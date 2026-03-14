import client from './client'

export interface Candidate {
  id: string
  document_chunk_id: string | null
  candidate_name: string
  candidate_description: string | null
  confidence_score: number | null
  status: string
  source_type: string  // 'document' | 'manual'
  document_id: string | null
  document_title: string | null
  document_file_name: string | null
  created_at: string
}

export interface KnowledgePoint {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  status: string
  weight: number
  node_type: string  // 'category' | 'knowledge_point'
  source_candidate_id: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgePointTree extends KnowledgePoint {
  children: KnowledgePointTree[]
}

export const candidatesApi = {
  list: (params: { page?: number; page_size?: number; status?: string }) =>
    client.get<{ code: string; data: { items: Candidate[]; total: number; page: number; page_size: number } }>(
      '/knowledge-points/candidates', { params }
    ),
  accept: (id: string, data: { name?: string; description?: string; category_id: string }) =>
    client.post<{ code: string; data: KnowledgePoint }>(`/knowledge-points/candidates/${id}/accept`, data),
  ignore: (id: string) =>
    client.post<{ code: string; data: Candidate }>(`/knowledge-points/candidates/${id}/ignore`),
  createManual: (data: { candidate_name: string; candidate_description?: string }) =>
    client.post<{ code: string; data: Candidate }>('/knowledge-points/candidates/manual', data),
  batchAccept: (ids: string[], category_id: string) =>
    client.post('/knowledge-points/candidates/batch-accept', { ids, category_id }),
  batchIgnore: (ids: string[]) =>
    client.post('/knowledge-points/candidates/batch-ignore', { ids }),
}

export const knowledgePointsApi = {
  tree: () =>
    client.get<{ code: string; data: KnowledgePointTree[] }>('/knowledge-points/tree'),
  search: (keyword: string, page = 1, page_size = 20) =>
    client.get<{ code: string; data: { items: KnowledgePoint[]; total: number } }>(
      '/knowledge-points/search', { params: { keyword, page, page_size } }
    ),
  createCategory: (data: { name: string; description?: string; parent_id?: string }) =>
    client.post<{ code: string; data: KnowledgePoint }>('/knowledge-points/categories', data),
  update: (id: string, data: Partial<{ name: string; description: string | null; parent_id: string | null; status: string; weight: number }>) =>
    client.put<{ code: string; data: KnowledgePoint }>(`/knowledge-points/${id}`, data),
  archive: (id: string) =>
    client.post<{ code: string; data: KnowledgePoint }>(`/knowledge-points/${id}/archive`),
  getSource: (id: string) =>
    client.get<{ code: string; data: any }>(`/knowledge-points/${id}/source`),
}
