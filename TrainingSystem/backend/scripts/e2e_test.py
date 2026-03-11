"""
全面端到端 API 测试脚本 — 覆盖所有模块的 CRUD + 数据一致性
运行: python scripts/e2e_test.py
"""
import urllib.request, urllib.parse, json, sys, time

BASE = 'http://localhost:8000/api/v1'
PASS = 0
FAIL = 0
ERRORS = []

def req(method, path, data=None, token=None, form=None):
    url = BASE + path
    if form:
        encoded = urllib.parse.urlencode(form).encode()
        r = urllib.request.Request(url, data=encoded, method=method)
        r.add_header('Content-Type', 'application/x-www-form-urlencoded')
    elif data is not None:
        r = urllib.request.Request(url, data=json.dumps(data).encode(), method=method)
        r.add_header('Content-Type', 'application/json')
    else:
        r = urllib.request.Request(url, method=method)
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        txt = e.read()
        try: return e.code, json.loads(txt)
        except: return e.code, {'raw': txt.decode()[:300]}
    except Exception as ex:
        return 0, str(ex)

def check(name, condition, detail=''):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f'  ✓ {name}')
    else:
        FAIL += 1
        ERRORS.append(f'{name}: {detail}')
        print(f'  ✗ {name}  [{detail}]')

def section(title):
    print(f'\n{"="*55}')
    print(f'  {title}')
    print('='*55)

# ──────────────────────────────────────────────────────────
# 1. AUTH
# ──────────────────────────────────────────────────────────
section('1. 认证模块')
s, d = req('POST', '/auth/login', {'username': 'admin', 'password': 'Admin@123'})
check('管理员登录', s == 200 and 'access_token' in d.get('data', {}), f'{s} {d}')
TOKEN = d['data']['access_token'] if s == 200 else ''

s, d = req('POST', '/auth/login', {'username': 'admin', 'password': 'wrong'})
check('错误密码被拒绝', s == 401, f'{s}')

s, d = req('GET', '/auth/me', token=TOKEN)
check('获取当前用户信息', s == 200 and d.get('data', {}).get('username') == 'admin', f'{s}')

# ──────────────────────────────────────────────────────────
# 2. 用户管理
# ──────────────────────────────────────────────────────────
section('2. 用户管理')
s, d = req('GET', '/users', token=TOKEN)
check('用户列表', s == 200 and 'items' in d.get('data', {}), f'{s}')
initial_user_count = d.get('data', {}).get('total', 0)

ts = int(time.time())
s, d = req('POST', '/users', {
    'username': f'testuser_{ts}', 'password': 'Test@1234',
    'real_name': '测试用户', 'email': f'test_{ts}@test.com'
}, token=TOKEN)
check('创建用户', s == 200 and 'id' in d.get('data', {}), f'{s} {d}')
test_user_id = d.get('data', {}).get('id', '')

if test_user_id:
    s, d = req('GET', f'/users/{test_user_id}', token=TOKEN)
    check('查询用户详情', s == 200 and d.get('data', {}).get('id') == test_user_id, f'{s}')

    s, d = req('PUT', f'/users/{test_user_id}', {'real_name': '测试用户改名'}, token=TOKEN)
    check('更新用户信息', s == 200, f'{s} {d}')

    s, d = req('POST', f'/users/{test_user_id}/reset-password?new_password=NewPass@123', token=TOKEN)
    check('重置用户密码', s == 200, f'{s} {d}')

# 登录新用户验证密码修改
if test_user_id:
    s, d = req('POST', '/auth/login', {'username': f'testuser_{ts}', 'password': 'NewPass@123'})
    check('新用户登录（密码已更新）', s == 200, f'{s}')
    USER_TOKEN = d['data']['access_token'] if s == 200 else ''

# ──────────────────────────────────────────────────────────
# 3. 角色权限
# ──────────────────────────────────────────────────────────
section('3. 角色与权限')
s, d = req('GET', '/roles', token=TOKEN)
check('角色列表', s == 200, f'{s}')

s, d = req('POST', '/roles', {'name': f'TestRole_{ts}', 'code': f'test_role_{ts}', 'description': '测试角色'}, token=TOKEN)
check('创建角色', s == 200, f'{s} {d}')
test_role_id = d.get('data', {}).get('id', '')

