import { useEffect, useState } from 'react'
import { Button, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface TaskRow {
  id: string; title: string; status: string
  due_at: string | null; created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'success', in_progress: 'processing',
  completed: 'cyan', archived: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', published: '已发布', in_progress: '进行中',
  completed: '已完成', archived: '已归档',
}

export default function PublishRecordsPage() {
  const [rows, setRows] = useState<TaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>('published')

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

  useEffect(() => { fetchData() }, [page, statusFilter])

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
    </div>
  )
}
