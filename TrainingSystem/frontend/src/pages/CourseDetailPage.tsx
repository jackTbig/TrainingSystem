import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Card, Collapse, Form, Input, InputNumber, Modal,
  Space, Tag, TreeSelect, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, PlusOutlined, RollbackOutlined, ThunderboltOutlined } from '@ant-design/icons'
import MDEditor from '@uiw/react-md-editor'
import type { Course, CourseVersion } from '@/api/courses'
import { coursesApi } from '@/api/courses'
import client from '@/api/client'

const { Title, Text } = Typography

// Ant Design Form.Item compatible wrapper for MDEditor
function MDEditorField({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <MDEditor
      value={value ?? ''}
      onChange={(v) => onChange?.(v ?? '')}
      height={280}
      data-color-mode="light"
    />
  )
}

const VERSION_STATUS_COLOR: Record<string, string> = {
  draft: 'default', pending_review: 'processing', in_review: 'blue',
  published: 'success', rejected: 'error', archived: 'warning',
}
const VERSION_STATUS_LABEL: Record<string, string> = {
  draft: '草稿', pending_review: '待审核', in_review: '审核中',
  published: '已发布', rejected: '被驳回', archived: '已归档',
}

function toTreeSelectData(nodes: any[]): any[] {
  return nodes.map(n => ({ title: n.name, value: n.id, children: n.children?.length ? toTreeSelectData(n.children) : undefined }))
}

function collectDescendantIds(nodes: any[], targetId: string): string[] {
  for (const n of nodes) {
    if (n.value === targetId) {
      const ids: string[] = []
      const collect = (children: any[]) => { children?.forEach(c => { ids.push(c.value); collect(c.children ?? []) }) }
      collect(n.children ?? [])
      return ids
    }
    const found = collectDescendantIds(n.children ?? [], targetId)
    if (found.length > 0 || (n.children ?? []).some((c: any) => c.value === targetId)) return found
  }
  return []
}

function collectAncestorIds(nodes: any[], targetId: string, path: string[] = []): string[] {
  for (const n of nodes) {
    if (n.value === targetId) return path
    const found = collectAncestorIds(n.children ?? [], targetId, [...path, n.value])
    if (found.length > 0 || (n.children ?? []).some((c: any) => c.value === targetId)) return found
  }
  return []
}