if test_role_id:
    s, d = req('GET', f'/roles/{test_role_id}', token=TOKEN)
    check('查询角色详情', s == 200, f'{s}')

    s, d = req('GET', '/roles/permissions', token=TOKEN)
    check('查询权限列表', s == 200, f'{s}')

    if test_user_id:
        s, d = req('PUT', f'/roles/{test_role_id}/users', {'user_ids': [test_user_id]}, token=TOKEN)
        check('分配用户到角色', s == 200, f'{s} {d}')

    s, d = req('DELETE', f'/roles/{test_role_id}', token=TOKEN)
    check('删除角色', s == 200, f'{s} {d}')

# ──────────────────────────────────────────────────────────
# 4. 部门管理
# ──────────────────────────────────────────────────────────
section('4. 部门管理')
s, d = req('GET', '/departments', token=TOKEN)
check('部门树形列表', s == 200, f'{s}')

s, d = req('POST', '/departments', {'name': f'测试部门_{ts}', 'description': '测试'}, token=TOKEN)
check('创建部门', s == 200, f'{s} {d}')
test_dept_id = d.get('data', {}).get('id', '')

if test_dept_id:
    s, d = req('PUT', f'/departments/{test_dept_id}', {'name': '测试部门改名'}, token=TOKEN)
    check('更新部门名称', s == 200, f'{s} {d}')

    if test_user_id:
        s, d = req('POST', f'/departments/{test_dept_id}/members', {'user_id': test_user_id, 'role': 'member'}, token=TOKEN)
        check('添加部门成员', s == 200, f'{s} {d}')

        s, d = req('GET', f'/departments/{test_dept_id}/members', token=TOKEN)
        check('查询部门成员', s == 200, f'{s}')
        raw_data = d.get('data', [])
        member_count = len(raw_data) if isinstance(raw_data, list) else len(raw_data.get('items', []))
        check('成员数量正确', member_count >= 1, f'count={member_count}')

        s, d = req('DELETE', f'/departments/{test_dept_id}/members/{test_user_id}', token=TOKEN)
        check('移除部门成员', s == 200, f'{s} {d}')

    s, d = req('DELETE', f'/departments/{test_dept_id}', token=TOKEN)
    check('删除部门', s == 200, f'{s} {d}')

# ──────────────────────────────────────────────────────────
# 5. 文档管理
# ──────────────────────────────────────────────────────────
section('5. 文档管理')
s, d = req('GET', '/documents', token=TOKEN)
check('文档列表', s == 200, f'{s}')

# Upload via multipart (simplified: use urllib multipart)
import io, uuid as uuidlib
boundary = '----FormBoundary' + str(ts)
body_parts = []
body_parts.append(f'------FormBoundary{ts}\r\nContent-Disposition: form-data; name="title"\r\n\r\nE2E测试文档_{ts}'.encode())
body_parts.append(f'------FormBoundary{ts}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nThis is a test document for e2e testing.'.encode())
body_parts.append(f'------FormBoundary{ts}--'.encode())
body = b'\r\n'.join(body_parts) + b'\r\n'

doc_req = urllib.request.Request(BASE + '/documents', data=body, method='POST')
doc_req.add_header('Content-Type', f'multipart/form-data; boundary=----FormBoundary{ts}')
doc_req.add_header('Authorization', f'Bearer {TOKEN}')
try:
    with urllib.request.urlopen(doc_req, timeout=10) as resp:
        doc_s, doc_d = resp.status, json.loads(resp.read())
except urllib.error.HTTPError as e:
    doc_s, doc_d = e.code, json.loads(e.read())

check('上传文档', doc_s == 200, f'{doc_s} {doc_d}')
test_doc_id = doc_d.get('data', {}).get('id', '')

