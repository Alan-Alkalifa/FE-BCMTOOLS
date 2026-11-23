export type BcmOperationalRole = 'bcm_head' | 'bcm_admin' | 'bcm_coordinator'

export const bcmRoleTabs: { label: string, value: BcmOperationalRole }[] = [
  { label: 'BCM Head', value: 'bcm_head' },
  { label: 'BCM Admin', value: 'bcm_admin' },
  { label: 'BCM Coordinator', value: 'bcm_coordinator' },
]

export const bcmSignerEndpoint = (role?: BcmOperationalRole | null) =>
  role ? `/api/bianca/bcm-roles/${role}/candidates` : '/api/users'

export const bcmRoleLabel = (role: BcmOperationalRole) => bcmRoleTabs.find((item) => item.value === role)!.label

export interface BcmAssignment {
  id: number
  role: BcmOperationalRole
  is_active: boolean
  description: string | null
  user: {
    id: number
    display_name: string | null
    username: string
    employee_id: string | null
    email: string | null
    department: string | null
    job_title: string | null
    is_active: boolean
  }
}
