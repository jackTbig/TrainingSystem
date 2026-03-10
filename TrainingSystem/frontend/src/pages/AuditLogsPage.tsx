import { useEffect, useState } from 'react'
import { Button, Input, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface LogRow {
  id: string; operator_id: string | null; action: string
  resource_type: string | null; resource_id: string | null; created_at: string
}

const ACTION_COLOR: Record<string, string> = {
  create: 'success', update: 'processing', delete: 'error',
  login: 'cyan', logout: 'default', publish: 'purple',
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (actionFilter) params.action = actionFilter
      if (typeFilter) params.resource_type = typeFilter
      const res = await client.get('/system/audit-logs', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, typeFilter])

  const columns: ColumnsType<LogRow> = [
    {
      title: '操作', dataIndex: 'action', width: 120,
      render: (v) => {
        const key = Object.keys(ACTION_COLOR).find((k) => v.toLowerCase().includes(k)) ?? 'default'
        return <Tag color={ACTION_COLOR[key] ?? 'default'}>{v}</Tag>
      },
    },
    {
      title: '资源类型', dataIndex: 'resource_type', width: 120,
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: '资源ID', dataIndex: 'resource_id', ellipsis: true,
      render: (v) => v ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span> : '—',
    },
    {
      title: '操作人', dataIndex: 'operator_id', width: 200,
      render: (v) => v ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span> : <Tag>系统</Tag>,
    },
    {
      title: '时间', dataIndex: 'created_at', width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>审计日志</Title>
        <Space>
          <Input
            placeholder="操作关键词" style={{ width: 140 }}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            onPressEnter={() => { setPage(1); fetchData(1) }}
            allowClear
          />
          <Select
            placeholder="资源类型" allowClear style={{ width: 120 }}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1) }}
            options={[
              { value: 'user', label: '用户' },
              { value: 'document', label: '文档' },
              { value: 'course', label: '课程' },
              { value: 'question', label: '题目' },
              { value: 'exam', label: '考试' },
              { value: 'training_task', label: '培训任务' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); fetchData(1) }}>刷新</Button>
        </Space>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />
    </div>
  )
}
