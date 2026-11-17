/** Master MTD (Administration › Master data): the MTD choices of BIANCA. */
export interface MasterMtd {
  id: number
  code: string
  name: string
  category: 'Business Critical' | 'Important' | 'Others' | null
  hours: number | null
  for_it: boolean
  for_non_it: boolean
  description: string | null
  sort_order: number
  is_active: boolean
  updated_at: string | null
  updated_by: string | null
}

export type MasterMtdInput = Omit<MasterMtd, 'id' | 'updated_at' | 'updated_by' | 'code'> & { code: string | null }

const BASE = '/api/masterdata/mtds'

export function useMasterMtds(query: MaybeRefOrGetter<{ q?: string, active?: string }>) {
  return useFetch<{ items: MasterMtd[] }>(BASE, { query, key: 'masterdata-mtds' })
}

export const masterMtdApi = {
  create: (body: MasterMtdInput) => $fetch<MasterMtd>(BASE, { method: 'POST', body }),
  update: (id: number, body: MasterMtdInput) => $fetch<MasterMtd>(`${BASE}/${id}`, { method: 'PUT', body }),
}

/** The body of a choice, to send it back with one change. */
export function masterMtdInput(row: MasterMtd): MasterMtdInput {
  const { id: _id, updated_at: _at, updated_by: _by, ...rest } = row
  return rest
}
