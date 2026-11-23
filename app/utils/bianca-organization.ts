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
}
