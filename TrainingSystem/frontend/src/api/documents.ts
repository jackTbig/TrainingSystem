import client from './client'

export interface DocumentVersion {
  id: string
  version_no: number
  file_name: string
  file_size: number
  mime_type: string | null
  created_at: string
}

export interface Document {
  id: string
  title: string
  owner_id: string
  source_type: string
  status: string
  current_version_id: string | null
  created_at: string
  updated_at: string
  versions: DocumentVersion[]
}

export interface DocumentListItem {
  id: string
  title: string
  owner_id: string
  status: string
  current_version_id: string | null
  created_at: string
}

export const documentsApi = {
  list: (params: { page?: number; page_size?: number; status?: string; mine?: boolean }) =>
    client.get<{ code: string; data: { items: DocumentListItem[]; total: number; page: number; page_size: number } }>('/documents', { params }),

  get: (id: string) =>
    client.get<{ code: string; data: Document }>(`/documents/${id}`),

  upload: (formData: FormData) =>
    client.post<{ code: string; data: Document }>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: string, data: { title?: string; status?: string }) =>
    client.put<{ code: string; data: Document }>(`/documents/${id}`, data),

  archive: (id: string) =>
    client.post<{ code: string; data: Document }>(`/documents/${id}/archive`),

  reparse: (id: string) =>
    client.post<{ code: string; data: { task_id: string } }>(`/documents/${id}/reparse`),

  delete: (id: string) =>
    client.delete<{ code: string; message: string }>(`/documents/${id}`),
}