function applyDownwardCascade(prev: string[], next: string[], tree: any[]): string[] {
  const added = next.filter(id => !prev.includes(id))
  const removed = prev.filter(id => !next.includes(id))
  let result = [...next]
  for (const id of added) {
    const desc = collectDescendantIds(tree, id)
    desc.forEach(d => { if (!result.includes(d)) result.push(d) })
  }
  for (const id of removed) {
    // remove descendants (unchecking a parent clears children)
    const desc = collectDescendantIds(tree, id)
    result = result.filter(r => !desc.includes(r))
    // remove ancestors (unchecking a child clears parent)
    const anc = collectAncestorIds(tree, id)
    result = result.filter(r => !anc.includes(r))
  }
  return result
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeVersion, setActiveVersion] = useState<CourseVersion | null>(null)
  const [addVerOpen, setAddVerOpen] = useState(false)
  const [addChapOpen, setAddChapOpen] = useState(false)
  const [aiGenOpen, setAiGenOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [verForm] = Form.useForm()
  const [chapForm] = Form.useForm()
  const [aiGenForm] = Form.useForm()
  const [kpTree, setKpTree] = useState<any[]>([])
  const [selectedKpIds, setSelectedKpIds] = useState<string[]>([])

  const load = async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const res = await coursesApi.get(courseId)
      const c = res.data.data
      setCourse(c)
      if (c.versions.length > 0) {
        const latest = c.versions.reduce((a, b) => a.version_no > b.version_no ? a : b)
        setActiveVersion(latest)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    client.get('/knowledge-points/tree').then(r => setKpTree(toTreeSelectData(r.data.data))).catch(() => {})
  }, [courseId])

  const handleAddVersion = async (values: { title: string; summary?: string }) => {
    if (!courseId) return
    setSaving(true)
    try {
      await coursesApi.createVersion(courseId, values)
      message.success('版本创建成功')
      setAddVerOpen(false)
      verForm.resetFields()
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleAddChapter = async (values: { title: string; content: string; estimated_duration_minutes?: number }) => {
    if (!activeVersion) return
    setSaving(true)
    const nextNo = (activeVersion.chapters.length || 0) + 1
    try {
      await coursesApi.addChapter(activeVersion.id, { chapter_no: nextNo, ...values })
      message.success('章节添加成功')
      setAddChapOpen(false)
      chapForm.resetFields()
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleAiGenerate = async (values: { chapter_count: number }) => {
    if (!courseId) return
    setAiGenerating(true)
    try {
      await client.post(`/courses/${courseId}/ai-generate`, {
        knowledge_point_ids: selectedKpIds,
        chapter_count: values.chapter_count,
      })
      message.success('AI 生成任务已提交，Worker 处理完成后会自动创建新版本，请稍后刷新')
      setAiGenOpen(false)
      aiGenForm.resetFields()
      setSelectedKpIds([])
    } catch {
      message.error('提交失败，请检查 AI Worker 是否运行')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!activeVersion) return
    await coursesApi.updateVersionStatus(activeVersion.id, 'pending_review')
    message.success('已提交审核')
    load()
  }

  const handleRollback = (v: CourseVersion) => {
    Modal.confirm({
      title: `回滚到 v${v.version_no}？`,
      content: '当前已发布版本将被归档，此版本将变为发布状态。',
      onOk: async () => {
        await client.post(`/courses/versions/${v.id}/rollback`)
        message.success('版本回滚成功')
        load()
      },
    })
  }

  if (loading) return <div style={{ padding: 24 }}>加载中...</div>
  if (!course) return <div>课程不存在</div>

  const canEdit = activeVersion?.status === 'draft' || activeVersion?.status === 'rejected'

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/courses')}>返回列表</Button>
      </Space>

      <Title level={4}>{course.title}</Title>

      {/* 版本选择 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">版本：</Text>
        <Space wrap style={{ marginLeft: 8 }}>
          {course.versions.map((v) => (
            <Space key={v.id} size={4}>
              <Tag
                color={activeVersion?.id === v.id ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveVersion(v)}
              >
                v{v.version_no} <Tag color={VERSION_STATUS_COLOR[v.status]} style={{ margin: 0 }}>{VERSION_STATUS_LABEL[v.status]}</Tag>
              </Tag>
              {(v.status === 'archived' || v.status === 'rejected') && (
                <Button
                  size="small" icon={<RollbackOutlined />}
                  onClick={() => handleRollback(v)}
                  style={{ fontSize: 11 }}
                >回滚</Button>
              )}
            </Space>
          ))}
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddVerOpen(true)}>新建版本</Button>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => setAiGenOpen(true)}>AI 生成课程</Button>
        </Space>
      </div>

      {activeVersion ? (
        <Card
          title={`v${activeVersion.version_no}：${activeVersion.title}`}
          extra={
            <Space>
              {activeVersion.summary && <Text type="secondary">{activeVersion.summary}</Text>}
              {canEdit && (
                <>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setAddChapOpen(true)}>添加章节</Button>
                  <Button size="small" type="primary" onClick={handleSubmitReview}>提交审核</Button>
                </>
              )}
            </Space>
          }
        >
          {activeVersion.chapters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              暂无章节，{canEdit ? '点击「添加章节」开始编写' : '此版本无章节内容'}
            </div>
          ) : (
            <Collapse
              items={activeVersion.chapters.map((ch) => ({
                key: ch.id,
                label: <Text strong>第 {ch.chapter_no} 章：{ch.title}{ch.estimated_duration_minutes ? `（约 ${ch.estimated_duration_minutes} 分钟）` : ''}</Text>,
                children: <MDEditor.Markdown source={ch.content} style={{ padding: 8 }} />,
              }))}
            />
          )}
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
            <p>暂无版本，点击「新建版本」创建第一个课程版本</p>
          </div>
        </Card>
      )}

      {/* 新建版本弹窗 */}
      <Modal title="新建课程版本" open={addVerOpen} onCancel={() => { setAddVerOpen(false); verForm.resetFields() }} footer={null}>
        <Form form={verForm} layout="vertical" onFinish={handleAddVersion} style={{ marginTop: 16 }}>
          <Form.Item label="版本标题" name="title" rules={[{ required: true }]}>
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item label="摘要" name="summary">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAddVerOpen(false); verForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI 生成弹窗 */}
      <Modal
        title="AI 生成课程内容"
        open={aiGenOpen}
        onCancel={() => { setAiGenOpen(false); aiGenForm.resetFields(); setSelectedKpIds([]) }}
        footer={null}
        width={440}
      >
        <Form form={aiGenForm} layout="vertical" onFinish={handleAiGenerate} style={{ marginTop: 16 }} initialValues={{ chapter_count: 5 }}>
          <Form.Item label="指定知识点" extra="不选则使用全部已激活知识点">
            <TreeSelect
              treeData={kpTree}
              value={selectedKpIds}
              onChange={(v: any) => {
                const next = Array.isArray(v) ? v.map((i: any) => i?.value ?? i) : []
                setSelectedKpIds(prev => applyDownwardCascade(prev, next, kpTree))
              }}
              multiple
              treeCheckable
              treeCheckStrictly
              showCheckedStrategy="SHOW_ALL"
              placeholder="可选择特定知识点范围"
              style={{ width: '100%' }}
              maxTagCount={3}
              allowClear
            />
          </Form.Item>
          <Form.Item label="章节数量" name="chapter_count" rules={[{ required: true }]}>
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAiGenOpen(false); aiGenForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={aiGenerating} icon={<ThunderboltOutlined />}>
                开始生成
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加章节弹窗 */}
      <Modal title="添加章节" open={addChapOpen} onCancel={() => { setAddChapOpen(false); chapForm.resetFields() }} footer={null} width={640}>
        <Form form={chapForm} layout="vertical" onFinish={handleAddChapter} style={{ marginTop: 16 }}>
          <Form.Item label="章节标题" name="title" rules={[{ required: true }]}>
            <Input maxLength={255} showCount />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入章节内容' }]}>
            <MDEditorField />
          </Form.Item>
          <Form.Item label="预计学习时长（分钟）" name="estimated_duration_minutes">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAddChapOpen(false); chapForm.resetFields() }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={saving}>保存章节</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
