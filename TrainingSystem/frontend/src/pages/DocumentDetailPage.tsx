import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Badge, Button, Card, Col, Descriptions, Row, Space, Statistic, Table, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SyncOutlined } from '@ant-design/icons'
import client from '../api/client'

const { Title, Paragraph } = Typography

interface Chunk {
  id: string
  chunk_index: number
  chapter_title: string | null
  content: string
  token_count: number | null
  embedding_status: string
  created_at: string
}

interface DocDetail {
  id: string
  title: string
  status: string
  source_type: string
  current_version_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  uploaded: { color: 'blue', label: '待解析' },
  parsing:  { color: 'processing', label: '解析中' },
  parsed:   { color: 'success', label: '已解析' },
  failed:   { color: 'error', label: '解析失败' },
  archived: { color: 'default', label: '已归档' },
}

const EMBED_COLOR: Record<string, string> = {
  pending: 'default', processing: 'processing', done: 'success', failed: 'error',
}

export default function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [chunksLoading, setChunksLoading] = useState(false)
  const [reparsing, setReparsing] = useState(false)

  useEffect(() => {
    client.get(`/documents/${docId}`).then(res => {
      setDoc(res.data.data)
      setLoading(false)
    })
  }, [docId])

  const fetchChunks = async (p = page) => {
    setChunksLoading(true)
    try {
      const res = await client.get(`/documents/${docId}/chunks`, { params: { page: p, page_size: 20 } })
      setChunks(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setChunksLoading(false)
    }
  }

  useEffect(() => { fetchChunks() }, [docId, page])

  const handleReparse = async () => {
    setReparsing(true)
    try {
      await client.post(`/documents/${docId}/reparse`)
      message.success('已重新加入解析队列')
      const res = await client.get(`/documents/${docId}`)
      setDoc(res.data.data)
    } finally {
      setReparsing(false)
    }
  }

  if (!doc && !loading) return <div style={{ padding: 40 }}>文档不存在</div>

  const st = doc ? (STATUS_MAP[doc.status] || { color: 'default', label: doc.status }) : null

  const columns = [
    {
      title: '#',
      dataIndex: 'chunk_index',
      width: 60,
      render: (v: number) => <Tag>{v + 1}</Tag>,
    },
    {
      title: '章节',
      dataIndex: 'chapter_title',
      width: 160,
      render: (v: string | null) => v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '内容',
      dataIndex: 'content',
      render: (v: string) => (
        <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }} style={{ margin: 0 }}>
          {v}
        </Paragraph>
      ),
    },
    {
      title: 'Tokens',
      dataIndex: 'token_count',
      width: 80,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: '向量化',
      dataIndex: 'embedding_status',
      width: 90,
      render: (v: string) => (
        v === 'processing'
          ? <Badge status="processing" text="处理中" />
          : <Tag color={EMBED_COLOR[v] || 'default'}>{v}</Tag>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/documents')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>{doc?.title ?? '加载中…'}</Title>
        {st && (
          st.color === 'processing'
            ? <Badge status="processing" text={st.label} />
            : <Tag color={st.color}>{st.label}</Tag>
        )}
        {doc && (doc.status === 'failed' || doc.status === 'uploaded') && (
          <Button icon={<SyncOutlined />} loading={reparsing} onClick={handleReparse}>重新解析</Button>
        )}
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="解析块数" value={total} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已向量化"
              value={chunks.filter(c => c.embedding_status === 'done').length}
              suffix={`/ ${chunks.length}`}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="来源类型">{doc?.source_type ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {doc?.created_at ? new Date(doc.created_at).toLocaleString('zh-CN') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title={`解析结果（共 ${total} 块）`}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={chunks}
          loading={chunksLoading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 块`,
          }}
          size="small"
        />
      </Card>
    </div>
  )
}
