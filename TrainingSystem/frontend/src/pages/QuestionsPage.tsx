import { useEffect, useState } from 'react'
import {
  Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title } = Typography

interface QuestionRow {
  id: string; status: string; current_version_id: string | null; created_at: string
  question_type: string | null; stem: string | null; difficulty_level: number | null
}

const TYPE_LABEL: Record<string, string> = {
  single_choice: '单选', multi_choice: '多选', true_false: '判断',
  fill_blank: '填空', short_answer: '简答',
}

export default function QuestionsPage() {
  const [rows, setRows] = useState<QuestionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [form] = Form.useForm()
  const [aiForm] = Form.useForm()
  const qType = Form.useWatch('question_type', form)

  const fetchData = async (p = page, s = statusFilter, t = typeFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (s) params.status = s
      if (t) params.question_type = t
      const res = await client.get('/questions', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, statusFilter, typeFilter])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      // 构建 answer_json 和 options
      let answer_json: Record<string, unknown> = {}
      let options: Record<string, string> | undefined
      if (values.question_type === 'single_choice' || values.question_type === 'multi_choice') {
        options = { A: values.optA, B: values.optB, C: values.optC, D: values.optD } as Record<string, string>
        answer_json = { answer: values.answer }
      } else if (values.question_type === 'true_false') {
        answer_json = { answer: values.tf_answer }
      } else {
        answer_json = { answer: values.text_answer }
      }
      await client.post('/questions', {
        question_type: values.question_type,
        stem: values.stem,
        options,
        answer_json,
        analysis: values.analysis,
        difficulty_level: values.difficulty_level,
      })
      message.success('题目创建成功')
      setCreateOpen(false)
      form.resetFields()
      fetchData(1)
    } finally {
      setSaving(false)
    }
  }

  const handleAiGenerate = async (values: { count: number; question_types: string[] }) => {
    setAiGenerating(true)
    try {
      await client.post('/questions/ai-generate', {
        knowledge_point_ids: [],
        chapter_ids: [],
        question_types: values.question_types,
        count: values.count,
      })
      message.success('AI 题目生成任务已提交，请稍后刷新查看新题目')
      setAiOpen(false)
      aiForm.resetFields()
    } catch {
      message.error('提交失败，请检查 AI Worker 是否运行')
    } finally {
      setAiGenerating(false)
    }
  }

  const STATUS_COLOR: Record<string, string> = { draft: 'default', published: 'success', archived: 'warning' }

  const columns: ColumnsType<QuestionRow> = [
    {
      title: '类型', dataIndex: 'question_type', width: 70,
      render: (v) => v ? <Tag color="blue">{TYPE_LABEL[v] ?? v}</Tag> : '—',
    },
    {
      title: '题干', dataIndex: 'stem', ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: '难度', dataIndex: 'difficulty_level', width: 70,
      render: (v) => v ? <span style={{ color: '#faad14', whiteSpace: 'nowrap' }}>{'★'.repeat(v)}</span> : '—',
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 150,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 80,
      render: (_, row) => (
        <Button size="small" danger onClick={() => {
          Modal.confirm({
            title: '确认删除此题目？',
            content: '已被试卷引用的题目无法删除。',
            onOk: async () => {
              try {
                await client.delete(`/questions/${row.id}`)
                message.success('已删除')
                fetchData()
              } catch (e: any) {
                message.error(e?.response?.data?.message || '删除失败')
              }
            },
          })
        }}>删除</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>题库管理</Title>
        <Space>
          <Select
            placeholder="状态" allowClear style={{ width: 90 }}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '已发布' }]}
          />
          <Select
            placeholder="题型" allowClear style={{ width: 90 }}
            onChange={(v) => { setTypeFilter(v); setPage(1) }}
            options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<ThunderboltOutlined />} onClick={() => setAiOpen(true)}>AI 批量生成</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建题目</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchData(p) }, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal title="新建题目" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields() }} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }} initialValues={{ question_type: 'single_choice', difficulty_level: 3 }}>
          <Form.Item label="题目类型" name="question_type" rules={[{ required: true }]}>
            <Select options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Form.Item label="题干" name="stem" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          {(qType === 'single_choice' || qType === 'multi_choice') && (
            <>
              {['A', 'B', 'C', 'D'].map((opt) => (
                <Form.Item key={opt} label={`选项 ${opt}`} name={`opt${opt}`} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              ))}
              <Form.Item label="正确答案（如 A 或 AB）" name="answer" rules={[{ required: true }]}>
                <Input maxLength={4} />
              </Form.Item>
            </>
          )}
          {qType === 'true_false' && (
            <Form.Item label="答案" name="tf_answer" rules={[{ required: true }]}>
              <Select options={[{ value: 'true', label: '正确' }, { value: 'false', label: '错误' }]} />
            </Form.Item>
          )}
          {(qType === 'fill_blank' || qType === 'short_answer') && (
            <Form.Item label="参考答案" name="text_answer" rules={[{ required: true }]}>
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
          <Form.Item label="解析" name="analysis">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="难度（1简单～5困难）" name="difficulty_level">
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="AI 批量生成题目"
        open={aiOpen}
        onCancel={() => { setAiOpen(false); aiForm.resetFields() }}
        footer={null}
        width={480}
      >
        <Form
          form={aiForm}
          layout="vertical"
          onFinish={handleAiGenerate}
          style={{ marginTop: 16 }}
          initialValues={{ count: 10, question_types: ['single_choice', 'true_false', 'short_answer'] }}
        >
          <Form.Item label="生成数量" name="count" rules={[{ required: true }]}>
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="题目类型" name="question_types" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAiOpen(false); aiForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={aiGenerating} icon={<ThunderboltOutlined />}>
                开始生成
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
