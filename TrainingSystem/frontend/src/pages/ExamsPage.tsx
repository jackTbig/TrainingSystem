import { useEffect, useState } from 'react'
import {
  Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface ExamRow {
  id: string; title: string; exam_mode: string; duration_minutes: number
  total_score: number; pass_score: number; status: string; paper_id: string | null
  start_at: string | null; end_at: string | null
}

interface PaperRow { id: string; title: string; paper_type: string; created_at: string }

const STATUS_COLOR: Record<string, string> = { draft: 'default', published: 'success', archived: 'warning' }
const STATUS_LABEL: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' }

export default function ExamsPage() {
  const [rows, setRows] = useState<ExamRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [papers, setPapers] = useState<PaperRow[]>([])
  const [form] = Form.useForm()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const [examsRes, papersRes] = await Promise.all([
        client.get('/exams', { params: { page: p, page_size: 20 } }),
        client.get('/exams/papers', { params: { page: 1, page_size: 100 } }),
      ])
      setRows(examsRes.data.data.items)
      setTotal(examsRes.data.data.total)
      setPapers(papersRes.data.data.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      await client.post('/exams', values)
      message.success('考试创建成功')
      setCreateOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (id: string) => {
    Modal.confirm({
      title: '确认发布考试？', content: '发布后学员可参加考试。',
      onOk: async () => {
        await client.post(`/exams/${id}/publish`)
        message.success('已发布')
        fetchData()
      },
    })
  }

  const columns: ColumnsType<ExamRow> = [
    { title: '考试名称', dataIndex: 'title', ellipsis: true },
    { title: '时长', dataIndex: 'duration_minutes', width: 80, render: (v) => `${v}分钟` },
    { title: '总分/及格', width: 95, render: (_, r) => `${r.total_score}/${r.pass_score}` },
    {
      title: '关联试卷', dataIndex: 'paper_id', width: 100,
      render: (v) => {
        const p = papers.find((p) => p.id === v)
        return p ? <Tag color="blue">{p.title.slice(0, 8)}</Tag> : <Tag color="error">未关联</Tag>
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '操作', width: 80,
      render: (_, r) => r.status === 'draft' ? (
        <Button size="small" type="primary" onClick={() => handlePublish(r.id)}>发布</Button>
      ) : null,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>考试管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<UnorderedListOutlined />} onClick={() => window.open('/my-exams', '_self')}>学员视角</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建考试</Button>
        </Space>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal title="新建考试" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null} width={560}>
        <Form
          form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}
          initialValues={{ exam_mode: 'timed', duration_minutes: 60, total_score: 100, pass_score: 60 }}
        >
          <Form.Item label="考试名称" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="说明" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="关联试卷" name="paper_id">
            <Select
              allowClear placeholder="选择试卷（可后续关联）"
              options={papers.map((p) => ({ value: p.id, label: p.title }))}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item label="时长（分钟）" name="duration_minutes">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="总分" name="total_score">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="及格分" name="pass_score">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
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
