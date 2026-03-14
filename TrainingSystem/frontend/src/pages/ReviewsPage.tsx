import '@uiw/react-markdown-preview/markdown.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, Collapse, Descriptions, Form, Input, Modal, Row, Select, Space,
  Spin, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, CloseOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons'
import MDEditor from '@uiw/react-md-editor'
import client from '@/api/client'

const { Title, Text } = Typography

interface ReviewRow {
  id: string
  content_type: string
  content_id: string
  content_title: string | null
  content_description: string | null
  content_version_id: string
  review_stage: string
  status: string
  created_at: string
}

interface ReviewDetail {
  id: string; content_type: string; content_id: string
  content_version_id: string; status: string; review_stage: string
  comments: { id: string; comment_type: string; content: string; action_suggestion: string; created_at: string }[]
}

interface CourseChapter { id: string; chapter_no: number; title: string; content: string; estimated_duration_minutes: number | null }
interface CourseVersionDetail { id: string; version_no: number; title: string; summary: string | null; status: string; chapters: CourseChapter[] }

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
  const navigate = useNavigate()
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [versionContent, setVersionContent] = useState<CourseVersionDetail | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [actionModal, setActionModal] = useState<{ open: boolean; action: 'approve' | 'reject'; batch: boolean } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async (p = page, s = statusFilter, t = typeFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (s && s !== 'all') params.status = s
      if (t && t !== 'all') params.content_type = t
      const res = await client.get('/reviews', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, statusFilter, typeFilter])

  const loadDetail = async (row: ReviewRow) => {
    setVersionContent(null)
    setDetailLoading(true)
    try {
      const res = await client.get(`/reviews/${row.id}`)
      setDetail(res.data.data)
    } finally {
      setDetailLoading(false)
    }
    // 同步加载审核内容
    if (row.content_type === 'course_version') {
      setContentLoading(true)
      try {
        const res = await client.get(`/courses/versions/${row.content_version_id}`)
        setVersionContent(res.data.data)
      } finally {
        setContentLoading(false)
      }
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
        const res = await client.post('/reviews/batch-action', { task_ids: selectedRowKeys, action, comment })
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
      title: '类型', dataIndex: 'content_type', width: 90,
      render: (v) => <Tag>{TYPE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '审核内容', ellipsis: true,
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>
            {row.content_title || <Text type="secondary" style={{ fontSize: 12 }}>ID: {row.content_id.slice(0, 8)}…</Text>}
          </div>
          {row.content_description && (
            <div style={{ color: '#888', fontSize: 12 }}>{row.content_description}</div>
          )}
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '提交时间', dataIndex: 'created_at', width: 140,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 130,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="link" style={{ padding: 0 }} onClick={() => loadDetail(row)}>查看</Button>
          {(row.status === 'pending' || row.status === 'in_review') && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />}
                onClick={() => { loadDetail(row); openAction('approve', row.id) }}>通过</Button>
              <Button size="small" danger icon={<CloseOutlined />}
                onClick={() => { loadDetail(row); openAction('reject', row.id) }}>驳回</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  const selectedRow = rows.find(r => r.id === detail?.id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>内容审核</Title>
        <Space>
          <Select
            style={{ width: 110 }}
            value={typeFilter || 'all'}
            onChange={(v) => { setTypeFilter(v === 'all' ? undefined : v); setPage(1) }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Select
            style={{ width: 110 }}
            value={statusFilter || 'all'}
            onChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
            ]}
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
        <Col span={detail ? 10 : 24}>
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
            onRow={(row) => ({
              onClick: () => loadDetail(row),
              style: { cursor: 'pointer', background: detail?.id === row.id ? '#e6f7ff' : undefined },
            })}
            pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p), showTotal: (t) => `共 ${t} 条` }}
          />
        </Col>

        {detail && (
          <Col span={14}>
            <Card
              title={
                <Space>
                  <span>审核详情</span>
                  {selectedRow?.content_type === 'course_version' && (
                    <Button
                      size="small" type="link" icon={<LinkOutlined />}
                      onClick={() => navigate(`/courses/${detail.content_id}`)}
                    >
                      打开课程
                    </Button>
                  )}
                </Space>
              }
              extra={
                <Space>
                  {(detail.status === 'pending' || detail.status === 'in_review') && (
                    <>
                      <Button type="primary" icon={<CheckOutlined />} size="small"
                        onClick={() => openAction('approve', detail.id)}>通过</Button>
                      <Button danger icon={<CloseOutlined />} size="small"
                        onClick={() => openAction('reject', detail.id)}>驳回</Button>
                    </>
                  )}
                  <Button size="small" onClick={() => { setDetail(null); setVersionContent(null) }}>关闭</Button>
                </Space>
              }
              loading={detailLoading}
              style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}
            >
              {/* 基本信息 */}
              <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
                <Descriptions.Item label="类型">{TYPE_LABEL[detail.content_type] ?? detail.content_type}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status] ?? detail.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="审核内容" span={2}>
                  <Text strong>{selectedRow?.content_title}</Text>
                  {selectedRow?.content_description && (
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{selectedRow.content_description}</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              {/* 课程版本内容 */}
              {detail.content_type === 'course_version' && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>课程章节内容</Text>
                  {contentLoading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
                  ) : versionContent ? (
                    versionContent.chapters.length === 0 ? (
                      <div style={{ color: '#999', padding: '12px 0' }}>此版本暂无章节内容</div>
                    ) : (
                      <>
                        {/* 章节目录 */}
                        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '10px 16px', marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>章节目录（共 {versionContent.chapters.length} 章）</Text>
                          {versionContent.chapters.map(ch => (
                            <div key={ch.id} style={{ padding: '2px 0', fontSize: 13 }}>
                              <Text>第 {ch.chapter_no} 章：{ch.title}</Text>
                              {ch.estimated_duration_minutes && (
                                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>约 {ch.estimated_duration_minutes} 分钟</Text>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* 章节内容（默认全部展开） */}
                        <Collapse
                          size="small"
                          defaultActiveKey={versionContent.chapters.map(ch => ch.id)}
                          items={versionContent.chapters.map(ch => ({
                            key: ch.id,
                            label: (
                              <Text strong>第 {ch.chapter_no} 章：{ch.title}</Text>
                            ),
                            children: (
                              <div data-color-mode="light">
                                <MDEditor.Markdown source={ch.content} style={{ padding: '4px 8px' }} />
                              </div>
                            ),
                          }))}
                        />
                      </>
                    )
                  ) : null}
                </div>
              )}

              {/* 历史审核意见 */}
              {detail.comments.length > 0 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>历史审核意见</Text>
                  {detail.comments.map(c => (
                    <div key={c.id} style={{ background: '#f5f5f5', borderRadius: 4, padding: '8px 12px', marginBottom: 8 }}>
                      <Tag color={c.action_suggestion === 'approve' ? 'success' : 'error'} style={{ marginBottom: 4 }}>
                        {c.action_suggestion === 'approve' ? '通过' : '驳回'}
                      </Tag>
                      <Text style={{ display: 'block', fontSize: 13 }}>{c.content}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString('zh-CN')}</Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        )}
      </Row>

      <Modal
        title={actionModal?.action === 'approve'
          ? (actionModal.batch ? '批量通过' : '通过审核')
          : (actionModal?.batch ? '批量驳回' : '驳回审核')}
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
            <Input.TextArea rows={3} placeholder={actionModal?.action === 'reject' ? '请说明驳回原因...' : '请输入审核意见（可选）...'} />
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
