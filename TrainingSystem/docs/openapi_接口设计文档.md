# 内部培训考试系统——OpenAPI 接口设计文档（初稿）

文档名称：内部培训考试系统 OpenAPI 接口设计文档  
版本号：v0.1  
日期：2026-03-09  
依据文档：PRD v2.0、总体架构设计文档 v0.1、详细数据模型设计文档 v0.1、状态机说明书 v0.1  
状态：接口初稿，可进入详细接口定义与代码生成阶段

---

# 1. 文档目标

本文档用于定义一期系统的核心 API 边界、资源模型、接口命名规范、请求响应结构、异步任务接口模式、幂等与错误处理规则，为以下工作提供基础：

1. FastAPI 路由与 Pydantic Schema 生成
2. 前端 API SDK 生成
3. OpenAPI YAML/JSON 正式文档产出
4. Claude / Cursor / Codex 的模块化代码生成
5. 接口级自动化测试编写

---

# 2. 接口设计原则

## 2.1 总体原则

1. 一期统一采用 **REST API**
2. 路径表达资源，HTTP Method 表达动作
3. 核心资源使用名词复数
4. 审核、发布、提交等动作用子资源或动作端点表示
5. 所有列表接口支持分页
6. 所有写操作必须经过服务层，不允许前端直接写状态
7. 所有异步任务统一返回 `task_id` 或 `job_id`
8. 所有关键接口返回结构统一

---

## 2.2 API 前缀

统一前缀：

```text
/api/v1
```

---

## 2.3 返回结构约定

### 成功响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

### 分页响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

### 失败响应

```json
{
  "code": "COURSE_STATUS_INVALID",
  "message": "当前课程状态不允许提交审核",
  "data": null,
  "request_id": "req_xxx"
}
```

---

## 2.4 通用请求头

### 认证
```http
Authorization: Bearer <access_token>
```

### 幂等键（关键写接口建议支持）
```http
Idempotency-Key: <uuid>
```

适用接口：

- 上传文档
- 创建课程生成任务
- 创建题目生成任务
- 提交审核
- 发布
- 开始考试
- 交卷

---

# 3. 认证与权限接口

---

## 3.1 登录

### `POST /api/v1/auth/login`

用途：用户名密码登录。

#### Request Body

```json
{
  "username": "trainer01",
  "password": "******"
}
```

#### Response

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "access_token": "jwt-token",
    "token_type": "Bearer",
    "expires_in": 7200,
    "user": {
      "id": "uuid",
      "username": "trainer01",
      "real_name": "张三",
      "roles": ["trainer"]
    }
  }
}
```

错误码：

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_USER_DISABLED`

---

## 3.2 获取当前用户信息

### `GET /api/v1/auth/me`

用途：返回当前登录用户及权限摘要。

#### Response

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "id": "uuid",
    "username": "trainer01",
    "real_name": "张三",
    "roles": ["trainer"],
    "permissions": ["document.upload", "course.generate"]
  }
}
```

---

## 3.3 退出登录

### `POST /api/v1/auth/logout`

用途：退出登录。  
说明：若采用纯 JWT，可做前端删除 token；若支持 refresh token，可在服务端失效化。

---

# 4. 用户、角色、部门接口

---

## 4.1 用户列表

### `GET /api/v1/users`

查询参数：

- `keyword`
- `status`
- `department_id`
- `page`
- `page_size`

#### Response Item

```json
{
  "id": "uuid",
  "username": "employee01",
  "real_name": "李四",
  "email": "test@example.com",
  "phone": "13800000000",
  "status": "active",
  "department": {
    "id": "uuid",
    "name": "技术部"
  },
  "roles": ["employee"],
  "created_at": "2026-03-09T10:00:00Z"
}
```

---

## 4.2 创建用户

### `POST /api/v1/users`

#### Request Body

```json
{
  "username": "employee01",
  "password": "Init@123456",
  "real_name": "李四",
  "email": "test@example.com",
  "phone": "13800000000",
  "department_ids": ["uuid"],
  "role_ids": ["uuid"]
}
```

错误码：

- `USER_USERNAME_DUPLICATE`
- `ROLE_NOT_FOUND`
- `DEPARTMENT_NOT_FOUND`

---

## 4.3 获取用户详情

### `GET /api/v1/users/{user_id}`

---

## 4.4 更新用户

### `PUT /api/v1/users/{user_id}`

---

## 4.5 停用/启用用户

### `POST /api/v1/users/{user_id}/enable`
### `POST /api/v1/users/{user_id}/disable`

---

## 4.6 角色列表

### `GET /api/v1/roles`

---

## 4.7 创建角色

### `POST /api/v1/roles`

---

## 4.8 配置角色权限

### `PUT /api/v1/roles/{role_id}/permissions`

#### Request Body

```json
{
  "permission_ids": ["uuid1", "uuid2"]
}
```

---

## 4.9 部门树查询

### `GET /api/v1/departments/tree`

---

## 4.10 创建部门

### `POST /api/v1/departments`

#### Request Body

```json
{
  "name": "培训部",
  "parent_id": "uuid"
}
```

---

# 5. 文档知识库接口

---

## 5.1 上传文档

### `POST /api/v1/documents/upload`

用途：上传单个文档并创建文档记录。

#### Content-Type
`multipart/form-data`

#### Form Fields

- `file`: 文件
- `title`: 可选
- `tags`: 可选，多值或 JSON 字符串

#### Response

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "document_id": "uuid",
    "document_version_id": "uuid",
    "parse_task_id": "uuid",
    "status": "parsing"
  }
}
```

