# 内部培训考试系统——第一批可直接投喂 Cursor / Claude / Codex 的 Prompt 包（初稿）

文档名称：内部培训考试系统第一批 Agent Prompt 包  
版本号：v0.1  
日期：2026-03-09  
适用对象：Cursor / Claude Code / Codex / 其他代码 Agent  
状态：可直接复制执行

---

# 1. 使用说明

这份文档不是设计文档，而是 **已经按任务拆好的执行提示词集合**。  
目标是让你直接复制到 Cursor / Claude / Codex 中，按顺序生成第一批代码。

使用原则：

1. **一次只执行一个 Prompt**
2. 每执行完一个 Prompt，必须先本地运行/检查，再执行下一个
3. 不要跨任务合并执行
4. 每个 Prompt 都要求 agent 输出“涉及文件清单”
5. 每个 Prompt 都要求 agent **不修改未授权模块**

---

# 2. 执行顺序

第一批推荐顺序如下：

```text
P0-01 基础 backend 骨架
P0-02 基础 frontend 骨架
P0-03 Docker Compose 基础环境
P1-01 SQLAlchemy Base / Session / Settings
P1-02 用户权限数据模型
P1-03 Alembic V001
P1-04 认证接口
P1-05 用户接口
P1-06 角色与部门接口
P1-07 前端登录与路由守卫
P1-08 管理端布局与菜单壳
```

---

# 3. 通用前置提示（建议每次加在最前面）

下面这段建议作为每次任务提示词的前缀：

```text
你正在一个已有设计文档约束的企业级项目中工作。

必须遵守以下规则：
1. 只完成我本次要求的任务，不扩展额外功能
2. 只修改我允许的文件或目录
3. 所有代码必须可运行
4. 不要省略关键文件
5. 输出“涉及文件清单”
6. 输出“你做了什么”
7. 输出“如何验证”
8. 若发现缺少前置依赖，只最小化补齐，不要重构整个项目
9. 不要擅自修改数据库设计
10. 不要把业务逻辑写进 router
```

---

# 4. Prompt 包：Phase 0 基础工程

---

# P0-01 生成 backend 基础骨架

```text
请完成任务：生成 backend 基础骨架。

项目背景：
这是一个企业内部培训考试系统，后端采用 FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL。

本次任务目标：
只生成 backend 的基础工程骨架，不生成任何具体业务模块。

必须生成的目录和文件：

backend/
  app/
    api/
      router.py
      deps.py
      v1/
        __init__.py
    core/
      config.py
      security.py
      logger.py
      response.py
      exceptions.py
      lifespan.py
    db/
      session.py
      base.py
    models/
      base.py
      __init__.py
    schemas/
      common.py
      __init__.py
    repositories/
      __init__.py
    services/
      __init__.py
    tasks/
      __init__.py
    utils/
      __init__.py
    enums/
      __init__.py
    exceptions/
      __init__.py
  main.py
  requirements.txt
  pyproject.toml
  .env.example

具体要求：
1. 使用 FastAPI
2. 使用 Pydantic Settings 管理配置
3. 使用 SQLAlchemy 2.x async engine/session
4. main.py 可以启动应用
5. api/router.py 先保留空 router 聚合逻辑
6. response.py 提供统一成功响应函数
7. exceptions.py 提供业务异常基类
8. models/base.py 提供 DeclarativeBase、UUIDMixin、TimestampMixin
9. requirements.txt 写出最小依赖集合
10. .env.example 提供数据库、Redis、RabbitMQ、JWT 配置项占位

禁止：
1. 不生成 users/documents/courses 等业务模块
2. 不写示例业务接口
3. 不擅自增加 Celery、Kafka 等新技术
4. 不修改为同步 SQLAlchemy

输出格式要求：
1. 涉及文件清单
2. 关键代码说明
3. 如何本地运行验证
4. 如有假设，请单独列出
```

---

# P0-02 生成 frontend 基础骨架

