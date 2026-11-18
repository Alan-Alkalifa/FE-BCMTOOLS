import { defineStatusScale } from '~/utils/status'

/** BIA statuses, as the backend names them (the same as SCCA). */
export type BiancaStatus = 'draft' | 'in_approval' | 'final'
export type BiancaStatusKey = BiancaStatus | 'in_revision'

export const biancaStatus = defineStatusScale<BiancaStatusKey>({
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  in_revision: { label: 'In revision', color: 'error', icon: 'i-lucide-undo-2' },
  in_approval: { label: 'In approval', color: 'warning', icon: 'i-lucide-hourglass' },
  final: { label: 'Final', color: 'success', icon: 'i-lucide-badge-check' },
})

export function biancaStatusKey(item: { status: BiancaStatus, in_revision?: boolean | null } | null | undefined): BiancaStatusKey | undefined {
  if (!item) return undefined
  return item.status === 'draft' && item.in_revision ? 'in_revision' : item.status
}

export const BIANCA_CATEGORY = defineStatusScale<'Business Critical' | 'Important' | 'Others'>({
  'Business Critical': { label: 'Business Critical', color: 'error', icon: 'i-lucide-flame' },
  'Important': { label: 'Important', color: 'warning', icon: 'i-lucide-triangle-alert' },
  'Others': { label: 'Others', color: 'neutral', icon: 'i-lucide-circle' },
})

export const BIANCA_INPUT_METHOD = { web: 'Web form', excel: 'Excel upload' } as const

export function biancaPath(id?: number | 'new') {
  return id === undefined ? '/bianca/manage' : `/bianca/manage/${id}`
}

/** Plain IDR with thousands separators (the cumulative loss cells). */
export function formatIdr(value: number | null | undefined) {
  return value == null ? '—' : new Intl.NumberFormat('id-ID').format(value)
}
