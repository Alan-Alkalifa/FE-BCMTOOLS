export const organizationEndpoint = '/api/masterdata/organization'

export const organizationLevels = [
  { label: 'Directorate', value: 'directorate' },
  { label: 'Sub Directorate', value: 'sub_directorate' },
  { label: 'Group', value: 'org_group' },
] as const

export type UnitLevel = typeof organizationLevels[number]['value']
export type OrganizationPath = Record<UnitLevel, string>
export interface OrganizationOwner {
  id: number
  name: string
  email: string | null
}
export interface OrganizationRow extends OrganizationPath {
  id: number | null
  level: UnitLevel
  code: string | null
  description: string | null
  owner: OrganizationOwner | null
  source: 'hr' | 'bia'
  is_active: boolean
  available: boolean
  /** Active HR employees at or under this unit. */
  employees?: number
  /** Details moved here by a recorded change that HR does not show yet. */
  waiting_hr?: boolean
  /** HR's people left this unit; its details wait for the change that carries them along. */
  left_hr?: boolean
}

export type OrganizationChangeKind = 'rename' | 'move' | 'new' | 'closed'
export type OrganizationChangeSource = 'manual' | 'hr_import'

interface OrganizationChangePaths {
  id: number
  kind: OrganizationChangeKind
  level: UnitLevel
  previous: OrganizationPath
  current: OrganizationPath
}

export interface OrganizationChange extends OrganizationChangePaths {
  effective_date: string
  reference: string | null
  note: string | null
  source: OrganizationChangeSource
  recorded_by: { id: number, name: string } | null
  recorded_at: string | null
}

export interface OrganizationDetected extends OrganizationChangePaths {
  people_moved: number
  people_total: number
  import_file: string | null
  detected_at: string | null
  status: 'pending' | 'confirmed' | 'dismissed'
}

export const organizationChangeKinds: Record<OrganizationChangeKind, { label: string, color: 'info' | 'warning' | 'success' | 'neutral', icon: string }> = {
  rename: { label: 'Renamed', color: 'info', icon: 'i-lucide-pencil-line' },
  move: { label: 'Moved', color: 'warning', icon: 'i-lucide-move-right' },
  new: { label: 'New', color: 'success', icon: 'i-lucide-plus' },
  closed: { label: 'Closed', color: 'neutral', icon: 'i-lucide-circle-minus' },
}

export const organizationChangeSources: Record<OrganizationChangeSource, string> = {
  manual: 'Manual',
  hr_import: 'HR import',
}

/** "Bank › Ops › Net", or an em dash for no unit. */
export function organizationPathLabel(path: Partial<OrganizationPath> | null | undefined) {
  const parts = [path?.directorate, path?.sub_directorate, path?.org_group].filter(Boolean)
  return parts.length ? parts.join(' › ') : '—'
}

/** The change's type, as the server derives it, for the form's preview. */
export function organizationChangeKind(previous: OrganizationPath, current: OrganizationPath): OrganizationChangeKind | null {
  const depth = (path: OrganizationPath) => (!path.directorate.trim() ? 0 : path.org_group.trim() ? 3 : path.sub_directorate.trim() ? 2 : 1)
  const a = depth(previous)
  const b = depth(current)
  if (!a && !b) return null
  if (!a) return 'new'
  if (!b) return 'closed'
  if (a !== b) return null
  const key = (path: OrganizationPath, size: number) => [path.directorate, path.sub_directorate, path.org_group].slice(0, size).map((part) => part.trim().toLowerCase()).join('\u0000')
  if (key(previous, a) === key(current, a)) return null
  return key(previous, a - 1) === key(current, a - 1) ? 'rename' : 'move'
}

export function emptyOrganizationPath(): OrganizationPath {
  return { directorate: '', sub_directorate: '', org_group: '' }
}
