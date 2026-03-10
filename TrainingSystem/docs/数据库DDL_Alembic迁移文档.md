# 内部培训考试系统——数据库 DDL + Alembic 迁移文档（初稿）

文档名称：内部培训考试系统数据库 DDL 与迁移文档  
版本号：v0.1  
日期：2026-03-09  
数据库：PostgreSQL 15  
ORM：SQLAlchemy 2.x  
迁移工具：Alembic  
状态：可直接指导后端建模与 migration 生成

---

# 1. 文档目标

本文档用于把业务模型转换成 **工程级数据库契约**。

目标：

1. 固定数据库主结构，避免 agent 自行猜测字段
2. 固定命名规范，避免后续 migration 漂移
3. 固定索引与约束，保证性能和一致性
4. 固定删除策略，避免逻辑混乱
5. 固定 Alembic 演进顺序

---

# 2. 全局数据库规范

---

## 2.1 主键规范

统一：

```sql
UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

要求：

1. 所有主表 UUID
2. 不使用自增 bigint
3. API 层统一 UUID 字符串

---

## 2.2 时间字段规范

统一：

```sql
created_at TIMESTAMP NOT NULL DEFAULT now(),
updated_at TIMESTAMP NOT NULL DEFAULT now()
```

说明：

- `updated_at` 由 service 层维护
- 不依赖 trigger（一期先简单）

---

## 2.3 删除策略

统一：

```text
业务主表全部逻辑删除
```

增加：

```sql
is_deleted BOOLEAN NOT NULL DEFAULT false
```

但：

一期建议只对真正需要删除恢复的表启用。  
多数业务表用 status 控制即可。

---

## 2.4 状态字段规范

统一：

```sql
status VARCHAR(32) NOT NULL
```

禁止：

- enum 类型（避免迁移麻烦）

---

## 2.5 JSONB 使用原则

仅用于：

1. options
2. answer_json
3. config
4. tags

禁止：

把核心关系塞进 JSONB。

---

## 2.6 命名规范

---

### 表名

统一复数：

```text
users
courses
questions
```

---

### 外键字段

统一：

```text
xxx_id
```

---

### 索引命名

统一：

```text
idx_<table>_<field>
```

---

### 唯一约束命名

统一：

```text
uq_<table>_<field>
```

---

# 3. Alembic 迁移顺序

---

```text
V001_users_roles_departments
V002_documents
V003_knowledge_points
V004_courses
V005_questions
V006_reviews
V007_publish
V008_training
V009_exams
V010_audit_async
```

要求：

每次只生成一个 migration。

---

# 4. V001 基础权限系统

---

# 4.1 users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(64) NOT NULL,
  email VARCHAR(128),
  phone VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE UNIQUE INDEX uq_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
```

---

# 4.2 roles

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  code VARCHAR(64) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE UNIQUE INDEX uq_roles_code ON roles(code);
```

---

# 4.3 permissions

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE UNIQUE INDEX uq_permissions_code ON permissions(code);
```

---

# 4.4 user_roles

```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  PRIMARY KEY(user_id, role_id)
);
```

---

# 4.5 role_permissions

```sql
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY(role_id, permission_id)
);
```

---

# 4.6 departments

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  parent_id UUID REFERENCES departments(id),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 4.7 user_departments

```sql
CREATE TABLE user_departments (
  user_id UUID NOT NULL REFERENCES users(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  PRIMARY KEY(user_id, department_id)
);
```

---

# 5. V002 文档系统

---

# 5.1 documents

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  source_type VARCHAR(32) NOT NULL DEFAULT 'upload',
  status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
  current_version_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_documents_owner_id ON documents(owner_id);
CREATE INDEX idx_documents_status ON documents(status);
```

---

# 5.2 document_versions

```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  version_no INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(128),
  file_hash VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE UNIQUE INDEX uq_document_versions_doc_ver
ON document_versions(document_id, version_no);
```

---

# 5.3 document_parse_tasks

```sql
CREATE TABLE document_parse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 5.4 document_chunks

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  chunk_index INT NOT NULL,
  chapter_title VARCHAR(255),
  content TEXT NOT NULL,
  token_count INT,
  embedding_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_document_chunks_doc_ver
ON document_chunks(document_version_id);
```

---

# 6. V003 知识点系统

---

# 6.1 knowledge_point_candidates

```sql
CREATE TABLE knowledge_point_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_chunk_id UUID REFERENCES document_chunks(id),
  candidate_name VARCHAR(255) NOT NULL,
  candidate_description TEXT,
  confidence_score NUMERIC(5,4),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 6.2 knowledge_points

```sql
CREATE TABLE knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES knowledge_points(id),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  weight INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_knowledge_points_parent_id
ON knowledge_points(parent_id);
```

---

# 6.3 knowledge_point_relations

```sql
CREATE TABLE knowledge_point_relations (
  source_id UUID NOT NULL REFERENCES knowledge_points(id),
  target_id UUID NOT NULL REFERENCES knowledge_points(id),
  relation_type VARCHAR(32) NOT NULL,
  PRIMARY KEY(source_id, target_id, relation_type)
);
```

