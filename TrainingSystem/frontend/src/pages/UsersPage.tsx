import { useEffect, useState } from 'react'
import {
  Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { KeyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface UserRow {
  id: string; username: string; real_name: string; email: string
  phone: string | null; status: string; created_at: string
}

const STATUS_COLOR: Record<string, string> = { active: 'success', inactive: 'default', locked: 'error' }
const STATUS_LABEL: Record<string, string> = { active: '正常', inactive: '停用', locked: '锁定' }

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [form] = Form.useForm()
  const [resetForm] = Form.useForm()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res = await client.get('/users', { params: { page: p, page_size: 20 } })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const handleCreate = async (values: Record<string, string>) => {
    setSaving(true)
    try {
      await client.post('/users', values)
      message.success('用户创建成功')
      setCreateOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await client.delete(`/users/${id}`)
      message.success('已删除')
      fetchData()
    } catch {
      message.error('删除失败')
    }
  }

  const handleResetPassword = async (values: { new_password: string }) => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await client.post(`/users/${selectedUser.id}/reset-password`, null, {
        params: { new_password: values.new_password },
      })
      message.success('密码已重置')
      setResetOpen(false)
      resetForm.resetFields()
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<UserRow> = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '邮箱', dataIndex: 'email', ellipsis: true },
    { title: '手机', dataIndex: 'phone', width: 130, render: (v) => v || '—' },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 130,
      render: (_, row) => (
        <Space size="small">
          <Button
            size="small" icon={<KeyOutlined />}
            onClick={() => { setSelectedUser(row); setResetOpen(true) }}
          >重置密码</Button>
          <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(row.id)} okText="删除" cancelText="取消">
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建用户</Button>
        </Space>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />

      {/* 新建用户 */}
      <Modal title="新建用户" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null} width={480}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}
          initialValues={{ status: 'active' }}>
          <Form.Item label="用户名" name="username" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="姓名" name="real_name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item label="手机" name="phone"><Input /></Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal
        title={`重置密码 — ${selectedUser?.real_name}`}
        open={resetOpen}
        onCancel={() => { setResetOpen(false); resetForm.resetFields() }}
        footer={null}
        width={400}
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword} style={{ marginTop: 16 }}>
          <Form.Item label="新密码" name="new_password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setResetOpen(false); resetForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>确认重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
