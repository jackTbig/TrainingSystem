# 内部培训考试系统——FastAPI 工程目录与模块骨架文档（初稿）

文档名称：内部培训考试系统 FastAPI 工程目录与模块骨架文档  
版本号：v0.1  
日期：2026-03-09  
适用技术栈：FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL + Redis + RabbitMQ  
状态：可直接指导 Claude / Cursor / Codex 生成第一批后端代码

---

# 1. 文档目标

本文档用于把前面所有设计文档，落到 **真正可生成代码的后端工程骨架**。

目标：

1. 固定 backend 目录结构
2. 固定模块边界
3. 固定每层职责
4. 固定命名规则
5. 固定 router 注册方式
6. 固定依赖注入方式
7. 固定事务边界
8. 固定异常处理模式

如果没有这一层，AI agent 最容易出现：

- 所有逻辑塞进 router
- schema 和 model 混写
- service 失控
- repository 缺失
- 文件命名混乱
- 模块无法持续扩展

---

# 2. backend 顶层目录

---

```text
backend/
├── app/
├── alembic/
├── tests/
├── scripts/
├── requirements.txt
├── pyproject.toml
├── alembic.ini
├── Dockerfile
├── .env.example
└── main.py
```

---

## 目录职责

---

### app
业务代码主体。

---

### alembic
数据库迁移。

---

### tests
自动化测试。

---

### scripts
初始化脚本、数据导入脚本。

---

### main.py
FastAPI 启动入口。

---

# 3. app 主目录结构

---

```text
app/
├── api/
├── schemas/
├── models/
├── repositories/
├── services/
├── tasks/
├── core/
├── db/
├── utils/
├── enums/
├── constants/
└── exceptions/
```

---

# 4. 每层职责（最关键）

---

# 4.1 api 层

只负责：

1. 接收请求
2. 参数校验
3. 调 service
4. 返回 response

禁止：

- 写业务规则
- 写数据库查询

---

## 示例

错误：

```python
router.post(...)
直接 session.query(...)
```

正确：

```python
router -> service -> repository
```

---

# 4.2 service 层

负责：

1. 状态机校验
2. 权限校验
3. 业务流程
4. 事务边界

禁止：

- 写复杂 SQL

---

# 4.3 repository 层

负责：

1. 所有数据库访问
2. ORM 查询
3. 聚合查询

禁止：

- 状态机逻辑

---

# 4.4 schema 层

负责：

1. Request schema
2. Response schema

禁止：

- ORM model 混入

---

# 4.5 model 层

负责：

SQLAlchemy ORM。

---

# 4.6 tasks 层

负责：

异步任务。

---

# 4.7 core 层

负责：

系统基础设施。

---

---

# 5. api 目录结构

---

```text
app/api/
├── deps.py
├── router.py
└── v1/
```

---

# 5.1 v1 模块结构

---

```text
app/api/v1/
├── auth/
├── users/
├── roles/
├── departments/
├── documents/
├── knowledge_points/
├── courses/
├── questions/
├── reviews/
├── publish/
├── training/
├── exams/
├── stats/
├── audit/
└── async_jobs/
```

---

# 5.2 每个模块固定结构

例如 users：

```text
users/
├── router.py
├── schema.py
├── service.py
├── repository.py
└── __init__.py
```

---

## 原则

模块内只放模块相关代码。

不要：

```text
users_service.py 放到 services 根目录
```

否则后期爆炸。

---

# 6. models 目录结构

---

```text
app/models/
├── base.py
├── user.py
├── role.py
├── permission.py
├── department.py
├── document.py
├── knowledge_point.py
├── course.py
├── question.py
├── review.py
├── publish.py
├── training.py
├── exam.py
├── audit.py
├── async_job.py
└── __init__.py
```

---

# 6.1 base.py

必须统一：

```python
DeclarativeBase
UUIDMixin
TimestampMixin
```

---

## 建议 mixin

---

### UUIDMixin

```python
id = mapped_column(UUID(as_uuid=True), primary_key=True)
```

---

### TimestampMixin

```python
created_at
updated_at
```

---

这样 agent 不会每张表重复写错。

---

# 7. schemas 目录结构

---

```text
app/schemas/
├── common.py
├── auth.py
├── user.py
├── role.py
├── document.py
├── course.py
├── question.py
├── review.py
├── training.py
├── exam.py
└── async_job.py
```

---

# 7.1 schema 拆分原则

一个实体至少三类 schema：

---

## Create

```python
UserCreateSchema
```

---

## Update

```python
UserUpdateSchema
```

---

## Response

```python
UserResponseSchema
```

---

禁止：

```python
一个 schema 全包
```

---

# 8. repositories 目录结构

---

