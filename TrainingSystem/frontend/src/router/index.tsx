import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import DocumentsPage from '@/pages/DocumentsPage'
import KnowledgeCandidatesPage from '@/pages/KnowledgeCandidatesPage'
import KnowledgePointsPage from '@/pages/KnowledgePointsPage'
import CoursesPage from '@/pages/CoursesPage'
import CourseDetailPage from '@/pages/CourseDetailPage'
import CourseStudyPage from '@/pages/CourseStudyPage'
import QuestionsPage from '@/pages/QuestionsPage'
import ExamsPage from '@/pages/ExamsPage'
import TrainingTasksPage from '@/pages/TrainingTasksPage'
import ReviewsPage from '@/pages/ReviewsPage'
import MyExamsPage from '@/pages/MyExamsPage'
import MyTrainingPage from '@/pages/MyTrainingPage'
import ExamTakingPage from '@/pages/ExamTakingPage'
import ExamResultPage from '@/pages/ExamResultPage'
import UsersPage from '@/pages/UsersPage'
import RolesPage from '@/pages/RolesPage'
import DepartmentsPage from '@/pages/DepartmentsPage'
import PublishRecordsPage from '@/pages/PublishRecordsPage'
import AsyncJobsPage from '@/pages/AsyncJobsPage'
import AuditLogsPage from '@/pages/AuditLogsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ForbiddenPage from '@/pages/ForbiddenPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <RedirectIfAuth><LoginPage /></RedirectIfAuth>,
  },
  // 考试答题页：全屏，不用 MainLayout
  {
    path: '/exam/:examId/take/:attemptId',
    element: <RequireAuth><ExamTakingPage /></RequireAuth>,
  },
  // 课程学习页：全屏
  {
    path: '/study/:versionId',
    element: <RequireAuth><CourseStudyPage /></RequireAuth>,
  },
  {
    path: '/',
    element: <RequireAuth><MainLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'system/users', element: <UsersPage /> },
      { path: 'system/roles', element: <RolesPage /> },
      { path: 'system/departments', element: <DepartmentsPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'knowledge-points/candidates', element: <KnowledgeCandidatesPage /> },
      { path: 'knowledge-points', element: <KnowledgePointsPage /> },
      { path: 'courses', element: <CoursesPage /> },
      { path: 'courses/:courseId', element: <CourseDetailPage /> },
      { path: 'questions', element: <QuestionsPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'publish-records', element: <PublishRecordsPage /> },
      { path: 'training-tasks', element: <TrainingTasksPage /> },
      { path: 'exams', element: <ExamsPage /> },
      { path: 'my-exams', element: <MyExamsPage /> },
      { path: 'my-training', element: <MyTrainingPage /> },
      { path: 'exam/:attemptId/result', element: <ExamResultPage /> },
      { path: 'async-jobs', element: <AsyncJobsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: '403', element: <ForbiddenPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
