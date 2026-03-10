import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Col, Progress, Row, Space, Tag, Typography } from 'antd'
import { BookOutlined, FileSearchOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface TrainingItem {
  assignment_id: string; task_id: string; title: string; description: string | null
  course_version_id: string | null; exam_id: string | null
  due_at: string | null; assignment_status: string; progress_percent: number; completed: boolean
}

const STATUS_COLOR: Record<string, string> = {
  assigned: 'blue', study_completed: 'cyan', exam_passed: 'success', overdue: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  assigned: '未开始', study_completed: '已完成学习', exam_passed: '考试通过', overdue: '已逾期',
}

export default function MyTrainingPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TrainingItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await client.get('/training-tasks/my', { params: { page: 1, page_size: 50 } })
      setTasks(res.data.data.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>我的培训</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
      </div>

      {tasks.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无培训任务</div>
      )}

      <Row gutter={[16, 16]}>
        {tasks.map((task) => (
          <Col key={task.assignment_id} xs={24} sm={12} lg={8}>
            <Card
              title={task.title}
              extra={<Tag color={STATUS_COLOR[task.assignment_status] ?? 'default'}>{STATUS_LABEL[task.assignment_status] ?? task.assignment_status}</Tag>}
            >
              {task.description && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{task.description}</Text>
              )}
              <Progress percent={task.progress_percent} size="small" style={{ marginBottom: 12 }} />
              {task.due_at && (
                <Text type={new Date(task.due_at) < new Date() ? 'danger' : 'secondary'} style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                  截止：{new Date(task.due_at).toLocaleDateString('zh-CN')}
                </Text>
              )}
              <Space>
                {task.course_version_id && (
                  <Button size="small" icon={<BookOutlined />} onClick={() => navigate(`/study/${task.course_version_id}`)}>
                    去学习
                  </Button>
                )}
                {task.exam_id && (
                  <Button size="small" icon={<FileSearchOutlined />} onClick={() => navigate('/my-exams')}>
                    去考试
                  </Button>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
