# 内部培训考试系统——后续完整材料总包（第二批 Prompt + 测试 + 部署 + 上线闭环）

## 总体闭环路线

第一批（已完成）
- 基础骨架 / 权限 / 登录

第二批
- 文档知识库 / 知识点系统

第三批
- 课程 / 题库 / 审核

第四批
- 培训 / 考试 / 发布

第五批
- AI任务链 / OCR / Embedding / LLM接入

第六批
- 测试体系 / 安全 / CI/CD

第七批
- 生产部署 / 监控 / 灰度上线

## 第二批 Prompt（知识入口）

### P2-01 documents 数据模型 + migration
- document.py model
- Alembic V002_documents
- documents / document_versions / document_parse_tasks / document_chunks

### P2-02 documents 上传接口
- POST /api/v1/documents/upload
- GET /api/v1/documents

### P2-03 parse task 骨架
- RabbitMQ producer
- parse task 状态机

### P2-04 文档列表前端
- 表格 / 上传 / 状态标签

### P2-05 knowledge point candidates
- candidates / accept / ignore / merge

### P2-06 知识点前端页
- candidate 列表 / merge / 树

## 第三批 Prompt（课程 / 题库 / 审核）

### courses
- courses / course_versions / course_chapters / generation_tasks

### questions
- questions / question_versions / generation_tasks

### reviews
- review_tasks / review_comments

## 第四批 Prompt（培训 / 考试 / 发布）

### training
- training_tasks / training_assignments / study_progress

### exams
- exams / papers / attempts / answers

### publish
- publish_records / rollback

## 第五批 Prompt（AI链路）

### OCR
- PaddleOCR 接入

### chunk pipeline
- parse -> chunk

### embedding
- chunk -> milvus

### LLM
- course generator
- question generator

## 测试体系

### pytest
- auth
- users
- documents upload
- courses generate
- exam submit

### Playwright
- login
- upload
- course edit
- exam submit

### Locust
- 500 并发考试
- 2000 在线用户

## 安全

- JWT 2h
- 上传文件 mime/hash 校验
- 权限中间件
- SQLAlchemy 防注入

## CI/CD

GitLab CI:
- lint
- test
- build
- deploy

## 生产部署

推荐拓扑：
- nginx
- frontend
- backend x2
- worker x2
- postgres
- redis
- rabbitmq
- milvus

## 监控

Prometheus:
- api latency
- queue backlog
- worker failures

Grafana:
- 考试并发
- 文档解析耗时
- 课程生成耗时

## 上线检查

1. migration 全通过
2. env 完整
3. jwt secret 替换
4. storage 挂载
5. backup 已启用
6. HTTPS 生效

## Runbook（建议补充）

- 上传失败排查
- 任务卡死排查
- 考试异常排查
- 回滚流程
- 数据恢复流程
