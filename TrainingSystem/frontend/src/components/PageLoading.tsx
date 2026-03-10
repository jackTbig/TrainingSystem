import { Spin } from 'antd'

export default function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" tip="加载中..." />
    </div>
  )
}
