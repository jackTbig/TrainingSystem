import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Badge, Button, Card, Col, Descriptions, Modal, Progress,
  Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, UserOutlined, BookOutlined,
} from '@ant-design/icons'
import client from '../api/client'

const { Title, Text } = Typography

interface Assignment {
  assignment_id: string
  user_id: string
  username: string
  real_name: string
  assignment_status: string
  progress_percent: number
  completed: boolean
  study_completed_at: string | null
  exam_score: number | null
  exam_passed: boolean | null
}

interface TaskDetail {
  id: string
  title: string
  description: string | null
  status: string
  course_version_id: string | null
  exam_id: string | null
  course_title: string | null
  exam_title: string | null
  due_at: string | null
  allow_makeup_exam: boolean
  created_at: string
  total_assigned: number
  completed_count: number
  assignments: Assignment[]
}

interface UserItem { id: string; username: string; real_name: string }

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'blue', label: '已发布' },
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已结束' },
  archived: { color: 'warning', label: '已归档' },
}

const ASGN_STATUS: Record<string, { color: string; label: string }> = {
  assigned: { color: 'default', label: '未开始' },
  study_completed: { color: 'cyan', label: '已完成学习' },
  exam_completed: { color: 'success', label: '考试通过' },
  overdue: { color: 'error', label: '已逾期' },
}

export default function TrainingTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)

  const fetchTask = async () => {
    setLoading(true)
    try {
      const res = await client.get(`/training-tasks/${taskId}`)
      setTask(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTask() }, [taskId])

  const openAssign = async () => {
    try {
      const res = await client.get('/users', { params: { page: 1, page_size: 200 } })
      setAllUsers(res.data.data.items)
    } catch {
      setAllUsers([])
    }
    setSelectedUsers([])
    setAssignOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedUsers.length) { message.warning('请选择学员'); return }
    setAssigning(true)
    try {
      await client.post(`/training-tasks/${taskId}/assign`, selectedUsers)
      message.success(`已分配 ${selectedUsers.length} 名学员`)
      setAssignOpen(false)
      fetchTask()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '分配失败')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemove = (userId: string, name: string) => {
    Modal.confirm({
      title: `移除学员 ${name}？`,
      onOk: async () => {
        await client.delete(`/training-tasks/${taskId}/assignments/${userId}`)
        message.success('已移除')
        fetchTask()
      },
    })
  }

  const columns = [
    {
      title: '姓名', dataIndex: 'real_name', width: 120,
      render: (v: string, row: Assignment) => `${v || ''}（${row.username}）`,
    },
    {
      title: '状态', dataIndex: 'assignment_status', width: 110,
      render: (v: string) => {
        const s = ASGN_STATUS[v] || { color: 'default', label: v }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '学习进度', dataIndex: 'progress_percent', width: 160,
      render: (v: number) => <Progress percent={v} size="small" />,
    },
    {
      title: '考试成绩', dataIndex: 'exam_score', width: 130,
      render: (v: number | null, row: Assignment) =>
        v == null ? '—' : (
          <Space>
            <Text strong style={{ color: row.exam_passed ? '#52c41a' : '#ff4d4f' }}>{v} 分</Text>
            <Tag color={row.exam_passed ? 'success' : 'error'}>{row.exam_passed ? '通过' : '未通过'}</Tag>
          </Space>
        ),
    },
    {
      title: '完成学习时间', dataIndex: 'study_completed_at', width: 150,
      render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '—',
    },
    {
      title: '操作', width: 80,
      render: (_: unknown, row: Assignment) => (
        <Button danger size="small" icon={<DeleteOutlined />}
          onClick={() => handleRemove(row.user_id, row.real_name || row.username)} />
      ),
    },
  ]

  if (!task && !loading) return <div style={{ padding: 40 }}>任务不存在</div>

  const st = task ? (STATUS_MAP[task.status] || { color: 'default', label: task.status }) : null
  const completionRate = task && task.total_assigned > 0
    ? Math.round(task.completed_count / task.total_assigned * 100) : 0

  // Already-assigned user IDs for filtering in selector
  const assignedIds = new Set(task?.assignments.map(a => a.user_id) ?? [])

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/training-tasks')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>{task?.title ?? '加载中…'}</Title>
        {st && <Tag color={st.color}>{st.label}</Tag>}
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="已分配学员" value={task?.total_assigned ?? 0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成学习" value={task?.completed_count ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="完成率" value={completionRate} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="截止日期"
              value={task?.due_at ? new Date(task.due_at).toLocaleDateString('zh-CN') : '不限'} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="描述" span={2}>{task?.description || '—'}</Descriptions.Item>
          <Descriptions.Item label="关联课程">
            {task?.course_title
              ? <Space><BookOutlined /><span>{task.course_title}</span></Space>
              : <span style={{ color: '#ccc' }}>未关联</span>}
          </Descriptions.Item>
          <Descriptions.Item label="关联考试">
            {task?.exam_title
              ? <Tag color="blue">{task.exam_title}</Tag>
              : <span style={{ color: '#ccc' }}>未关联</span>}
          </Descriptions.Item>
          <Descriptions.Item label="允许补考">
            <Badge status={task?.allow_makeup_exam ? 'success' : 'default'}
              text={task?.allow_makeup_exam ? '是' : '否'} />
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {task?.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="学员分配与进度"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAssign}>
            分配学员
          </Button>
        }
      >
        <Table
          rowKey="assignment_id"
          columns={columns}
          dataSource={task?.assignments ?? []}
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title="分配学员"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={handleAssign}
        okText="确认分配"
        confirmLoading={assigning}
        width={480}
      >
        <p style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>已分配的学员不会重复添加</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="搜索并选择学员"
          showSearch
          filterOption={(input, option) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          value={selectedUsers}
          onChange={setSelectedUsers}
          options={allUsers.map(u => ({
            value: u.id,
            label: `${u.real_name || u.username}（${u.username}）`,
            disabled: assignedIds.has(u.id),
          }))}
        />
      </Modal>
    </div>
  )
}
