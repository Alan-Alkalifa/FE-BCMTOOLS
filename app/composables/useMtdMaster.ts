import type { BiancaMtdOption } from './useBiancaConfigAdmin'

/** Master data › Master MTD: Suggested MTD (Part 1) and Expected / dependency MTD (Part 2). */
export interface MtdSuggested {
  value: string
  label: string
  description: string | null
  active: boolean
}

export interface MtdMaster {
  suggested: MtdSuggested[]
  options: BiancaMtdOption[]
  /** The BIA configuration versions that hold a copy of the master. */
  active_version: string | null
  draft_version: string | null
  /** Suggested MTD the Suggested MTD rule uses -> the version whose rule uses it. */
  rule_users: Record<string, string>
  hours_per_day: number
  days_per_week: number
}

const MTD_MASTER = '/api/masterdata/mtd'
export const mtdMasterApi = {
  saveSuggested: (items: MtdSuggested[]) => $fetch<MtdMaster>(`${MTD_MASTER}/suggested`, { method: 'PUT', body: { items } }),
  saveOptions: (items: BiancaMtdOption[]) => $fetch<MtdMaster>(`${MTD_MASTER}/options`, { method: 'PUT', body: { items } }),
}

/** Hours of an MTD duration ('4 hours', '1 day', '2 weeks'), as the BIA compares them. */
export function mtdHours(value: string, hoursPerDay: number, daysPerWeek: number): number | null {
  const duration = /^(\d+(?:\.\d+)?) (hour|day|week)s?$/.exec(value.trim())
  if (!duration) return null
  const unit = duration[2] === 'week' ? hoursPerDay * daysPerWeek : duration[2] === 'day' ? hoursPerDay : 1
  return Number(duration[1]) * unit
}
