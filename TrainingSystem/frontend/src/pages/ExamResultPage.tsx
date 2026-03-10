import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, Collapse, Descriptions, Result, Row, Space, Tag, Typography,
} from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, HomeOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Text, Paragraph } = Typography

interface AnswerItem {
  question_version_id: string
  question_type: string
  stem: string
  options: Record<string, string> | null
  answer_json: { value: unknown }
  correct_answer: { value: unknown }
  analysis: string | null
  score: number | null
}

interface AttemptResult {
  id: string
  exam_id: string
  status: string
  started_at: string
  submitted_at: string | null
  total_score: number | null
  pass_result: boolean | null
  answers: AnswerItem[]
}

const TYPE_LABEL: Record<string, string> = {
  single_choice: '单选', multi_choice: '多选', true_false: '判断',
  fill_blank: '填空', short_answer: '简答',
}

function formatAnswer(type: string, value: unknown, options: Record<string, string> | null): string {
  if (value === null || value === undefined) return '未作答'
  if (type === 'true_false') return value === true || value === 'true' ? '正确' : '错误'
  if ((type === 'single_choice' || type === 'multi_choice') && options) {
    const keys = String(value).split(',')
    return keys.map((k) => `${k.trim()}. ${options[k.trim()] ?? ''}`).join(' | ')
  }
  return String(value)
}

export default function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attemptId) return
    client.get(`/exams/attempts/${attemptId}`)
      .then((res) => setResult(res.data.data))
      .finally(() => setLoading(false))
  }, [attemptId])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}>加载中...</div>
  if (!result) return <div style={{ textAlign: 'center', padding: 80 }}>记录不存在</div>

  const passed = result.pass_result === true
  const score = result.total_score ?? 0
  const duration = result.submitted_at
    ? Math.round((new Date(result.submitted_at).getTime() - new Date(result.started_at).getTime()) / 60000)
    : null

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      {/* 结果摘要 */}
      <Result
        icon={passed
          ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
          : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
        status={passed ? 'success' : 'error'}
        title={passed ? `恭喜，考试通过！得分 ${score} 分` : `很遗憾，未通过。得分 ${score} 分`}
        subTitle={
          <Space direction="vertical" size={4}>
            {duration !== null && <Text type="secondary">用时 {duration} 分钟</Text>}
            <Text type="secondary">提交时间：{result.submitted_at ? new Date(result.submitted_at).toLocaleString('zh-CN') : '—'}</Text>
          </Space>
        }
        extra={[
          <Button key="home" icon={<HomeOutlined />} onClick={() => navigate('/my-exams')}>返回我的考试</Button>,
        ]}
        style={{ background: '#fff', borderRadius: 8, padding: '32px 0 16px' }}
      />

      {/* 答题统计 */}
      <Card style={{ marginTop: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="作答题数">{result.answers.length} 题</Descriptions.Item>
          <Descriptions.Item label="客观题得分">
            {result.answers.filter((a) => a.score !== null && a.score > 0).reduce((s, a) => s + (a.score ?? 0), 0)} 分
          </Descriptions.Item>
          <Descriptions.Item label="正确率">
            {result.answers.length > 0
              ? `${Math.round(result.answers.filter((a) => a.score && a.score > 0).length / result.answers.length * 100)}%`
              : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 逐题解析 */}
      <Card title="答题解析" style={{ marginTop: 16 }}>
        <Collapse
          items={result.answers.map((ans, idx) => {
            const correct = ans.score !== null && ans.score > 0
            const isSubjective = ['fill_blank', 'short_answer'].includes(ans.question_type)
            return {
              key: ans.question_version_id,
              label: (
                <Row align="middle" gutter={8}>
                  <Col><Text strong>第 {idx + 1} 题</Text></Col>
                  <Col><Tag color="blue">{TYPE_LABEL[ans.question_type]}</Tag></Col>
                  <Col>
                    {isSubjective
                      ? <Tag color="default">主观题</Tag>
                      : correct
                        ? <Tag color="success">正确 +{ans.score}</Tag>
                        : <Tag color="error">错误 +0</Tag>}
                  </Col>
                  <Col flex="auto"><Text ellipsis>{ans.stem}</Text></Col>
                </Row>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Paragraph style={{ marginBottom: 8 }}><Text strong>题目：</Text>{ans.stem}</Paragraph>

                  {ans.options && (
                    <div>
                      <Text strong>选项：</Text>
                      {Object.entries(ans.options).map(([k, v]) => (
                        <div key={k} style={{ paddingLeft: 16 }}>{k}. {v}</div>
                      ))}
                    </div>
                  )}

                  <div>
                    <Text strong>你的答案：</Text>
                    <Text type={isSubjective ? 'secondary' : correct ? 'success' : 'danger'}>
                      {formatAnswer(ans.question_type, ans.answer_json?.value, ans.options)}
                    </Text>
                  </div>

                  {!isSubjective && (
                    <div>
                      <Text strong>正确答案：</Text>
                      <Text type="success">
                        {formatAnswer(ans.question_type, ans.correct_answer?.value, ans.options)}
                      </Text>
                    </div>
                  )}

                  {ans.analysis && (
                    <div style={{ background: '#fffbe6', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #faad14' }}>
                      <Text strong>解析：</Text>
                      <Text>{ans.analysis}</Text>
                    </div>
                  )}
                </Space>
              ),
            }
          })}
        />
      </Card>
    </div>
  )
}
