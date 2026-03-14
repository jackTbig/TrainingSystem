import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { coursesApi } from '@/api/courses'

const { Title } = Typography

interface CourseRow {
  id: string; title: string; owner_id: string; status: string
  current_version_id: string | null; version_count: number
  latest_version_no: number | null; latest_version_status: string | null
  created_at: string
}

const VER_STATUS_COLOR: Record<string, string> = {
  draft: 'default', pending_review: 'processing', in_review: 'blue',
  published: 'success', rejected: 'error', archived: 'warning',
}
const VER_STATUS_LABEL: Record<string, string> = {
  draft: '草稿', pending_review: '待审核', in_review: '审核中',
  published: '已发布', rejected: '已驳回', archived: '已归档',
}

export default function CoursesPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseRow[]>([])
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
      setCourses(res.data.data.items as unknown as CourseRow[])
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

  const columns: ColumnsType<CourseRow> = [
    {
      title: '课程名称', dataIndex: 'title',
      render: (v, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/courses/${row.id}`)}>{v}</Button>
      ),
    },
    {
      title: '版本状态', width: 160,
      render: (_, row) => {
        if (!row.latest_version_status) return <Tag>无版本</Tag>
        return (
          <span>
            <Tag color={VER_STATUS_COLOR[row.latest_version_status]}>
              {VER_STATUS_LABEL[row.latest_version_status] ?? row.latest_version_status}
            </Tag>
            <span style={{ color: '#999', fontSize: 12 }}>
              v{row.latest_version_no}（共 {row.version_count} 个）
            </span>
          </span>
        )
      },
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/courses/${row.id}`)}>查看/编辑</Button>
          <Button size="small" danger onClick={() => {
            Modal.confirm({
              title: '确认删除此课程？',
              content: '删除后不可恢复，若被培训任务引用则无法删除。',
              onOk: async () => {
                try {
                  await coursesApi.delete(row.id)
                  message.success('已删除')
                  fetchData()
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
