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
  async (error) => {
    const status = error.response?.status
    // When responseType is 'blob', data is a Blob — parse it to get JSON error
    let data = error.response?.data
    if (data instanceof Blob && data.type?.includes('application/json')) {
      try { data = JSON.parse(await data.text()) } catch { data = {} }
    }
    const code = data?.code
    const msg = data?.message || '请求失败'

    if (status === 401 || code === 'AUTH_TOKEN_EXPIRED') {
      storage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Skip auto-toast for blob requests — the caller handles the message
    if (status !== 422 && error.config?.responseType !== 'blob') {
      message.error(msg)
    }

    return Promise.reject(error)
  }
)

export default client
