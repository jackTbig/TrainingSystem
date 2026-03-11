import { useEffect, useState } from 'react'
import { Button, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text } = Typography

interface AttemptRow {
  id: string
  exam_id: string
  exam_title: string
  user_id: string
  username: string
  real_name: string
  total_score: number | null
  pass_result: boolean | null
  submitted_at: string | null
}

interface ExamOption { id: string; title: string }

export default function ScoresPage() {
  const [rows, setRows] = useState<AttemptRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [examOptions, setExamOptions] = useState<ExamOption[]>([])
  const [filterExam, setFilterExam] = useState<string | undefined>()
  const [filterPass, setFilterPass] = useState<boolean | undefined>()

  useEffect(() => {
    client.get('/exams', { params: { page: 1, page_size: 200 } }).then(res => {
      setExamOptions(res.data.data.items.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title })))
    })
  }, [])

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, page_size: 20 }
      if (filterExam) params.exam_id = filterExam
      if (filterPass !== undefined) params.pass_result = filterPass
      const res = await client.get('/exams/all-attempts', { params })
      setRows(res.data.data.items)
      setTotal(res.data.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1); setPage(1) }, [filterExam, filterPass])
  useEffect(() => { fetchData() }, [page])

  const columns = [
    {
      title: '考试名称', dataIndex: 'exam_title', ellipsis: true,
    },
    {
      title: '姓名', dataIndex: 'real_name', width: 120,
      render: (v: string, row: AttemptRow) => `${v || ''}（${row.username}）`,
    },
    {
      title: '成绩', dataIndex: 'total_score', width: 100,
      render: (v: number | null, row: AttemptRow) => (
        v == null ? '—' : (
          <Text strong style={{ color: row.pass_result ? '#52c41a' : '#ff4d4f' }}>{v} 分</Text>
        )
      ),
    },
    {
      title: '结果', dataIndex: 'pass_result', width: 90,
      render: (v: boolean | null) =>
        v == null ? '—' : <Tag color={v ? 'success' : 'error'}>{v ? '通过' : '未通过'}</Tag>,
    },
    {
      title: '提交时间', dataIndex: 'submitted_at', width: 160,
      render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '—',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>成绩查询</Title>
        <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="筛选考试"
          allowClear
          style={{ width: 240 }}
          value={filterExam}
          onChange={setFilterExam}
          options={examOptions.map(e => ({ value: e.id, label: e.title }))}
          showSearch
          filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
        />
        <Select
          placeholder="筛选结果"
          allowClear
          style={{ width: 120 }}
          value={filterPass}
          onChange={setFilterPass}
          options={[
            { value: true, label: '通过' },
            { value: false, label: '未通过' },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`,
        }}
        size="small"
      />
    </div>
  )
}