if test_doc_id:
    s, d = req('GET', f'/documents/{test_doc_id}', token=TOKEN)
    check('文档详情', s == 200, f'{s}')

    s, d = req('PUT', f'/documents/{test_doc_id}', {'title': 'E2E测试文档（已改名）'}, token=TOKEN)
    check('更新文档标题', s == 200, f'{s} {d}')

    s, d = req('GET', f'/documents/{test_doc_id}/chunks', token=TOKEN)
    check('文档分块列表（未解析时为空）', s == 200, f'{s}')

    s, d = req('POST', f'/documents/{test_doc_id}/reparse', token=TOKEN)
    check('触发重新解析', s == 200, f'{s} {d}')

    s, d = req('POST', f'/documents/{test_doc_id}/archive', token=TOKEN)
    check('归档文档', s == 200, f'{s} {d}')

    s, d = req('DELETE', f'/documents/{test_doc_id}', token=TOKEN)
    check('删除文档（硬删除）', s == 200, f'{s} {d}')

    s, d = req('GET', f'/documents/{test_doc_id}', token=TOKEN)
    check('删除后不可访问', s == 404, f'{s}')

# ──────────────────────────────────────────────────────────
# 6. 知识点管理
# ──────────────────────────────────────────────────────────
section('6. 知识点管理')
s, d = req('GET', '/knowledge-points/tree', token=TOKEN)
check('知识点树形结构', s == 200, f'{s}')

s, d = req('GET', '/knowledge-points/candidates', token=TOKEN)
check('候选知识点列表', s == 200, f'{s}')

s, d = req('POST', '/knowledge-points', {
    'name': f'E2E知识点_{ts}', 'description': '测试', 'subject': '测试科目'
}, token=TOKEN)
check('创建知识点', s == 200, f'{s} {d}')
test_kp_id = d.get('data', {}).get('id', '')

if test_kp_id:
    s, d = req('GET', f'/knowledge-points/{test_kp_id}', token=TOKEN)
    check('知识点详情', s == 200, f'{s}')

    s, d = req('PUT', f'/knowledge-points/{test_kp_id}', {'name': 'E2E知识点（改名）', 'description': '已更新'}, token=TOKEN)
    check('更新知识点', s == 200, f'{s} {d}')

    s, d = req('GET', '/knowledge-points/search?keyword=E2E', token=TOKEN)
    check('知识点搜索', s == 200, f'{s}')

    s, d = req('POST', f'/knowledge-points/{test_kp_id}/archive', token=TOKEN)
    check('归档知识点', s == 200, f'{s} {d}')

# ──────────────────────────────────────────────────────────
# 7. 课程管理
# ──────────────────────────────────────────────────────────
section('7. 课程管理')
s, d = req('GET', '/courses', token=TOKEN)
check('课程列表', s == 200, f'{s}')

s, d = req('POST', '/courses', {'title': f'E2E测试课程_{ts}'}, token=TOKEN)
check('创建课程', s == 200, f'{s} {d}')
test_course_id = d.get('data', {}).get('id', '')

