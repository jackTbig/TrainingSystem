import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd'
import { ClockCircleOutlined, PlayCircleOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface MyAttempt {
  attempt_id: string; status: string; total_score: number | null; pass_result: boolean | null; started_at: string
}
interface ExamItem {
  id: string; title: string; description: string | null
  duration_minutes: number; total_score: number; pass_score: number
  exam_mode: string; start_at: string | null; end_at: string | null
  my_attempt: MyAttempt | null
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ongoing: { label: '进行中', color: 'processing' },
  submitted: { label: '已提交', color: 'warning' },
  graded: { label: '已评分', color: 'default' },
}

export default function MyExamsPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await client.get('/exams/my', { params: { page: 1, page_size: 50 } })
      setExams(res.data.data.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleStart = async (exam: ExamItem) => {
    try {
      const res = await client.post(`/exams/${exam.id}/start`)
      const { attempt_id, resumed } = res.data.data
      if (resumed) message.info('继续上次未完成的考试')
      navigate(`/exam/${exam.id}/take/${attempt_id}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || '无法开始考试')
    }
  }

  const handleViewResult = (attemptId: string) => {
    navigate(`/exam/${attemptId}/result`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>我的考试</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
      </div>

      {exams.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          暂无可参加的考试
        </div>
      )}

      <Row gutter={[16, 16]}>
        {exams.map((exam) => {
          const attempt = exam.my_attempt
          const canStart = !attempt || attempt.status === 'ongoing'
          const isGraded = attempt?.status === 'graded'
          const passed = attempt?.pass_result === true

          return (
            <Col key={exam.id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                title={exam.title}
                extra={
                  attempt ? (
                    <Tag color={STATUS_MAP[attempt.status]?.color ?? 'default'}>
                      {STATUS_MAP[attempt.status]?.label ?? attempt.status}
                    </Tag>
                  ) : <Tag>未开始</Tag>
                }
                actions={[
                  canStart ? (
                    <Button
                      key="start"
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleStart(exam)}
                    >
                      {attempt?.status === 'ongoing' ? '继续作答' : '开始考试'}
                    </Button>
                  ) : (
                    <Button
                      key="result"
                      icon={<TrophyOutlined />}
                      onClick={() => handleViewResult(attempt!.attempt_id)}
                    >
                      查看结果
                    </Button>
                  ),
                ]}
              >
                {exam.description && (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{exam.description}</Text>
                )}
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text><ClockCircleOutlined style={{ marginRight: 4 }} />时长：{exam.duration_minutes} 分钟</Text>
                  <Text>总分：{exam.total_score} 分 · 及格：{exam.pass_score} 分</Text>
                  {isGraded && attempt && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: passed ? '#f6ffed' : '#fff2f0', borderRadius: 6 }}>
                      <Text style={{ color: passed ? '#52c41a' : '#ff4d4f' }} strong>
                        {passed ? '通过' : '未通过'} · 得分 {attempt.total_score ?? '—'}
                      </Text>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}
