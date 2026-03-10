import { useEffect, useState } from 'react'
import {
  Button, Form, Input, InputNumber, Modal, Space, Tag, Tree, Typography, message,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { KnowledgePointTree } from '@/api/knowledge'
import { knowledgePointsApi } from '@/api/knowledge'

const { Title, Text } = Typography

function toTreeNodes(nodes: KnowledgePointTree[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: (
      <Space>
        <Text strong>{n.name}</Text>
        {n.weight > 0 && <Tag color="blue">权重 {n.weight}</Tag>}
        {n.description && <Text type="secondary" style={{ fontSize: 12 }}>{n.description}</Text>}
      </Space>
    ),
    children: n.children.length > 0 ? toTreeNodes(n.children) : undefined,
    isLeaf: n.children.length === 0,
  }))
}

export default function KnowledgePointsPage() {
  const [treeData, setTreeData] = useState<DataNode[]>([])
const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [parentId, setParentId] = useState<string | undefined>()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [form] = Form.useForm()

  const fetchTree = async () => {
    setLoading(true)
    try {
      const res = await knowledgePointsApi.tree()
      setTreeData(toTreeNodes(res.data.data))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTree() }, [])

  const openCreate = (pid?: string) => {
    setParentId(pid)
    form.resetFields()
    setCreateOpen(true)
  }

  const handleCreate = async (values: { name: string; description?: string; weight?: number }) => {
    setCreating(true)
    try {
      await knowledgePointsApi.create({ ...values, parent_id: parentId })
      message.success('创建成功')
      setCreateOpen(false)
      fetchTree()
    } finally {
      setCreating(false)
    }
  }

  const handleArchive = () => {
    if (!selectedKey) return
    Modal.confirm({
      title: '确认归档此知识点？',
      content: '归档后不再参与课程/题目生成。',
      okButtonProps: { danger: true },
      onOk: async () => {
        await knowledgePointsApi.archive(selectedKey)
        message.success('已归档')
        setSelectedKey(null)
        fetchTree()
      },
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>知识点管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTree}>刷新</Button>
          {selectedKey && (
            <>
              <Button onClick={() => openCreate(selectedKey)}>添加子节点</Button>
              <Button danger onClick={handleArchive}>归档</Button>
            </>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            新建顶级知识点
          </Button>
        </Space>
      </div>

      {treeData.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
          <p>暂无知识点</p>
          <p style={{ fontSize: 12 }}>可通过审核候选知识点或手动创建来添加</p>
        </div>
      ) : (
        <Tree
          treeData={treeData}
          defaultExpandAll
          showLine
          selectedKeys={selectedKey ? [selectedKey] : []}
          onSelect={(keys) => setSelectedKey(keys[0] as string || null)}
          style={{ background: '#fafafa', padding: 16, borderRadius: 8, minHeight: 200 }}
        />
      )}

      <Modal
        title={parentId ? '添加子知识点' : '新建顶级知识点'}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={255} showCount />
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
    </div>
  )
}