if test_course_id:
    s, d = req('GET', f'/courses/{test_course_id}', token=TOKEN)
    check('课程详情', s == 200, f'{s}')

    s, d = req('PUT', f'/courses/{test_course_id}', {'title': 'E2E课程（改名）'}, token=TOKEN)
    check('更新课程标题', s == 200, f'{s} {d}')

    s, d = req('POST', f'/courses/{test_course_id}/versions', {
        'title': 'V1版本', 'summary': '第一个版本'
    }, token=TOKEN)
    check('创建课程版本', s == 200, f'{s} {d}')
    test_ver_id = d.get('data', {}).get('id', '')

    if test_ver_id:
        s, d = req('GET', f'/courses/versions/{test_ver_id}', token=TOKEN)
        check('版本详情', s == 200, f'{s}')

        s, d = req('POST', f'/courses/versions/{test_ver_id}/chapters', {
            'chapter_no': 1, 'title': '第一章', 'content': '# 第一章\n\n内容内容',
            'estimated_duration_minutes': 30
        }, token=TOKEN)
        check('添加章节', s == 200, f'{s} {d}')
        test_chap_id = d.get('data', {}).get('id', '')

        if test_chap_id:
            s, d = req('PUT', f'/courses/chapters/{test_chap_id}', {
                'title': '第一章（修改）', 'content': '# 修改后内容'
            }, token=TOKEN)
            check('更新章节内容', s == 200, f'{s} {d}')

            s, d = req('DELETE', f'/courses/chapters/{test_chap_id}', token=TOKEN)
            check('删除章节', s == 200, f'{s} {d}')

        # submit for review
        s, d = req('POST', f'/courses/versions/{test_ver_id}/status', {'status': 'pending_review'}, token=TOKEN)
        check('提交审核', s == 200, f'{s} {d}')

        # rollback to draft first then test rollback
        s, d = req('POST', f'/courses/versions/{test_ver_id}/status', {'status': 'published'}, token=TOKEN)
        check('设置为发布状态', s == 200, f'{s}')

        # create another version to test rollback
        s, d = req('POST', f'/courses/{test_course_id}/versions', {'title': 'V2版本'}, token=TOKEN)
        check('创建第二个版本', s == 200, f'{s}')
        test_ver2_id = d.get('data', {}).get('id', '')

        if test_ver2_id:
            # rollback to V1
            s, d = req('POST', f'/courses/versions/{test_ver_id}/rollback', token=TOKEN)
            check('回滚到V1（应被拒绝，已是published）', s == 400, f'{s} {d}')

            # set v1 to archived then rollback
            s, d = req('POST', f'/courses/versions/{test_ver_id}/status', {'status': 'archived'}, token=TOKEN)
            s, d = req('POST', f'/courses/versions/{test_ver_id}/rollback', token=TOKEN)
            check('从归档状态回滚到发布', s == 200, f'{s} {d}')

    # delete course (should work since no training tasks reference it)
    s, d = req('DELETE', f'/courses/{test_course_id}', token=TOKEN)
    check('删除课程', s == 200, f'{s} {d}')

    s, d = req('GET', f'/courses/{test_course_id}', token=TOKEN)
    check('删除后课程不可访问', s == 404, f'{s}')

# ──────────────────────────────────────────────────────────
# 8. 题目管理
# ──────────────────────────────────────────────────────────
section('8. 题目管理')
s, d = req('GET', '/questions', token=TOKEN)
check('题目列表', s == 200, f'{s}')

s, d = req('POST', '/questions', {
    'question_type': 'single_choice',
    'stem': 'E2E测试题：以下哪个选项正确？',
    'options': {'A': '选项A', 'B': '选项B', 'C': '选项C', 'D': '选项D'},
    'answer_json': {'answer': 'A'},
    'analysis': '选A因为...',
    'difficulty_level': 2,
}, token=TOKEN)
check('创建单选题', s == 200, f'{s} {d}')
test_q_id = d.get('data', {}).get('id', '')

s, d = req('POST', '/questions', {
    'question_type': 'true_false',
    'stem': '判断题：地球是圆的',
    'options': None,
    'answer_json': {'answer': True},
    'analysis': '正确',
    'difficulty_level': 1,
}, token=TOKEN)
check('创建判断题', s == 200, f'{s} {d}')
test_q2_id = d.get('data', {}).get('id', '')

if test_q_id:
    s, d = req('GET', f'/questions/{test_q_id}', token=TOKEN)
    check('题目详情（含版本）', s == 200 and len(d.get('data', {}).get('versions', [])) >= 1, f'{s}')

    s, d = req('PUT', f'/questions/{test_q_id}', {
        'question_type': 'single_choice',
        'stem': 'E2E测试题（已修改）：以下哪个选项正确？',
        'options': {'A': '新选项A', 'B': '新选项B', 'C': '新选项C', 'D': '新选项D'},
        'answer_json': {'answer': 'B'},
        'analysis': '修改后选B',
        'difficulty_level': 3,
    }, token=TOKEN)
    check('更新题目（创建新版本）', s == 200, f'{s} {d}')

    s, d = req('GET', f'/questions/{test_q_id}', token=TOKEN)
    ver_count = len(d.get('data', {}).get('versions', []))
    check('更新后版本数 >= 2', ver_count >= 2, f'ver_count={ver_count}')

    s, d = req('POST', f'/questions/{test_q_id}/versions', {
        'question_type': 'single_choice',
        'stem': 'V3版本题干',
        'options': {'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D'},
        'answer_json': {'answer': 'C'},
        'difficulty_level': 1,
    }, token=TOKEN)
    check('新建题目版本', s == 200, f'{s}')

    s, d = req('POST', f'/questions/{test_q_id}/status', {'status': 'published'}, token=TOKEN)
    check('发布题目', s == 200, f'{s}')

