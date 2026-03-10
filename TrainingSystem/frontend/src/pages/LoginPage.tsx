import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import { setCredentials } from '@/store/authSlice'
import client from '@/api/client'

const { Title } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const loginRes = await client.post('/auth/login', values)
      const { access_token } = loginRes.data.data

      // 用新 token 立即取用户信息
      const meRes = await client.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      const me = meRes.data.data
      const user = {
        id: me.id,
        username: me.username,
        real_name: me.real_name,
        roles: (me.roles as { code: string }[]).map((r) => r.code),
        permissions: [] as string[],
      }

      dispatch(setCredentials({ token: access_token, user }))
      message.success('登录成功')
      navigate('/dashboard')
    } catch {
      // 错误已由 client 拦截器处理
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>内部培训考试系统</Title>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
