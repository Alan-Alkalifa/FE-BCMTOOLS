import type { UserRole } from '~/composables/useAuth'

export interface Profile {
  id: number
  username: string
  display_name: string | null
  given_name: string | null
  surname: string | null
  email: string | null
  job_title: string | null
  department: string | null
  company_name: string | null
  office_location: string | null
  employee_id: string | null
  mobile_phone: string | null
  business_phones: string[]
  preferred_language: string | null
  /** HR organization (the HR employee file now, LDAP later). */
  directorate: string | null
  sub_directorate: string | null
  org_group: string | null
  division: string | null
  org_level: string | null
  city: string | null
  province: string | null
  /** Direct supervisor (DS) as HR gives it, and their account when a user has the DS NIP. */
  supervisor_nip: string | null
  supervisor_name: string | null
  supervisor_email: string | null
  supervisor: { id: number, name: string, email: string | null } | null
  auth_provider: 'local' | 'ldap'
  roles: UserRole[]
  permissions: string[]
  has_photo: boolean
  password_changed_at: string | null
  last_login_at: string | null
}

export const PROFILE_PHOTO_URL = '/api/me/photo'

export function useProfile() {
  return useFetch<Profile>('/api/me/profile', { key: 'profile' })
}