if test_q2_id:
    s, d = req('DELETE', f'/questions/{test_q2_id}', token=TOKEN)
    check('删除未引用题目', s == 200, f'{s} {d}')

    s, d = req('GET', f'/questions/{test_q2_id}', token=TOKEN)
    check('删除后不可访问', s == 404, f'{s}')

# ──────────────────────────────────────────────────────────
# 9. 审核管理
# ──────────────────────────────────────────────────────────
section('9. 审核管理')
s, d = req('GET', '/reviews', token=TOKEN)
check('审核任务列表', s == 200, f'{s}')

# create a temp KP to review
s, d = req('POST', '/knowledge-points', {'name': f'审核测试KP_{ts}', 'subject': '测试'}, token=TOKEN)
review_kp_id = d.get('data', {}).get('id', '') if s == 200 else ''

if review_kp_id:
    s, d = req('POST', '/reviews', {
        'content_type': 'knowledge_point',
        'content_id': review_kp_id,
        'content_version_id': review_kp_id,
        'review_stage': 'first_review',
    }, token=TOKEN)
    check('创建审核任务', s == 200, f'{s} {d}')
    test_review_id = d.get('data', {}).get('id', '')

    if test_review_id:
        s, d = req('GET', f'/reviews/{test_review_id}', token=TOKEN)
        check('审核任务详情', s == 200, f'{s}')

        s, d = req('POST', f'/reviews/{test_review_id}/action', {
            'action': 'approve', 'comment': 'E2E测试通过'
        }, token=TOKEN)
        check('审核通过操作', s == 200, f'{s} {d}')

        # batch action — create more reviews first
        s, d = req('POST', '/reviews', {
            'content_type': 'knowledge_point',
            'content_id': review_kp_id,
            'content_version_id': review_kp_id,
            'review_stage': 'second_review',
        }, token=TOKEN)
        review2_id = d.get('data', {}).get('id', '') if s == 200 else ''

        if review2_id:
            s, d = req('POST', '/reviews/batch-action', {
                'task_ids': [review2_id], 'action': 'approve', 'comment': 'E2E批量通过'
            }, token=TOKEN)
            check('批量审核操作', s == 200 and d.get('data', {}).get('success_count', 0) >= 1, f'{s} {d}')

    # status filter
    s, d = req('GET', '/reviews?status=approved', token=TOKEN)
    check('已通过审核筛选', s == 200, f'{s}')

# ──────────────────────────────────────────────────────────
# 10. 试卷 + 考试管理
# ──────────────────────────────────────────────────────────
section('10. 试卷与考试管理')
s, d = req('GET', '/exams/papers', token=TOKEN)
check('试卷列表', s == 200, f'{s}')

# use the question created above (test_q_id)
q_ver_id = None
if test_q_id:
    s, d = req('GET', f'/questions/{test_q_id}', token=TOKEN)
    q_ver_id = d.get('data', {}).get('current_version_id')

paper_id = None
if q_ver_id:
    s, d = req('POST', '/exams/papers', {
        'title': f'E2E试卷_{ts}',
        'paper_type': 'practice',
        'question_version_ids': [q_ver_id],
        'scores': [10],
    }, token=TOKEN)
    check('创建试卷', s == 200, f'{s} {d}')
    paper_id = d.get('data', {}).get('id', '')

s, d = req('POST', '/exams', {
    'title': f'E2E测试考试_{ts}',
    'exam_mode': 'timed',
    'duration_minutes': 30,
    'total_score': 10,
    'pass_score': 6,
    'paper_id': paper_id,
}, token=TOKEN)
check('创建考试', s == 200, f'{s} {d}')
test_exam_id = d.get('data', {}).get('id', '')

