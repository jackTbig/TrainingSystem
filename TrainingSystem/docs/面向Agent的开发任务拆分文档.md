# 内部培训考试系统——面向 Agent 的开发任务拆分文档（初稿）

文档名称：内部培训考试系统 Agent 开发任务拆分文档  
版本号：v0.1  
日期：2026-03-09  
依据文档：PRD v2.0、总体架构设计文档、数据模型、状态机、OpenAPI 接口文档、前端页面规格文档  
状态：可直接用于 Claude / Cursor / Codex 分阶段开发

---

# 1. 文档目标

本文档不是技术设计文档，而是 **把系统拆成 AI agent 可以稳定执行的小任务单元**。

目的：

1. 避免 agent 一次生成全系统导致上下文污染
2. 降低模块耦合导致的错误扩散
3. 建立“先底座、后业务、最后联调”的开发顺序
4. 让每个任务都具备明确输入 / 输出 / 验收边界
5. 支持多人并行或多 agent 并行

---

# 2. 为什么必须拆分

AI agent 最大问题：

不是不会写代码，而是：

**上下文一长，就开始猜。**

典型失败模式：

```text
PRD → 一次生成全部系统
```

结果：

1. 模块命名不统一
2. 数据结构漂移
3. 状态机失真
4. API 对不上
5. 页面与后端脱节
6. 测试缺失

正确方式：

```text
架构 → 模块 → 子模块 → 单任务
```

每次只让 agent 做一个稳定边界。

---

# 3. 总体拆分原则

---

## 3.1 一个任务只做一件事

错误：

```text
生成课程模块（含数据库、接口、页面、审核）
```

正确：

```text
先生成 course 表 + repository + schema + service
```

---

## 3.2 每个任务必须定义输入和输出

否则 agent 会自己补。

---

## 3.3 每个任务必须可单独验证

必须做到：

```text
任务完成 → 可以跑 → 可以测 → 再继续
```

---

## 3.4 优先做“被依赖模块”

顺序：

```text
基础设施 > 核心对象 > 状态流 > 页面
```

---

# 4. 总体任务树

---

```text
Phase 0 基础工程
Phase 1 基础权限系统
Phase 2 文档知识库
Phase 3 知识点系统
Phase 4 课程系统
Phase 5 题库系统
Phase 6 审核系统
Phase 7 发布系统
Phase 8 培训系统
Phase 9 考试系统
Phase 10 前端页面
Phase 11 测试与运维
```

---

# 5. Phase 0 基础工程

---

# Task 0.1 初始化 monorepo 工程

## 输入

技术约束：

```yaml
frontend: React18 + TS + Vite + AntD
backend: FastAPI
database: PostgreSQL
cache: Redis
queue: RabbitMQ
```

## 输出

```text
frontend/
backend/
infra/
docs/
```

## 必须产出

### frontend
- package.json
- vite.config.ts
- src/

### backend
- app/
- requirements.txt
- main.py

### infra
- docker-compose.yml

## 验收

```bash
docker compose up
```

全部容器能启动。

---

# Task 0.2 后端基础目录生成

## 输出目录

```text
backend/app/
  api/
  schemas/
  models/
  repositories/
  services/
  tasks/
  core/
```

## 要求

1. FastAPI router 自动注册
2. SQLAlchemy 初始化
3. Alembic 初始化
4. Redis client
5. RabbitMQ client

---

# Task 0.3 前端基础骨架生成

## 输出

```text
src/
  layouts/
  router/
  pages/
  components/
  store/
  api/
```

## 必须具备

1. 登录页
2. Layout
3. Menu
4. Route Guard
5. Axios 封装

---

# 6. Phase 1 基础权限系统

---

# Task 1.1 用户表模型

## 输入

数据模型：

```sql
users
roles
permissions
user_roles
role_permissions
departments
user_departments
```

## 输出

### models
- user.py
- role.py
- permission.py
- department.py

### alembic migration

## 验收

数据库迁移成功。

---

# Task 1.2 用户接口

## 输出

```text
GET /users
POST /users
PUT /users/{id}
```

## 要求

1. Pydantic schema
2. service
3. repository
4. router

## 验收

Swagger 可调用。

---

# Task 1.3 登录认证

## 输出

```text
POST /auth/login
GET /auth/me
```

## 要求

JWT。

## 验收

登录成功返回 token。

---

# Task 1.4 前端登录页 + 权限路由

## 输出

1. 登录页
2. token 保存
3. 路由守卫
4. 当前用户状态

---

# 7. Phase 2 文档知识库

---

# Task 2.1 文档表模型

## 输出

```text
documents
document_versions
document_parse_tasks
document_chunks
```

---

# Task 2.2 上传接口

## 输出

```text
POST /documents/upload
```

## 要求

1. multipart
2. 文件存储
3. metadata 写库

## 验收

上传成功返回 document_id。

---

# Task 2.3 文档解析任务

## 输出

1. RabbitMQ consumer
2. parse task state update

## 要求

解析流程：

```text
upload → parse → chunk → embedding
```

---

# Task 2.4 文档列表页

## 输出

1. 文档表格
2. 上传弹窗
3. 状态标签

---

# 8. Phase 3 知识点系统

---