```text
app/repositories/
├── base.py
├── user_repository.py
├── document_repository.py
├── course_repository.py
├── question_repository.py
├── review_repository.py
├── training_repository.py
├── exam_repository.py
└── async_job_repository.py
```

---

# 8.1 BaseRepository 必须统一

统一封装：

1. get_by_id
2. list_by_page
3. create
4. update
5. delete（如需要）

---

## 示例

```python
class BaseRepository:
    def get_by_id(...)
```

---

这样 agent 不会每个 repository 风格不同。

---

# 9. services 目录结构

---

```text
app/services/
├── auth_service.py
├── user_service.py
├── document_service.py
├── parse_service.py
├── knowledge_point_service.py
├── course_service.py
├── question_service.py
├── review_service.py
├── publish_service.py
├── training_service.py
├── exam_service.py
├── grading_service.py
├── audit_service.py
└── async_job_service.py
```

---

# 9.1 service 设计原则

---

## service 可以组合多个 repository

例如：

```text
course_service
同时调：
course_repository
review_repository
audit_service
```

---

## service 是状态机入口

例如：

```python
submit_review()
```

内部必须校验：

```text
draft 才允许 submit
```

---

# 10. tasks 目录结构

---

```text
app/tasks/
├── worker.py
├── document_parse_task.py
├── embedding_task.py
├── course_generate_task.py
├── question_generate_task.py
├── grading_task.py
└── retry_task.py
```

---

# 10.1 任务职责

每个 task：

只做一件事。

---

例如：

错误：

```text
一个 task 同时 parse + chunk + embedding
```

正确：

```text
三个 task 串联
```

---

# 11. core 目录结构

---

```text
app/core/
├── config.py
├── security.py
├── logger.py
├── redis.py
├── rabbitmq.py
├── exceptions.py
├── response.py
└── lifespan.py
```

---

# 11.1 config.py

统一读取：

```python
Pydantic Settings
```

---

## 禁止

到处：

```python
os.getenv
```

---

# 11.2 security.py

负责：

1. JWT
2. password hash

---

# 11.3 response.py

统一：

```python
success_response()
error_response()
```

---

# 12. db 目录结构

---

```text
app/db/
├── session.py
├── base.py
└── init_db.py
```

---

# 12.1 session.py

统一：

```python
async_sessionmaker
```

---

## 原则

所有 repository 注入 session。

---

# 13. enums 目录结构

---

```text
app/enums/
├── course_status.py
├── question_status.py
├── review_status.py
├── publish_status.py
├── exam_status.py
└── async_job_status.py
```

---

# 13.1 为什么必须 enums

否则：

状态字符串到处散落。

agent 极易写错。

---

# 14. exceptions 目录结构

---

```text
app/exceptions/
├── business.py
├── auth.py
├── review.py
├── course.py
└── exam.py
```

---

# 14.1 原则

禁止：

```python
raise HTTPException everywhere
```

必须：

```python
raise CourseStatusInvalid()
```

由统一 handler 转成 API 错误码。

---

# 15. router 注册方式（必须统一）

---

# api/router.py

统一：

```python
api_router.include_router(...)
```

---

## 每模块 prefix

例如：

```python
/users
/documents
/courses
```

---

## 禁止

模块自己 mount app。

---

# 16. main.py 启动骨架

---

```python
FastAPI
include_router
lifespan
middleware
exception_handler
```

---

## middleware 建议

---

### request_id

### audit

### cors

---

# 17. 测试目录结构

---

```text
tests/
├── api/
├── services/
├── repositories/
├── fixtures/
└── factories/
```

---

# 17.1 第一批必须有的测试

---

## auth

## users

## documents upload

---

否则后期越改越坏。

---

# 18. Agent 第一批代码生成顺序（现在开始真正写代码）

---

## Step 1

生成：

```text
core + db + base model
```

---

## Step 2

生成：

```text
users / roles / auth
```

---

## Step 3

生成：

```text
documents
```

---

## Step 4

生成：

```text
knowledge_points
```

---

不要跳着写。

---

# 19. 给 agent 的标准提示（第一批）

---

```text
请生成 backend 基础骨架：

要求：
1. 按文档目录生成
2. 只生成 core/db/models/base/api/router/main
3. 不生成业务模块
4. 使用 FastAPI + SQLAlchemy 2.x
5. 输出涉及文件清单
6. 每个文件可运行

禁止：
1. 不生成 documents/courses 等业务模块
2. 不写示例业务代码
```

---

# 20. 当前真正可以开始 coding 的位置

你现在已经不再缺文档。

真正应该开始：

# 第一轮 Cursor/Claude 写骨架代码

因为：

再往后继续写文档收益急剧下降。

---

# 21. 下一步最正确动作

建议直接开始：

## 生成 Phase0 + Phase1 第一批代码

即：

```text
backend 基础骨架
users
roles
auth
```

这时最稳。
