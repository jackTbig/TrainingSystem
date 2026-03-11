import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  DashboardOutlined, UserOutlined, TeamOutlined, ApartmentOutlined,
  FileTextOutlined, BulbOutlined, BookOutlined, QuestionCircleOutlined,
  AuditOutlined, SendOutlined, ExperimentOutlined, FileSearchOutlined,
  ThunderboltOutlined, LogoutOutlined, TrophyOutlined,
} from '@ant-design/icons'
import { logout } from '@/store/authSlice'
import { RootState } from '@/store'

const { Header, Sider, Content } = Layout

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
      { key: '/async-jobs', icon: <ThunderboltOutlined />, label: '异步任务' },
      { key: '/audit-logs', icon: <FileSearchOutlined />, label: '审计日志' },
    ],
  },
]

function buildMenu(isAdmin: boolean) {
  return allMenuItems
    .filter((item) => isAdmin || !(item as any).admin)
    .map((item) => {
      if (!('children' in item)) return item
      const children = item.children.filter((c) => isAdmin || !(c as any).admin)
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
  const isAdmin = user?.roles?.includes('admin') ?? false
  const menuItems = buildMenu(isAdmin)

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
          selectedKeys={[location.pathname]}
          defaultOpenKeys={[]}
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