# Task 3.1 候选知识点模型

## 输出

```text
knowledge_point_candidates
knowledge_points
knowledge_point_relations
```

---

# Task 3.2 候选知识点接口

## 输出

```text
GET /knowledge-point-candidates
POST /accept
POST /ignore
POST /merge
```

---

# Task 3.3 知识点列表页

## 输出

1. 列表
2. 合并弹窗
3. 状态切换

---

# 9. Phase 4 课程系统

---

# Task 4.1 课程模型

## 输出

```text
courses
course_versions
course_chapters
course_generation_tasks
```

---

# Task 4.2 课程生成接口

## 输出

```text
POST /courses/generate
GET /course-generation-tasks/{id}
```

## 要求

异步任务。

---

# Task 4.3 课程编辑接口

## 输出

```text
GET /course-versions/{id}
PUT /course-versions/{id}
```

---

# Task 4.4 课程编辑页

## 输出

1. 左目录
2. 中编辑器
3. 右辅助信息

---

# Task 4.5 课程状态机校验

## 要求

状态：

```text
draft → ai_generated → pending_review → in_review → approved → published
```

必须 service 层校验。

---

# 10. Phase 5 题库系统

---

# Task 5.1 题目模型

## 输出

```text
questions
question_versions
question_generation_tasks
```

---

# Task 5.2 题目生成接口

## 输出

```text
POST /questions/generate
```

---

# Task 5.3 题目编辑页

## 输出

1. 题干
2. 选项
3. 答案
4. 解析

---

# Task 5.4 相似题检测接口

## 输出

```text
GET /question-versions/{id}/similarities
```

---

# 11. Phase 6 审核系统

---

# Task 6.1 审核模型

## 输出

```text
review_tasks
review_comments
review_actions
```

---

# Task 6.2 审核接口

## 输出

```text
approve
reject
return
```

---

# Task 6.3 审核页

## 输出

1. 来源对照
2. 内容区
3. 意见区

---

# 12. Phase 7 发布系统

---

# Task 7.1 发布模型

## 输出

```text
publish_records
publish_targets
```

---

# Task 7.2 发布接口

## 输出

```text
publish
rollback
```

---

# Task 7.3 发布页

## 输出

1. 发布记录列表
2. 回滚按钮

---

# 13. Phase 8 培训系统

---

# Task 8.1 培训任务模型

## 输出

```text
training_tasks
training_assignments
study_progress
```

---

# Task 8.2 培训任务接口

## 输出

```text
create
publish
cancel
```

---

# Task 8.3 培训任务页

## 输出

1. 列表
2. 创建弹窗
3. 分配页

---

# 14. Phase 9 考试系统

---

# Task 9.1 考试模型

## 输出

```text
exams
exam_papers
exam_attempts
exam_answers
exam_scores
```

---

# Task 9.2 开始考试接口

## 输出

```text
POST /my/exams/{id}/start
```

---

# Task 9.3 答题接口

## 输出

```text
PUT /answers
POST /submit
```

---

# Task 9.4 考试页

## 输出

1. 倒计时
2. 题号导航
3. 自动保存

---

# Task 9.5 自动阅卷

## 输出

客观题评分 service。

---

# 15. Phase 10 前端页面总装

---

# Task 10.1 管理端菜单接通

---

# Task 10.2 所有列表页统一 SearchForm

---

# Task 10.3 状态标签统一组件

---

# Task 10.4 权限按钮组件

---

# Task 10.5 全局异常处理

---

# 16. Phase 11 测试与运维

---

# Task 11.1 API 自动测试

## 输出

pytest。

---

# Task 11.2 前端 E2E

## 输出

playwright。

---

# Task 11.3 Docker 生产化

## 输出

多环境 compose。

---

# Task 11.4 CI/CD

## 输出

GitLab pipeline。

---

# 17. 每个任务给 agent 的标准提示模板

---

```text
请只完成 Task 4.2：

输入：
- 已存在 FastAPI 工程
- 已存在 PostgreSQL 和 SQLAlchemy

要求：
1. 实现 courses/generate 接口
2. 建立 generation_task 表写入
3. 返回 task_id
4. 不实现 LLM，只写任务骨架
5. 输出 router + service + schema + migration + test

禁止：
1. 修改其他模块
2. 不新增前端代码
3. 不生成无关文件
```

---

# 18. Agent 最容易犯错的地方

---

## 不要一次让 agent：

```text
实现课程系统
```

必须：

```text
只实现 course_versions update service
```

---

## 不要允许 agent 改动未知模块

必须明确：

```text
只修改以下文件
```

---

## 每次任务必须要求输出：

```text
涉及文件清单
```

---

# 19. 推荐开发节奏

---

## 每完成一任务：

1. 本地运行
2. Swagger 检查
3. 页面联调
4. 提交 git

然后再下一任务。

---

# 20. 结论

现在你已经有：

1. PRD
2. 架构
3. 数据模型
4. 状态机
5. API
6. 页面规格
7. Agent 任务拆分

这时 Claude / Cursor / Codex 已经可以进入稳定开发。

下一步真正关键的是：

**《数据库DDL + Alembic迁移文档》**

因为一旦 DDL 钉死，整个系统才不会漂。