错误码：

- `DOCUMENT_FILE_TOO_LARGE`
- `DOCUMENT_UNSUPPORTED_TYPE`
- `DOCUMENT_UPLOAD_FAILED`

幂等要求：
- 建议通过文件 hash + Idempotency-Key 做重复保护

---

## 5.2 批量上传文档

### `POST /api/v1/documents/batch-upload`

#### Response

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "accepted_count": 3,
    "rejected_count": 1,
    "items": [
      {
        "file_name": "a.pdf",
        "document_id": "uuid",
        "parse_task_id": "uuid"
      }
    ]
  }
}
```

---

## 5.3 文档列表

### `GET /api/v1/documents`

查询参数：

- `keyword`
- `status`
- `owner_id`
- `tag`
- `page`
- `page_size`

#### Response Item

```json
{
  "id": "uuid",
  "title": "安全培训手册",
  "status": "parsed",
  "source_type": "upload",
  "owner": {
    "id": "uuid",
    "real_name": "张三"
  },
  "current_version_no": 1,
  "created_at": "2026-03-09T10:00:00Z"
}
```

---

## 5.4 获取文档详情

### `GET /api/v1/documents/{document_id}`

#### Response

```json
{
  "id": "uuid",
  "title": "安全培训手册",
  "status": "parsed",
  "current_version": {
    "id": "uuid",
    "version_no": 1,
    "file_name": "安全培训手册.pdf",
    "file_size": 102400,
    "mime_type": "application/pdf"
  },
  "tags": ["安全", "培训"],
  "latest_parse_task": {
    "id": "uuid",
    "status": "succeeded"
  }
}
```

---

## 5.5 获取文档版本列表

### `GET /api/v1/documents/{document_id}/versions`

---

## 5.6 获取文档解析结果

### `GET /api/v1/documents/{document_id}/parsed-result`

#### Response

```json
{
  "document_id": "uuid",
  "document_version_id": "uuid",
  "status": "parsed",
  "structure": {
    "chapters": [
      {
        "title": "第一章",
        "level": 1
      }
    ]
  },
  "chunk_count": 28
}
```

---

## 5.7 获取文档分块列表

### `GET /api/v1/documents/{document_id}/chunks`

查询参数：

- `page`
- `page_size`
- `chapter_title`

---

## 5.8 重试文档解析

### `POST /api/v1/documents/{document_id}/retry-parse`

#### Response

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "parse_task_id": "uuid",
    "status": "processing"
  }
}
```

错误码：

- `DOCUMENT_STATUS_INVALID`
- `DOCUMENT_PARSE_RETRY_LIMIT_EXCEEDED`

---

## 5.9 归档文档

### `POST /api/v1/documents/{document_id}/archive`

---

## 5.10 文档预览地址

### `GET /api/v1/documents/{document_id}/preview-url`

#### Response

```json
{
  "preview_url": "https://..."
}
```

---

# 6. 知识点接口

---

## 6.1 候选知识点列表

### `GET /api/v1/knowledge-point-candidates`

查询参数：

- `document_id`
- `status`
- `page`
- `page_size`

#### Response Item

```json
{
  "id": "uuid",
  "candidate_name": "权限最小化原则",
  "candidate_description": "系统权限控制中的基本原则",
  "status": "pending",
  "confidence_score": 0.92,
  "source_chunk": {
    "id": "uuid",
    "content": "权限最小化原则要求..."
  }
}
```

