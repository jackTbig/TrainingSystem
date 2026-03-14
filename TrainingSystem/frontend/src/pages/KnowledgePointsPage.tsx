import { useEffect, useState } from 'react'
import {
  Badge, Button, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber,
  Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Tree, TreeSelect,
  Typography, message,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined,
  FilePdfOutlined, FileOutlined, FolderOpenOutlined, FolderOutlined,
  LinkOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Candidate, KnowledgePointTree } from '@/api/knowledge'
import { candidatesApi, knowledgePointsApi } from '@/api/knowledge'
import client from '@/api/client'

const { Title, Text, Paragraph } = Typography

// ── helpers ───────────────────────────────────────────────────────────────────

function findNode(nodes: KnowledgePointTree[], id: string): KnowledgePointTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function toTreeSelectData(nodes: any[]): any[] {
  return nodes.map(n => ({
    title: n.name,
    value: n.id,
    children: n.children?.length ? toTreeSelectData(n.children) : undefined,
  }))
}

// ── candidate constants ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing', accepted: 'success', ignored: 'default', merged: 'purple',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待审核', accepted: '已接受', ignored: '已忽略', merged: '已合并',
}

// ── openFile helper ───────────────────────────────────────────────────────────

async function openFile(docId: string, fileName: string, inline: boolean) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// Tree tab panel
// ═══════════════════════════════════════════════════════════════════════════════

