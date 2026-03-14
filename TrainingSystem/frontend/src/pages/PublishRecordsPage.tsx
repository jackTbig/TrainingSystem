import { useEffect, useState } from 'react'
import { Button, Descriptions, Drawer, Progress, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface TaskRow {
  id: string; title: string; status: string
  due_at: string | null; created_at: string
}

interface TaskDetail {
  id: string; title: string; description?: string; status: string
  course_version_id: string | null; exam_id: string | null
  due_at: string | null; allow_makeup_exam: boolean; created_at: string
  total_assigned: number; completed_count: number
  assignments: {
    assignment_id: string; user_id: string; username: string; real_name: string
    assignment_status: string; progress_percent: number; completed: boolean
    study_completed_at: string | null; exam_score: number | null; exam_passed: boolean | null
  }[]
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'success', in_progress: 'processing',
  completed: 'cyan', archived: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', published: '已发布', in_progress: '进行中',
  completed: '已完成', archived: '已归档',
}
const ASGN_STATUS_LABEL: Record<string, string> = {
  pending: '待开始', in_progress: '学习中', completed: '已完成',
}

export default function PublishRecordsPage() {
  const [rows, setRows] = useState<TaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>('published')
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchData = async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (s) params.status = s
      const res = await client.get('/training-tasks', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: string) => {
    setDetailLoading(true)
    setDrawerOpen(true)
    try {
      const res = await client.get(`/training-tasks/${id}`)
      setDetail(res.data.data)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, statusFilter])

  const asgn_columns: ColumnsType<TaskDetail['assignments'][0]> = [
    { title: '姓名', dataIndex: 'real_name', width: 90, render: (v, r) => v || r.username },
    {
      title: '状态', dataIndex: 'assignment_status', width: 80,
      render: (s) => <Tag>{ASGN_STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '进度', dataIndex: 'progress_percent', width: 100,
      render: (v) => <Progress percent={v} size="small" style={{ marginBottom: 0 }} />,
    },
    {
      title: '考试成绩', dataIndex: 'exam_score', width: 80,
      render: (v, r) => v != null
        ? <Tag color={r.exam_passed ? 'success' : 'error'}>{v} 分</Tag>
        : <Text type="secondary">—</Text>,
    },
  ]

  const columns: ColumnsType<TaskRow> = [
    { title: '培训任务', dataIndex: 'title', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '截止时间', dataIndex: 'due_at', width: 160,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : <span style={{ color: '#bbb' }}>无限制</span>,
    },
    {
      title: '发布时间', dataIndex: 'created_at', width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 90,
      render: (_, row) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => loadDetail(row.id)}>明细</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>发布记录</Title>
        <Space>
          <Select
            style={{ width: 110 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={[
              { value: undefined, label: '全部状态' },
              ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
        </Space>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />

      <Drawer
        title="培训任务明细"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
        loading={detailLoading}
      >
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="任务名称" span={2}>{detail.title}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status] ?? detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="补考">
                {detail.allow_makeup_exam ? '允许' : '不允许'}
              </Descriptions.Item>
              <Descriptions.Item label="截止时间">
                {detail.due_at ? new Date(detail.due_at).toLocaleString('zh-CN') : '无限制'}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {new Date(detail.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="总学员数">{detail.total_assigned}</Descriptions.Item>
              <Descriptions.Item label="已完成">
                {detail.completed_count} / {detail.total_assigned}
              </Descriptions.Item>
              {detail.description && (
                <Descriptions.Item label="说明" span={2}>{detail.description}</Descriptions.Item>
              )}
            </Descriptions>

            {detail.total_assigned > 0 && (
              <>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>学员进度</Text>
                <Table
                  rowKey="assignment_id"
                  columns={asgn_columns}
                  dataSource={detail.assignments}
                  size="small"
                  pagination={detail.assignments.length > 10 ? { pageSize: 10 } : false}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}
