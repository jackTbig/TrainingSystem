import axios from 'axios'
import { message } from 'antd'
import { storage } from '@/utils/storage'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截：附加 token
client.interceptors.request.use((config) => {
  const token = storage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一错误处理
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    const msg = error.response?.data?.message || '请求失败'

    if (status === 401 || code === 'AUTH_TOKEN_EXPIRED') {
      storage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status !== 422) {
      message.error(msg)
    }

    return Promise.reject(error)
  }
)

export default client
