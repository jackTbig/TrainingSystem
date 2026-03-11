import { useEffect, useState } from 'react'
import {
  Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space,
  Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface ReviewRow {
  id: string; content_type: string; content_id: string; content_version_id: string
  review_stage: string; status: string; created_at: string
}

interface ReviewDetail {
  id: string; content_type: string; content_id: string; status: string; review_stage: string
  comments: { id: string; comment_type: string; content: string; action_suggestion: string; created_at: string }[]
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionModal, setActionModal] = useState<{ open: boolean; action: 'approve' | 'reject'; batch: boolean } | null>(null)
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

  const loadDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await client.get(`/reviews/${id}`)
      setDetail(res.data.data)
    } finally {
      setDetailLoading(false)
    }
  }

  const openAction = (action: 'approve' | 'reject', id?: string, batch = false) => {
    form.resetFields()
    if (id) setSelectedId(id)
    setActionModal({ open: true, action, batch })
  }

  const handleAction = async (values: { comment?: string }) => {
    const isBatch = actionModal?.batch
    const action = actionModal!.action
    const comment = values.comment || ''
    setActionLoading(true)
    try {
      if (isBatch) {
        const res = await client.post('/reviews/batch-action', {
          task_ids: selectedRowKeys,
          action,
          comment,
        })
        message.success(res.data.message || '批量操作完成')
        setSelectedRowKeys([])
      } else {
        await client.post(`/reviews/${selectedId}/action`, { action, comment })
        message.success(action === 'approve' ? '已通过' : '已驳回')
        if (detail?.id === selectedId) setDetail(null)
      }
      setActionModal(null)
      fetchData(1)
    } finally {
      setActionLoading(false)
    }
  }

  const pendingSelected = (selectedRowKeys as string[]).filter(
    id => rows.find(r => r.id === id && (r.status === 'pending' || r.status === 'in_review'))
  )

  const columns: ColumnsType<ReviewRow> = [
    {
      title: '类型', dataIndex: 'content_type', width: 100,
      render: (v) => <Tag>{TYPE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '内容ID', dataIndex: 'content_id', width: 90,
      render: (v) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 8)}…</Text>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => loadDetail(row.id)}>详情</Button>
          {(row.status === 'pending' || row.status === 'in_review') && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />}
                onClick={() => openAction('approve', row.id)}>通过</Button>
              <Button size="small" danger icon={<CloseOutlined />}
                onClick={() => openAction('reject', row.id)}>驳回</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>审核任务</Title>
        <Space>
          <Select
            placeholder="状态筛选" allowClear style={{ width: 120 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
        </Space>
      </div>

      {pendingSelected.length > 0 && (
        <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 6, padding: '8px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text>已选 {pendingSelected.length} 条待审核</Text>
          <Button size="small" type="primary" icon={<CheckOutlined />}
            onClick={() => openAction('approve', undefined, true)}>批量通过</Button>
          <Button size="small" danger icon={<CloseOutlined />}
            onClick={() => openAction('reject', undefined, true)}>批量驳回</Button>
        </div>
      )}

      <Row gutter={16}>
        <Col span={detail ? 14 : 24}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            size="small"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              getCheckboxProps: (row) => ({ disabled: row.status !== 'pending' && row.status !== 'in_review' }),
            }}
            onRow={(row) => ({ onClick: () => loadDetail(row.id), style: { cursor: 'pointer' } })}
            pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p), showTotal: (t) => `共 ${t} 条` }}
          />
        </Col>

        {detail && (
          <Col span={10}>
            <Card
              title="审核详情"
              extra={<Button size="small" onClick={() => setDetail(null)}>关闭</Button>}
              loading={detailLoading}
            >
              <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
                <Descriptions.Item label="类型">{TYPE_LABEL[detail.content_type] ?? detail.content_type}</Descriptions.Item>
                <Descriptions.Item label="内容ID">
                  <Text code style={{ fontSize: 11 }}>{detail.content_id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="阶段">{detail.review_stage}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status] ?? detail.status}</Tag>
                </Descriptions.Item>
              </Descriptions>

              {detail.comments.length > 0 && (
                <>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>审核意见</Text>
                  {detail.comments.map(c => (
                    <div key={c.id} style={{ background: '#f5f5f5', borderRadius: 4, padding: '8px 12px', marginBottom: 8 }}>
                      <Tag color={c.action_suggestion === 'approve' ? 'success' : 'error'} style={{ marginBottom: 4 }}>
                        {c.action_suggestion === 'approve' ? '通过' : '驳回'}
                      </Tag>
                      <Text style={{ display: 'block', fontSize: 13 }}>{c.content}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString('zh-CN')}</Text>
                    </div>
                  ))}
                </>
              )}

              {(detail.status === 'pending' || detail.status === 'in_review') && (
                <Space style={{ marginTop: 8 }}>
                  <Button type="primary" icon={<CheckOutlined />} size="small"
                    onClick={() => openAction('approve', detail.id)}>通过</Button>
                  <Button danger icon={<CloseOutlined />} size="small"
                    onClick={() => openAction('reject', detail.id)}>驳回</Button>
                </Space>
              )}
            </Card>
          </Col>
        )}
      </Row>

      <Modal
        title={actionModal?.action === 'approve' ? (actionModal.batch ? '批量通过' : '通过审核') : (actionModal?.batch ? '批量驳回' : '驳回审核')}
        open={actionModal?.open}
        onCancel={() => { setActionModal(null); form.resetFields() }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAction} style={{ marginTop: 16 }}>
          <Form.Item
            label={actionModal?.action === 'reject' ? '驳回原因' : '审核意见（可选）'}
            name="comment"
            rules={actionModal?.action === 'reject' ? [{ required: true, message: '请填写驳回原因' }] : []}
          >
            <Input.TextArea rows={3} placeholder={actionModal?.action === 'reject' ? '请说明驳回原因...' : '请输入审核意见...'} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setActionModal(null); form.resetFields() }}>取消</Button>
              {actionModal?.action === 'approve'
                ? <Button type="primary" htmlType="submit" loading={actionLoading} icon={<CheckOutlined />}>确认通过</Button>
                : <Button danger htmlType="submit" loading={actionLoading} icon={<CloseOutlined />}>确认驳回</Button>
              }
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
