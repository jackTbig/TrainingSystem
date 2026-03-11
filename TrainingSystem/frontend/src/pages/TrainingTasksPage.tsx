import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface TaskRow { id: string; title: string; status: string; due_at: string | null; created_at: string }

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'blue', in_progress: 'processing', completed: 'success', archived: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', published: '已发布', in_progress: '进行中', completed: '已完成', archived: '已归档',
}

export default function TrainingTasksPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<TaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res = await client.get('/training-tasks', { params: { page: p, page_size: 20 } })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const handleCreate = async (values: { title: string; description?: string }) => {
    setSaving(true)
    try {
      await client.post('/training-tasks', values)
      message.success('培训任务创建成功')
      setCreateOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (id: string) => {
    Modal.confirm({
      title: '确认发布培训任务？',
      onOk: async () => {
        await client.post(`/training-tasks/${id}/publish`)
        message.success('已发布')
        fetchData()
      },
    })
  }

  const columns: ColumnsType<TaskRow> = [
    { title: '任务名称', dataIndex: 'title' },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag> },
    { title: '截止日期', dataIndex: 'due_at', width: 160, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: (v) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', width: 160, render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/training-tasks/${r.id}`)}>详情</Button>
          {r.status === 'draft' && <Button size="small" type="primary" onClick={() => handlePublish(r.id)}>发布</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>培训任务</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建任务</Button>
        </Space>
      </div>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />
      <Modal title="新建培训任务" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="任务名称" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="任务说明" name="description"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