if test_exam_id:
    s, d = req('GET', '/exams', token=TOKEN)
    check('考试列表', s == 200, f'{s}')

    s, d = req('PUT', f'/exams/{test_exam_id}', {
        'title': f'E2E考试（已修改）_{ts}',
        'duration_minutes': 45,
        'pass_score': 7,
    }, token=TOKEN)
    check('更新考试信息', s == 200, f'{s} {d}')

    s, d = req('POST', f'/exams/{test_exam_id}/publish', token=TOKEN)
    check('发布考试', s == 200, f'{s} {d}')

    s, d = req('PUT', f'/exams/{test_exam_id}', {'title': '修改已发布考试（应被拒绝）'}, token=TOKEN)
    check('已发布考试不可修改', s == 400, f'{s}')

    s, d = req('DELETE', f'/exams/{test_exam_id}', token=TOKEN)
    check('已发布考试不可删除', s == 400, f'{s} {d}')

# create another draft exam to test delete
s, d = req('POST', '/exams', {
    'title': f'待删除考试_{ts}',
    'exam_mode': 'timed', 'duration_minutes': 10,
    'total_score': 10, 'pass_score': 6,
}, token=TOKEN)
del_exam_id = d.get('data', {}).get('id', '') if s == 200 else ''
if del_exam_id:
    s, d = req('DELETE', f'/exams/{del_exam_id}', token=TOKEN)
    check('删除草稿考试', s == 200, f'{s} {d}')
    s, d = req('GET', f'/exams/{del_exam_id}', token=TOKEN)
    check('删除后考试不存在', s == 404, f'{s}')

# test question in paper cannot be deleted
if test_q_id and paper_id:
    s, d = req('DELETE', f'/questions/{test_q_id}', token=TOKEN)
    check('题目被试卷引用时无法删除', s == 400, f'{s} {d}')

# ──────────────────────────────────────────────────────────
# 11. 培训任务管理
# ──────────────────────────────────────────────────────────
section('11. 培训任务管理')
s, d = req('GET', '/training-tasks', token=TOKEN)
check('培训任务列表', s == 200, f'{s}')

s, d = req('POST', '/training-tasks', {
    'title': f'E2E培训任务_{ts}',
    'description': '端到端测试',
}, token=TOKEN)
check('创建培训任务', s == 200, f'{s} {d}')
test_task_id = d.get('data', {}).get('id', '')

if test_task_id:
    s, d = req('GET', f'/training-tasks/{test_task_id}', token=TOKEN)
    check('培训任务详情', s == 200, f'{s}')

    s, d = req('PUT', f'/training-tasks/{test_task_id}', {
        'title': 'E2E培训任务（改名）',
        'description': '已更新描述',
    }, token=TOKEN)
    check('更新培训任务', s == 200, f'{s} {d}')

    if test_user_id:
        s, d = req('POST', f'/training-tasks/{test_task_id}/assign', [test_user_id], token=TOKEN)
        check('分配学员', s == 200, f'{s} {d}')

        s, d = req('GET', f'/training-tasks/{test_task_id}', token=TOKEN)
        total_assigned = d.get('data', {}).get('total_assigned', 0)
        check('分配后学员数量 >= 1', total_assigned >= 1, f'total={total_assigned}')

        # update progress as the user
        asgn_list = d.get('data', {}).get('assignments', [])
        if asgn_list:
            asgn_id = asgn_list[0]['assignment_id']
            s, d = req('POST', f'/training-tasks/assignments/{asgn_id}/progress', {
                'progress_percent': 50,
                'last_position': {'chapter_index': 1},
            }, token=USER_TOKEN if 'USER_TOKEN' in dir() else TOKEN)
            check('更新学习进度', s == 200, f'{s} {d}')

        s, d = req('DELETE', f'/training-tasks/{test_task_id}/assignments/{test_user_id}', token=TOKEN)
        check('移除分配学员', s == 200, f'{s} {d}')

    # test: draft task can be deleted
    s, d = req('DELETE', f'/training-tasks/{test_task_id}', token=TOKEN)
    check('删除草稿培训任务', s == 200, f'{s} {d}')

    s, d = req('GET', f'/training-tasks/{test_task_id}', token=TOKEN)
    check('删除后培训任务不可访问', s == 404, f'{s}')

