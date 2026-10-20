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
