import { useEffect, useState } from 'react'
import {
  Badge, Button, Collapse, Form, Input, Modal, Popconfirm,
  Select, Space, Tag, TreeSelect, Typography, message,
} from 'antd'
import {
  CheckOutlined, CloseOutlined, FileTextOutlined, PlusOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Candidate, KnowledgePointTree } from '@/api/knowledge'
import { candidatesApi, knowledgePointsApi } from '@/api/knowledge'

const { Title, Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  accepted: 'success',
  ignored: 'default',
  merged: 'purple',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待审核', accepted: '已接受', ignored: '已忽略', merged: '已合并',
}

function toCategoryTreeSelect(nodes: KnowledgePointTree[]): any[] {
  return nodes
    .filter(n => n.node_type === 'category')
    .map(n => {
      const catChildren = n.children.filter(c => c.node_type === 'category')
      return {
        title: n.name,
        value: n.id,
        children: catChildren.length > 0 ? toCategoryTreeSelect(n.children) : undefined,
      }
    })
}

interface AcceptModalState {
  open: boolean
  candidate: Candidate | null
  batchIds: string[] | null  // null = single accept
}

export default function KnowledgeCandidatesPage() {
  const navigate = useNavigate()
  const [allItems, setAllItems] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  // category tree for accept modal
  const [categoryTree, setCategoryTree] = useState<KnowledgePointTree[]>([])

  // accept modal
  const [acceptModal, setAcceptModal] = useState<AcceptModalState>({ open: false, candidate: null, batchIds: null })
  const [acceptForm] = Form.useForm()
  const [accepting, setAccepting] = useState(false)

  // manual create modal
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm] = Form.useForm()
  const [manualCreating, setManualCreating] = useState(false)

  // per-group selections
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>({})

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await candidatesApi.list({ page: 1, page_size: 200 })
      setAllItems(res.data.data.items)
      setGroupSelections({})
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await knowledgePointsApi.tree()
      setCategoryTree(res.data.data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchData()
    fetchCategories()
  }, [])

  // ── Filtering ────────────────────────────────────────────────────────────

  const filteredItems = statusFilter
    ? allItems.filter(i => i.status === statusFilter)
    : allItems

  // ── Grouping ─────────────────────────────────────────────────────────────

  type Group = {
    key: string
    label: string
    docId: string | null
    items: Candidate[]
    isManual: boolean
  }

  const groupMap = new Map<string, Group>()
  for (const item of filteredItems) {
    const key = item.document_id ?? '__manual__'
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        label: item.document_title ?? (item.source_type === 'manual' ? '手动添加' : '未知文档'),
        docId: item.document_id,
        items: [],
        isManual: !item.document_id,
      })
    }
    groupMap.get(key)!.items.push(item)
  }
  // Ensure manual group exists even if empty after filter
  if (!groupMap.has('__manual__')) {
    groupMap.set('__manual__', { key: '__manual__', label: '手动添加', docId: null, items: [], isManual: true })
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.isManual) return 1
    if (b.isManual) return -1
    return a.label.localeCompare(b.label)
  })

  // ── Accept ────────────────────────────────────────────────────────────────

  const openAccept = (candidate: Candidate) => {
    setAcceptModal({ open: true, candidate, batchIds: null })
    acceptForm.setFieldsValue({
      name: candidate.candidate_name,
      description: candidate.candidate_description ?? '',
      category_id: undefined,
    })
  }

  const openBatchAccept = (ids: string[]) => {
    setAcceptModal({ open: true, candidate: null, batchIds: ids })
    acceptForm.setFieldsValue({ name: undefined, description: undefined, category_id: undefined })
  }

  const handleAcceptSubmit = async (values: { name?: string; description?: string; category_id: string }) => {
    setAccepting(true)
    try {
      if (acceptModal.batchIds) {
        const res = await candidatesApi.batchAccept(acceptModal.batchIds, values.category_id)
        const { accepted, failed } = (res as any).data.data
        message.success(`已接受 ${accepted} 条${failed ? `，${failed} 条失败` : ''}`)
      } else if (acceptModal.candidate) {
        await candidatesApi.accept(acceptModal.candidate.id, {
          name: values.name,
          description: values.description,
          category_id: values.category_id,
        })
        message.success('已接受并创建知识点')
      }
      setAcceptModal({ open: false, candidate: null, batchIds: null })
      acceptForm.resetFields()
      await fetchData()
      await fetchCategories()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '操作失败')
    } finally {
      setAccepting(false)
    }
  }

  // ── Ignore ────────────────────────────────────────────────────────────────

  const handleIgnore = async (candidate: Candidate) => {
    try {
      await candidatesApi.ignore(candidate.id)
      message.success('已忽略')
      await fetchData()
    } catch {
      message.error('操作失败')
    }
  }

  const handleBatchIgnore = async (ids: string[]) => {
    try {
      const res = await candidatesApi.batchIgnore(ids)
      const { ignored, failed } = (res as any).data.data
      message.success(`已忽略 ${ignored} 条${failed ? `，${failed} 条失败` : ''}`)
      await fetchData()
    } catch {
      message.error('操作失败')
    }
  }

  // ── Manual create ─────────────────────────────────────────────────────────

  const handleManualCreate = async (values: { candidate_name: string; candidate_description?: string }) => {
    setManualCreating(true)
    try {
      await candidatesApi.createManual(values)
      message.success('手动候选知识点已创建')
      setManualOpen(false)
      manualForm.resetFields()
      await fetchData()
    } finally {
      setManualCreating(false)
    }
  }

  // ── Collapse items ────────────────────────────────────────────────────────

  const categoryTreeData = toCategoryTreeSelect(categoryTree)

  const collapseItems = groups.map(group => {
    const pendingItems = group.items.filter(i => i.status === 'pending')
    const sel = groupSelections[group.key] ?? []
    const pendingSel = sel.filter(id => group.items.find(i => i.id === id && i.status === 'pending'))

    const toggleSelect = (id: string) => {
      setGroupSelections(prev => {
        const cur = prev[group.key] ?? []
        return {
          ...prev,
          [group.key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id],
        }
      })
    }

    const toggleAll = () => {
      const allIds = pendingItems.map(i => i.id)
      const cur = groupSelections[group.key] ?? []
      const allSelected = allIds.every(id => cur.includes(id))
      setGroupSelections(prev => ({
        ...prev,
        [group.key]: allSelected ? cur.filter(id => !allIds.includes(id)) : [...new Set([...cur, ...allIds])],
      }))
    }

    const headerExtra = (
      <Space onClick={e => e.stopPropagation()}>
        {pendingItems.length > 0 && (
          <Tag color="processing">{pendingItems.length} 待审核</Tag>
        )}
        <Tag>{group.items.length} 条</Tag>
        {group.isManual && (
          <Button
            size="small" type="dashed" icon={<PlusOutlined />}
            onClick={e => { e.stopPropagation(); setManualOpen(true) }}
          >
            添加候选
          </Button>
        )}
        {group.docId && (
          <Button
            size="small" type="link"
            onClick={e => { e.stopPropagation(); navigate(`/documents/${group.docId}`) }}
          >
            查看文档 ↗
          </Button>
        )}
      </Space>
    )

    const batchBar = pendingSel.length > 0 && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        background: '#e6f4ff', borderRadius: 6, border: '1px solid #91caff', marginBottom: 8,
      }}>
        <Text>已选 <Text strong>{pendingSel.length}</Text> 条</Text>
        <Button
          size="small" type="primary" icon={<CheckOutlined />}
          onClick={() => openBatchAccept(pendingSel)}
        >
          批量接受
        </Button>
        <Popconfirm
          title={`批量忽略 ${pendingSel.length} 条？`}
          okText="确认" cancelText="取消" okButtonProps={{ danger: true }}
          onConfirm={() => handleBatchIgnore(pendingSel)}
        >
          <Button size="small" danger icon={<CloseOutlined />}>批量忽略</Button>
        </Popconfirm>
        <Button size="small" onClick={() => setGroupSelections(prev => ({ ...prev, [group.key]: [] }))}>
          取消
        </Button>
      </div>
    )

    const content = (
      <div>
        {batchBar}
        {group.items.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>暂无候选知识点</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pendingItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={pendingItems.every(i => sel.includes(i.id))}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>全选待审核</Text>
              </div>
            )}
            {group.items.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                  background: item.status === 'pending' ? '#fafafa' : '#f9f9f9',
                  borderRadius: 6, border: '1px solid #f0f0f0',
                }}
              >
                {item.status === 'pending' && (
                  <input
                    type="checkbox"
                    checked={sel.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <FileTextOutlined style={{ color: '#8c8c8c', flexShrink: 0 }} />
                    <Text strong style={{ fontSize: 13 }}>{item.candidate_name}</Text>
                    {item.status === 'pending'
                      ? <Badge status="processing" text="待审核" />
                      : <Tag color={STATUS_COLOR[item.status]} style={{ margin: 0 }}>{STATUS_LABEL[item.status] ?? item.status}</Tag>
                    }
                    {item.confidence_score != null && (
                      <Tag color={item.confidence_score >= 0.8 ? 'green' : item.confidence_score >= 0.6 ? 'orange' : 'red'} style={{ margin: 0 }}>
                        {(item.confidence_score * 100).toFixed(0)}%
                      </Tag>
                    )}
                    {item.source_type === 'manual' && (
                      <Tag color="cyan" style={{ margin: 0 }}>手动</Tag>
                    )}
                  </div>
                  {item.candidate_description && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                      {item.candidate_description}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </Text>
                </div>
                {item.status === 'pending' && (
                  <Space style={{ flexShrink: 0 }}>
                    <Button
                      size="small" type="primary" icon={<CheckOutlined />}
                      onClick={() => openAccept(item)}
                    >
                      接受
                    </Button>
                    <Popconfirm
                      title={`忽略「${item.candidate_name}」？`}
                      okText="忽略" cancelText="取消" okButtonProps={{ danger: true }}
                      onConfirm={() => handleIgnore(item)}
                    >
                      <Button size="small" danger icon={<CloseOutlined />}>忽略</Button>
                    </Popconfirm>
                  </Space>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )

    return {
      key: group.key,
      label: (
        <Space>
          <Text strong>{group.label}</Text>
          {group.isManual && <Tag color="cyan">手动</Tag>}
        </Space>
      ),
      extra: headerExtra,
      children: content,
    }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>候选知识点审核</Title>
        <Space>
          <Select
            value={statusFilter}
            onChange={v => setStatusFilter(v)}
            placeholder="全部状态"
            allowClear
            style={{ width: 130 }}
            options={[
              { label: '待审核', value: 'pending' },
              { label: '已接受', value: 'accepted' },
              { label: '已忽略', value: 'ignored' },
              { label: '已合并', value: 'merged' },
            ]}
          />
          <Button
            type="primary" icon={<PlusOutlined />}
            onClick={() => setManualOpen(true)}
          >
            手动添加候选知识点
          </Button>
        </Space>
      </div>

      {loading && <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>加载中...</div>}
      {!loading && (
        <Collapse
          defaultActiveKey={groups.filter(g => g.items.some(i => i.status === 'pending')).map(g => g.key)}
          items={collapseItems}
          style={{ background: 'transparent' }}
        />
      )}

      {/* Accept modal */}
      <Modal
        title={acceptModal.batchIds ? `批量接受 ${acceptModal.batchIds.length} 条候选知识点` : `接受候选知识点`}
        open={acceptModal.open}
        onCancel={() => { setAcceptModal({ open: false, candidate: null, batchIds: null }); acceptForm.resetFields() }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={acceptForm} layout="vertical" onFinish={handleAcceptSubmit} style={{ marginTop: 16 }}>
          {!acceptModal.batchIds && (
            <>
              <Form.Item label="知识点名称" name="name">
                <Input maxLength={255} showCount />
              </Form.Item>
              <Form.Item label="描述" name="description">
                <Input.TextArea rows={3} maxLength={1000} showCount />
              </Form.Item>
            </>
          )}
          <Form.Item
            label="目标分类"
            name="category_id"
            rules={[{ required: true, message: '请选择目标分类' }]}
          >
            <TreeSelect
              treeData={categoryTreeData}
              placeholder="选择目标分类（必须先在知识点管理中创建分类）"
              treeDefaultExpandAll
              showSearch
              filterTreeNode={(val, node: any) => node.title?.toLowerCase().includes(val.toLowerCase())}
              style={{ width: '100%' }}
              notFoundContent={
                <div style={{ padding: 12, color: '#999', fontSize: 13 }}>
                  暂无分类，请先在「知识点管理」中创建分类
                </div>
              }
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setAcceptModal({ open: false, candidate: null, batchIds: null }); acceptForm.resetFields() }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={accepting}>
                {acceptModal.batchIds ? '批量接受' : '接受并创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Manual create modal */}
      <Modal
        title="手动添加候选知识点"
        open={manualOpen}
        onCancel={() => { setManualOpen(false); manualForm.resetFields() }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form form={manualForm} layout="vertical" onFinish={handleManualCreate} style={{ marginTop: 16 }}>
          <Form.Item
            label="候选名称"
            name="candidate_name"
            rules={[{ required: true, message: '请输入候选名称' }]}
          >
            <Input maxLength={255} showCount autoFocus />
          </Form.Item>
          <Form.Item label="描述" name="candidate_description">
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setManualOpen(false); manualForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={manualCreating}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
