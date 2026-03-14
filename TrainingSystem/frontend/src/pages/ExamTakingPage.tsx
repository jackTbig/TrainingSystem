import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Alert, Button, Card, Col, Modal, Progress, Radio, Row,
  Space, Tag, Typography, message, Result,
} from 'antd'
import { CheckOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text, Paragraph } = Typography

interface Question {
  question_version_id: string
  sort_order: number
  score: number
  question_type: string
  stem: string
  options: Record<string, string | string[]> | null
}

interface PaperData {
  exam_id: string
  title: string
  duration_minutes: number
  total_score: number
  pass_score: number
  questions: Question[]
}

type Answers = Record<string, string | string[] | Record<string, string>>

const TYPE_LABEL: Record<string, string> = {
  single_choice: '单选', multi_choice: '多选', true_false: '判断',
  fill_blank: '填空', short_answer: '简答',
  matching: '连线题', ai_graded: 'AI判卷',
}

export default function ExamTakingPage() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>()
  const navigate = useNavigate()

  const [paper, setPaper] = useState<PaperData | null>(null)
  const [paperError, setPaperError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [shuffledRights, setShuffledRights] = useState<Record<string, string[]>>({})
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 加载试卷
  useEffect(() => {
    if (!examId) return
    setLoading(true)
    client.get(`/exams/${examId}/paper`)
      .then((res) => {
        const p: PaperData = res.data.data
        setPaper(p)
        setSecondsLeft(p.duration_minutes * 60)
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } } }
        setPaperError(err?.response?.data?.message || '试卷加载失败，该考试可能未关联试卷')
      })
      .finally(() => setLoading(false))
  }, [examId])

  // 初始化连线题打乱顺序的右侧选项
  useEffect(() => {
    if (!paper) return
    const map: Record<string, string[]> = {}
    paper.questions.forEach((q) => {
      if (q.question_type === 'matching' && Array.isArray(q.options?.right)) {
        const rights = [...(q.options!.right as string[])]
        for (let i = rights.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rights[i], rights[j]] = [rights[j], rights[i]]
        }
        map[q.question_version_id] = rights
      }
    })
    setShuffledRights(map)
  }, [paper])

  // 倒计时
  useEffect(() => {
    if (!paper) return
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(countdownRef.current!)
          handleSubmit(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current!)
  }, [paper])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // 单题自动保存
  const autoSave = async (qvid: string, answer: unknown) => {
    if (!attemptId) return
    try {
      await client.post(`/exams/attempts/${attemptId}/answers`, {
        question_version_id: qvid,
        answer_json: { value: answer },
      })
    } catch { /* 静默失败 */ }
  }

  const handleAnswer = (qvid: string, value: string | string[] | Record<string, string>) => {
    setAnswers((prev) => ({ ...prev, [qvid]: value }))
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => autoSave(qvid, value), 1500)
  }

  const isAnswered = (q: Question) => {
    const ans = answers[q.question_version_id]
    if (!ans) return false
    if (q.question_type === 'matching' && Array.isArray(q.options?.left)) {
      const pairs = ans as Record<string, string>
      return (q.options!.left as string[]).every((_: string, i: number) => pairs[String(i)] !== undefined)
    }
    return !!ans
  }

  const handleSubmit = async (isTimeout = false) => {
    if (!attemptId) return
    if (!isTimeout) {
      const unanswered = paper!.questions.filter((q) => !isAnswered(q)).length
      if (unanswered > 0) {
        Modal.confirm({
          title: `还有 ${unanswered} 道题未作答`,
          content: '确认提交？未作答的题目将得 0 分。',
          okText: '确认提交', cancelText: '继续作答',
          onOk: () => doSubmit(),
        })
        return
      }
    }
    await doSubmit()
  }

  const doSubmit = async () => {
    if (!attemptId) return
    setSubmitting(true)
    clearInterval(countdownRef.current!)
    try {
      const answerList = Object.entries(answers).map(([question_version_id, value]) => ({
        question_version_id,
        answer_json: { value },
      }))
      const res = await client.post(`/exams/attempts/${attemptId}/submit`, answerList)
      const { total_score, pass_result } = res.data.data
      message.success(pass_result ? `提交成功！得分 ${total_score}，通过！` : `提交成功，得分 ${total_score}`)
      navigate(`/exam/${attemptId}/result`)
    } catch {
      message.error('提交失败，请重试')
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}>加载中...</div>
  if (paperError || !paper) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Result
        status="error"
        title="无法加载试卷"
        subTitle={paperError || '试卷不存在或未关联到该考试'}
        extra={<Button type="primary" onClick={() => navigate('/my-exams')}>返回我的考试</Button>}
      />
    </div>
  )

  const q = paper.questions[current]
  const answered = paper.questions.filter(isAnswered).length
  const urgentTime = secondsLeft < 300 // 5分钟内变红

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* 顶部信息栏 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100, background: '#fff',
        padding: '12px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>{paper.title}</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            总分 {paper.total_score} 分 · 及格 {paper.pass_score} 分 · 共 {paper.questions.length} 题
          </Text>
        </div>
        <Space size="large">
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: urgentTime ? '#ff4d4f' : '#1677ff', fontSize: 22, fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />{formatTime(secondsLeft)}
            </div>
            {urgentTime && <Text type="danger" style={{ fontSize: 11 }}>即将超时！</Text>}
          </div>
          <Button
            type="primary" icon={<SendOutlined />} loading={submitting}
            onClick={() => handleSubmit(false)}
          >
            交卷
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* 左侧题号导航 */}
        <Col xs={24} md={5}>
          <Card size="small" title="答题进度" style={{ position: 'sticky', top: 80 }}>
            <Progress
              percent={Math.round(answered / paper.questions.length * 100)}
              size="small"
              format={() => `${answered}/${paper.questions.length}`}
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {paper.questions.map((item, idx) => {
                const isDone = isAnswered(item)
                const isCur = idx === current
                return (
                  <div
                    key={item.question_version_id}
                    onClick={() => setCurrent(idx)}
                    style={{
                      width: 32, height: 32, lineHeight: '32px', textAlign: 'center',
                      borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: isCur ? 'bold' : 'normal',
                      border: isCur ? '2px solid #1677ff' : '1px solid #d9d9d9',
                      background: isDone ? '#e6f4ff' : '#fff',
                      color: isDone ? '#1677ff' : '#666',
                    }}
                  >
                    {idx + 1}
                    {isDone && <CheckOutlined style={{ fontSize: 10, marginLeft: 1 }} />}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
              <span style={{ background: '#e6f4ff', padding: '1px 6px', borderRadius: 3, marginRight: 4 }}>已答</span>
              <span style={{ background: '#fff', border: '1px solid #d9d9d9', padding: '1px 6px', borderRadius: 3 }}>未答</span>
            </div>
          </Card>
        </Col>

        {/* 右侧答题区 */}
        <Col xs={24} md={19}>
          <Card
            title={
              <Space>
                <Text strong>第 {current + 1} 题</Text>
                <Tag color="blue">{TYPE_LABEL[q.question_type] ?? q.question_type}</Tag>
                <Tag>{q.score} 分</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>上一题</Button>
                <Button disabled={current === paper.questions.length - 1} onClick={() => setCurrent((c) => c + 1)}>下一题</Button>
              </Space>
            }
          >
            <Paragraph style={{ fontSize: 16, marginBottom: 20 }}>{q.stem}</Paragraph>

            {/* 单选 */}
            {q.question_type === 'single_choice' && q.options && (
              <Radio.Group
                value={answers[q.question_version_id]}
                onChange={(e) => handleAnswer(q.question_version_id, e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {Object.entries(q.options).map(([k, v]) => (
                  <Radio key={k} value={k} style={{ padding: '10px 16px', border: '1px solid #d9d9d9', borderRadius: 6, margin: 0, background: answers[q.question_version_id] === k ? '#e6f4ff' : '#fff' }}>
                    <Text><Text strong>{k}.</Text> {v}</Text>
                  </Radio>
                ))}
              </Radio.Group>
            )}

            {/* 判断 */}
            {q.question_type === 'true_false' && (
              <Radio.Group
                value={answers[q.question_version_id]}
                onChange={(e) => handleAnswer(q.question_version_id, e.target.value)}
                style={{ display: 'flex', gap: 16 }}
              >
                {[['true', '正确'], ['false', '错误']].map(([v, l]) => (
                  <Radio key={v} value={v} style={{ padding: '10px 24px', border: '1px solid #d9d9d9', borderRadius: 6, margin: 0, background: answers[q.question_version_id] === v ? '#e6f4ff' : '#fff' }}>
                    {l}
                  </Radio>
                ))}
              </Radio.Group>
            )}

            {/* 简答/填空 */}
            {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
              <textarea
                rows={5}
                value={(answers[q.question_version_id] as string) || ''}
                onChange={(e) => handleAnswer(q.question_version_id, e.target.value)}
                placeholder="请在此输入答案..."
                style={{ width: '100%', padding: 12, border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, resize: 'vertical', outline: 'none' }}
              />
            )}

            {/* AI判卷 */}
            {q.question_type === 'ai_graded' && (
              <textarea
                rows={5}
                value={(answers[q.question_version_id] as string) || ''}
                onChange={(e) => handleAnswer(q.question_version_id, e.target.value)}
                placeholder="请在此输入答案，AI将根据评分标准进行评分..."
                style={{ width: '100%', padding: 12, border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, resize: 'vertical', outline: 'none' }}
              />
            )}

            {/* 连线题 */}
            {q.question_type === 'matching' && q.options && (
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                  点击左侧项目，再点击右侧项目进行连线
                </div>
                <Row gutter={24}>
                  <Col span={10}>
                    {(q.options.left as string[]).map((item: string, li: number) => {
                      const key = `${q.question_version_id}:${li}`
                      const isSelected = selectedLeft === key
                      const currentAnswer = (answers[q.question_version_id] as Record<string, string>) || {}
                      const pairedRightIdx = currentAnswer[String(li)]
                      const colors = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']
                      return (
                        <div key={li}
                          onClick={() => setSelectedLeft(isSelected ? null : key)}
                          style={{
                            padding: '10px 14px', marginBottom: 8, borderRadius: 6, cursor: 'pointer',
                            border: `2px solid ${isSelected ? colors[li % colors.length] : pairedRightIdx !== undefined ? colors[li % colors.length] : '#d9d9d9'}`,
                            background: isSelected ? `${colors[li % colors.length]}15` : '#fff',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                          <Tag color={pairedRightIdx !== undefined ? colors[li % colors.length] : 'default'}>{li + 1}</Tag>
                          <span>{item}</span>
                        </div>
                      )
                    })}
                  </Col>
                  <Col span={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                    <div style={{ color: '#999', fontSize: 20 }}>→</div>
                  </Col>
                  <Col span={10}>
                    {(shuffledRights[q.question_version_id] || (q.options.right as string[])).map((item: string, si: number) => {
                      const currentAnswer = (answers[q.question_version_id] as Record<string, string>) || {}
                      const actualRightIdx = (q.options!.right as string[]).indexOf(item)
                      const pairedLeftIdx = Object.entries(currentAnswer).find(([, v]) => v === String(actualRightIdx))?.[0]
                      const colors = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']
                      const color = pairedLeftIdx !== undefined ? colors[parseInt(pairedLeftIdx) % colors.length] : null
                      return (
                        <div key={si}
                          onClick={() => {
                            if (!selectedLeft) return
                            const [qvid, leftIdxStr] = selectedLeft.split(':')
                            if (qvid !== q.question_version_id) return
                            const leftIdx = parseInt(leftIdxStr)
                            const actualRight = (q.options!.right as string[]).indexOf(item)
                            const prev = (answers[q.question_version_id] as Record<string, string>) || {}
                            const next = { ...prev, [String(leftIdx)]: String(actualRight) }
                            handleAnswer(q.question_version_id, next)
                            setSelectedLeft(null)
                          }}
                          style={{
                            padding: '10px 14px', marginBottom: 8, borderRadius: 6, cursor: selectedLeft ? 'pointer' : 'default',
                            border: `2px solid ${color || '#d9d9d9'}`,
                            background: color ? `${color}15` : '#fff',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                          {pairedLeftIdx !== undefined && <Tag color={colors[parseInt(pairedLeftIdx) % colors.length]}>{parseInt(pairedLeftIdx) + 1}</Tag>}
                          <span>{item}</span>
                        </div>
                      )
                    })}
                  </Col>
                </Row>
                {Object.keys((answers[q.question_version_id] as Record<string, string>) || {}).length > 0 && (
                  <Button type="link" danger size="small" onClick={() => handleAnswer(q.question_version_id, {})}>
                    清除所有连线
                  </Button>
                )}
              </div>
            )}

            {urgentTime && (
              <Alert message="时间紧张，请抓紧作答！" type="warning" showIcon style={{ marginTop: 16 }} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
