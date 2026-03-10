import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { CourseListItem } from '@/api/courses'
import { coursesApi } from '@/api/courses'

const { Title } = Typography

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'success', archived: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', published: '已发布', archived: '已归档',
}

export default function CoursesPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res = await coursesApi.list({ page: p, page_size: 20 })
      setCourses(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const handleCreate = async (values: { title: string }) => {
    setCreating(true)
    try {
      const res = await coursesApi.create(values)
      message.success('创建成功')
      setCreateOpen(false)
      form.resetFields()
      navigate(`/courses/${res.data.data.id}`)
    } finally {
      setCreating(false)
    }
  }

  const columns: ColumnsType<CourseListItem> = [
    {
      title: '课程名称', dataIndex: 'title',
      render: (v, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/courses/${row.id}`)}>{v}</Button>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 100,
      render: (_, row) => (
        <Button size="small" onClick={() => navigate(`/courses/${row.id}`)}>查看/编辑</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>课程管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建课程</Button>
        </Space>
      </div>
      <Table rowKey="id" columns={columns} dataSource={courses} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
      />
      <Modal title="新建课程" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="课程名称" name="title" rules={[{ required: true, message: '请输入课程名称' }]}>
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={creating}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
