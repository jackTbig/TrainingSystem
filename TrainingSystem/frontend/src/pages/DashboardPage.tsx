import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import {
  BookOutlined, FileTextOutlined, FormOutlined,
  QuestionCircleOutlined, TeamOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '@/store'
import client from '@/api/client'

const { Title, Text } = Typography

const cardStyle = { cursor: 'pointer', transition: 'box-shadow 0.2s' }
const cardHover = { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }

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
  const [hovered, setHovered] = useState<string | null>(null)
  const navigate = useNavigate()

  const isAdmin = user?.roles?.some((r: any) =>
    typeof r === 'string' ? r === 'admin' : r?.code === 'admin'
  ) ?? false

  useEffect(() => {
    client.get('/dashboard').then((res) => setStats(res.data.data)).catch(() => {})
  }, [])

  const go = (path: string) => navigate(path)

  const mk = (key: string) => ({
    style: { ...cardStyle, ...(hovered === key ? cardHover : {}) },
    onMouseEnter: () => setHovered(key),
    onMouseLeave: () => setHovered(null),
  })

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>欢迎回来，{user?.real_name}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {isAdmin ? '内部培训考试系统管理后台' : '内部培训考试系统'}
      </Text>

      <Row gutter={[16, 16]}>
        {isAdmin ? (
          // ── 管理员：全局数据 ────────────────────────────────────────
          <>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('users')} onClick={() => go('/system/users')}>
                <Statistic title="活跃用户" value={stats?.users ?? '—'} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('docs')} onClick={() => go('/documents')}>
                <Statistic title="文档总数" value={stats?.documents.total ?? '—'} prefix={<FileTextOutlined />}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>已解析 {stats.documents.parsed}</Text> : null} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('kp')} onClick={() => go('/knowledge-points')}>
                <Statistic title="知识点" value={stats?.knowledge_points.total ?? '—'} prefix={<ThunderboltOutlined />}
                  suffix={stats?.knowledge_points.candidates_pending ? <Text type="warning" style={{ fontSize: 12 }}>待审 {stats.knowledge_points.candidates_pending}</Text> : null} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('courses')} onClick={() => go('/courses')}>
                <Statistic title="课程" value={stats?.courses.total ?? '—'} prefix={<BookOutlined />}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>已发布 {stats.courses.published}</Text> : null} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('questions')} onClick={() => go('/questions')}>
                <Statistic title="题目数量" value={stats?.questions.total ?? '—'} prefix={<QuestionCircleOutlined />}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>已发布 {stats.questions.published}</Text> : null} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('exams')} onClick={() => go('/exams')}>
                <Statistic title="考试场次" value={stats?.exams.total ?? '—'} prefix={<FormOutlined />}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>答题 {stats.exams.attempts} 次</Text> : null} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card {...mk('training')} onClick={() => go('/training-tasks')}>
                <Statistic title="培训任务" value={stats?.training_tasks.total ?? '—'} prefix={<BookOutlined />}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>进行中 {stats.training_tasks.in_progress}</Text> : null} />
              </Card>
            </Col>
          </>
        ) : (
          // ── 普通用户：仅自己相关数据 ────────────────────────────────
          <>
            <Col xs={24} sm={12} md={8}>
              <Card {...mk('exams')} onClick={() => go('/my-exams')}>
                <Statistic title="我参与的考试" value={stats?.exams.total ?? '—'} prefix={<FormOutlined />}
                  valueStyle={{ color: '#1677ff' }}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>答题 {stats.exams.attempts} 次</Text> : null} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card {...mk('training')} onClick={() => go('/my-training')}>
                <Statistic title="我的培训任务" value={stats?.training_tasks.total ?? '—'} prefix={<BookOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                  suffix={stats ? <Text type="secondary" style={{ fontSize: 12 }}>进行中 {stats.training_tasks.in_progress}</Text> : null} />
              </Card>
            </Col>
          </>
        )}
      </Row>
    </div>
  )
}
