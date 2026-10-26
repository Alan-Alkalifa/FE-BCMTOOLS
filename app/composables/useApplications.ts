/** The application master: Administration > Applications and the SCCA lookups. */

export interface ApplicationCharacteristics {
  criticality_category: string | null
  rto: string | null
  rpo: string | null
  /** Percent, from the application's latest final SCCA. */
  dr_capacity: string | null
  final: { id: number, ref_no: string, finalised_at: string | null } | null
}

export interface Application {
  id: number
  application_code: string
  application_name: string
  category: string | null
  rto_hours: string | null
  rpo: string | null
  description: string | null
  is_active: boolean
  final_assessment: { id: number, ref_no: string, finalised_at: string | null } | null
  in_use: boolean
  characteristics?: ApplicationCharacteristics
  created_by: string | null
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ApplicationInput {
  application_code?: string
  application_name?: string
  category?: string | null
  rto_hours?: string | null
  rpo?: string | null
  description?: string | null
  is_active?: boolean
}

export interface ApplicationQuery {
  q?: string
  active?: '1' | '0'
  category?: string
  exclude?: number
  characteristics?: '1'
  page?: number
  per_page?: number
}

const BASE = '/api/applications'

export const applicationsApi = {
  list: (query: ApplicationQuery) =>
    $fetch<{ items: Application[], page: number, per_page: number, total: number, pages: number }>(BASE, { query }),
  get: (id: number) => $fetch<Application>(`${BASE}/${id}`),
  create: (body: ApplicationInput) => $fetch<Application>(BASE, { method: 'POST', body }),
  update: (id: number, body: ApplicationInput) => $fetch<Application>(`${BASE}/${id}`, { method: 'PATCH', body }),
  remove: (id: number) => $fetch(`${BASE}/${id}`, { method: 'DELETE' }),
}
