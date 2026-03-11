import client from './client'

export interface CourseChapter {
  id: string; chapter_no: number; title: string; content: string
  estimated_duration_minutes: number | null; created_at: string
}
export interface CourseVersion {
  id: string; course_id: string; version_no: number; title: string
  summary: string | null; source_type: string; status: string
  published_at: string | null; created_at: string; updated_at: string
  chapters: CourseChapter[]
}
export interface Course {
  id: string; title: string; owner_id: string; status: string
  current_version_id: string | null; created_at: string; updated_at: string
  versions: CourseVersion[]
}
export interface CourseListItem {
  id: string; title: string; owner_id: string; status: string
  current_version_id: string | null; created_at: string
}

export const coursesApi = {
  list: (p: { page?: number; page_size?: number; status?: string; mine?: boolean }) =>
    client.get<{ code: string; data: { items: CourseListItem[]; total: number; page: number; page_size: number } }>('/courses', { params: p }),
  get: (id: string) => client.get<{ code: string; data: Course }>(`/courses/${id}`),
  create: (data: { title: string }) => client.post<{ code: string; data: Course }>('/courses', data),
  update: (id: string, data: { title?: string; status?: string }) => client.put<{ code: string; data: Course }>(`/courses/${id}`, data),
  createVersion: (courseId: string, data: { title: string; summary?: string }) =>
    client.post<{ code: string; data: CourseVersion }>(`/courses/${courseId}/versions`, data),
  getVersion: (versionId: string) => client.get<{ code: string; data: CourseVersion }>(`/courses/versions/${versionId}`),
  updateVersionStatus: (versionId: string, status: string) =>
    client.post<{ code: string; data: CourseVersion }>(`/courses/versions/${versionId}/status`, { status }),
  addChapter: (versionId: string, data: { chapter_no: number; title: string; content: string; estimated_duration_minutes?: number }) =>
    client.post<{ code: string; data: CourseChapter }>(`/courses/versions/${versionId}/chapters`, data),
  updateChapter: (chapterId: string, data: { title?: string; content?: string }) =>
    client.put<{ code: string; data: CourseChapter }>(`/courses/chapters/${chapterId}`, data),
  deleteChapter: (chapterId: string) => client.delete(`/courses/chapters/${chapterId}`),
  delete: (courseId: string) => client.delete(`/courses/${courseId}`),
}
