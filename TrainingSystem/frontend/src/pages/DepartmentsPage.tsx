import { useEffect, useState } from 'react'
import {
  Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space,
  Table, Tag, Tree, Typography, message,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import {
  ApartmentOutlined, DeleteOutlined, EditOutlined,
  PlusOutlined, ReloadOutlined, TeamOutlined,
} from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface DeptNode {
  id: string; name: string; parent_id: string | null
  status: string; member_count: number; created_at: string
  children: DeptNode[]
}
interface Member { user_id: string; username: string; real_name: string; is_primary: boolean }
interface UserItem { id: string; username: string; real_name: string }

export default function DepartmentsPage() {
  const [tree, setTree] = useState<DeptNode[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // create / edit modals
  const [createOpen, setCreateOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | undefined>()
  const [editOpen, setEditOpen] = useState(false)
  const [editNode, setEditNode] = useState<DeptNode | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  // members drawer
  const [membersDrawer, setMembersDrawer] = useState(false)
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [addUserId, setAddUserId] = useState<string | undefined>()

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

  // Flatten tree for parent Select options
  const flatDepts: { id: string; name: string }[] = []
  function flattenTree(nodes: DeptNode[], prefix = '') {
    nodes.forEach((n) => {
      flatDepts.push({ id: n.id, name: prefix + n.name })
      if (n.children?.length) flattenTree(n.children, prefix + '　')
    })
  }
  flattenTree(tree)

  function findNode(nodes: DeptNode[], id: string): DeptNode | null {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = findNode(n.children, id)
      if (found) return found
    }
    return null
  }

  // ── CRUD ──────────────────────────────────────────────────────

  const handleCreate = async (values: { name: string }) => {
    setSaving(true)
    try {
      await client.post('/departments', { name: values.name, parent_id: createParentId ?? null })
      message.success('部门创建成功')
      setCreateOpen(false)
      createForm.resetFields()
      setCreateParentId(undefined)
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (values: { name: string }) => {
    if (!editNode) return
    setSaving(true)
    try {
      await client.put(`/departments/${editNode.id}`, { name: values.name })
      message.success('已更新')
      setEditOpen(false)
      editForm.resetFields()
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (node: DeptNode) => {
    try {
      await client.delete(`/departments/${node.id}`)
      message.success('已删除')
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败（可能有子部门或成员）')
    }
  }

  const openCreateChild = (parentNode: DeptNode) => {
    setCreateParentId(parentNode.id)
    createForm.resetFields()
    setCreateOpen(true)
  }

  const openEdit = (node: DeptNode) => {
    setEditNode(node)
    editForm.setFieldsValue({ name: node.name })
    setEditOpen(true)
  }

  // ── Members ────────────────────────────────────────────────────

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

  // ── Tree render ────────────────────────────────────────────────

  function toTreeData(nodes: DeptNode[]): DataNode[] {
    return nodes.map((n) => ({
      key: n.id,
      title: (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
          className="dept-tree-node"
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.name}
          </span>
          <Tag color={n.member_count > 0 ? 'blue' : 'default'} style={{ margin: 0, flexShrink: 0 }}>
            {n.member_count}人
          </Tag>
          {/* action buttons — shown on hover via CSS */}
          <span className="dept-actions" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <Button
              size="small" type="text" icon={<PlusOutlined />}
              title="添加子部门"
              onClick={(e) => { e.stopPropagation(); openCreateChild(n) }}
              style={{ padding: '0 4px', height: 20, fontSize: 12 }}
            />
            <Button
              size="small" type="text" icon={<EditOutlined />}
              title="编辑部门名称"
              onClick={(e) => { e.stopPropagation(); openEdit(n) }}
              style={{ padding: '0 4px', height: 20, fontSize: 12 }}
            />
            <Popconfirm
              title={`删除「${n.name}」？`}
              description="若有子部门或成员将无法删除"
              onConfirm={(e) => { e?.stopPropagation(); handleDelete(n) }}
              onCancel={(e) => e?.stopPropagation()}
              okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
            >
              <Button
                size="small" type="text" danger icon={<DeleteOutlined />}
                title="删除部门"
                onClick={(e) => e.stopPropagation()}
                style={{ padding: '0 4px', height: 20, fontSize: 12 }}
              />
            </Popconfirm>
          </span>
        </div>
      ),
      children: n.children.length > 0 ? toTreeData(n.children) : undefined,
    }))
  }

  const memberCols = [
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '用户名', dataIndex: 'username' },
    {
      title: '主部门', dataIndex: 'is_primary', width: 80,
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
      <style>{`
        .dept-tree-node .dept-actions { opacity: 0; transition: opacity 0.15s; }
        .dept-tree-node:hover .dept-actions { opacity: 1; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>部门管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateParentId(undefined); createForm.resetFields(); setCreateOpen(true) }}>
            新建顶级部门
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* 部门树 */}
        <div style={{ width: 360, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0', minHeight: 300 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#333', fontSize: 13 }}>
            <ApartmentOutlined style={{ marginRight: 6 }} />
            部门树
            <span style={{ fontWeight: 400, color: '#999', marginLeft: 8, fontSize: 12 }}>悬停节点显示操作 · 点击节点管理成员</span>
          </div>
          {loading ? (
            <div style={{ color: '#999', padding: 20 }}>加载中...</div>
          ) : tree.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>
              <ApartmentOutlined style={{ fontSize: 32, marginBottom: 8 }} />
              <div>暂无部门，点击右上角新建</div>
            </div>
          ) : (
            <Tree
              treeData={toTreeData(tree)}
              defaultExpandAll
              blockNode
              onSelect={(keys) => {
                if (keys.length === 0) return
                const node = findNode(tree, keys[0] as string)
                if (node) openMembers(node)
              }}
            />
          )}
        </div>

        {/* 右侧说明 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', minHeight: 200 }}>
          <div style={{ textAlign: 'center' }}>
            <TeamOutlined style={{ fontSize: 48, marginBottom: 12 }} />
            <div style={{ marginBottom: 8 }}>点击部门节点 → 管理成员</div>
            <div style={{ fontSize: 12 }}>
              <span style={{ marginRight: 16 }}><PlusOutlined /> 悬停节点添加子部门</span>
              <span style={{ marginRight: 16 }}><EditOutlined /> 悬停节点重命名</span>
              <span style={{ color: '#ff4d4f' }}><DeleteOutlined /> 悬停节点删除</span>
            </div>
          </div>
        </div>
      </div>

      {/* 新建部门 */}
      <Modal
        title={createParentId ? `新建子部门（上级：${flatDepts.find(d => d.id === createParentId)?.name ?? ''}）` : '新建顶级部门'}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); setCreateParentId(undefined) }}
        footer={null}
        width={420}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="部门名称" name="name" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="请输入部门名称" autoFocus />
          </Form.Item>
          {!createParentId && (
            <Form.Item label="上级部门（可选）" name="parent_id">
              <Select
                allowClear placeholder="不选则为顶级部门"
                options={flatDepts.map((d) => ({ value: d.id, label: d.name }))}
                onChange={(v) => setCreateParentId(v)}
              />
            </Form.Item>
          )}
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); setCreateParentId(undefined) }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑部门 */}
      <Modal
        title={`编辑部门 — ${editNode?.name}`}
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields() }}
        footer={null}
        width={420}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item label="部门名称" name="name" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setEditOpen(false); editForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理 */}
      <Drawer
        title={<><ApartmentOutlined style={{ marginRight: 6 }} />{selectedDept?.name} — 成员管理</>}
        open={membersDrawer}
        onClose={() => setMembersDrawer(false)}
        width={500}
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
          locale={{ emptyText: '暂无成员' }}
        />
      </Drawer>

      {/* 添加成员 */}
      <Modal
        title={`添加成员至「${selectedDept?.name}」`}
        open={addUserOpen}
        onCancel={() => { setAddUserOpen(false); setAddUserId(undefined) }}
        onOk={handleAddMember}
        okText="添加"
      >
        <Select
          showSearch
          style={{ width: '100%', marginTop: 16 }}
          placeholder="搜索姓名或用户名"
          value={addUserId}
          onChange={setAddUserId}
          optionFilterProp="label"
          options={allUsers
            .filter((u) => !members.find((m) => m.user_id === u.id))
            .map((u) => ({ value: u.id, label: `${u.real_name}（${u.username}）` }))}
        />
      </Modal>
    </div>
  )
}
