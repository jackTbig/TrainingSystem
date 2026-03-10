import { useEffect, useState } from 'react'
import { Badge, Button, Modal, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { Candidate } from '@/api/knowledge'
import { candidatesApi } from '@/api/knowledge'

const { Title, Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  accepted: 'success',
  ignored: 'default',
  merged: 'purple',
}

export default function KnowledgeCandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending')

  const fetchData = async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await candidatesApi.list({ page: p, page_size: 20, status: s })
      setItems(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1, statusFilter) }, [statusFilter])

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
        fetchData()
      },
    })
  }

  const handleIgnore = async (row: Candidate) => {
    Modal.confirm({
      title: '忽略此候选知识点？',
      content: `"${row.candidate_name}" 将被标记为已忽略`,
      okText: '确认忽略',
      okButtonProps: { danger: true },
      onOk: async () => {
        await candidatesApi.ignore(row.id)
        message.success('已忽略')
        fetchData()
      },
    })
  }

  const columns: ColumnsType<Candidate> = [
    {
      title: '候选名称',
      dataIndex: 'candidate_name',
      render: (v) => <Text strong>{v}</Text>,
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
          : <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 140,
      render: (_, row) =>
        row.status === 'pending' ? (
          <Space>
            <Tooltip title="接受，创建知识点">
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleAccept(row)}
              />
            </Tooltip>
            <Tooltip title="忽略">
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleIgnore(row)}
              />
            </Tooltip>
          </Space>
        ) : null,
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
      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: (p) => { setPage(p); fetchData(p) },
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </div>
  )
}