function TreePanel() {
  const [rawTree, setRawTree] = useState<KnowledgePointTree[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<KnowledgePointTree | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// Candidates tab panel
// ═══════════════════════════════════════════════════════════════════════════════

function CandidatesPanel() {
  const [items, setItems] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  // 详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<Candidate | null>(null)
  const [linkedKp, setLinkedKp] = useState<{ id: string; name: string } | null>(null)
  const [kpLoading, setKpLoading] = useState(false)
  const [sourceChunk, setSourceChunk] = useState<{
    chunk_index: number; chapter_title: string | null; content: string
    document: { id: string; title: string; file_name: string } | null
  } | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)

  // 接受弹窗
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [acceptRow, setAcceptRow] = useState<Candidate | null>(null)
  const [acceptSaving, setAcceptSaving] = useState(false)
  const [acceptForm] = Form.useForm()
  const [kpTree, setKpTree] = useState<any[]>([])

  const navigate = useNavigate()

  const fetchData = async (p = page, s = statusFilter, ps = pageSize) => {
    setLoading(true)
    try {
      const res = await candidatesApi.list({ page: p, page_size: ps, status: s })
      setItems(res.data.data.items)
      setTotal(res.data.data.total)
      setSelectedIds([])
    } finally {
      setLoading(false)
    }
  }

  const fetchKpTree = () => {
    knowledgePointsApi.tree()
      .then(r => setKpTree(toTreeSelectData(r.data.data)))
      .catch(() => {})
  }

  useEffect(() => { fetchData(1, statusFilter) }, [statusFilter])
  useEffect(() => { fetchKpTree() }, [])

  // ── 单条操作 ──────────────────────────────────────────────────────────────

  const openAccept = (row: Candidate) => {
    setAcceptRow(row)
    acceptForm.setFieldsValue({
      name: row.candidate_name,
      description: row.candidate_description ?? '',
      parent_id: undefined,
      weight: 0,
    })
    setAcceptOpen(true)
  }

  const handleAccept = async () => {
    if (!acceptRow) return
    setAcceptSaving(true)
    try {
      const values = acceptForm.getFieldsValue()
      await candidatesApi.accept(acceptRow.id, {
        name: values.name,
        description: values.description,
        parent_id: values.parent_id,
        weight: values.weight || 0,
      })
      message.success('已接受并创建知识点')
      setAcceptOpen(false)
      if (detail?.id === acceptRow.id) setDrawerOpen(false)
      fetchData()
      fetchKpTree()
    } catch {
      message.error('接受失败')
    } finally {
      setAcceptSaving(false)
    }
  }

  const handleIgnore = (row: Candidate) => {
    Modal.confirm({
      title: '忽略此候选知识点？',
      content: `"${row.candidate_name}" 将被标记为已忽略`,
      okText: '确认忽略',
      okButtonProps: { danger: true },
      onOk: async () => {
        await candidatesApi.ignore(row.id)
        message.success('已忽略')
        if (detail?.id === row.id) setDrawerOpen(false)
        fetchData()
      },
    })
  }

  // ── 批量操作 ──────────────────────────────────────────────────────────────

  const handleBatchAccept = async () => {
    setBatchLoading(true)
    try {
      const res = await client.post('/knowledge-points/candidates/batch-accept', { ids: selectedIds })
      const { accepted, failed } = res.data.data
      message.success(`已接受 ${accepted} 条${failed ? `，${failed} 条失败` : ''}`)
      fetchData()
      fetchKpTree()
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchIgnore = async () => {
    setBatchLoading(true)
    try {
      const res = await client.post('/knowledge-points/candidates/batch-ignore', { ids: selectedIds })
      const { ignored, failed } = res.data.data
      message.success(`已忽略 ${ignored} 条${failed ? `，${failed} 条失败` : ''}`)
      fetchData()
    } finally {
      setBatchLoading(false)
    }
  }

  const pendingSelected = items.filter((i) => selectedIds.includes(i.id) && i.status === 'pending')

  // ── 查看详情 ──────────────────────────────────────────────────────────────

  const openDetail = async (row: Candidate) => {
    setDetail(row)
    setLinkedKp(null)
    setSourceChunk(null)
    setDrawerOpen(true)

    const tasks: Promise<void>[] = []

    if (row.document_chunk_id) {
      setSourceLoading(true)
      tasks.push(
        client.get(`/documents/chunks/${row.document_chunk_id}`)
          .then((res) => setSourceChunk(res.data.data))
          .catch(() => setSourceChunk(null))
          .finally(() => setSourceLoading(false))
      )
    }

    if (row.status === 'accepted') {
      setKpLoading(true)
      tasks.push(
        knowledgePointsApi.search(row.candidate_name, 1, 5)
          .then((res) => {
            const match = res.data.data.items.find((kp: any) => kp.name === row.candidate_name)
            if (match) setLinkedKp({ id: match.id, name: match.name })
          })
          .catch(() => {})
          .finally(() => setKpLoading(false))
      )
    }

    await Promise.all(tasks)
  }

  // ── 表格列 ────────────────────────────────────────────────────────────────

  const columns: ColumnsType<Candidate> = [
    {
      title: '候选名称',
      dataIndex: 'candidate_name',
      render: (v, row) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: '#1677ff' }}
          onClick={() => openDetail(row)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: '描述',
      dataIndex: 'candidate_description',
      ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence_score',
      width: 90,
      render: (v: number | null) =>
        v != null ? (
          <Tag color={v >= 0.8 ? 'green' : v >= 0.6 ? 'orange' : 'red'}>
            {(v * 100).toFixed(0)}%
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) =>
        s === 'pending'
          ? <Badge status="processing" text="待审核" />
          : <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 120,
      render: (_, row) => (
        <Space>
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(row)} />
          </Tooltip>
          {row.status === 'pending' && (
            <>
              <Tooltip title="接受，创建知识点">
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openAccept(row)} />
              </Tooltip>
              <Tooltip title="忽略">
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleIgnore(row)} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Select
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          style={{ width: 120 }}
          options={[
            { label: '待审核', value: 'pending' },
            { label: '已接受', value: 'accepted' },
            { label: '已忽略', value: 'ignored' },
            { label: '已合并', value: 'merged' },
            { label: '全部', value: undefined },
          ]}
        />
      </div>

      {/* 批量操作工具栏 */}
      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
          padding: '10px 16px', background: '#e6f4ff', borderRadius: 8, border: '1px solid #91caff',
        }}>
          <Text>
            已选 <Text strong>{selectedIds.length}</Text> 条
            {pendingSelected.length < selectedIds.length && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                （其中 {pendingSelected.length} 条待审核可操作）
              </Text>
            )}
          </Text>
          <Button
            type="primary" size="small" icon={<CheckOutlined />}
            loading={batchLoading} disabled={pendingSelected.length === 0}
            onClick={handleBatchAccept}
          >
            批量接受
          </Button>
          <Popconfirm
            title={`批量忽略 ${pendingSelected.length} 条待审核候选知识点？`}
            okText="确认忽略" cancelText="取消" okButtonProps={{ danger: true }}
            disabled={pendingSelected.length === 0}
            onConfirm={handleBatchIgnore}
          >
            <Button
              danger size="small" icon={<CloseOutlined />}
              loading={batchLoading} disabled={pendingSelected.length === 0}
            >
              批量忽略
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedIds([])}>取消选择</Button>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
            fetchData(p, statusFilter, ps)
          },
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      {/* 详情抽屉 */}
      <Drawer
        title="候选知识点详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          detail?.status === 'pending' && (
            <Space>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => { setDrawerOpen(false); openAccept(detail) }}>接受</Button>
              <Button danger icon={<CloseOutlined />} onClick={() => handleIgnore(detail)}>忽略</Button>
            </Space>
          )
        }
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="候选名称">
                <Text strong>{detail.candidate_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 'pending'
                  ? <Badge status="processing" text="待审核" />
                  : <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {detail.confidence_score != null
                  ? <Tag color={detail.confidence_score >= 0.8 ? 'green' : detail.confidence_score >= 0.6 ? 'orange' : 'red'}>
                      {(detail.confidence_score * 100).toFixed(1)}%
                    </Tag>
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="提取时间">
                {new Date(detail.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            {detail.candidate_description && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>描述</Text>
                <Paragraph style={{ margin: 0, padding: '10px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  {detail.candidate_description}
                </Paragraph>
              </div>
            )}

            {/* 知识点出处 */}
            {detail.document_chunk_id && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>知识点出处</Text>
                {sourceLoading ? (
                  <div style={{ color: '#999', fontSize: 13 }}>加载中...</div>
                ) : sourceChunk ? (
                  <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {sourceChunk.document && (
                        <Tag
                          color="blue" style={{ margin: 0, cursor: 'pointer' }}
                          onClick={() => { setDrawerOpen(false); navigate(`/documents/${sourceChunk.document!.id}`) }}
                        >
                          {sourceChunk.document.title} ↗
                        </Tag>
                      )}
                      <Tag style={{ margin: 0 }}>第 {sourceChunk.chunk_index + 1} 段</Tag>
                      {sourceChunk.chapter_title && (
                        <Tag color="geekblue" style={{ margin: 0 }}>{sourceChunk.chapter_title}</Tag>
                      )}
                      {sourceChunk.document && (() => {
                        const docId = sourceChunk.document!.id
                        const fileName = sourceChunk.document!.file_name
                        const isPdf = fileName.toLowerCase().endsWith('.pdf')
                        return (
                          <Space size={4} style={{ marginLeft: 'auto' }}>
                            {isPdf && (
                              <Tooltip title="在浏览器中预览 PDF">
                                <Button
                                  size="small" type="link" icon={<FilePdfOutlined />}
                                  style={{ padding: '0 4px', color: '#ff4d4f' }}
                                  onClick={() => openFile(docId, fileName, true)}
                                >
                                  预览
                                </Button>
                              </Tooltip>
                            )}
                            <Tooltip title="下载原始文件">
                              <Button
                                size="small" type="link" icon={<DownloadOutlined />}
                                style={{ padding: '0 4px' }}
                                onClick={() => openFile(docId, fileName, false)}
                              >
                                下载
                              </Button>
                            </Tooltip>
                          </Space>
                        )
                      })()}
                    </div>
                    <div style={{ padding: '10px 12px', maxHeight: 200, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {sourceChunk.content}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>原始文档块已删除或无法访问</Text>
                )}
              </div>
            )}

            {/* 已接受时显示对应知识点链接 */}
            {detail.status === 'accepted' && (
              <div style={{ padding: '12px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                <Text strong style={{ color: '#52c41a' }}>已创建对应知识点</Text>
                {kpLoading && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>查找中...</Text>}
                {linkedKp && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      type="link" icon={<LinkOutlined />} style={{ padding: 0 }}
                      onClick={() => { setDrawerOpen(false); navigate('/knowledge-points') }}
                    >
                      前往知识点管理查看「{linkedKp.name}」
                    </Button>
                  </div>
                )}
                {!kpLoading && !linkedKp && (
                  <div style={{ marginTop: 4 }}>
                    <Button
                      type="link" icon={<LinkOutlined />} style={{ padding: 0 }}
                      onClick={() => { setDrawerOpen(false); navigate('/knowledge-points') }}
                    >
                      前往知识点管理
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* 接受弹窗（含表单） */}
      <Modal
        title="接受候选知识点"
        open={acceptOpen}
        onCancel={() => { setAcceptOpen(false); acceptForm.resetFields() }}
        onOk={handleAccept}
        okText="确认接受"
        confirmLoading={acceptSaving}
        width={520}
      >
        <Form form={acceptForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="知识点名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={255} showCount />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="父级知识点" name="parent_id" extra="不选则创建为顶级知识点">
            <TreeSelect
              treeData={kpTree}
              placeholder="选择父级知识点（可选）"
              allowClear
              style={{ width: '100%' }}
              treeDefaultExpandAll={false}
              showSearch
              treeNodeFilterProp="title"
            />
          </Form.Item>
          <Form.Item label="权重（越大越重要）" name="weight" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main page with tabs
// ═══════════════════════════════════════════════════════════════════════════════

export default function KnowledgePointsPage() {
  // We need a pending count for the badge. Fetch it once on mount.
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    candidatesApi.list({ page: 1, page_size: 1, status: 'pending' })
      .then(r => setPendingCount(r.data.data.total))
      .catch(() => {})
  }, [])

  const tabItems = [
    {
      key: 'tree',
      label: '知识点目录',
      children: (
        <div>
          <style>{`
            .kp-tree-node .kp-actions { opacity: 0; transition: opacity 0.15s; }
            .kp-tree-node:hover .kp-actions { opacity: 1; }
          `}</style>
          <TreePanel />
        </div>
      ),
    },
    {
      key: 'candidates',
      label: (
        <span>
          候选知识点
          {pendingCount != null && pendingCount > 0 && (
            <Badge count={pendingCount} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: <CandidatesPanel />,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>知识点管理</Title>
      </div>
      <Tabs defaultActiveKey="tree" items={tabItems} />
    </div>
  )
}