```text
请完成任务：生成 frontend 基础骨架。

项目背景：
这是一个企业内部培训考试系统，前端采用 React 18 + TypeScript + Vite + Ant Design + Redux Toolkit。

本次任务目标：
只生成 frontend 的基础壳，不生成业务页面。

必须生成的目录和文件：

frontend/
  src/
    main.tsx
    App.tsx
    router/
      index.tsx
    layouts/
      MainLayout.tsx
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      NotFoundPage.tsx
      ForbiddenPage.tsx
    store/
      index.ts
      authSlice.ts
    api/
      client.ts
    components/
      PageLoading.tsx
    utils/
      storage.ts
    styles/
      index.css
  package.json
  tsconfig.json
  vite.config.ts

具体要求：
1. 使用 React Router
2. 提供最小登录页
3. 提供 Dashboard 占位页
4. 提供 403 / 404 页面
5. 提供 MainLayout 占位布局
6. 提供 Axios client 封装
7. 提供 authSlice，用于保存 token 和当前用户基础信息
8. 路由先支持：
   - /login
   - /dashboard
   - /403
   - *
9. 使用 Ant Design 基本布局
10. 所有代码可运行

禁止：
1. 不生成 users/documents/courses 等业务页面
2. 不引入额外状态管理库
3. 不写 mock 业务数据页面

输出格式要求：
1. 涉及文件清单
2. 关键代码说明
3. 如何本地运行验证
```

---

# P0-03 生成 docker-compose 基础环境

```text
请完成任务：生成基础 docker-compose 开发环境。

项目目标：
为 backend / frontend / postgres / redis / rabbitmq 提供本地开发启动环境。

必须生成：

infra/
  docker-compose.yml

如果有必要，可补：
- backend/Dockerfile
- frontend/Dockerfile

具体要求：
1. postgres 使用 15
2. redis 使用 7
3. rabbitmq 使用管理界面镜像
4. backend 暴露 8000
5. frontend 暴露 5173 或 80
6. postgres 环境变量从 .env.example 对应
7. 只做开发环境 compose，不做 k8s

禁止：
1. 不增加 Elasticsearch、Milvus（后续再加）
2. 不增加生产优化配置
3. 不重构 backend/frontend 项目结构

输出格式要求：
1. 涉及文件清单
2. 启动命令
3. 服务访问地址
```

---

# 5. Prompt 包：Phase 1 基础权限与登录

---

# P1-01 生成 SQLAlchemy Base / Session / Settings 完整实现

```text
请完成任务：补齐 backend 基础设施实现。

前提：
项目已有 backend 基础骨架。

本次目标：
只补齐以下能力：
1. config.py
2. db/session.py
3. db/base.py
4. models/base.py
5. core/security.py
6. core/response.py
7. core/exceptions.py
8. main.py 启动接线

具体要求：
1. config.py 使用 Pydantic Settings
2. session.py 提供 async engine 和 async_sessionmaker
3. models/base.py 提供 DeclarativeBase、UUID 主键 mixin、created_at / updated_at mixin
4. security.py 提供：
   - 密码 hash
   - 密码校验
   - JWT 创建
   - JWT 解析
5. response.py 提供统一成功响应结构
6. exceptions.py 提供 BusinessException 基类，并包含 code/message
7. main.py 注册统一异常处理器
8. 确保应用可启动

禁止：
1. 不新增业务模型
2. 不写用户接口
3. 不写 router 业务逻辑
4. 不引入未声明框架

输出格式要求：
1. 涉及文件清单
2. 关键实现说明
3. 验证步骤
```

---

# P1-02 生成用户权限数据模型

```text
请完成任务：生成用户权限相关 ORM 模型。

前提：
项目已有 SQLAlchemy base。

本次只生成以下模型文件：

backend/app/models/
  user.py
  role.py
  permission.py
  department.py

并更新：
- backend/app/models/__init__.py

必须覆盖的数据表：
1. users
2. roles
3. permissions
4. user_roles
5. role_permissions
6. departments
7. user_departments

要求：
1. 严格按照数据库设计文档中的字段生成
2. 使用 SQLAlchemy 2.x typed ORM 风格
3. 多对多关联合理定义
4. 关系命名清晰
5. 不写业务逻辑，只写 model
6. 若 current 文档里缺某些字段默认值，可按 DDL 文档实现

禁止：
1. 不生成 Alembic migration
2. 不写 API
3. 不写 service
4. 不擅自改字段名

输出格式要求：
1. 涉及文件清单
2. 模型关系说明
3. 与 DDL 差异说明（如有）
```