---

# 7. V004 课程系统

---

# 7.1 courses

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  current_version_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_courses_owner_id ON courses(owner_id);
CREATE INDEX idx_courses_status ON courses(status);
```

---

# 7.2 course_versions

```sql
CREATE TABLE course_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE UNIQUE INDEX uq_course_versions_course_ver
ON course_versions(course_id, version_no);
```

---

# 7.3 course_chapters

```sql
CREATE TABLE course_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id UUID NOT NULL REFERENCES course_versions(id),
  chapter_no INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  estimated_duration_minutes INT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_course_chapters_version
ON course_chapters(course_version_id);
```

---

# 7.4 course_generation_tasks

```sql
CREATE TABLE course_generation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  config JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 8. V005 题库系统

---

# 8.1 questions

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_version_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 8.2 question_versions

```sql
CREATE TABLE question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id),
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  question_type VARCHAR(32) NOT NULL,
  stem TEXT NOT NULL,
  options JSONB,
  answer_json JSONB NOT NULL,
  analysis TEXT,
  difficulty_level INT NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE UNIQUE INDEX uq_question_versions_ver
ON question_versions(question_id, version_no);
```

---

# 8.3 question_generation_tasks

```sql
CREATE TABLE question_generation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  config JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 9. V006 审核系统

---

# 9.1 review_tasks

```sql
CREATE TABLE review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(32) NOT NULL,
  content_id UUID NOT NULL,
  content_version_id UUID NOT NULL,
  review_stage VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  assigned_reviewer_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_review_tasks_status ON review_tasks(status);
```

---

# 9.2 review_comments

```sql
CREATE TABLE review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_task_id UUID NOT NULL REFERENCES review_tasks(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  comment_type VARCHAR(32) NOT NULL,
  target_path VARCHAR(255),
  content TEXT NOT NULL,
  action_suggestion VARCHAR(32),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 10. V007 发布系统

---

# 10.1 publish_records

```sql
CREATE TABLE publish_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(32) NOT NULL,
  content_version_id UUID NOT NULL,
  publish_scope_type VARCHAR(32),
  effective_at TIMESTAMP,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  reason TEXT,
  operator_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 11. V008 培训系统

---

# 11.1 training_tasks

```sql
CREATE TABLE training_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  course_version_id UUID REFERENCES course_versions(id),
  exam_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  due_at TIMESTAMP,
  allow_makeup_exam BOOLEAN NOT NULL DEFAULT false,
  makeup_exam_limit INT NOT NULL DEFAULT 0,
  notify_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 11.2 training_assignments

```sql
CREATE TABLE training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_task_id UUID NOT NULL REFERENCES training_tasks(id),
  user_id UUID NOT NULL REFERENCES users(id),
  assignment_status VARCHAR(32) NOT NULL DEFAULT 'assigned',
  study_completed_at TIMESTAMP,
  exam_completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_training_assignments_task
ON training_assignments(training_task_id);
```

---

# 11.3 study_progress

```sql
CREATE TABLE study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_assignment_id UUID NOT NULL REFERENCES training_assignments(id),
  progress_percent INT NOT NULL DEFAULT 0,
  last_position JSONB,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 12. V009 考试系统

---

# 12.1 exams

```sql
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  exam_mode VARCHAR(32) NOT NULL,
  duration_minutes INT NOT NULL,
  total_score INT NOT NULL,
  pass_score INT NOT NULL,
  paper_id UUID,
  start_at TIMESTAMP,
  end_at TIMESTAMP,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 12.2 exam_papers

```sql
CREATE TABLE exam_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  paper_type VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 12.3 exam_attempts

```sql
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(32) NOT NULL DEFAULT 'ongoing',
  started_at TIMESTAMP NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP,
  total_score INT,
  pass_result BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 索引

```sql
CREATE INDEX idx_exam_attempts_exam_user
ON exam_attempts(exam_id, user_id);
```

---

# 12.4 exam_answers

```sql
CREATE TABLE exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id),
  question_version_id UUID NOT NULL REFERENCES question_versions(id),
  answer_json JSONB NOT NULL,
  score INT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 13. V010 支撑系统

---

# 13.1 audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES users(id),
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64),
  resource_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

# 13.2 async_jobs

```sql
CREATE TABLE async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(64) NOT NULL,
  biz_type VARCHAR(64),
  biz_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMP NOT NULL DEFAULT now(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);
```

---

# 14. Agent 使用建议

---

## 每次只生成一个 migration

例如：

```text
只生成 V004_courses
```

禁止：

```text
生成全部 migration
```

---

## 每次要求输出

1. SQLAlchemy model
2. Alembic migration
3. repository
4. schema

---

## 先 migration 再 service

顺序不能反。

---

# 15. 下一步最关键

现在数据库已经钉死。

下一步真正适合继续的是：

# 《FastAPI 工程目录 + 模块骨架文档》

因为 agent 下一步要真正开始写代码。
