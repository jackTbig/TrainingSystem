import { useEffect, useState } from 'react'
import { Button, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface JobRow {
  id: string; job_type: string; biz_label: string; biz_id: string | null
  status: string; retry_count: number; error_message: string | null
  created_at: string; started_at: string | null; finished_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'default', running: 'processing', succeeded: 'success',
  failed: 'error', cancelled: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '运行中', succeeded: '成功',
  failed: '失败', cancelled: '已取消',
}
const JOB_TYPE_LABEL: Record<string, string> = {
  document_parse: '文档解析', course_generate: '课程生成', question_generate: '题目生成',
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const sec = Math.floor((e - s) / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

export default function AsyncJobsPage() {
  const [rows, setRows] = useState<JobRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.job_type = typeFilter
      const res = await client.get('/system/bg-tasks', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, statusFilter, typeFilter])

  const columns: ColumnsType<JobRow> = [
    {
      title: '任务类型', dataIndex: 'biz_label', width: 110,
      render: (v, r) => <Tag color="blue">{JOB_TYPE_LABEL[r.job_type] ?? v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    { title: '重试', dataIndex: 'retry_count', width: 55 },
    {
      title: '用时', width: 90,
      render: (_, r) => duration(r.started_at, r.finished_at),
    },
    {
      title: '错误信息', dataIndex: 'error_message', ellipsis: true,
      render: (v) => v ? (
        <Tooltip title={v}>
          <Text type="danger" style={{ fontSize: 12 }}>{v}</Text>
        </Tooltip>
      ) : '—',
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>后台任务</Title>
        <Space>
          <Select
            placeholder="状态" allowClear style={{ width: 100 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Select
            placeholder="任务类型" allowClear style={{ width: 120 }}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1) }}
            options={Object.entries(JOB_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
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
