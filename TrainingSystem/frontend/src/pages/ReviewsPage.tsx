import { useEffect, useState } from 'react'
import {
  Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface ReviewRow {
  id: string; content_type: string; content_id: string; content_version_id: string
  review_stage: string; status: string; created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing', in_review: 'blue', approved: 'success', rejected: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待审核', in_review: '审核中', approved: '已通过', rejected: '已驳回',
}
const TYPE_LABEL: Record<string, string> = {
  course_version: '课程版本', question_version: '题目版本', knowledge_point: '知识点',
}

export default function ReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (s) params.status = s
      const res = await client.get('/reviews', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, statusFilter])

  const handleApprove = async (values: { comment?: string }) => {
    if (!selectedId) return
    setActionLoading(true)
    try {
      await client.post(`/reviews/${selectedId}/action`, { action: 'approve', comment: values.comment || '' })
      message.success('已通过审核')
      setApproveOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (values: { comment: string }) => {
    if (!selectedId) return
    setActionLoading(true)
    try {
      await client.post(`/reviews/${selectedId}/action`, { action: 'reject', comment: values.comment })
      message.success('已驳回')
      setRejectOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setActionLoading(false)
    }
  }

  const columns: ColumnsType<ReviewRow> = [
    {
      title: '内容类型', dataIndex: 'content_type', width: 110,
      render: (v) => <Tag>{TYPE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '内容ID', dataIndex: 'content_id', width: 100,
      render: (v) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 8)}…</Text>,
    },
    { title: '审核阶段', dataIndex: 'review_stage', width: 90 },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 160,
      render: (_, row) => row.status === 'pending' || row.status === 'in_review' ? (
        <Space size="small">
          <Button
            size="small" type="primary" icon={<CheckOutlined />}
            onClick={() => { setSelectedId(row.id); setApproveOpen(true) }}
          >通过</Button>
          <Button
            size="small" danger icon={<CloseOutlined />}
            onClick={() => { setSelectedId(row.id); setRejectOpen(true) }}
          >驳回</Button>
        </Space>
      ) : null,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>审核任务</Title>
        <Space>
          <Select
            placeholder="状态筛选" allowClear style={{ width: 120 }}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
        </Space>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p), showTotal: (t) => `共 ${t} 条` }}
      />

      {/* 通过弹窗 */}
      <Modal title="通过审核" open={approveOpen} onCancel={() => { setApproveOpen(false); form.resetFields() }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleApprove} style={{ marginTop: 16 }}>
          <Form.Item label="审核意见（可选）" name="comment">
            <Input.TextArea rows={3} placeholder="请输入审核意见..." />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setApproveOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={actionLoading} icon={<CheckOutlined />}>确认通过</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回弹窗 */}
      <Modal title="驳回审核" open={rejectOpen} onCancel={() => { setRejectOpen(false); form.resetFields() }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleReject} style={{ marginTop: 16 }}>
          <Form.Item label="驳回原因" name="comment" rules={[{ required: true, message: '请填写驳回原因' }]}>
            <Input.TextArea rows={3} placeholder="请说明驳回原因..." />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setRejectOpen(false); form.resetFields() }}>取消</Button>
              <Button danger htmlType="submit" loading={actionLoading} icon={<CloseOutlined />}>确认驳回</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
