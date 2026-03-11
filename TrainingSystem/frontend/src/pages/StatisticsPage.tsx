import { useEffect, useState } from 'react'
import { Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from 'antd'
import {
  FileTextOutlined, TeamOutlined, TrophyOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface Overview {
  total_users: number
  total_documents: number
  total_training_tasks: number
  total_assignments: number
  completed_assignments: number
  completion_rate: number
  total_exam_attempts: number
  passed_exam_attempts: number
  exam_pass_rate: number
}

interface TaskStat {
  id: string
  title: string
  status: string
  total_assigned: number
  completed_count: number
  completion_rate: number
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'blue', in_progress: 'processing', completed: 'success', archived: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', published: '已发布', in_progress: '进行中', completed: '已结束', archived: '已归档',
}

export default function StatisticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/system/statistics').then(res => {
      setOverview(res.data.data.overview)
      setTaskStats(res.data.data.task_stats)
    }).finally(() => setLoading(false))
  }, [])

  const columns = [
    { title: '任务名称', dataIndex: 'title', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    { title: '已分配', dataIndex: 'total_assigned', width: 80 },
    { title: '已完成', dataIndex: 'completed_count', width: 80 },
    {
      title: '完成率', dataIndex: 'completion_rate', width: 180,
      render: (v: number) => <Progress percent={v} size="small" />,
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>培训统计</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="总用户数" value={overview?.total_users ?? 0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="文档总数" value={overview?.total_documents ?? 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="培训任务" value={overview?.total_training_tasks ?? 0} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="考试次数" value={overview?.total_exam_attempts ?? 0} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card title="培训完成率" loading={loading}>
            <Row align="middle" gutter={16}>
              <Col flex="1">
                <Progress
                  type="circle"
                  percent={overview?.completion_rate ?? 0}
                  size={120}
                  format={(p) => `${p}%`}
                />
              </Col>
              <Col flex="auto">
                <Statistic title="已完成" value={overview?.completed_assignments ?? 0} suffix={`/ ${overview?.total_assignments ?? 0}`} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="考试通过率" loading={loading}>
            <Row align="middle" gutter={16}>
              <Col flex="1">
                <Progress
                  type="circle"
                  percent={overview?.exam_pass_rate ?? 0}
                  size={120}
                  strokeColor="#52c41a"
                  format={(p) => `${p}%`}
                />
              </Col>
              <Col flex="auto">
                <Statistic title="已通过" value={overview?.passed_exam_attempts ?? 0} suffix={`/ ${overview?.total_exam_attempts ?? 0}`} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="近期培训任务完成情况（最近10条）">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={taskStats}
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}