---

# P1-03 生成 Alembic V001

```text
请完成任务：生成 Alembic V001_users_roles_departments 迁移。

前提：
用户权限 ORM 模型已存在。

本次目标：
只生成第一版 migration，覆盖：
1. users
2. roles
3. permissions
4. user_roles
5. role_permissions
6. departments
7. user_departments

要求：
1. 使用 Alembic 标准迁移格式
2. upgrade / downgrade 完整
3. 包含索引与唯一约束
4. 与 DDL 文档一致
5. 如需启用 pgcrypto 或 uuid 扩展，请在 migration 中说明

禁止：
1. 不生成其他业务表
2. 不修改 ORM 模型定义
3. 不把所有后续 migration 合并进来

输出格式要求：
1. 涉及文件清单
2. migration revision 名称
3. 如何执行迁移
4. 如何回滚
```

---

# P1-04 生成认证接口

```text
请完成任务：生成 auth 模块。

本次只生成以下接口：
1. POST /api/v1/auth/login
2. GET /api/v1/auth/me

必须生成或补齐以下文件：

backend/app/api/v1/auth/
  router.py
  schema.py
  service.py
  repository.py
  __init__.py

如有必要可补：
- app/api/deps.py
- app/api/router.py

具体要求：
1. login 使用 username + password
2. 登录成功返回 access_token、token_type、expires_in、user 摘要
3. /me 从 JWT 中解析当前用户
4. repository 只负责查询 user
5. service 负责密码校验和 token 生成
6. router 不直接访问数据库
7. 使用统一响应结构
8. 错误时返回业务错误码：
   - AUTH_INVALID_CREDENTIALS
   - AUTH_USER_DISABLED

禁止：
1. 不生成 refresh token
2. 不实现 logout 持久化逻辑
3. 不做前端代码
4. 不把权限树直接塞进 login 返回

输出格式要求：
1. 涉及文件清单
2. 接口说明
3. 验证方法（curl 或 swagger）
```

---

# P1-05 生成用户接口

```text
请完成任务：生成 users 模块基础 CRUD 接口。

本次只实现：
1. GET /api/v1/users
2. POST /api/v1/users
3. GET /api/v1/users/{user_id}
4. PUT /api/v1/users/{user_id}
5. POST /api/v1/users/{user_id}/enable
6. POST /api/v1/users/{user_id}/disable

必须生成：

backend/app/api/v1/users/
  router.py
  schema.py
  service.py
  repository.py
  __init__.py

要求：
1. 严格按 router -> service -> repository 分层
2. 支持分页列表
3. create 支持绑定部门和角色
4. update 支持更新基础资料、部门、角色
5. enable/disable 修改用户状态
6. password_hash 由 service 处理
7. response schema 不返回 password_hash
8. 列表接口支持 keyword / status / department_id 过滤

禁止：
1. 不实现删除接口
2. 不生成前端代码
3. 不把所有逻辑写到 router
4. 不跳过 service 层

输出格式要求：
1. 涉及文件清单
2. 接口说明
3. 示例请求
4. 验证步骤
```

---

# P1-06 生成角色与部门接口

```text
请完成任务：生成 roles 与 departments 基础接口。

本次实现接口：

roles:
1. GET /api/v1/roles
2. POST /api/v1/roles
3. PUT /api/v1/roles/{role_id}/permissions

departments:
1. GET /api/v1/departments/tree
2. POST /api/v1/departments

必须生成：

backend/app/api/v1/roles/
  router.py
  schema.py
  service.py
  repository.py

backend/app/api/v1/departments/
  router.py
  schema.py
  service.py
  repository.py

要求：
1. 部门支持 parent_id
2. 部门树接口返回树形结构
3. 角色权限更新通过 role_permissions 维护
4. service 负责校验角色/权限/部门是否存在
5. 使用统一响应结构

禁止：
1. 不生成删除接口
2. 不做复杂组织路径 path 维护（若当前模型未设计）
3. 不生成前端页面

输出格式要求：
1. 涉及文件清单
2. 接口说明
3. 验证步骤
```

