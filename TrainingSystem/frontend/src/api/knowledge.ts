import client from './client'

export interface Candidate {
  id: string
  document_chunk_id: string | null
  candidate_name: string
  candidate_description: string | null
  confidence_score: number | null
  status: string
  created_at: string
}

export interface KnowledgePoint {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  status: string
  weight: number
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
  accept: (id: string, data: { name?: string; description?: string; parent_id?: string; weight?: number }) =>
    client.post<{ code: string; data: KnowledgePoint }>(`/knowledge-points/candidates/${id}/accept`, data),
  ignore: (id: string) =>
    client.post<{ code: string; data: Candidate }>(`/knowledge-points/candidates/${id}/ignore`),
  merge: (id: string, target_knowledge_point_id: string) =>
    client.post<{ code: string; data: KnowledgePoint }>(`/knowledge-points/candidates/${id}/merge`, { target_knowledge_point_id }),
}

export const knowledgePointsApi = {
  tree: () =>
    client.get<{ code: string; data: KnowledgePointTree[] }>('/knowledge-points/tree'),
  search: (keyword: string, page = 1, page_size = 20) =>
    client.get<{ code: string; data: { items: KnowledgePoint[]; total: number } }>(
      '/knowledge-points/search', { params: { keyword, page, page_size } }
    ),
  create: (data: { name: string; description?: string; parent_id?: string; weight?: number }) =>
    client.post<{ code: string; data: KnowledgePoint }>('/knowledge-points', data),
  update: (id: string, data: Partial<{ name: string; description: string; parent_id: string; status: string; weight: number }>) =>
    client.put<{ code: string; data: KnowledgePoint }>(`/knowledge-points/${id}`, data),
  archive: (id: string) =>
    client.post<{ code: string; data: KnowledgePoint }>(`/knowledge-points/${id}/archive`),
}
