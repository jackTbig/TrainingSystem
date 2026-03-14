import { useEffect, useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  DashboardOutlined, UserOutlined, TeamOutlined, ApartmentOutlined,
  FileTextOutlined, BulbOutlined, BookOutlined, QuestionCircleOutlined,
  AuditOutlined, SendOutlined, ExperimentOutlined, FileSearchOutlined,
  ThunderboltOutlined, LogoutOutlined, TrophyOutlined,
} from '@ant-design/icons'
import { logout, setCredentials } from '@/store/authSlice'
import { RootState } from '@/store'
import client from '@/api/client'
import { storage } from '@/utils/storage'

const { Header, Sider, Content } = Layout

function getAllLeaves(items: any[]): { key: string; parentKey?: string }[] {
  const result: { key: string; parentKey?: string }[] = []
  for (const item of items) {
    if (item.children?.length) {
      for (const c of item.children) result.push({ key: c.key, parentKey: item.key })
    } else {
      result.push({ key: item.key })
    }
  }
  return result
}

function resolveSelectedKey(path: string, items: any[]): string {
  const leaves = getAllLeaves(items)
  const matches = leaves.filter(l => path === l.key || path.startsWith(l.key + '/'))
  if (!matches.length) return path
  return matches.sort((a, b) => b.key.length - a.key.length)[0].key
}

function resolveParentKeys(selectedKey: string, items: any[]): string[] {
  const leaves = getAllLeaves(items)
  const leaf = leaves.find(l => l.key === selectedKey)
  return leaf?.parentKey ? [leaf.parentKey] : []
}

// admin: true means only visible to users with 'admin' role
const allMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '首页' },
  {
    key: 'system', icon: <UserOutlined />, label: '系统管理', admin: true,
    children: [
      { key: '/system/users', icon: <UserOutlined />, label: '用户管理' },
      { key: '/system/roles', icon: <TeamOutlined />, label: '角色权限' },
      { key: '/system/departments', icon: <ApartmentOutlined />, label: '部门管理' },
    ],
  },
  {
    key: 'knowledge', icon: <FileTextOutlined />, label: '知识库', admin: true,
    children: [
      { key: '/documents', icon: <FileTextOutlined />, label: '文档管理' },
      { key: '/knowledge-points/candidates', icon: <BulbOutlined />, label: '候选知识点' },
      { key: '/knowledge-points', icon: <BulbOutlined />, label: '知识点管理' },
    ],
  },
  {
    key: 'content', icon: <BookOutlined />, label: '内容生产', admin: true,
    children: [
      { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
      { key: '/questions', icon: <QuestionCircleOutlined />, label: '题库管理' },
      { key: '/reviews', icon: <AuditOutlined />, label: '审核管理' },
      { key: '/publish-records', icon: <SendOutlined />, label: '发布记录' },
    ],
  },
  {
    key: 'training', icon: <ExperimentOutlined />, label: '培训考试',
    children: [
      { key: '/training-tasks', icon: <ExperimentOutlined />, label: '培训任务（管理）', admin: true },
      { key: '/exams', icon: <FileSearchOutlined />, label: '考试管理', admin: true },
      { key: '/my-training', icon: <BookOutlined />, label: '我的培训' },
      { key: '/my-exams', icon: <TrophyOutlined />, label: '我的考试' },
      { key: '/statistics', icon: <DashboardOutlined />, label: '培训统计', admin: true },
      { key: '/scores', icon: <TrophyOutlined />, label: '成绩查询', admin: true },
    ],
  },
  {
    key: 'system2', icon: <ThunderboltOutlined />, label: '系统审计', admin: true,
    children: [
      { key: '/async-jobs', icon: <ThunderboltOutlined />, label: '后台任务' },
      { key: '/audit-logs', icon: <FileSearchOutlined />, label: '审计日志' },
    ],
  },
]

function buildMenu(isAdmin: boolean) {
  return allMenuItems
    .filter((item) => isAdmin || !(item as any).admin)
    .map((item) => {
      if (!('children' in item)) return item
      const children = (item.children ?? []).filter((c) => isAdmin || !(c as any).admin)
      return { ...item, children }
    })
    .filter((item) => !('children' in item) || (item as any).children.length > 0)
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const user = useSelector((state: RootState) => state.auth.user)
  const [openKeys, setOpenKeys] = useState<string[]>([])

  // Re-fetch fresh user info on mount so roles are always current
  useEffect(() => {
    const token = storage.getToken()
    if (!token) return
    client.get('/auth/me').then((res) => {
      const me = res.data.data
      dispatch(setCredentials({
        token,
        user: {
          id: me.id,
          username: me.username,
          real_name: me.real_name,
          roles: (me.roles as { code: string }[]).map((r) => r.code),
          permissions: [],
        },
      }))
    }).catch(() => {})
  }, [])

  // Support both string[] and object[] (guards against stale localStorage format)
  const isAdmin = user?.roles?.some((r: any) =>
    typeof r === 'string' ? r === 'admin' : r?.code === 'admin'
  ) ?? false
  const menuItems = buildMenu(isAdmin)

  const selectedKey = resolveSelectedKey(location.pathname, menuItems)

  useEffect(() => {
    const parents = resolveParentKeys(selectedKey, menuItems)
    setOpenKeys(prev => [...new Set([...prev, ...parents])])
  }, [selectedKey])

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const userMenu = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') handleLogout()
    },
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 12 : 14, fontWeight: 'bold' }}>
          {collapsed ? '培训' : '培训考试系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <Dropdown menu={userMenu}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <Typography.Text>{user?.real_name}</Typography.Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
