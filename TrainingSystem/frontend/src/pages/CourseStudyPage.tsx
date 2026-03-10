import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, Layout, Menu, Progress, Row, Space, Tag, Typography,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, ReadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text, Paragraph } = Typography
const { Sider, Content } = Layout

interface Chapter {
  id: string; chapter_no: number; title: string; content: string; estimated_duration_minutes: number | null
}
interface CourseVersionDetail {
  id: string; title: string; summary: string | null; status: string; chapters: Chapter[]
}

export default function CourseStudyPage() {
  const { versionId } = useParams<{ versionId: string }>()
  const navigate = useNavigate()
  const [version, setVersion] = useState<CourseVersionDetail | null>(null)
  const [currentChap, setCurrentChap] = useState(0)
  const [read, setRead] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!versionId) return
    setLoading(true)
    client.get(`/courses/versions/${versionId}`)
      .then((res) => setVersion(res.data.data))
      .finally(() => setLoading(false))
  }, [versionId])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}>加载中...</div>
  if (!version) return <div style={{ textAlign: 'center', padding: 80 }}>课程不存在</div>

  const chap = version.chapters[currentChap]
  const progress = version.chapters.length > 0 ? Math.round(read.size / version.chapters.length * 100) : 0

  const markRead = () => {
    setRead((prev) => {
      const next = new Set(prev)
      next.add(currentChap)
      return next
    })
    if (currentChap < version.chapters.length - 1) {
      setCurrentChap((c) => c + 1)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* 顶部栏 */}
      <div style={{ background: '#fff', padding: '12px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <Title level={5} style={{ margin: 0 }}>{version.title}</Title>
        </Space>
        <Space>
          <Text type="secondary">学习进度</Text>
          <Progress percent={progress} size="small" style={{ width: 120 }} />
          <Text type="secondary">{read.size}/{version.chapters.length}</Text>
        </Space>
      </div>

      <Layout style={{ flex: 1 }}>
        {/* 左侧目录 */}
        <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: '16px 12px 8px', fontWeight: 600, color: '#666', fontSize: 12 }}>课程目录</div>
          <Menu
            mode="inline"
            selectedKeys={[String(currentChap)]}
            style={{ border: 'none' }}
            items={version.chapters.map((ch, idx) => ({
              key: String(idx),
              icon: read.has(idx) ? <CheckOutlined style={{ color: '#52c41a' }} /> : <ReadOutlined />,
              label: (
                <Space size={4}>
                  <Text style={{ fontSize: 13 }} ellipsis>第{ch.chapter_no}章 {ch.title}</Text>
                  {ch.estimated_duration_minutes && <Tag style={{ fontSize: 10 }}>{ch.estimated_duration_minutes}分</Tag>}
                </Space>
              ),
              onClick: () => setCurrentChap(idx),
            }))}
          />
        </Sider>

        {/* 右侧内容 */}
        <Content style={{ padding: 32 }}>
          {chap ? (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <Card>
                <div style={{ marginBottom: 24 }}>
                  <Tag color="blue">第 {chap.chapter_no} 章</Tag>
                  {chap.estimated_duration_minutes && (
                    <Tag color="default">预计 {chap.estimated_duration_minutes} 分钟</Tag>
                  )}
                  <Title level={3} style={{ marginTop: 12 }}>{chap.title}</Title>
                </div>

                <Paragraph
                  style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#333' }}
                >
                  {chap.content}
                </Paragraph>

                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    disabled={currentChap === 0}
                    onClick={() => setCurrentChap((c) => c - 1)}
                  >
                    上一章
                  </Button>
                  <Button
                    type="primary"
                    icon={read.has(currentChap) ? <CheckOutlined /> : undefined}
                    onClick={markRead}
                    style={{ background: read.has(currentChap) ? '#52c41a' : undefined }}
                  >
                    {read.has(currentChap)
                      ? (currentChap < version.chapters.length - 1 ? '已读，下一章' : '已完成')
                      : (currentChap < version.chapters.length - 1 ? '标记已读，下一章' : '完成学习')}
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <Row justify="center" style={{ paddingTop: 80 }}>
              <Col>
                <Text type="secondary">请从左侧目录选择章节</Text>
              </Col>
            </Row>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