---

## 6.2 接受候选知识点

### `POST /api/v1/knowledge-point-candidates/{candidate_id}/accept`

#### Request Body

```json
{
  "name": "权限最小化原则",
  "description": "系统权限控制中的基本原则",
  "parent_id": "uuid"
}
```

#### Response

```json
{
  "knowledge_point_id": "uuid",
  "candidate_status": "accepted"
}
```

---

## 6.3 忽略候选知识点

### `POST /api/v1/knowledge-point-candidates/{candidate_id}/ignore`

---

## 6.4 合并候选知识点到已有知识点

### `POST /api/v1/knowledge-point-candidates/{candidate_id}/merge`

#### Request Body

```json
{
  "target_knowledge_point_id": "uuid"
}
```

---

## 6.5 知识点列表

### `GET /api/v1/knowledge-points`

查询参数：

- `keyword`
- `status`
- `parent_id`
- `page`
- `page_size`

---

## 6.6 创建知识点

### `POST /api/v1/knowledge-points`

#### Request Body

```json
{
  "name": "权限最小化原则",
  "description": "系统权限控制中的基本原则",
  "parent_id": "uuid",
  "weight": 10
}
```

---

## 6.7 获取知识点详情

### `GET /api/v1/knowledge-points/{knowledge_point_id}`

---

## 6.8 更新知识点

### `PUT /api/v1/knowledge-points/{knowledge_point_id}`

---

## 6.9 停用知识点

### `POST /api/v1/knowledge-points/{knowledge_point_id}/deactivate`

---

## 6.10 启用知识点

### `POST /api/v1/knowledge-points/{knowledge_point_id}/activate`

---

## 6.11 合并知识点

### `POST /api/v1/knowledge-points/{knowledge_point_id}/merge`

#### Request Body

```json
{
  "target_knowledge_point_id": "uuid"
}
```

---

## 6.12 获取知识点引用情况

### `GET /api/v1/knowledge-points/{knowledge_point_id}/references`

#### Response

```json
{
  "documents_count": 5,
  "courses_count": 2,
  "questions_count": 18
}
```

---

# 7. 课程接口

---

## 7.1 课程列表

### `GET /api/v1/courses`

查询参数：

- `keyword`
- `status`
- `owner_id`
- `page`
- `page_size`

---

## 7.2 创建课程空白草稿

### `POST /api/v1/courses`

#### Request Body

```json
{
  "title": "网络安全入门课程"
}
```

---

## 7.3 获取课程详情

### `GET /api/v1/courses/{course_id}`

#### Response

```json
{
  "id": "uuid",
  "title": "网络安全入门课程",
  "status": "draft",
  "current_version_id": "uuid",
  "owner_id": "uuid",
  "created_at": "2026-03-09T10:00:00Z"
}
```

---

## 7.4 获取课程版本列表

### `GET /api/v1/courses/{course_id}/versions`

---

## 7.5 获取课程版本详情

### `GET /api/v1/course-versions/{course_version_id}`

#### Response

```json
{
  "id": "uuid",
  "course_id": "uuid",
  "version_no": 2,
  "status": "draft",
  "title": "网络安全入门课程",
  "summary": "课程摘要",
  "chapter_count": 5,
  "chapters": [
    {
      "id": "uuid",
      "chapter_no": 1,
      "title": "第一章 基本概念",
      "content": "markdown content"
    }
  ]
}
```

---

## 7.6 生成课程草稿

### `POST /api/v1/courses/generate`

用途：发起课程生成任务。

#### Request Body

```json
{
  "title": "网络安全入门课程",
  "input_type": "knowledge_points",
  "knowledge_point_ids": ["uuid1", "uuid2"],
  "document_ids": [],
  "config": {
    "chapter_count_min": 5,
    "chapter_count_max": 8,
    "knowledge_points_per_chapter_min": 3,
    "knowledge_points_per_chapter_max": 5,
    "case_ratio": 0.2
  }
}
```

