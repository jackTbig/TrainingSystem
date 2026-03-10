import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import {
  BookOutlined, FileTextOutlined, FormOutlined,
  QuestionCircleOutlined, TeamOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import client from '@/api/client'

const { Title, Text } = Typography

interface Stats {
  users: number
  documents: { total: number; parsed: number; uploading: number }
  knowledge_points: { total: number; candidates_pending: number }
  courses: { total: number; published: number }
  questions: { total: number; published: number }
  exams: { total: number; published: number; attempts: number }
  training_tasks: { total: number; in_progress: number }
}

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    client.get('/dashboard').then((res) => setStats(res.data.data)).catch(() => {})
  }, [])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>欢迎回来，{user?.real_name}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>内部培训考试系统管理后台</Text>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="活跃用户" value={stats?.users ?? '—'} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="文档总数" value={stats?.documents.total ?? '—'} prefix={<FileTextOutlined />}
              suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>已解析 {stats.documents.parsed}</Text> : null} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="知识点" value={stats?.knowledge_points.total ?? '—'} prefix={<ThunderboltOutlined />}
              suffix={stats?.knowledge_points.candidates_pending ? <Text type="warning" style={{ fontSize: 12 }}>待审 {stats.knowledge_points.candidates_pending}</Text> : null} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="课程" value={stats?.courses.total ?? '—'} prefix={<BookOutlined />}
              suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>已发布 {stats.courses.published}</Text> : null} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="题目数量" value={stats?.questions.total ?? '—'} prefix={<QuestionCircleOutlined />}
              suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>已发布 {stats.questions.published}</Text> : null} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="考试场次" value={stats?.exams.total ?? '—'} prefix={<FormOutlined />}
              suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>答题 {stats.exams.attempts} 次</Text> : null} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="培训任务" value={stats?.training_tasks.total ?? '—'} prefix={<BookOutlined />}
              suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>进行中 {stats.training_tasks.in_progress}</Text> : null} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
