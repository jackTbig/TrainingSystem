import { useEffect, useState } from 'react'
import {
  Badge, Button, Descriptions, Drawer, Modal, Popconfirm,
  Select, Space, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, CloseOutlined, DownloadOutlined, EyeOutlined, FilePdfOutlined, LinkOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Candidate } from '@/api/knowledge'
import { candidatesApi, knowledgePointsApi } from '@/api/knowledge'
import client from '@/api/client'

const { Title, Text, Paragraph } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  accepted: 'success',
  ignored: 'default',
  merged: 'purple',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待审核', accepted: '已接受', ignored: '已忽略', merged: '已合并',
}

export default function KnowledgeCandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  // 详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<Candidate | null>(null)
  const [linkedKp, setLinkedKp] = useState<{ id: string; name: string } | null>(null)
  const [kpLoading, setKpLoading] = useState(false)
  const [sourceChunk, setSourceChunk] = useState<{
    chunk_index: number; chapter_title: string | null; content: string
    document: { id: string; title: string; file_name: string } | null
  } | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)

  const navigate = useNavigate()

  const fetchData = async (p = page, s = statusFilter, ps = pageSize) => {
    setLoading(true)
    try {
      const res = await candidatesApi.list({ page: p, page_size: ps, status: s })
      setItems(res.data.data.items)
      setTotal(res.data.data.total)
      setSelectedIds([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1, statusFilter) }, [statusFilter])

  // ── 单条操作 ──────────────────────────────────────────────────────────────

  const handleAccept = (row: Candidate) => {
    Modal.confirm({
      title: '接受候选知识点',
      content: (
        <div>
          <p>将创建知识点：<strong>{row.candidate_name}</strong></p>
          <p style={{ color: '#888', fontSize: 12 }}>{row.candidate_description}</p>
        </div>
      ),
      okText: '确认接受',
      onOk: async () => {
        await candidatesApi.accept(row.id, {})
        message.success('已接受并创建知识点')
        if (detail?.id === row.id) setDrawerOpen(false)
        fetchData()
      },
    })
  }

  const handleIgnore = (row: Candidate) => {
    Modal.confirm({
      title: '忽略此候选知识点？',
      content: `"${row.candidate_name}" 将被标记为已忽略`,
      okText: '确认忽略',
      okButtonProps: { danger: true },
      onOk: async () => {
        await candidatesApi.ignore(row.id)
        message.success('已忽略')
        if (detail?.id === row.id) setDrawerOpen(false)
        fetchData()
      },
    })
  }

  // ── 批量操作 ──────────────────────────────────────────────────────────────

  const handleBatchAccept = async () => {
    setBatchLoading(true)
    try {
      const res = await client.post('/knowledge-points/candidates/batch-accept', { ids: selectedIds })
      const { accepted, failed } = res.data.data
      message.success(`已接受 ${accepted} 条${failed ? `，${failed} 条失败` : ''}`)
      fetchData()
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchIgnore = async () => {
    setBatchLoading(true)
    try {
      const res = await client.post('/knowledge-points/candidates/batch-ignore', { ids: selectedIds })
      const { ignored, failed } = res.data.data
      message.success(`已忽略 ${ignored} 条${failed ? `，${failed} 条失败` : ''}`)
      fetchData()
    } finally {
      setBatchLoading(false)
    }
  }

  const pendingSelected = items.filter((i) => selectedIds.includes(i.id) && i.status === 'pending')

  // ── 查看详情 ──────────────────────────────────────────────────────────────

  const openDetail = async (row: Candidate) => {
    setDetail(row)
    setLinkedKp(null)
    setSourceChunk(null)
    setDrawerOpen(true)

    // 并发：查出处 chunk + 查关联知识点
    const tasks: Promise<void>[] = []

    if (row.document_chunk_id) {
      setSourceLoading(true)
      tasks.push(
        client.get(`/documents/chunks/${row.document_chunk_id}`)
          .then((res) => setSourceChunk(res.data.data))
          .catch(() => setSourceChunk(null))
          .finally(() => setSourceLoading(false))
      )
    }

    if (row.status === 'accepted') {
      setKpLoading(true)
      tasks.push(
        knowledgePointsApi.search(row.candidate_name, 1, 5)
          .then((res) => {
            const match = res.data.data.items.find((kp: any) => kp.name === row.candidate_name)
            if (match) setLinkedKp({ id: match.id, name: match.name })
          })
          .catch(() => {})
          .finally(() => setKpLoading(false))
      )
    }

    await Promise.all(tasks)
  }

  // ── 表格列 ────────────────────────────────────────────────────────────────

  const columns: ColumnsType<Candidate> = [
    {
      title: '候选名称',
      dataIndex: 'candidate_name',
      render: (v, row) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: '#1677ff' }}
          onClick={() => openDetail(row)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: '描述',
      dataIndex: 'candidate_description',
      ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence_score',
      width: 90,
      render: (v: number | null) =>
        v != null ? (
          <Tag color={v >= 0.8 ? 'green' : v >= 0.6 ? 'orange' : 'red'}>
            {(v * 100).toFixed(0)}%
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) =>
        s === 'pending'
          ? <Badge status="processing" text="待审核" />
          : <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 120,
      render: (_, row) => (
        <Space>
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(row)} />
          </Tooltip>
          {row.status === 'pending' && (
            <>
              <Tooltip title="接受，创建知识点">
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAccept(row)} />
              </Tooltip>
              <Tooltip title="忽略">
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleIgnore(row)} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>候选知识点审核</Title>
        <Select
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          style={{ width: 120 }}
          options={[
            { label: '待审核', value: 'pending' },
            { label: '已接受', value: 'accepted' },
            { label: '已忽略', value: 'ignored' },
            { label: '已合并', value: 'merged' },
            { label: '全部', value: undefined },
          ]}
        />
      </div>

      {/* 批量操作工具栏 */}
      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
          padding: '10px 16px', background: '#e6f4ff', borderRadius: 8, border: '1px solid #91caff',
        }}>
          <Text>
            已选 <Text strong>{selectedIds.length}</Text> 条
            {pendingSelected.length < selectedIds.length && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                （其中 {pendingSelected.length} 条待审核可操作）
              </Text>
            )}
          </Text>
          <Button
            type="primary" size="small" icon={<CheckOutlined />}
            loading={batchLoading} disabled={pendingSelected.length === 0}
            onClick={handleBatchAccept}
          >
            批量接受
          </Button>
          <Popconfirm
            title={`批量忽略 ${pendingSelected.length} 条待审核候选知识点？`}
            okText="确认忽略" cancelText="取消" okButtonProps={{ danger: true }}
            disabled={pendingSelected.length === 0}
            onConfirm={handleBatchIgnore}
          >
            <Button
              danger size="small" icon={<CloseOutlined />}
              loading={batchLoading} disabled={pendingSelected.length === 0}
            >
              批量忽略
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedIds([])}>取消选择</Button>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
            fetchData(p, statusFilter, ps)
          },
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      {/* 详情抽屉 */}
      <Drawer
        title="候选知识点详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          detail?.status === 'pending' && (
            <Space>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAccept(detail)}>接受</Button>
              <Button danger icon={<CloseOutlined />} onClick={() => handleIgnore(detail)}>忽略</Button>
            </Space>
          )
        }
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="候选名称">
                <Text strong>{detail.candidate_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 'pending'
                  ? <Badge status="processing" text="待审核" />
                  : <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {detail.confidence_score != null
                  ? <Tag color={detail.confidence_score >= 0.8 ? 'green' : detail.confidence_score >= 0.6 ? 'orange' : 'red'}>
                      {(detail.confidence_score * 100).toFixed(1)}%
                    </Tag>
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="提取时间">
                {new Date(detail.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            {detail.candidate_description && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>描述</Text>
                <Paragraph style={{ margin: 0, padding: '10px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  {detail.candidate_description}
                </Paragraph>
              </div>
            )}

            {/* 知识点出处 */}
            {detail.document_chunk_id && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  知识点出处
                </Text>
                {sourceLoading ? (
                  <div style={{ color: '#999', fontSize: 13 }}>加载中...</div>
                ) : sourceChunk ? (
                  <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
                    {/* 文档信息 + 操作按钮 */}
                    <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {sourceChunk.document && (
                        <Tag
                          color="blue" style={{ margin: 0, cursor: 'pointer' }}
                          onClick={() => { setDrawerOpen(false); navigate(`/documents/${sourceChunk.document!.id}`) }}
                        >
                          📄 {sourceChunk.document.title} ↗
                        </Tag>
                      )}
                      <Tag style={{ margin: 0 }}>第 {sourceChunk.chunk_index + 1} 段</Tag>
                      {sourceChunk.chapter_title && (
                        <Tag color="geekblue" style={{ margin: 0 }}>{sourceChunk.chapter_title}</Tag>
                      )}
                      {/* 预览 / 下载按钮 */}
                      {sourceChunk.document && (() => {
                        const docId = sourceChunk.document!.id
                        const fileName = sourceChunk.document!.file_name
                        const isPdf = fileName.toLowerCase().endsWith('.pdf')

                        const openFile = async (inline: boolean) => {
                          try {
                            const res = await client.get(
                              `/documents/${docId}/download`,
                              { params: { inline }, responseType: 'blob' }
                            )
                            const blob = new Blob([res.data], { type: res.headers['content-type'] })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            if (!inline) a.download = fileName
                            else a.target = '_blank'
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            setTimeout(() => URL.revokeObjectURL(url), 5000)
                          } catch {
                            message.error('文件获取失败')
                          }
                        }

                        return (
                          <Space size={4} style={{ marginLeft: 'auto' }}>
                            {isPdf && (
                              <Tooltip title="在浏览器中预览 PDF">
                                <Button
                                  size="small" type="link" icon={<FilePdfOutlined />}
                                  style={{ padding: '0 4px', color: '#ff4d4f' }}
                                  onClick={() => openFile(true)}
                                >
                                  预览
                                </Button>
                              </Tooltip>
                            )}
                            <Tooltip title="下载原始文件">
                              <Button
                                size="small" type="link" icon={<DownloadOutlined />}
                                style={{ padding: '0 4px' }}
                                onClick={() => openFile(false)}
                              >
                                下载
                              </Button>
                            </Tooltip>
                          </Space>
                        )
                      })()}
                    </div>
                    <div style={{ padding: '10px 12px', maxHeight: 200, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {sourceChunk.content}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>原始文档块已删除或无法访问</Text>
                )}
              </div>
            )}

            {/* 已接受时显示对应知识点链接 */}
            {detail.status === 'accepted' && (
              <div style={{ padding: '12px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                <Text strong style={{ color: '#52c41a' }}>已创建对应知识点</Text>
                {kpLoading && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>查找中...</Text>}
                {linkedKp && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      type="link" icon={<LinkOutlined />} style={{ padding: 0 }}
                      onClick={() => { setDrawerOpen(false); navigate('/knowledge-points') }}
                    >
                      前往知识点管理查看「{linkedKp.name}」
                    </Button>
                  </div>
                )}
                {!kpLoading && !linkedKp && (
                  <div style={{ marginTop: 4 }}>
                    <Button
                      type="link" icon={<LinkOutlined />} style={{ padding: 0 }}
                      onClick={() => { setDrawerOpen(false); navigate('/knowledge-points') }}
                    >
                      前往知识点管理
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
