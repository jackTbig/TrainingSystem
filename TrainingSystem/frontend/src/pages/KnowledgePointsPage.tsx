import { useEffect, useState } from 'react'
import {
  Button, Form, Input, Modal, Popconfirm, Space, Tag, Tree,
  Typography, message, Descriptions, Empty, Divider, Tooltip,
} from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import {
  FolderOutlined, FolderOpenOutlined, FileOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  DownloadOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { KnowledgePointTree } from '@/api/knowledge'
import { knowledgePointsApi } from '@/api/knowledge'
import client from '@/api/client'

const { Title, Text, Paragraph } = Typography

type SourceChunk = {
  chunk_index: number
  chapter_title: string | null
  content: string
  document: { id: string; title: string; file_name: string } | null
} | null

function findNode(nodes: KnowledgePointTree[], id: string): KnowledgePointTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

export default function KnowledgePointsPage() {
  const navigate = useNavigate()
  const [rawTree, setRawTree] = useState<KnowledgePointTree[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<KnowledgePointTree | null>(null)
  const [sourceChunk, setSourceChunk] = useState<SourceChunk>(undefined as any)
  const [sourceLoading, setSourceLoading] = useState(false)

  // create sub-category modal
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

  // ── Drag-and-drop ──────────────────────────────────────────────────

  const isDescendant = (ancestor: KnowledgePointTree, targetId: string): boolean => {
    for (const child of ancestor.children) {
      if (child.id === targetId) return true
      if (isDescendant(child, targetId)) return true
    }
    return false
  }

  const allowDrop: TreeProps['allowDrop'] = ({ dropNode, dropPosition }) => {
    if (dropPosition === 0) {
      // dropping INTO a node — only categories can have children
      const target = findNode(rawTree, dropNode.key as string)
      return target?.node_type === 'category'
    }
    return true // dropping in gap is always allowed
  }

  const onDrop: TreeProps['onDrop'] = async (info) => {
    const dragId = info.dragNode.key as string
    const targetId = info.node.key as string
    const draggedNode = findNode(rawTree, dragId)
    const targetNode = findNode(rawTree, targetId)
    if (!draggedNode || !targetNode) return

    let newParentId: string | null
    if (!info.dropToGap) {
      // drop onto node → become child of that category
      newParentId = targetNode.id
    } else {
      // drop in gap → same level as target
      newParentId = targetNode.parent_id ?? null
    }

    // prevent dropping a category into its own descendant
    if (draggedNode.node_type === 'category' && newParentId) {
      if (isDescendant(draggedNode, newParentId)) {
        message.warning('不能将分类移入自身的子节点中')
        return
      }
    }

    const currentParentId = draggedNode.parent_id ?? null
    if (currentParentId === newParentId) return

    try {
      await knowledgePointsApi.update(dragId, { parent_id: newParentId })
      message.success('已移动')
      await fetchTree()
    } catch {
      message.error('移动失败')
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  const openCreateCategory = (parentId?: string) => {
    setCreateParentId(parentId)
    createForm.resetFields()
    setCreateOpen(true)
  }

  const handleCreateCategory = async (values: { name: string; description?: string }) => {
    setCreating(true)
    try {
      await knowledgePointsApi.createCategory({ ...values, parent_id: createParentId })
      message.success('分类创建成功')
      setCreateOpen(false)
      await fetchTree()
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (node: KnowledgePointTree) => {
    setEditNode(node)
    editForm.setFieldsValue({ name: node.name, description: node.description })
    setEditOpen(true)
  }

  const handleEdit = async (values: { name: string; description?: string }) => {
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
      const isCategory = n.node_type === 'category'
      const hasChildren = n.children.length > 0
      return {
        key: n.id,
        icon: ({ expanded }: { expanded?: boolean }) =>
          isCategory
            ? (expanded ? <FolderOpenOutlined style={{ color: '#faad14' }} /> : <FolderOutlined style={{ color: '#faad14' }} />)
            : <FileOutlined style={{ color: '#1677ff' }} />,
        title: (
          <div className="kp-tree-node" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.name}
            </span>
            {n.status === 'archived' && <Tag color="default" style={{ margin: 0, flexShrink: 0 }}>已归档</Tag>}
            <span className="kp-actions" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {isCategory && (
                <Button
                  size="small" type="text" icon={<PlusOutlined />}
                  title="添加子分类"
                  onClick={(e) => { e.stopPropagation(); openCreateCategory(n.id) }}
                  style={{ padding: '0 4px', height: 20, fontSize: 12 }}
                />
              )}
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
    if (keys.length === 0) { setSelected(null); setSourceChunk(null); return }
    const node = findNode(rawTree, keys[0] as string)
    setSelected(node)
    setSourceChunk(null)
    if (node && node.node_type === 'knowledge_point') {
      setSourceLoading(true)
      client.get(`/knowledge-points/${node.id}/source`)
        .then(r => setSourceChunk(r.data.data))
        .catch(() => setSourceChunk(null))
        .finally(() => setSourceLoading(false))
    }
  }

  const openFile = async (docId: string, fileName: string, inline: boolean) => {
    try {
      const res = await client.get(`/documents/${docId}/download`, { params: { inline }, responseType: 'blob' })
      const blob = new Blob([res.data], { type: res.headers['content-type'] })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      if (!inline) a.download = fileName
      else a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      message.error('文件获取失败')
    }
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateCategory()}>
            新建顶级分类
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
              draggable={{ icon: false }}
              allowDrop={allowDrop}
              onDrop={onDrop}
              style={{ fontSize: 13 }}
            />
          )}
        </div>

        {/* 右侧详情 */}
        <div style={{ flex: 1, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0', minHeight: 400 }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selected.node_type === 'category'
                    ? <FolderOutlined style={{ color: '#faad14', fontSize: 18 }} />
                    : <FileOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                  }
                  <Title level={5} style={{ margin: 0 }}>{selected.name}</Title>
                  <Tag color={selected.node_type === 'category' ? 'gold' : 'blue'}>
                    {selected.node_type === 'category' ? '分类' : '知识点'}
                  </Tag>
                </div>
                <Space>
                  {selected.node_type === 'category' && (
                    <Button size="small" icon={<PlusOutlined />} onClick={() => openCreateCategory(selected.id)}>
                      添加子分类
                    </Button>
                  )}
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(selected)}>编辑</Button>
                </Space>
              </div>

              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="类型">
                  <Tag color={selected.node_type === 'category' ? 'gold' : 'blue'}>
                    {selected.node_type === 'category' ? '分类' : '知识点'}
                  </Tag>
                </Descriptions.Item>
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

              {/* Category: show children */}
              {selected.node_type === 'category' && (
                <>
                  <Divider orientation="left" style={{ fontSize: 13 }}>
                    子节点（{selected.children.length}）
                  </Divider>
                  {selected.children.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selected.children.map((c) => (
                        <div
                          key={c.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => {
                            setSelected(c)
                            setSourceChunk(null)
                            if (c.node_type === 'knowledge_point') {
                              setSourceLoading(true)
                              client.get(`/knowledge-points/${c.id}/source`)
                                .then(r => setSourceChunk(r.data.data))
                                .catch(() => setSourceChunk(null))
                                .finally(() => setSourceLoading(false))
                            }
                          }}
                        >
                          {c.node_type === 'category'
                            ? <FolderOutlined style={{ color: '#faad14' }} />
                            : <FileOutlined style={{ color: '#1677ff' }} />
                          }
                          <Text style={{ flex: 1 }}>{c.name}</Text>
                          <Tag color={c.node_type === 'category' ? 'gold' : 'blue'} style={{ margin: 0 }}>
                            {c.node_type === 'category' ? '分类' : '知识点'}
                          </Tag>
                          {c.children.length > 0 && (
                            <Tag color="default" style={{ margin: 0 }}>{c.children.length} 子项</Tag>
                          )}
                          {c.status === 'archived' && <Tag color="default" style={{ margin: 0 }}>已归档</Tag>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 24 }}>
                      <FolderOpenOutlined style={{ fontSize: 28 }} />
                      <div style={{ marginTop: 8 }}>暂无子节点</div>
                      <Button type="link" onClick={() => openCreateCategory(selected.id)}>添加子分类</Button>
                    </div>
                  )}
                </>
              )}

              {/* KnowledgePoint: show source */}
              {selected.node_type === 'knowledge_point' && (
                <>
                  <Divider orientation="left" style={{ fontSize: 13 }}>知识点出处</Divider>
                  {sourceLoading ? (
                    <div style={{ color: '#999', fontSize: 13, padding: '8px 0' }}>加载中...</div>
                  ) : sourceChunk ? (
                    <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {sourceChunk.document && (
                          <Tag color="blue" style={{ margin: 0, cursor: 'pointer' }}
                            onClick={() => navigate(`/documents/${sourceChunk!.document!.id}`)}>
                            {sourceChunk.document.title} ↗
                          </Tag>
                        )}
                        <Tag style={{ margin: 0 }}>第 {sourceChunk.chunk_index + 1} 段</Tag>
                        {sourceChunk.chapter_title && <Tag color="geekblue" style={{ margin: 0 }}>{sourceChunk.chapter_title}</Tag>}
                        {sourceChunk.document && (
                          <Space size={4} style={{ marginLeft: 'auto' }}>
                            {sourceChunk.document.file_name.toLowerCase().endsWith('.pdf') && (
                              <Tooltip title="在浏览器中预览 PDF">
                                <Button size="small" type="link" icon={<FilePdfOutlined />}
                                  style={{ padding: '0 4px', color: '#ff4d4f' }}
                                  onClick={() => openFile(sourceChunk!.document!.id, sourceChunk!.document!.file_name, true)}>
                                  预览
                                </Button>
                              </Tooltip>
                            )}
                            <Tooltip title="下载原始文件">
                              <Button size="small" type="link" icon={<DownloadOutlined />}
                                style={{ padding: '0 4px' }}
                                onClick={() => openFile(sourceChunk!.document!.id, sourceChunk!.document!.file_name, false)}>
                                下载
                              </Button>
                            </Tooltip>
                          </Space>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {sourceChunk.content}
                      </div>
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>此知识点无文档出处（手动创建或来源已删除）</Text>
                  )}
                </>
              )}
            </>
          ) : (
            <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 60 }}>
              <FolderOpenOutlined style={{ fontSize: 48 }} />
              <div style={{ marginTop: 12 }}>点击左侧节点查看详情</div>
            </div>
          )}
        </div>
      </div>

      {/* 新建子分类 */}
      <Modal
        title={createParentId ? '添加子分类' : '新建分类'}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateCategory} style={{ marginTop: 16 }}>
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input maxLength={255} showCount autoFocus />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={creating}>创建分类</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑 */}
      <Modal
        title={`编辑 — ${editNode?.name}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={255} showCount autoFocus />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
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