---

# 6. Prompt 包：前端第一批

---

# P1-07 生成前端登录与路由守卫

```text
请完成任务：生成前端登录流与路由守卫。

前提：
项目已有 React + Vite + AntD 基础骨架。

本次目标：
只实现：
1. 登录页表单
2. auth API 对接
3. token 本地存储
4. 当前用户状态持久化
5. 路由守卫
6. 未登录自动跳转 /login
7. 登录后跳转 /dashboard

涉及文件：
- src/pages/LoginPage.tsx
- src/store/authSlice.ts
- src/api/client.ts
- src/router/index.tsx
- src/utils/storage.ts
- 如有必要补 auth api 文件

要求：
1. 使用 AntD Form
2. 登录按钮 loading
3. 登录失败提示 message/error
4. token 存 localStorage
5. dashboard 需要登录后才能访问
6. /login 对已登录用户自动跳 dashboard

禁止：
1. 不生成业务菜单
2. 不生成用户管理页面
3. 不引入额外路由库
4. 不写 mock 登录逻辑，必须调用真实 API

输出格式要求：
1. 涉及文件清单
2. 关键逻辑说明
3. 联调验证步骤
```

---

# P1-08 生成管理端 Layout 与菜单壳

```text
请完成任务：生成管理端基础 Layout 与菜单壳。

前提：
已有登录和路由守卫。

本次目标：
只生成后台基础布局，不生成具体业务页。

要求实现：
1. MainLayout
2. 左侧菜单
3. 顶部栏
4. 内容区
5. 路由占位页接入

菜单先包含：
- 首页 /dashboard
- 用户管理 /system/users
- 角色权限 /system/roles
- 部门管理 /system/departments
- 文档管理 /documents
- 知识点管理 /knowledge-points
- 课程管理 /courses
- 题库管理 /questions
- 审核任务 /reviews
- 培训任务 /training-tasks
- 考试管理 /exams
- 审计日志 /audit-logs
- 异步任务 /async-jobs

要求：
1. 当前没有实现的页面先用占位页组件
2. 菜单高亮与路由同步
3. 顶栏显示当前用户姓名和退出按钮占位
4. 布局基于 AntD Layout

禁止：
1. 不实现具体业务数据表格
2. 不接入复杂权限树控制
3. 不生成多套布局系统

输出格式要求：
1. 涉及文件清单
2. 菜单与路由说明
3. 运行验证步骤
```

---

# 7. 每个 Prompt 执行后的检查清单

每跑完一个 Prompt，都做下面 7 项检查：

```text
1. 是否只改了授权文件
2. 是否新增了不该出现的技术栈
3. 是否能启动
4. 是否有 import 错误
5. 是否符合 router/service/repository 分层
6. 是否输出了验证方法
7. 是否和已定 DDL / API 文档冲突
```

---

# 8. 推荐执行节奏

推荐最稳节奏：

```text
当天只做 2~3 个 prompt
每个 prompt 完成后：
- 看 diff
- 本地运行
- 修一次
- 再 commit
```

不要这样做：

```text
一口气让 agent 跑完 8 个 prompt
```

后面很难收拾。

---

# 9. Git 提交建议

每个 Prompt 最好对应一次 commit。

建议提交信息格式：

```text
feat(auth): add login and current user api
feat(users): add user crud apis
feat(frontend): add login page and route guard
```

这样后续回滚轻松很多。

---

# 10. 第二批 Prompt 预告

当第一批完成并验证通过后，第二批应该进入：

1. documents
2. document parse task
3. knowledge point candidates
4. knowledge points
5. documents 前端列表页
6. knowledge points 前端列表页

也就是系统真正的“知识入口”。

---

# 11. 结论

这份 Prompt 包的目标只有一个：

**把“可落地设计”真正转成“可执行开发”。**

你现在不再缺文档，缺的是：

```text
小步、可验证、可回滚地让 agent 开始写代码
```

这份就是第一步。