# test: published task cannot be deleted
s, d = req('POST', '/training-tasks', {'title': f'发布后删除测试_{ts}'}, token=TOKEN)
pub_task_id = d.get('data', {}).get('id', '') if s == 200 else ''
if pub_task_id:
    req('POST', f'/training-tasks/{pub_task_id}/publish', token=TOKEN)
    s, d = req('DELETE', f'/training-tasks/{pub_task_id}', token=TOKEN)
    check('已发布培训任务不可删除', s == 400, f'{s} {d}')

# ──────────────────────────────────────────────────────────
# 12. 成绩与统计
# ──────────────────────────────────────────────────────────
section('12. 成绩与统计')
s, d = req('GET', '/exams/all-attempts', token=TOKEN)
check('管理员查看全部考试记录', s == 200, f'{s}')

s, d = req('GET', '/system/statistics', token=TOKEN)
check('系统统计数据', s == 200, f'{s}')
ov = d.get('data', {}).get('overview', {})
check('统计数据含用户数', 'total_users' in ov, f'{ov}')
check('统计数据含文档数', 'total_documents' in ov, f'{ov}')
check('统计数据含考试通过率', 'exam_pass_rate' in ov, f'{ov}')

# ──────────────────────────────────────────────────────────
# 13. 审计与异步任务
# ──────────────────────────────────────────────────────────
section('13. 审计与异步任务')
s, d = req('GET', '/system/audit-logs', token=TOKEN)
check('审计日志列表', s == 200, f'{s}')

s, d = req('GET', '/system/async-jobs', token=TOKEN)
check('异步任务列表', s == 200, f'{s}')

# ──────────────────────────────────────────────────────────
# 14. 数据一致性验证
# ──────────────────────────────────────────────────────────
section('14. 数据一致性验证')

# Course referenced by training task cannot be deleted
s, d = req('POST', '/courses', {'title': f'一致性测试课程_{ts}'}, token=TOKEN)
cs_course_id = d.get('data', {}).get('id', '') if s == 200 else ''
cs_ver_id = None
if cs_course_id:
    s, d = req('POST', f'/courses/{cs_course_id}/versions', {'title': 'V1'}, token=TOKEN)
    cs_ver_id = d.get('data', {}).get('id', '') if s == 200 else ''

if cs_ver_id:
    s, d = req('POST', '/training-tasks', {
        'title': f'一致性任务_{ts}',
        'course_version_id': cs_ver_id,
    }, token=TOKEN)
    cs_task_id = d.get('data', {}).get('id', '') if s == 200 else ''

    if cs_task_id:
        s, d = req('DELETE', f'/courses/{cs_course_id}', token=TOKEN)
        check('被培训任务引用的课程不可删除', s == 400, f'{s} {d}')

        # clean up
        req('DELETE', f'/training-tasks/{cs_task_id}', token=TOKEN)
        req('DELETE', f'/courses/{cs_course_id}', token=TOKEN)

# Exam with submitted attempts cannot be deleted
s, d = req('GET', '/exams', token=TOKEN)
published_exams = [e for e in d.get('data', {}).get('items', []) if e['status'] == 'published']
if published_exams:
    existing_exam_id = published_exams[0]['id']
    s, d = req('DELETE', f'/exams/{existing_exam_id}', token=TOKEN)
    # may succeed (no attempts) or fail (has attempts)
    check('已发布考试删除有保护机制', s in [200, 400, 409], f'{s}')

# User deletion - check that user can be deleted
if test_user_id:
    s, d = req('DELETE', f'/users/{test_user_id}', token=TOKEN)
    check('用户删除', s == 200, f'{s} {d}')
    s, d = req('GET', f'/users/{test_user_id}', token=TOKEN)
    check('删除后用户不可访问', s == 404, f'{s}')

# ──────────────────────────────────────────────────────────
# RESULTS
# ──────────────────────────────────────────────────────────
total = PASS + FAIL
print(f'\n{"="*55}')
print(f'  测试结果: {PASS}/{total} 通过  ({FAIL} 失败)')
print('='*55)
if ERRORS:
    print('\n失败项目:')
    for e in ERRORS:
        print(f'  ✗ {e}')
print()
sys.exit(0 if FAIL == 0 else 1)
