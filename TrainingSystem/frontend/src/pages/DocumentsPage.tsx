import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge, Button, Form, Input, Modal, Space, Table, Tag, Tooltip, Typography, Upload, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CloudUploadOutlined, EyeOutlined, InboxOutlined, ReloadOutlined, SyncOutlined,
} from '@ant-design/icons'
import type { DocumentListItem } from '@/api/documents'
import { documentsApi } from '@/api/documents'
import client from '@/api/client'

const { Dragger } = Upload
const { Title } = Typography

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  uploaded: { color: 'blue', label: '待解析' },
  parsing:  { color: 'processing', label: '解析中' },
  parsed:   { color: 'success', label: '已解析' },
  failed:   { color: 'error', label: '解析失败' },
  archived: { color: 'default', label: '已归档' },
}


export default function DocumentsPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocumentListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form] = Form.useForm()

  const fetchDocs = async (p = page) => {
    setLoading(true)
    try {
      const res = await documentsApi.list({ page: p, page_size: 20 })
      setDocs(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [page])

  const handleUpload = async (values: { title: string; file: { file: File } }) => {
    const file = values.file?.file
    if (!file) { message.error('请选择文件'); return }
    const fd = new FormData()
    fd.append('title', values.title)
    fd.append('file', file)
    setUploading(true)
    try {
      await documentsApi.upload(fd)
      message.success('上传成功，已加入解析队列')
      setUploadOpen(false)
      form.resetFields()
      setPage(1)
      fetchDocs(1)
    } finally {
      setUploading(false)
    }
  }

  const handleReparse = async (id: string) => {
    try {
      await documentsApi.reparse(id)
      message.success('已重新加入解析队列')
      fetchDocs()
    } catch {}
  }

  const handlePreview = async (id: string) => {
    try {
      const res = await client.get(`/documents/${id}/download`, { params: { inline: true }, responseType: 'blob' })
      const blob = new Blob([res.data], { type: res.headers['content-type'] })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      message.error('文件预览失败')
    }
  }

  const handleArchive = async (id: string) => {
    Modal.confirm({
      title: '确认归档',
      content: '归档后文档不再参与课程生成，确认？',
      onOk: async () => {
        await documentsApi.archive(id)
        message.success('已归档')
        fetchDocs()
      },
    })
  }

  const columns: ColumnsType<DocumentListItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (v) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const m = STATUS_MAP[s] ?? { color: 'default', label: s }
        return m.color === 'processing'
          ? <Badge status="processing" text={m.label} />
          : <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 260,
      render: (_, row) => (
        <Space>
          <Tooltip title="在浏览器中预览文件（PDF 内联，其他格式下载）">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(row.id)}>预览</Button>
          </Tooltip>
          {row.status === 'parsed' && (
            <Button size="small" onClick={() => navigate(`/documents/${row.id}`)}>解析结果</Button>
          )}
          {(row.status === 'failed' || row.status === 'uploaded') && (
            <Tooltip title="重新解析">
              <Button size="small" icon={<SyncOutlined />} onClick={() => handleReparse(row.id)} />
            </Tooltip>
          )}
          {row.status !== 'archived' && (
            <Button size="small" danger onClick={() => handleArchive(row.id)}>归档</Button>
          )}
          <Button size="small" danger onClick={() => {
            Modal.confirm({
              title: '确认删除此文档？',
              content: '将同时删除所有版本、解析结果和分块数据，不可恢复！',
              onOk: async () => {
                try {
                  await documentsApi.delete(row.id)
                  message.success('已删除')
                  fetchDocs()
                } catch (e: any) {
                  message.error(e?.response?.data?.message || '删除失败')
                }
              },
            })
          }}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>文档管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchDocs()}>刷新</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>
            上传文档
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={docs}
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      <Modal
        title="上传文档"
        open={uploadOpen}
        onCancel={() => { setUploadOpen(false); form.resetFields() }}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload} style={{ marginTop: 16 }}>
          <Form.Item label="文档标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例：2024年安全规范手册" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            label="选择文件"
            name="file"
            rules={[{ required: true, message: '请选择文件' }]}
          >
            <Dragger
              beforeUpload={() => false}
              maxCount={1}
              accept=".pdf,.doc,.docx,.txt,.md"
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此区域</p>
              <p className="ant-upload-hint">支持 PDF、Word、TXT、Markdown，单文件不超过 50 MB</p>
            </Dragger>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setUploadOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={uploading}>上传</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
