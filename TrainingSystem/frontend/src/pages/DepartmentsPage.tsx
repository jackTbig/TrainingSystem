import { useEffect, useState } from 'react'
import {
  Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space,
  Table, Tag, Tree, Typography, message,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import { ApartmentOutlined, PlusOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface DeptNode {
  id: string; name: string; parent_id: string | null
  status: string; member_count: number; created_at: string
  children: DeptNode[]
}
interface Member { user_id: string; username: string; real_name: string; is_primary: boolean }
interface UserItem { id: string; username: string; real_name: string }

function toTreeData(nodes: DeptNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: (
      <span>
        {n.name}
        <Tag style={{ marginLeft: 8 }} color={n.status === 'active' ? 'success' : 'default'}>
          {n.member_count} 人
        </Tag>
      </span>
    ),
    children: n.children.length > 0 ? toTreeData(n.children) : undefined,
  }))
}

export default function DepartmentsPage() {
  const [tree, setTree] = useState<DeptNode[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [membersDrawer, setMembersDrawer] = useState(false)
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [addUserId, setAddUserId] = useState<string | undefined>()
  const [form] = Form.useForm()

  // Flatten tree for Select options
  const flatDepts: { id: string; name: string }[] = []
  function flattenTree(nodes: DeptNode[], prefix = '') {
    nodes.forEach((n) => {
      flatDepts.push({ id: n.id, name: prefix + n.name })
      if (n.children?.length) flattenTree(n.children, prefix + n.name + ' / ')
    })
  }
  flattenTree(tree)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await client.get('/departments')
      setTree(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async (values: { name: string; parent_id?: string }) => {
    setSaving(true)
    try {
      await client.post('/departments', values)
      message.success('部门创建成功')
      setCreateOpen(false)
      form.resetFields()
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  const openMembers = async (node: DeptNode) => {
    setSelectedDept(node)
    const [membersRes, usersRes] = await Promise.all([
      client.get(`/departments/${node.id}/members`),
      client.get('/users', { params: { page: 1, page_size: 100 } }),
    ])
    setMembers(membersRes.data.data)
    setAllUsers(usersRes.data.data.items)
    setMembersDrawer(true)
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedDept) return
    try {
      await client.delete(`/departments/${selectedDept.id}/members/${userId}`)
      message.success('已移除')
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
      fetchData()
    } catch {
      message.error('移除失败')
    }
  }

  const handleAddMember = async () => {
    if (!selectedDept || !addUserId) return
    try {
      await client.post(`/departments/${selectedDept.id}/members`, { user_id: addUserId })
      message.success('成员已添加')
      setAddUserOpen(false)
      setAddUserId(undefined)
      const res = await client.get(`/departments/${selectedDept.id}/members`)
      setMembers(res.data.data)
      fetchData()
    } catch {
      message.error('添加失败')
    }
  }

  // Find DeptNode by key from tree select event
  function findNode(nodes: DeptNode[], id: string): DeptNode | null {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = findNode(n.children, id)
      if (found) return found
    }
    return null
  }

  const memberCols = [
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    {
      title: '主部门', dataIndex: 'is_primary', width: 90,
      render: (v: boolean) => v ? <Tag color="blue">主</Tag> : null,
    },
    {
      title: '操作', width: 80,
      render: (_: unknown, row: Member) => (
        <Popconfirm title="确认移除该成员？" onConfirm={() => handleRemoveMember(row.user_id)} okText="移除" cancelText="取消">
          <Button size="small" danger>移除</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>部门管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建部门</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* 部门树 */}
        <div style={{ width: 280, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#333' }}>
            <ApartmentOutlined style={{ marginRight: 6 }} />部门树
          </div>
          {loading ? (
            <div style={{ color: '#999' }}>加载中...</div>
          ) : tree.length === 0 ? (
            <div style={{ color: '#999' }}>暂无部门</div>
          ) : (
            <Tree
              treeData={toTreeData(tree)}
              defaultExpandAll
              onSelect={(keys) => {
                if (keys.length === 0) return
                const node = findNode(tree, keys[0] as string)
                if (node) openMembers(node)
              }}
            />
          )}
        </div>

        {/* 右侧提示 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
          <div style={{ textAlign: 'center' }}>
            <TeamOutlined style={{ fontSize: 48, marginBottom: 12 }} />
            <div>点击左侧部门节点查看成员</div>
          </div>
        </div>
      </div>

      {/* 新建部门 */}
      <Modal title="新建部门" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null} width={440}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="部门名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="上级部门" name="parent_id">
            <Select
              allowClear placeholder="不选则为顶级部门"
              options={flatDepts.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理 */}
      <Drawer
        title={`成员管理 — ${selectedDept?.name}`}
        open={membersDrawer}
        onClose={() => setMembersDrawer(false)}
        width={480}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddUserOpen(true)}>
            添加成员
          </Button>
        }
      >
        <Table
          rowKey="user_id"
          size="small"
          columns={memberCols}
          dataSource={members}
          pagination={false}
        />
      </Drawer>

      {/* 添加成员 */}
      <Modal
        title="添加成员"
        open={addUserOpen}
        onCancel={() => { setAddUserOpen(false); setAddUserId(undefined) }}
        onOk={handleAddMember}
        okText="添加"
      >
        <Select
          showSearch
          style={{ width: '100%', marginTop: 16 }}
          placeholder="搜索用户"
          value={addUserId}
          onChange={setAddUserId}
          optionFilterProp="label"
          options={allUsers
            .filter((u) => !members.find((m) => m.user_id === u.id))
            .map((u) => ({ value: u.id, label: `${u.real_name} (${u.username})` }))}
        />
      </Modal>
    </div>
  )
}
