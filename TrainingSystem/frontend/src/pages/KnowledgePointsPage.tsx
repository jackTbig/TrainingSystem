import { useEffect, useState } from 'react'
import {
  Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Tag, Tree,
  Typography, message, Descriptions, Empty, Divider,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import {
  FolderOutlined, FolderOpenOutlined, FileOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { KnowledgePointTree } from '@/api/knowledge'
import { knowledgePointsApi } from '@/api/knowledge'

const { Title, Text, Paragraph } = Typography

function findNode(nodes: KnowledgePointTree[], id: string): KnowledgePointTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

export default function KnowledgePointsPage() {
  const [rawTree, setRawTree] = useState<KnowledgePointTree[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<KnowledgePointTree | null>(null)

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  // edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editNode, setEditNode] = useState<KnowledgePointTree | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm] = Form.useForm()

  const fetchTree = async () => {
    setLoading(true)
    try {
      const res = await knowledgePointsApi.tree()
      setRawTree(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTree() }, [])

  // ── CRUD ──────────────────────────────────────────────────────────

  const openCreate = (parentId?: string) => {
    setCreateParentId(parentId)
    createForm.resetFields()
    setCreateOpen(true)
  }

  const handleCreate = async (values: { name: string; description?: string; weight?: number }) => {
    setCreating(true)
    try {
      await knowledgePointsApi.create({ ...values, parent_id: createParentId })
      message.success('创建成功')
      setCreateOpen(false)
      await fetchTree()
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (node: KnowledgePointTree) => {
    setEditNode(node)
    editForm.setFieldsValue({ name: node.name, description: node.description, weight: node.weight })
    setEditOpen(true)
  }

  const handleEdit = async (values: { name: string; description?: string; weight?: number }) => {
    if (!editNode) return
    setEditSaving(true)
    try {
      await knowledgePointsApi.update(editNode.id, values)
      message.success('已更新')
      setEditOpen(false)
      if (selected?.id === editNode.id) setSelected(null)
      await fetchTree()
    } finally {
      setEditSaving(false)
    }
  }

  const handleArchive = async (node: KnowledgePointTree) => {
    try {
      await knowledgePointsApi.archive(node.id)
      message.success('已归档')
      if (selected?.id === node.id) setSelected(null)
      await fetchTree()
    } catch {
      message.error('归档失败')
    }
  }

  // ── Tree render ────────────────────────────────────────────────────

  function toTreeData(nodes: KnowledgePointTree[]): DataNode[] {
    return nodes.map((n) => {
      const hasChildren = n.children.length > 0
      return {
        key: n.id,
        icon: ({ expanded }: { expanded?: boolean }) =>
          hasChildren
            ? (expanded ? <FolderOpenOutlined style={{ color: '#faad14' }} /> : <FolderOutlined style={{ color: '#faad14' }} />)
            : <FileOutlined style={{ color: '#8c8c8c' }} />,
        title: (
          <div className="kp-tree-node" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.name}
            </span>
            {n.weight > 0 && <Tag color="blue" style={{ margin: 0, flexShrink: 0 }}>权重 {n.weight}</Tag>}
            {n.status === 'archived' && <Tag color="default" style={{ margin: 0, flexShrink: 0 }}>已归档</Tag>}
            <span className="kp-actions" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <Button
                size="small" type="text" icon={<PlusOutlined />}
                title="添加子知识点"
                onClick={(e) => { e.stopPropagation(); openCreate(n.id) }}
                style={{ padding: '0 4px', height: 20, fontSize: 12 }}
              />
              <Button
                size="small" type="text" icon={<EditOutlined />}
                title="编辑"
                onClick={(e) => { e.stopPropagation(); openEdit(n) }}
                style={{ padding: '0 4px', height: 20, fontSize: 12 }}
              />
              {n.status !== 'archived' && (
                <Popconfirm
                  title={`归档「${n.name}」？`}
                  description="归档后不再参与课程/题目生成"
                  onConfirm={(e) => { e?.stopPropagation(); handleArchive(n) }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="归档" cancelText="取消" okButtonProps={{ danger: true }}
                >
                  <Button
                    size="small" type="text" danger icon={<DeleteOutlined />}
                    title="归档"
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: '0 4px', height: 20, fontSize: 12 }}
                  />
                </Popconfirm>
              )}
            </span>
          </div>
        ),
        children: hasChildren ? toTreeData(n.children) : undefined,
        isLeaf: !hasChildren,
      }
    })
  }

  const treeData = toTreeData(rawTree)

  const onSelect = (keys: React.Key[]) => {
    if (keys.length === 0) { setSelected(null); return }
    const node = findNode(rawTree, keys[0] as string)
    setSelected(node)
  }

  return (
    <div>
      <style>{`
        .kp-tree-node .kp-actions { opacity: 0; transition: opacity 0.15s; }
        .kp-tree-node:hover .kp-actions { opacity: 1; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>知识点管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTree} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            新建顶级知识点
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 左侧目录树 */}
        <div style={{ width: 360, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0', minHeight: 400 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#555', fontSize: 13 }}>
            <FolderOutlined style={{ marginRight: 6, color: '#faad14' }} />
            知识点目录
            <span style={{ fontWeight: 400, color: '#999', marginLeft: 8, fontSize: 12 }}>悬停显示操作</span>
          </div>
          {rawTree.length === 0 && !loading ? (
            <Empty description="暂无知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
          ) : (
            <Tree
              showIcon
              showLine={{ showLeafIcon: false }}
              treeData={treeData}
              selectedKeys={selected ? [selected.id] : []}
              onSelect={onSelect}
              blockNode
              style={{ fontSize: 13 }}
            />
          )}
        </div>

        {/* 右侧详情 */}
        <div style={{ flex: 1, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0', minHeight: 400 }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title level={5} style={{ margin: 0 }}>{selected.name}</Title>
                <Space>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => openCreate(selected.id)}>添加子知识点</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(selected)}>编辑</Button>
                </Space>
              </div>
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="权重">{selected.weight}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selected.status === 'active' ? 'success' : 'default'}>
                    {selected.status === 'active' ? '正常' : '已归档'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间" span={2}>
                  {new Date(selected.created_at).toLocaleString('zh-CN')}
                </Descriptions.Item>
                {selected.description && (
                  <Descriptions.Item label="描述" span={2}>
                    <Paragraph style={{ margin: 0 }}>{selected.description}</Paragraph>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {selected.children.length > 0 && (
                <>
                  <Divider orientation="left" style={{ fontSize: 13 }}>子知识点（{selected.children.length}）</Divider>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.children.map((c) => (
                      <div
                        key={c.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 6, cursor: 'pointer' }}
                        onClick={() => setSelected(c)}
                      >
                        {c.children.length > 0 ? <FolderOutlined style={{ color: '#faad14' }} /> : <FileOutlined style={{ color: '#8c8c8c' }} />}
                        <Text style={{ flex: 1 }}>{c.name}</Text>
                        {c.weight > 0 && <Tag color="blue" style={{ margin: 0 }}>权重 {c.weight}</Tag>}
                        {c.children.length > 0 && <Tag color="default" style={{ margin: 0 }}>{c.children.length} 子项</Tag>}
                        {c.status === 'archived' && <Tag color="default" style={{ margin: 0 }}>已归档</Tag>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {selected.children.length === 0 && (
                <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 40 }}>
                  <FileOutlined style={{ fontSize: 32 }} />
                  <div style={{ marginTop: 8 }}>叶子节点，暂无子知识点</div>
                  <Button type="link" onClick={() => openCreate(selected.id)}>添加子知识点</Button>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 60 }}>
              <FolderOpenOutlined style={{ fontSize: 48 }} />
              <div style={{ marginTop: 12 }}>点击左侧知识点查看详情</div>
            </div>
          )}
        </div>
      </div>

      {/* 新建知识点 */}
      <Modal
        title={createParentId ? '添加子知识点' : '新建顶级知识点'}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={255} showCount autoFocus />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="权重（越大越重要）" name="weight" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={creating}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑知识点 */}
      <Modal
        title={`编辑 — ${editNode?.name}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={255} showCount autoFocus />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="权重" name="weight">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={editSaving}>保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
