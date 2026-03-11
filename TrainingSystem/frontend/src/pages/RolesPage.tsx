import { useEffect, useState } from 'react'
import {
  Button, Checkbox, Col, Drawer, Form, Input, Modal, Popconfirm,
  Row, Space, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface RoleRow {
  id: string; code: string; name: string; description: string | null
  user_count: number; permission_count: number; created_at: string
}
interface Permission { id: string; code: string; name: string; resource_type: string | null; action: string | null }
interface UserItem { id: string; username: string; real_name: string }

export default function RolesPage() {
  const [rows, setRows] = useState<RoleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [permDrawer, setPermDrawer] = useState(false)
  const [userDrawer, setUserDrawer] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null)
  const [allPerms, setAllPerms] = useState<Permission[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [, setRoleDetail] = useState<{ permissions: Permission[]; users: UserItem[] } | null>(null)
  const [checkedPerms, setCheckedPerms] = useState<string[]>([])
  const [checkedUsers, setCheckedUsers] = useState<string[]>([])
  const [form] = Form.useForm()

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res = await client.get('/roles', { params: { page: p, page_size: 20 } })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const openPermDrawer = async (role: RoleRow) => {
    setSelectedRole(role)
    const [detailRes, permsRes] = await Promise.all([
      client.get(`/roles/${role.id}`),
      client.get('/roles/permissions'),
    ])
    const detail = detailRes.data.data
    setRoleDetail(detail)
    setAllPerms(permsRes.data.data)
    setCheckedPerms(detail.permissions.map((p: Permission) => p.id))
    setPermDrawer(true)
  }

  const openUserDrawer = async (role: RoleRow) => {
    setSelectedRole(role)
    const [detailRes, usersRes] = await Promise.all([
      client.get(`/roles/${role.id}`),
      client.get('/users', { params: { page: 1, page_size: 100 } }),
    ])
    const detail = detailRes.data.data
    setRoleDetail(detail)
    setAllUsers(usersRes.data.data.items)
    setCheckedUsers(detail.users.map((u: UserItem) => u.id))
    setUserDrawer(true)
  }

  const savePerms = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      await client.put(`/roles/${selectedRole.id}/permissions`, { permission_ids: checkedPerms })
      message.success('权限已保存')
      setPermDrawer(false)
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  const saveUsers = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      await client.put(`/roles/${selectedRole.id}/users`, { user_ids: checkedUsers })
      message.success('用户已保存')
      setUserDrawer(false)
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (values: { code: string; name: string; description?: string }) => {
    setSaving(true)
    try {
      await client.post('/roles', values)
      message.success('角色创建成功')
      setCreateOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await client.delete(`/roles/${id}`)
      message.success('已删除')
      fetchData()
    } catch {
      message.error('删除失败')
    }
  }

  // 按 resource_type 分组权限
  const permGroups = allPerms.reduce<Record<string, Permission[]>>((acc, p) => {
    const key = p.resource_type ?? '其他'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const columns: ColumnsType<RoleRow> = [
    { title: '角色代码', dataIndex: 'code', width: 120 },
    { title: '角色名称', dataIndex: 'name', width: 120 },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: (v) => v || '—' },
    { title: '用户数', dataIndex: 'user_count', width: 80, render: (v) => <Tag>{v}</Tag> },
    { title: '权限数', dataIndex: 'permission_count', width: 80, render: (v) => <Tag color="blue">{v}</Tag> },
    {
      title: '操作', width: 200,
      render: (_, r) => {
        const isSystem = r.code === 'admin'
        return (
          <Space size="small">
            <Button
              size="small" icon={<SettingOutlined />}
              onClick={() => openPermDrawer(r)}
              disabled={isSystem}
              title={isSystem ? '系统管理员权限不可编辑' : undefined}
            >权限</Button>
            <Button size="small" icon={<TeamOutlined />} onClick={() => openUserDrawer(r)}>用户</Button>
            <Popconfirm
              title="确认删除该角色？"
              onConfirm={() => handleDelete(r.id)}
              okText="删除" cancelText="取消"
              disabled={isSystem}
            >
              <Button
                size="small" danger
                disabled={isSystem}
                title={isSystem ? '系统管理员角色不可删除' : undefined}
              >删除</Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>角色权限</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建角色</Button>
        </Space>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />

      {/* 新建角色 */}
      <Modal title="新建角色" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null} width={440}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="角色代码" name="code" rules={[{ required: true }]}><Input placeholder="如 admin / trainer" /></Form.Item>
          <Form.Item label="角色名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限配置 */}
      <Drawer
        title={`配置权限 — ${selectedRole?.name}`}
        open={permDrawer}
        onClose={() => setPermDrawer(false)}
        width={520}
        extra={<Button type="primary" loading={saving} onClick={savePerms}>保存</Button>}
      >
        {Object.entries(permGroups).map(([group, perms]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#555' }}>{group}</div>
            <Row gutter={[8, 8]}>
              {perms.map((p) => (
                <Col span={12} key={p.id}>
                  <Checkbox
                    checked={checkedPerms.includes(p.id)}
                    onChange={(e) => {
                      setCheckedPerms((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                      )
                    }}
                  >
                    {p.name}
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        {Object.keys(permGroups).length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', paddingTop: 40 }}>暂无权限数据</div>
        )}
      </Drawer>

      {/* 用户配置 */}
      <Drawer
        title={`配置用户 — ${selectedRole?.name}`}
        open={userDrawer}
        onClose={() => setUserDrawer(false)}
        width={400}
        extra={<Button type="primary" loading={saving} onClick={saveUsers}>保存</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allUsers.map((u) => (
            <Checkbox
              key={u.id}
              checked={checkedUsers.includes(u.id)}
              onChange={(e) => {
                setCheckedUsers((prev) =>
                  e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
                )
              }}
            >
              {u.real_name} <span style={{ color: '#999', fontSize: 12 }}>({u.username})</span>
            </Checkbox>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