#### Response

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "course_id": "uuid",
    "generation_task_id": "uuid",
    "status": "processing"
  }
}
```

错误码：

- `COURSE_GENERATE_INPUT_EMPTY`
- `KNOWLEDGE_POINT_NOT_FOUND`
- `DOCUMENT_NOT_FOUND`

---

## 7.7 查询课程生成任务

### `GET /api/v1/course-generation-tasks/{task_id}`

#### Response

```json
{
  "id": "uuid",
  "status": "succeeded",
  "course_id": "uuid",
  "result_version_id": "uuid",
  "error_message": null
}
```

---

## 7.8 更新课程版本

### `PUT /api/v1/course-versions/{course_version_id}`

#### Request Body

```json
{
  "title": "网络安全入门课程-修订版",
  "summary": "修订后的摘要",
  "chapters": [
    {
      "id": "uuid",
      "chapter_no": 1,
      "title": "第一章 基本概念",
      "content": "updated markdown content",
      "estimated_duration_minutes": 20
    }
  ]
}
```

错误码：

- `COURSE_VERSION_STATUS_NOT_EDITABLE`

---

## 7.9 新建课程版本（从已发布/已审核版本复制）

### `POST /api/v1/courses/{course_id}/versions/copy`

#### Request Body

```json
{
  "source_version_id": "uuid"
}
```

---

## 7.10 提交课程审核

### `POST /api/v1/course-versions/{course_version_id}/submit-review`

#### Request Body

```json
{
  "review_stage": "initial"
}
```

#### Response

```json
{
  "review_task_id": "uuid",
  "status": "pending_review"
}
```

错误码：

- `COURSE_STATUS_INVALID`
- `COURSE_VERSION_EMPTY`

---

## 7.11 获取课程版本对比

### `GET /api/v1/course-versions/compare`

查询参数：

- `left_version_id`
- `right_version_id`

---

# 8. 题库接口

---

## 8.1 题目列表

### `GET /api/v1/questions`

查询参数：

- `keyword`
- `status`
- `question_type`
- `knowledge_point_id`
- `page`
- `page_size`

---

## 8.2 获取题目详情

### `GET /api/v1/questions/{question_id}`

---

## 8.3 获取题目版本详情

### `GET /api/v1/question-versions/{question_version_id}`

#### Response

```json
{
  "id": "uuid",
  "question_id": "uuid",
  "version_no": 1,
  "status": "draft",
  "question_type": "single",
  "stem": "以下哪个属于最小权限原则？",
  "options": [
    {
      "option_key": "A",
      "option_text": "只给用户完成工作所需权限",
      "is_correct": true
    }
  ],
  "analysis": "最小权限原则要求...",
  "difficulty_level": 2
}
```

---

## 8.4 生成题目草稿

### `POST /api/v1/questions/generate`

#### Request Body

```json
{
  "knowledge_point_ids": ["uuid1", "uuid2"],
  "question_types": ["single", "multi", "judge", "fill"],
  "config": {
    "min_questions_per_knowledge_point": 3,
    "difficulty_distribution": {
      "easy": 0.3,
      "medium": 0.5,
      "hard": 0.2
    }
  }
}
```

#### Response

```json
{
  "generation_task_id": "uuid",
  "status": "processing"
}
```

---

## 8.5 查询题目生成任务

### `GET /api/v1/question-generation-tasks/{task_id}`

---

## 8.6 更新题目版本

### `PUT /api/v1/question-versions/{question_version_id}`

#### Request Body

```json
{
  "stem": "修订后的题干",
  "options": [
    {
      "option_key": "A",
      "option_text": "选项A",
      "is_correct": true
    }
  ],
  "answer_json": {
    "correct_options": ["A"]
  },
  "analysis": "解析内容",
  "difficulty_level": 3,
  "knowledge_point_ids": ["uuid1"]
}
```

---

## 8.7 批量提交题目审核

### `POST /api/v1/question-versions/submit-review`

#### Request Body

```json
{
  "question_version_ids": ["uuid1", "uuid2"],
  "review_stage": "initial"
}
```

#### Response

```json
{
  "created_review_task_count": 2
}
```

---

## 8.8 获取题目相似度提示

### `GET /api/v1/question-versions/{question_version_id}/similarities`

#### Response

```json
{
  "items": [
    {
      "similar_question_version_id": "uuid",
      "similarity_score": 0.92
    }
  ]
}
```

---

## 8.9 复制题目版本

### `POST /api/v1/questions/{question_id}/versions/copy`

---

# 9. 审核接口

---

## 9.1 审核任务列表

### `GET /api/v1/review-tasks`

查询参数：

- `status`
- `review_stage`
- `content_type`
- `assigned_reviewer_id`
- `page`
- `page_size`

---

## 9.2 获取审核任务详情

### `GET /api/v1/review-tasks/{review_task_id}`

#### Response

```json
{
  "id": "uuid",
  "content_type": "course",
  "content_id": "uuid",
  "content_version_id": "uuid",
  "review_stage": "initial",
  "status": "pending",
  "assigned_reviewer": {
    "id": "uuid",
    "real_name": "审核专家A"
  },
  "comments": []
}
```

---

## 9.3 开始处理审核任务

### `POST /api/v1/review-tasks/{review_task_id}/start`

---

## 9.4 添加审核意见

### `POST /api/v1/review-tasks/{review_task_id}/comments`

#### Request Body

```json
{
  "comment_type": "inline",
  "target_path": "chapters[0].content",
  "content": "这一段建议补充定义",
  "action_suggestion": "modify"
}
```

---

## 9.5 审核通过

### `POST /api/v1/review-tasks/{review_task_id}/approve`

#### Request Body

```json
{
  "result_summary": "内容完整，可进入下一阶段"
}
```

错误码：

- `REVIEW_TASK_STATUS_INVALID`
- `REVIEW_PERMISSION_DENIED`

---

## 9.6 审核驳回

### `POST /api/v1/review-tasks/{review_task_id}/reject`

#### Request Body

```json
{
  "result_summary": "题目答案存在歧义，需要修改"
}
```

---

## 9.7 退回修改

### `POST /api/v1/review-tasks/{review_task_id}/return`

#### Request Body

```json
{
  "result_summary": "课程结构基本正确，但第三章需要细化"
}
```

---

## 9.8 审核历史

### `GET /api/v1/review-tasks/history`

查询参数：

- `content_type`
- `content_id`

---

# 10. 发布接口

---

## 10.1 发布课程版本

### `POST /api/v1/publish/course-versions/{course_version_id}`

#### Request Body

```json
{
  "publish_scope_type": "department",
  "publish_scope": {
    "department_ids": ["uuid1", "uuid2"]
  },
  "effective_at": "2026-03-10T09:00:00Z",
  "reason": "一期正式发布"
}
```

#### Response

```json
{
  "publish_record_id": "uuid",
  "status": "scheduled"
}
```

错误码：

- `PUBLISH_STATUS_INVALID`
- `COURSE_NOT_APPROVED`

---

## 10.2 发布题目版本集合

### `POST /api/v1/publish/question-versions`

#### Request Body

```json
{
  "question_version_ids": ["uuid1", "uuid2"],
  "effective_at": "2026-03-10T09:00:00Z",
  "reason": "题库发布"
}
```

---

## 10.3 发布记录列表

### `GET /api/v1/publish-records`

---

## 10.4 获取发布记录详情

### `GET /api/v1/publish-records/{publish_record_id}`

---

## 10.5 回滚发布

### `POST /api/v1/publish-records/{publish_record_id}/rollback`

#### Request Body

```json
{
  "reason": "发现发布内容有误"
}
```

---

# 11. 培训任务接口

---

## 11.1 培训任务列表

### `GET /api/v1/training-tasks`

查询参数：

- `status`
- `keyword`
- `page`
- `page_size`

---

## 11.2 创建培训任务

### `POST /api/v1/training-tasks`

#### Request Body

```json
{
  "title": "网络安全月培训",
  "description": "针对全员的网络安全培训",
  "course_version_id": "uuid",
  "exam_id": "uuid",
  "due_at": "2026-03-31T23:59:59Z",
  "allow_makeup_exam": true,
  "makeup_exam_limit": 1,
  "notify_enabled": true,
  "assignments": {
    "user_ids": ["uuid1"],
    "department_ids": ["uuid2"]
  }
}
```

---

## 11.3 获取培训任务详情

### `GET /api/v1/training-tasks/{training_task_id}`

---

## 11.4 更新培训任务

### `PUT /api/v1/training-tasks/{training_task_id}`

限制：
- 已发布后部分字段不可修改，如课程版本、考试对象等

---

## 11.5 发布培训任务

### `POST /api/v1/training-tasks/{training_task_id}/publish`

---

## 11.6 取消培训任务

### `POST /api/v1/training-tasks/{training_task_id}/cancel`

#### Request Body

```json
{
  "reason": "培训计划调整"
}
```

---

## 11.7 培训任务分配列表

### `GET /api/v1/training-tasks/{training_task_id}/assignments`

查询参数：

- `assignment_status`
- `user_id`
- `page`
- `page_size`

---

## 11.8 我的培训任务列表

### `GET /api/v1/my/training-tasks`

查询参数：

- `assignment_status`
- `page`
- `page_size`

---

# 12. 学习进度接口

---

## 12.1 获取我的课程学习进度

### `GET /api/v1/my/training-tasks/{training_task_id}/study-progress`

---

## 12.2 更新学习进度

### `PUT /api/v1/my/training-tasks/{training_task_id}/study-progress`

#### Request Body

```json
{
  "progress_percent": 35,
  "last_position": {
    "chapter_id": "uuid",
    "offset": 1200
  },
  "completed": false
}
```

说明：
- 前端可定时上报
- 服务端需做范围校验，防止进度非法跳跃过大

---

## 12.3 完成课程学习

### `POST /api/v1/my/training-tasks/{training_task_id}/complete-study`

---

# 13. 考试接口

---

## 13.1 考试列表

### `GET /api/v1/exams`

---

## 13.2 创建考试

### `POST /api/v1/exams`

#### Request Body

```json
{
  "title": "网络安全考试",
  "description": "课程配套考试",
  "exam_mode": "fixed_paper",
  "duration_minutes": 60,
  "total_score": 100,
  "pass_score": 60,
  "paper_id": "uuid",
  "start_at": "2026-03-20T09:00:00Z",
  "end_at": "2026-03-31T23:59:59Z"
}
```

---

## 13.3 获取考试详情

### `GET /api/v1/exams/{exam_id}`

---

## 13.4 创建试卷

### `POST /api/v1/exam-papers`

#### Request Body

```json
{
  "title": "网络安全固定试卷A",
  "paper_type": "fixed",
  "question_items": [
    {
      "question_version_id": "uuid",
      "score": 5,
      "sort_order": 1
    }
  ]
}
```

---

## 13.5 获取试卷详情

### `GET /api/v1/exam-papers/{paper_id}`

---

## 13.6 我的考试入口详情

### `GET /api/v1/my/exams/{exam_id}`

#### Response

```json
{
  "exam_id": "uuid",
  "title": "网络安全考试",
  "status": "scheduled",
  "duration_minutes": 60,
  "attempt_summary": {
    "has_unfinished_attempt": false,
    "latest_attempt_id": null,
    "remaining_makeup_count": 1
  }
}
```

---

## 13.7 开始考试

### `POST /api/v1/my/exams/{exam_id}/start`

#### Request Body

```json
{
  "training_task_id": "uuid"
}
```

#### Response

```json
{
  "attempt_id": "uuid",
  "status": "ongoing",
  "started_at": "2026-03-10T09:00:00Z",
  "duration_minutes": 60
}
```

幂等要求：
- 若存在未完成 attempt，应返回原 attempt，而不是重复创建

错误码：

- `EXAM_NOT_AVAILABLE`
- `EXAM_ALREADY_FINISHED`
- `EXAM_ATTEMPT_LIMIT_EXCEEDED`

---

## 13.8 获取考试作答详情

### `GET /api/v1/my/exam-attempts/{attempt_id}`

#### Response

```json
{
  "attempt_id": "uuid",
  "status": "ongoing",
  "remaining_seconds": 3200,
  "questions": [
    {
      "question_id": "uuid",
      "question_version_id": "uuid",
      "question_type": "single",
      "stem": "题干",
      "options": [
        {
          "option_key": "A",
          "option_text": "选项A"
        }
      ],
      "score": 5,
      "my_answer": null
    }
  ]
}
```

---

## 13.9 保存答案（自动保存）

### `PUT /api/v1/my/exam-attempts/{attempt_id}/answers/{question_id}`

#### Request Body

```json
{
  "answer_json": {
    "selected_options": ["A"]
  }
}
```

说明：
- 可频繁调用
- 服务端只更新当前题答案，不触发提交

---

## 13.10 批量保存答案

### `PUT /api/v1/my/exam-attempts/{attempt_id}/answers`

#### Request Body

```json
{
  "answers": [
    {
      "question_id": "uuid1",
      "answer_json": {
        "selected_options": ["A"]
      }
    }
  ]
}
```

---

## 13.11 上报切屏/监考事件

### `POST /api/v1/my/exam-attempts/{attempt_id}/proctoring-events`

#### Request Body

```json
{
  "event_type": "visibility_hidden",
  "event_payload": {
    "ts": 1710000000
  }
}
```

---

## 13.12 提交试卷

### `POST /api/v1/my/exam-attempts/{attempt_id}/submit`

#### Request Body

```json
{
  "force_submit": true
}
```

#### Response

```json
{
  "attempt_id": "uuid",
  "status": "submitted",
  "auto_grading_started": true
}
```

幂等要求：
- 已提交状态重复提交，返回第一次有效提交结果

错误码：

- `EXAM_ATTEMPT_STATUS_INVALID`
- `EXAM_SUBMIT_TIMEOUT`

---

## 13.13 获取考试结果

### `GET /api/v1/my/exam-attempts/{attempt_id}/result`

#### Response

```json
{
  "attempt_id": "uuid",
  "status": "finished",
  "objective_score": 70,
  "subjective_score": 0,
  "total_score": 70,
  "pass_result": true,
  "answers": [
    {
      "question_id": "uuid",
      "is_correct": true,
      "score": 5,
      "analysis": "解析内容"
    }
  ]
}
```

---

## 13.14 我的成绩列表

### `GET /api/v1/my/scores`

---

# 14. 统计与审计接口

---

## 14.1 培训统计概览

### `GET /api/v1/stats/training-overview`

查询参数：

- `training_task_id`

#### Response

```json
{
  "training_task_id": "uuid",
  "assigned_count": 100,
  "completed_count": 78,
  "overdue_count": 5,
  "completion_rate": 0.78
}
```

---

## 14.2 学习进度分布

### `GET /api/v1/stats/study-progress-distribution`

---

## 14.3 成绩分布

### `GET /api/v1/stats/exam-score-distribution`

---

## 14.4 审计日志列表

### `GET /api/v1/audit-logs`

查询参数：

- `operator_id`
- `resource_type`
- `resource_id`
- `action`
- `start_time`
- `end_time`
- `page`
- `page_size`

#### Response Item

```json
{
  "id": "uuid",
  "operator": {
    "id": "uuid",
    "real_name": "管理员"
  },
  "action": "course.submit_review",
  "resource_type": "course_version",
  "resource_id": "uuid",
  "created_at": "2026-03-09T10:00:00Z"
}
```

---

# 15. 异步任务接口

一期建议提供统一任务查询接口，便于前端轮询和运维排障。

---

## 15.1 异步任务列表

### `GET /api/v1/async-jobs`

查询参数：

- `job_type`
- `biz_type`
- `biz_id`
- `status`
- `page`
- `page_size`

---

## 15.2 异步任务详情

### `GET /api/v1/async-jobs/{job_id}`

#### Response

```json
{
  "id": "uuid",
  "job_type": "course_generate",
  "biz_type": "course",
  "biz_id": "uuid",
  "status": "succeeded",
  "retry_count": 0,
  "error_message": null,
  "queued_at": "2026-03-09T10:00:00Z",
  "started_at": "2026-03-09T10:00:05Z",
  "finished_at": "2026-03-09T10:00:20Z"
}
```

---

## 15.3 重试异步任务

### `POST /api/v1/async-jobs/{job_id}/retry`

错误码：

- `ASYNC_JOB_STATUS_INVALID`
- `ASYNC_JOB_RETRY_LIMIT_EXCEEDED`

---

# 16. 核心数据 Schema 草案

本节不是最终 OpenAPI JSON Schema，而是供 agent 落地时参考的核心对象结构。

---

## 16.1 UserSummary

```json
{
  "id": "uuid",
  "username": "string",
  "real_name": "string"
}
```

---

## 16.2 DepartmentSummary

```json
{
  "id": "uuid",
  "name": "string"
}
```

---

## 16.3 DocumentSummary

```json
{
  "id": "uuid",
  "title": "string",
  "status": "uploaded|parsing|parsed|failed|archived",
  "created_at": "datetime"
}
```

---

## 16.4 KnowledgePointSummary

```json
{
  "id": "uuid",
  "name": "string",
  "status": "draft|active|inactive|merged"
}
```

---

## 16.5 CourseVersionDetail

```json
{
  "id": "uuid",
  "course_id": "uuid",
  "version_no": 1,
  "status": "draft|ai_generated|pending_review|in_review|approved|rejected|published|archived",
  "title": "string",
  "summary": "string",
  "chapters": [
    {
      "id": "uuid",
      "chapter_no": 1,
      "title": "string",
      "content": "string",
      "estimated_duration_minutes": 20
    }
  ]
}
```

---

## 16.6 QuestionVersionDetail

```json
{
  "id": "uuid",
  "question_id": "uuid",
  "version_no": 1,
  "status": "draft|ai_generated|pending_review|in_review|approved|rejected|published|archived",
  "question_type": "single|multi|judge|fill|short|case",
  "stem": "string",
  "options": [],
  "answer_json": {},
  "analysis": "string",
  "difficulty_level": 3
}
```

---

## 16.7 ReviewTaskDetail

```json
{
  "id": "uuid",
  "content_type": "course|question",
  "content_id": "uuid",
  "content_version_id": "uuid",
  "review_stage": "initial|final",
  "status": "pending|processing|approved|rejected|returned",
  "comments": []
}
```

---

## 16.8 ExamAttemptDetail

```json
{
  "attempt_id": "uuid",
  "status": "scheduled|ongoing|submitted|auto_graded|manual_grading|finished|cancelled",
  "started_at": "datetime",
  "submitted_at": "datetime|null",
  "remaining_seconds": 3200,
  "questions": []
}
```

---

# 17. 错误码规范

---

## 17.1 错误码命名规则

格式：

```text
<DOMAIN>_<ERROR_NAME>
```

示例：

- `AUTH_INVALID_CREDENTIALS`
- `DOCUMENT_UNSUPPORTED_TYPE`
- `COURSE_STATUS_INVALID`
- `REVIEW_PERMISSION_DENIED`
- `EXAM_ATTEMPT_LIMIT_EXCEEDED`

---

## 17.2 建议错误码域

- `AUTH_*`
- `USER_*`
- `ROLE_*`
- `DEPARTMENT_*`
- `DOCUMENT_*`
- `KNOWLEDGE_POINT_*`
- `COURSE_*`
- `QUESTION_*`
- `REVIEW_*`
- `PUBLISH_*`
- `TRAINING_*`
- `EXAM_*`
- `ASYNC_JOB_*`
- `SYSTEM_*`

---

# 18. 幂等与并发控制要求

---

## 18.1 必须幂等的接口

1. `POST /documents/upload`
2. `POST /courses/generate`
3. `POST /questions/generate`
4. `POST /course-versions/{id}/submit-review`
5. `POST /question-versions/submit-review`
6. `POST /publish/...`
7. `POST /my/exams/{exam_id}/start`
8. `POST /my/exam-attempts/{attempt_id}/submit`

---

## 18.2 并发控制建议

1. 课程版本更新使用 `updated_at` 或版本号进行乐观锁控制
2. 题目版本更新使用乐观锁控制
3. 审核任务处理时校验当前状态，防止重复审核
4. 交卷时锁定 attempt，防止重复评分

---

# 19. 接口与状态机的一致性要求

1. 所有提交审核接口必须校验版本状态是否允许提交  
2. 所有发布接口必须校验内容是否已审核通过  
3. 所有考试开始接口必须校验考试是否可用、次数是否超限  
4. 所有交卷接口必须校验 attempt 是否处于 ongoing  
5. 所有重试任务接口必须校验任务是否允许重试

---

# 20. 面向 agent 的拆分建议

建议不要让 agent 一次生成全部接口。  
推荐按以下顺序分批生成：

## 第一批：基础底座
- auth
- users
- roles
- departments

## 第二批：知识库
- documents
- document parse tasks
- knowledge point candidates
- knowledge points

## 第三批：内容生产
- courses
- course versions
- course generation tasks
- questions
- question versions
- question generation tasks

## 第四批：审核发布
- review tasks
- review comments
- publish records

## 第五批：培训考试
- training tasks
- study progress
- exams
- exam papers
- exam attempts
- exam answers
- scores

## 第六批：支撑
- async jobs
- audit logs
- stats

---

# 21. 后续文档建议

基于本接口文档，下一步应继续输出：

1. **前端页面规格文档**
2. **正式 OpenAPI YAML**
3. **FastAPI Pydantic Schema 清单**
4. **数据库 DDL 设计文档**
5. **面向 agent 的开发任务拆分文档**

---

# 22. 结论

到这里为止，系统的四层骨架已经齐了：

1. PRD  
2. 总体架构  
3. 数据模型 + 状态机  
4. OpenAPI 接口草案  

这时再让 agent 开发，已经不是“猜着写”，而是“按规格实现”。

下一步最顺的是继续补：

**《前端页面规格文档》**  

因为接口已经有了，页面、路由、表单、状态展示、按钮权限就可以钉死了。
