import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DatePicker, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'
import dayjs from 'dayjs'

const { Title } = Typography

interface TaskRow {
  id: string; title: string; status: string
  course_version_id: string | null; exam_id: string | null
  course_title: string | null; exam_title: string | null
  due_at: string | null; created_at: string
}

interface CourseOption { id: string; title: string; current_version_id: string | null; latest_version_no: number | null }
interface ExamOption { id: string; title: string }

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
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [exams, setExams] = useState<ExamOption[]>([])
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

  const openCreate = async () => {
    // Fetch published courses and all exams for selectors
    const [cRes, eRes] = await Promise.all([
      client.get('/courses', { params: { page: 1, page_size: 100, status: 'published' } }),
      client.get('/exams', { params: { page: 1, page_size: 100 } }),
    ])
    setCourses(cRes.data.data.items)
    setExams(eRes.data.data.items)
    setCreateOpen(true)
  }

  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      const payload: any = { title: values.title, description: values.description || null }
      if (values.course_id) {
        const course = courses.find(c => c.id === values.course_id)
        payload.course_version_id = course?.current_version_id || null
      }
      if (values.exam_id) payload.exam_id = values.exam_id
      if (values.due_at) payload.due_at = values.due_at.toISOString()
      await client.post('/training-tasks', payload)
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
    {
      title: '任务名称', dataIndex: 'title',
      render: (v, r) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/training-tasks/${r.id}`)}>{v}</Button>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag> },
    {
      title: '关联课程', dataIndex: 'course_title', width: 160,
      render: (v) => v ? <span style={{ fontSize: 12 }}>{v}</span> : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: '关联考试', dataIndex: 'exam_title', width: 140,
      render: (v) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#ccc' }}>—</span>,
    },
    { title: '截止日期', dataIndex: 'due_at', width: 140, render: (v) => v ? new Date(v).toLocaleDateString('zh-CN') : '—' },
    { title: '创建时间', dataIndex: 'created_at', width: 150, render: (v) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', width: 200, render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/training-tasks/${r.id}`)}>详情</Button>
          {r.status === 'draft' && <Button size="small" type="primary" onClick={() => handlePublish(r.id)}>发布</Button>}
          {r.status === 'draft' && (
            <Button size="small" danger onClick={() => {
              Modal.confirm({
                title: '确认删除此培训任务？',
                content: '已发布的任务不可删除。',
                onOk: async () => {
                  try {
                    await client.delete(`/training-tasks/${r.id}`)
                    message.success('已删除')
                    fetchData()
                  } catch (e: any) {
                    message.error(e?.response?.data?.message || '删除失败')
                  }
                },
              })
            }}>删除</Button>
          )}
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建任务</Button>
        </Space>
      </div>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />
      <Modal title="新建培训任务" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="任务名称" name="title" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="任务说明" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="关联课程（已发布）" name="course_id">
            <Select
              allowClear placeholder="选择课程（可选）"
              showSearch filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
              options={courses.map(c => ({
                value: c.id,
                label: `${c.title}${c.latest_version_no ? ` v${c.latest_version_no}` : ''}`,
                disabled: !c.current_version_id,
              }))}
            />
          </Form.Item>
          <Form.Item label="关联考试（可选）" name="exam_id">
            <Select
              allowClear placeholder="选择考试（可选）"
              showSearch filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
              options={exams.map(e => ({ value: e.id, label: e.title }))}
            />
          </Form.Item>
          <Form.Item label="截止日期（可选）" name="due_at">
            <DatePicker showTime style={{ width: '100%' }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
          </Form.Item>
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
