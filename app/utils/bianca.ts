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

/** The report of a BIA's business function (1-based number). */
export function biancaReportPath(id: number, fn?: number) {
  return fn ? `/bianca/report/${id}?fn=${fn}` : `/bianca/report/${id}`
}

/** The BIA written into the BIA workbook: all its functions, or those numbered (1-based). */
export function biancaExportUrl(id: number, functions?: number[]) {
  return functions?.length
    ? `/api/bianca/assessments/${id}/export?functions=${functions.join(',')}`
    : `/api/bianca/assessments/${id}/export`
}

/** Plain IDR with thousands separators (the cumulative loss cells). */
export function formatIdr(value: number | null | undefined) {
  return value == null ? '—' : new Intl.NumberFormat('id-ID').format(value)
}

/** An amount in IDR as people say it: 500000 → "IDR 500 RB", 5000000 → "IDR 5 JT", 1500000000 → "IDR 1,5 M". */
export function idrShort(value: number | string | null | undefined) {
  const amount = Number(value)
  if (value == null || value === '' || !Number.isFinite(amount)) return ''
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'M'], [1e6, 'JT'], [1e3, 'RB']]
  const [size, unit] = units.find(([size]) => Math.abs(amount) >= size) ?? [1, '']
  const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(amount / size)
  return `IDR ${number}${unit ? ` ${unit}` : ''}`
}
