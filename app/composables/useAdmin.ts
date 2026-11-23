import type { SealPurpose } from '~/utils/seal'

/** Administration API: users, roles and permissions, menus, email settings, audit log. */

export interface AdminRoleRef {
  id: number
  code: string
  name: string
}

export interface AdminUser {
  id: number
  username: string
  email: string | null
  display_name: string | null
  given_name: string | null
  surname: string | null
  job_title: string | null
  department: string | null
  company_name: string | null
  office_location: string | null
  /** NIP (unique). */
  employee_id: string | null
  mobile_phone: string | null
  preferred_language: string | null
  directorate: string | null
  sub_directorate: string | null
  org_group: string | null
  division: string | null
  /** Organization level, e.g. D-1, D-2, D-4. */
  org_level: string | null
  city: string | null
  province: string | null
  supervisor_nip: string | null
  supervisor_name: string | null
  supervisor_email: string | null
  /** The direct supervisor's account, linked by NIP. */
  supervisor: { id: number, name: string } | null
  auth_provider: 'local' | 'ldap'
  is_active: boolean
  is_locked: boolean
  has_password: boolean
  must_change_password: boolean
  roles: AdminRoleRef[]
  last_login_at: string | null
  created_at: string | null
}

export interface AdminUserInput {
  email?: string
  display_name?: string
  job_title?: string | null
  department?: string | null
  company_name?: string | null
  office_location?: string | null
  employee_id?: string | null
  mobile_phone?: string | null
  directorate?: string | null
  sub_directorate?: string | null
  org_group?: string | null
  division?: string | null
  org_level?: string | null
  city?: string | null
  province?: string | null
  supervisor_nip?: string | null
  supervisor_name?: string | null
  supervisor_email?: string | null
  is_active?: boolean
  role_ids?: number[]
  password?: string | null
}

export interface AdminPermission {
  code: string
  module: string
  description: string
}

export interface AdminRole {
  id: number
  code: string
  name: string
  description: string | null
  is_system: boolean
  permissions: string[]
  user_count: number
}

export interface AdminMenu {
  id: number
  code: string
  label: string
  icon: string | null
  route: string | null
  parent_id: number | null
  sort_order: number
  permission: string | null
  is_active: boolean
}

export type AdminMenuInput = Omit<AdminMenu, 'id' | 'code'> & { code?: string }

export type SmtpKind = 'gmail' | 'resend' | 'custom'
export type SmtpSecurity = 'starttls' | 'ssl' | 'none'

export interface SmtpProvider {
  id: number
  name: string
  kind: SmtpKind
  host: string
  port: number
  security: SmtpSecurity
  username: string
  from_address: string
  from_name: string
  is_active: boolean
  password_set: boolean
  created_at: string | null
  updated_at: string | null
  updated_by: string | null
}

export type SmtpProviderInput = Pick<SmtpProvider, 'name' | 'kind' | 'host' | 'port' | 'security' | 'username' | 'from_address' | 'from_name'> & {
  /** Left out: keep the stored one. */
  password?: string
}

export interface SmtpProviderList {
  items: SmtpProvider[]
  active_id: number | null
}

export interface SmtpTestResult {
  to: string
  provider: string
  sent: boolean
  error: string | null
}

interface SmtpPreset {
  label: string
  icon: string
  host: string
  port: number
  security: SmtpSecurity
  username: string
  usernameHelp: string
  passwordLabel: string
  /** The button on a provider card whose password or key is missing. */
  addPasswordLabel: string
  passwordHelp: string
  fromHelp: string
}

/** Defaults and field help for each kind of SMTP provider. */
export const SMTP_PRESETS: Record<SmtpKind, SmtpPreset> = {
  gmail: {
    label: 'Gmail',
    icon: 'i-lucide-mail',
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls',
    username: '',
    usernameHelp: 'The Gmail address that sends the emails.',
    passwordLabel: 'App password',
    addPasswordLabel: 'Add app password',
    passwordHelp: 'Google Account > Security > App passwords (needs 2-Step Verification). Not your Gmail password.',
    fromHelp: 'Usually the same Gmail address.',
  },
  resend: {
    label: 'Resend',
    icon: 'i-lucide-send',
    host: 'smtp.resend.com',
    port: 465,
    security: 'ssl',
    username: 'resend',
    usernameHelp: 'Always "resend".',
    passwordLabel: 'API key',
    addPasswordLabel: 'Add API key',
    passwordHelp: 'A Resend API key with Sending access (starts with re_). Create one at resend.com > API Keys.',
    fromHelp: 'An address on a domain verified in Resend, e.g. noreply@bemlanja.com.',
  },
  custom: {
    label: 'Other SMTP server',
    icon: 'i-lucide-server',
    host: '',
    port: 587,
    security: 'starttls',
    username: '',
    usernameHelp: 'Leave empty if the server needs no sign-in.',
    passwordLabel: 'Password',
    addPasswordLabel: 'Add password',
    passwordHelp: 'The SMTP password for this username.',
    fromHelp: 'An address the server is allowed to send from.',
  },
}

export const SMTP_SECURITY_ITEMS = [
  { label: 'SSL/TLS (port 465)', value: 'ssl' as const },
  { label: 'STARTTLS (port 587)', value: 'starttls' as const },
  { label: 'None (internal relay only)', value: 'none' as const },
]

export interface AuditEvent {
  id: number
  event: string
  username: string | null
  actor: string | null
  target_type: string | null
  target_id: number | null
  detail: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export interface OutboxEmail {
  id: number
  to: string[]
  subject: string
  status: 'queued' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
  /** The SMTP provider of the last attempt. */
  provider: string | null
  related_type: string | null
  related_id: number | null
  created_at: string
  sent_at: string | null
}

export interface Page<T> {
  items: T[]
  page: number
  per_page: number
  total: number
  pages: number
}

const BASE = '/api/admin'

/** Sends `body` with its `password` sealed (utils/seal.ts) when it carries one. */
function withSealedPassword<T>(url: string, method: 'POST' | 'PUT', purpose: SealPurpose, body: { password?: string | null }) {
  const { password, ...rest } = body
  if (!password) return $fetch<T>(url, { method, body: password === '' ? { ...rest, password } : rest })
  return sealedFetch<T>(url, purpose, { password }, { method, body: rest })
}

/** Administration > Users > Import from HR file: what happened (or would happen) row by row. */
export interface HrImportResult {
  dry_run: boolean
  counts: Record<'create' | 'update' | 'unchanged' | 'skip' | 'error', number>
  rows: {
    line: number
    nip: string | null
    name: string | null
    email: string | null
    action: 'create' | 'update' | 'unchanged' | 'skip' | 'error'
    remark: string
    user_id: number | null
    changes: string[]
  }[]
}

export interface UserOrgValues {
  directorates: string[]
  sub_directorates: string[]
  divisions: string[]
  departments: string[]
  org_levels: string[]
}

export function useUserOrgValues() {
  return useFetch<UserOrgValues>(`${BASE}/users/org-values`, { key: 'admin-user-org-values' })
}

export const adminApi = {
  importUsers: (file: File, dryRun: boolean) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch<HrImportResult>(`${BASE}/users/import`, { method: 'POST', body, query: dryRun ? { dry_run: 1 } : {} })
  },
  createUser: (body: AdminUserInput) =>
    withSealedPassword<{ user: AdminUser, invitation_sent: boolean }>(`${BASE}/users`, 'POST', 'user_password', body),
  updateUser: (id: number, body: AdminUserInput) =>
    $fetch<AdminUser>(`${BASE}/users/${id}`, { method: 'PUT', body }),
  unlockUser: (id: number) => $fetch<AdminUser>(`${BASE}/users/${id}/unlock`, { method: 'POST' }),
  resetPassword: (id: number, password?: string) =>
    withSealedPassword<{ user: AdminUser, email_sent: boolean }>(`${BASE}/users/${id}/reset-password`, 'POST', 'user_password', { password }),
  createRole: (body: { name: string, description?: string | null, permissions: string[] }) =>
    $fetch<AdminRole>(`${BASE}/roles`, { method: 'POST', body }),
  updateRole: (id: number, body: { name: string, description?: string | null, permissions: string[] }) =>
    $fetch<AdminRole>(`${BASE}/roles/${id}`, { method: 'PUT', body }),
  deleteRole: (id: number) => $fetch(`${BASE}/roles/${id}`, { method: 'DELETE' }),
  createMenu: (body: AdminMenuInput) => $fetch<AdminMenu>(`${BASE}/menus`, { method: 'POST', body }),
  updateMenu: (id: number, body: AdminMenuInput) =>
    $fetch<AdminMenu>(`${BASE}/menus/${id}`, { method: 'PUT', body }),
  orderMenus: (items: { id: number, parent_id: number | null, sort_order: number }[]) =>
    $fetch<{ items: AdminMenu[] }>(`${BASE}/menus/order`, { method: 'PUT', body: { items } }),
  deleteMenu: (id: number) => $fetch(`${BASE}/menus/${id}`, { method: 'DELETE' }),
  createProvider: (body: SmtpProviderInput) =>
    withSealedPassword<SmtpProvider>(`${BASE}/settings/mail/providers`, 'POST', 'smtp_password', body),
  updateProvider: (id: number, body: SmtpProviderInput) =>
    withSealedPassword<SmtpProvider>(`${BASE}/settings/mail/providers/${id}`, 'PUT', 'smtp_password', body),
  deleteProvider: (id: number) => $fetch(`${BASE}/settings/mail/providers/${id}`, { method: 'DELETE' }),
  activateProvider: (id: number) =>
    $fetch<SmtpProviderList>(`${BASE}/settings/mail/providers/${id}/activate`, { method: 'POST' }),
  deactivateProvider: (id: number) =>
    $fetch<SmtpProviderList>(`${BASE}/settings/mail/providers/${id}/deactivate`, { method: 'POST' }),
  testProvider: (id: number, to?: string) =>
    $fetch<SmtpTestResult>(`${BASE}/settings/mail/providers/${id}/test`, {
      method: 'POST',
      body: to ? { to } : {},
    }),
  retryEmail: (id: number) =>
    $fetch<{ id: number, status: string, last_error: string | null }>(`${BASE}/audit/emails/${id}/retry`, { method: 'POST' }),
}

export function useAdminRoles() {
  return useFetch<{ items: AdminRole[] }>(`${BASE}/roles`, { key: 'admin-roles' })
}

export function useAdminPermissions() {
  return useFetch<{ items: AdminPermission[] }>(`${BASE}/permissions`, { key: 'admin-permissions' })
}

export type UserState = 'active' | 'invited' | 'locked' | 'inactive'

export function userState(user: AdminUser): UserState {
  if (!user.is_active) return 'inactive'
  if (user.is_locked) return 'locked'
  if (!user.has_password || !user.last_login_at) return 'invited'
  return 'active'
}

export const userStatus = defineStatusScale<UserState>({
  active: { label: 'Active', color: 'success', icon: 'i-lucide-circle-check' },
  invited: { label: 'Not signed in yet', color: 'info', icon: 'i-lucide-mail' },
  locked: { label: 'Locked', color: 'warning', icon: 'i-lucide-lock' },
  inactive: { label: 'Inactive', color: 'neutral', icon: 'i-lucide-circle-minus' },
})

export const emailStatus = defineStatusScale<OutboxEmail['status']>({
  queued: { label: 'Queued', color: 'info', icon: 'i-lucide-clock' },
  sent: { label: 'Sent', color: 'success', icon: 'i-lucide-circle-check' },
  failed: { label: 'Failed', color: 'error', icon: 'i-lucide-circle-alert' },
})

const MODULE_LABELS: Record<string, string> = { scca: 'SCCA', ra: 'RA and RA Branch', sites: 'Sites', admin: 'Administration' }
/** Permission groups in the order of the sidebar; unknown modules go last. */
const MODULE_ORDER = ['scca', 'ra', 'sites', 'admin']

export function moduleLabel(module: string) {
  return MODULE_LABELS[module] ?? module.toUpperCase()
}

export function moduleOrder(module: string) {
  const index = MODULE_ORDER.indexOf(module)
  return index === -1 ? MODULE_ORDER.length : index
}

const EVENT_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Sign-in failed',
  'auth.login_locked': 'Sign-in while locked',
  'auth.locked': 'Account locked',
  'auth.logout': 'Signed out',
  'auth.password_changed': 'Password changed',
  'auth.reset_requested': 'Reset link requested',
  'auth.reset_done': 'Password reset',
  'admin.user_created': 'User created',
  'admin.user_updated': 'User updated',
  'admin.user_unlocked': 'User unlocked',
  'admin.password_set': 'Temporary password set',
  'admin.password_link_sent': 'Password link sent',
  'admin.role_created': 'Role created',
  'admin.role_updated': 'Role updated',
  'admin.role_deleted': 'Role deleted',
  'admin.menu_created': 'Menu added',
  'admin.menu_updated': 'Menu updated',
  'admin.menu_deleted': 'Menu deleted',
  'admin.menus_reordered': 'Menus reordered',
  'admin.mail_settings_updated': 'Email settings updated',
  'admin.mail_provider_created': 'SMTP provider added',
  'admin.mail_provider_updated': 'SMTP provider updated',
  'admin.mail_provider_deleted': 'SMTP provider deleted',
  'admin.mail_provider_activated': 'SMTP provider switched',
  'admin.mail_provider_deactivated': 'Email sending turned off',
  'admin.bootstrap': 'Administrator set up',
}

export function eventLabel(event: string) {
  return EVENT_LABELS[event] ?? event
}

export function eventTone(event: string): 'error' | 'warning' | 'neutral' {
  if (event === 'auth.login_failed' || event === 'auth.login_locked') return 'error'
  if (event === 'auth.locked') return 'warning'
  return 'neutral'
}

type ActivityTone = 'neutral' | 'primary' | 'success' | 'error' | 'warning' | 'info'

/** SCCA actions in the audit log (`scca.*`): label, icon and colour. */
export const SCCA_ACTIVITY: Record<string, { label: string, icon: string, tone: ActivityTone }> = {
  created: { label: 'Created', icon: 'i-lucide-file-plus', tone: 'primary' },
  updated: { label: 'Edited', icon: 'i-lucide-pencil', tone: 'neutral' },
  ratings_saved: { label: 'Ratings saved', icon: 'i-lucide-list-checks', tone: 'neutral' },
  interdependencies_saved: { label: 'Interdependencies saved', icon: 'i-lucide-network', tone: 'neutral' },
  submitted: { label: 'Submitted for approval', icon: 'i-lucide-send', tone: 'info' },
  approved: { label: 'Approved', icon: 'i-lucide-circle-check', tone: 'success' },
  rejected: { label: 'Rejected', icon: 'i-lucide-circle-x', tone: 'error' },
  recalled: { label: 'Recalled', icon: 'i-lucide-undo-2', tone: 'warning' },
  finalised: { label: 'Final', icon: 'i-lucide-badge-check', tone: 'success' },
  comment_added: { label: 'Comment', icon: 'i-lucide-message-square', tone: 'neutral' },
  report_downloaded: { label: 'Report downloaded', icon: 'i-lucide-download', tone: 'neutral' },
  renewal_started: { label: 'Renewal started', icon: 'i-lucide-refresh-cw', tone: 'primary' },
  nudged: { label: 'Reminded by BCM', icon: 'i-lucide-bell-ring', tone: 'info' },
  reassigned: { label: 'Step reassigned', icon: 'i-lucide-user-round-cog', tone: 'warning' },
  approved_on_behalf: { label: 'Approved on behalf', icon: 'i-lucide-badge-check', tone: 'warning' },
  reminded: { label: 'Automatic reminder', icon: 'i-lucide-bell', tone: 'neutral' },
  escalated: { label: 'Escalated to BCM', icon: 'i-lucide-siren', tone: 'error' },
  renewal_notice: { label: 'Renewal notice', icon: 'i-lucide-calendar-clock', tone: 'neutral' },
  monitoring_exported: { label: 'Monitoring export', icon: 'i-lucide-file-spreadsheet', tone: 'neutral' },
  settings_updated: { label: 'Reminder rules changed', icon: 'i-lucide-sliders-horizontal', tone: 'neutral' },
  version_moved: { label: 'Moved to another version', icon: 'i-lucide-file-cog', tone: 'info' },
  signer_changed: { label: 'Default or fixed signer changed', icon: 'i-lucide-user-round-cog', tone: 'neutral' },
  config_draft_started: { label: 'Configuration draft started', icon: 'i-lucide-file-plus', tone: 'primary' },
  config_changed: { label: 'Configuration changed', icon: 'i-lucide-file-cog', tone: 'neutral' },
  config_publish_requested: { label: 'Configuration publish requested', icon: 'i-lucide-send', tone: 'info' },
  config_publish_withdrawn: { label: 'Configuration request withdrawn', icon: 'i-lucide-undo-2', tone: 'warning' },
  config_published: { label: 'Configuration published', icon: 'i-lucide-badge-check', tone: 'success' },
  config_discarded: { label: 'Configuration draft discarded', icon: 'i-lucide-trash-2', tone: 'warning' },
}

export const SCCA_ACTIVITY_FILTERS = [
  { label: 'All actions', value: 'all' },
  ...Object.entries(SCCA_ACTIVITY).map(([value, item]) => ({ label: item.label, value, icon: item.icon })),
]

export function sccaActivity(event: string) {
  const action = event.replace(/^scca\./, '')
  return SCCA_ACTIVITY[action] ?? { label: action.replaceAll('_', ' '), icon: 'i-lucide-dot', tone: 'neutral' as const }
}

function sccaRoleName(role: unknown) {
  if (typeof role !== 'string') return null
  if (role === 'assessor') return 'Assessor'
  if (role === 'contributor') return 'Contributor'
  if (role === 'admin') return 'Admin'
  return signoffRoleLabel(role, true)
}

function sccaTabName(tab: unknown) {
  return SCCA_TABS.find((item) => item.value === tab)?.label ?? String(tab)
}

/** One line on what an SCCA action did, e.g. "Changed Rating · Category Critical → Very Important". */
export function sccaActivityDetail(row: AuditEvent): string {
  const detail = (row.detail ?? {}) as Record<string, unknown>
  const parts: string[] = []
  const action = row.event.replace(/^scca\./, '')
  if (action === 'created' && detail.reason) parts.push(reasonLabel(String(detail.reason)) ?? String(detail.reason))
  if (Array.isArray(detail.sections) && detail.sections.length) {
    parts.push(`Changed ${detail.sections.map(sccaTabName).join(', ')}`)
  }
  if (action === 'comment_added' && detail.tab) parts.push(`On ${sccaTabName(detail.tab)}`)
  const role = sccaRoleName(detail.role)
  if (role) parts.push(action === 'comment_added' ? `as ${role}` : role)
  if (detail.category_from && detail.category_to) parts.push(`Category ${detail.category_from} → ${detail.category_to}`)
  else if (detail.category_to) parts.push(`Category ${detail.category_to}`)
  if (detail.format) parts.push(String(detail.format) === 'xlsx' ? 'Excel' : String(detail.format).toUpperCase())
  if (action === 'renewal_started' && detail.renewal_of) parts.push(`Renews ${detail.renewal_of}`)
  if (action === 'reassigned' && (detail.from_name || detail.to_name)) parts.push(`${detail.from_name ?? '—'} → ${detail.to_name ?? '—'}`)
  else if (detail.approver) parts.push(action === 'approved_on_behalf' ? `for ${detail.approver}` : `to ${detail.approver}`)
  if (typeof detail.working_days === 'number') parts.push(`${detail.working_days} working days waiting`)
  if (detail.attachment_name) parts.push(`evidence ${detail.attachment_name}`)
  if (action === 'renewal_notice' && detail.kind) {
    const kind = String(detail.kind)
    parts.push(kind === 'overdue' ? `Overdue by ${detail.days_overdue ?? '?'} days` : `${kind.replace('renewal_', '')}-day notice`)
  }
  if (action === 'monitoring_exported') parts.push(`${detail.view} · ${detail.rows} rows · ${detail.filters}`)
  if (action === 'settings_updated' && detail.changed && typeof detail.changed === 'object') {
    parts.push(`Changed ${Object.keys(detail.changed).map((key) => key.replaceAll('_', ' ')).join(', ')}`)
  }
  if (action === 'version_moved') {
    parts.push(`${detail.from_version} → ${detail.to_version}`)
    if (Array.isArray(detail.cleared) && detail.cleared.length) parts.push(`cleared ${detail.cleared.join(', ')}`)
  }
  if (action === 'signer_changed') parts.push(`${signoffRoleLabel(String(detail.step), true)} (${detail.mode}): ${detail.from ?? '—'} → ${detail.to ?? '—'}`)
  if (action.startsWith('config_') && detail.version) {
    parts.push(String(detail.version))
    if (detail.part) parts.push(String(detail.part).replace('list:', 'list ').replaceAll('_', ' '))
    if (detail.copied_from) parts.push(`copy of ${detail.copied_from}`)
    if (detail.retired) parts.push(`${detail.retired} retired`)
    if (detail.request_withdrawn) parts.push('publish request withdrawn')
  }
  if (detail.note) parts.push(`“${detail.note}”`)
  return parts.join(' · ')
}

/** One readable message for an admin API error: the server's message, or each field problem. */
export function adminErrorText(error: unknown): string {
  const { statusCode, data } = (error ?? {}) as {
    statusCode?: number
    data?: { message?: string, details?: Record<string, string> }
  }
  if (statusCode === 422 && data?.details) return Object.values(data.details).join(' ')
  if (data?.message) return data.message
  if (statusCode === 403) return 'You don\'t have permission to do this.'
  return 'Couldn\'t reach the server. Check your connection and try again.'
}

// --- RA activity (Administration > Audit log > RA activity) -------------------------------

/** Every `ra.*` audit event, as the RA activity tab names it. */
export const RA_ACTIVITY: Record<string, { label: string, icon: string, tone: ActivityTone }> = {
  building_updated: { label: 'Building details changed', icon: 'i-lucide-pencil', tone: 'neutral' },
  building_contacts_saved: { label: 'Emergency contacts saved', icon: 'i-lucide-phone', tone: 'neutral' },
  building_occupants_saved: { label: 'Occupants saved', icon: 'i-lucide-users', tone: 'neutral' },
  building_recovery_team_saved: { label: 'Recovery team saved', icon: 'i-lucide-life-buoy', tone: 'neutral' },
  building_call_tree_saved: { label: 'Call tree saved', icon: 'i-lucide-network', tone: 'neutral' },
  building_approval_requested: { label: 'Building sent for approval', icon: 'i-lucide-send', tone: 'info' },
  building_approval_withdrawn: { label: 'Building request withdrawn', icon: 'i-lucide-undo-2', tone: 'warning' },
  building_approved: { label: 'Building approved', icon: 'i-lucide-circle-check', tone: 'success' },
  building_rejected: { label: 'Building rejected', icon: 'i-lucide-circle-x', tone: 'error' },
  building_deleted: { label: 'Building deleted', icon: 'i-lucide-trash-2', tone: 'warning' },
  assessment_created: { label: 'RA created', icon: 'i-lucide-file-plus', tone: 'primary' },
  assessment_updated: { label: 'RA details changed', icon: 'i-lucide-pencil', tone: 'neutral' },
  ratings_saved: { label: 'Hazard ratings saved', icon: 'i-lucide-list-checks', tone: 'neutral' },
  assessment_deleted: { label: 'RA deleted', icon: 'i-lucide-trash-2', tone: 'warning' },
  assessment_submitted: { label: 'Submitted for approval', icon: 'i-lucide-send', tone: 'info' },
  step_approved: { label: 'Step approved', icon: 'i-lucide-circle-check', tone: 'success' },
  assessment_returned: { label: 'Returned for changes', icon: 'i-lucide-undo-2', tone: 'warning' },
  revision_accepted: { label: 'Accepted the revision', icon: 'i-lucide-check', tone: 'info' },
  signer_changed: { label: 'Signer changed by BCM', icon: 'i-lucide-user-round-cog', tone: 'warning' },
  approved_on_behalf: { label: 'Approved on behalf', icon: 'i-lucide-badge-check', tone: 'warning' },
  incident_declared: { label: 'Disaster or incident declared', icon: 'i-lucide-siren', tone: 'error' },
  incident_approved: { label: 'Disaster or incident approved', icon: 'i-lucide-circle-check', tone: 'success' },
  incident_rejected: { label: 'Disaster or incident rejected', icon: 'i-lucide-circle-x', tone: 'neutral' },
  incident_updated: { label: 'Disaster or incident updated', icon: 'i-lucide-pencil', tone: 'neutral' },
  incident_note_added: { label: 'Disaster or incident update added', icon: 'i-lucide-message-square', tone: 'neutral' },
  incident_closed: { label: 'Disaster or incident closed', icon: 'i-lucide-circle-check-big', tone: 'success' },
  incident_reopened: { label: 'Disaster or incident reopened', icon: 'i-lucide-rotate-ccw', tone: 'warning' },
  incident_deleted: { label: 'Disaster or incident deleted', icon: 'i-lucide-trash-2', tone: 'warning' },
  approval_notice_sent: { label: 'Approvers told', icon: 'i-lucide-mail', tone: 'neutral' },
  approval_reminder_sent: { label: 'Approvers reminded', icon: 'i-lucide-bell-ring', tone: 'info' },
  approval_escalated: { label: 'Approval escalated to BCM', icon: 'i-lucide-siren', tone: 'error' },
  guidebook_updated: { label: 'Guidebook steps saved', icon: 'i-lucide-book-marked', tone: 'neutral' },
  bmkg_settings_updated: { label: 'BMKG earthquake settings saved', icon: 'i-lucide-activity', tone: 'neutral' },
  dibi_settings_updated: { label: 'Past disaster settings saved', icon: 'i-lucide-history', tone: 'neutral' },
  dibi_imported: { label: 'DIBI download imported', icon: 'i-lucide-file-up', tone: 'neutral' },
  outbreak_settings_updated: { label: 'WHO outbreak news settings saved', icon: 'i-lucide-biohazard', tone: 'neutral' },
  air_quality_settings_updated: { label: 'OpenAQ air quality settings saved', icon: 'i-lucide-wind', tone: 'neutral' },
  weather_settings_updated: { label: 'BMKG weather warning settings saved', icon: 'i-lucide-cloud-lightning', tone: 'neutral' },
  waqi_settings_updated: { label: 'WAQI settings saved', icon: 'i-lucide-gauge', tone: 'neutral' },
  config_draft_started: { label: 'Configuration draft started', icon: 'i-lucide-file-plus', tone: 'primary' },
  config_changed: { label: 'Configuration changed', icon: 'i-lucide-file-cog', tone: 'neutral' },
  config_publish_requested: { label: 'Configuration publish requested', icon: 'i-lucide-send', tone: 'info' },
  config_publish_withdrawn: { label: 'Configuration request withdrawn', icon: 'i-lucide-undo-2', tone: 'warning' },
  config_published: { label: 'Configuration published', icon: 'i-lucide-badge-check', tone: 'success' },
  config_discarded: { label: 'Configuration draft discarded', icon: 'i-lucide-trash-2', tone: 'warning' },
  signer_default_changed: { label: 'Default or fixed signer changed', icon: 'i-lucide-user-round-cog', tone: 'neutral' },
  division_created: { label: 'Division added', icon: 'i-lucide-plus', tone: 'neutral' },
  division_changed: { label: 'Division changed', icon: 'i-lucide-pencil', tone: 'neutral' },
  division_deleted: { label: 'Division deleted', icon: 'i-lucide-trash-2', tone: 'warning' },
  settings_updated: { label: 'Reminder rules changed', icon: 'i-lucide-sliders-horizontal', tone: 'neutral' },
  config_diagram_updated: { label: 'Team diagram replaced', icon: 'i-lucide-network', tone: 'neutral' },
  hazard_types_updated: { label: 'Disaster or incident per hazard changed', icon: 'i-lucide-split', tone: 'neutral' },
  config_diagram_reset: { label: 'Team diagram back to the workbook picture', icon: 'i-lucide-rotate-ccw', tone: 'neutral' },
  migrated: { label: 'Brought in by RA migration', icon: 'i-lucide-file-up', tone: 'primary' },
  migration_run: { label: 'RA migration run', icon: 'i-lucide-file-up', tone: 'neutral' },
  migration_undone: { label: 'RA migration run undone', icon: 'i-lucide-undo-2', tone: 'warning' },
}

/** The groups the RA activity tab filters by (the API's `group`). */
export const RA_ACTIVITY_GROUPS = [
  { label: 'All RA activity', value: 'all' },
  { label: 'Buildings and their profile', value: 'buildings' },
  { label: 'RAs', value: 'assessments' },
  { label: 'Sign-off', value: 'signoff' },
  { label: 'Disasters and incidents', value: 'incidents' },
  { label: 'Approvals and reminders', value: 'approvals' },
  { label: 'RA and Sites configuration, guidebook', value: 'configuration' },
]

export function raActivity(event: string) {
  const action = event.replace(/^ra\./, '')
  return RA_ACTIVITY[action] ?? { label: action.replaceAll('_', ' '), icon: 'i-lucide-dot', tone: 'neutral' as const }
}

const RA_FIELD_NAMES: Record<string, string> = {
  lic_user_id: 'LIC',
  licom_user_id: 'LICOM',
  lic_phone: 'LIC phone',
  licom_phone: 'LICOM phone',
  zip_code: 'postal code',
  is_active: 'active',
}

function raField(name: string) {
  return RA_FIELD_NAMES[name] ?? name.replaceAll('_', ' ')
}

/** The record an RA event is about: the building, and the RA or disaster reference. */
export function raActivityRecord(row: AuditEvent): { label: string, ref: string | null, to: string | null } {
  const detail = (row.detail ?? {}) as Record<string, unknown>
  const building = typeof detail.building === 'string' ? detail.building : null
  const ref = typeof detail.ref_no === 'string' ? detail.ref_no : typeof detail.code === 'string' ? detail.code : null
  if (row.target_type === 'ra_crisis_events' && row.target_id) {
    return { label: building ?? 'Disaster or incident', ref, to: `/disasters/${row.target_id}` }
  }
  if (row.target_type === 'ra_assessments' && row.target_id) {
    const kind = detail.kind === 'branch' ? 'ra-branch' : 'ra'
    return { label: building ?? 'RA', ref, to: row.event === 'ra.assessment_deleted' ? null : `/${kind}/manage/${row.target_id}` }
  }
  if (row.target_type === 'ra_locations' && row.target_id) {
    return { label: building ?? (detail.name as string | undefined) ?? 'Building', ref, to: row.event === 'ra.building_deleted' ? null : `${MASTER_BUILDINGS_PATH}/${row.target_id}` }
  }
  if (row.target_type === 'ra_playbooks') {
    // The disaster guidebook opens the incident one when the hazard is an incident.
    const hazard = (detail.hazard as string | undefined) ?? null
    return { label: 'Guidebook', ref: hazard, to: guidebookPath('disaster', hazard ?? undefined) }
  }
  if (row.target_type === 'ra_diagrams') {
    const kind = detail.kind === 'branch' ? 'branch' : undefined
    return { label: 'RA configuration', ref: null, to: `/admin/ra-config?tab=diagrams${kind ? `&kind=${kind}` : ''}` }
  }
  const sitesTab = SITES_CONFIG_EVENTS[row.event.replace(/^ra\./, '')]
  if (sitesTab) return { label: 'Sites configuration', ref: null, to: `${SITES_CONFIG_PATH}?tab=${sitesTab}` }
  return { label: 'RA configuration', ref: null, to: null }
}

/** RA activity events about Sites configuration, with the tab they changed. */
const SITES_CONFIG_EVENTS: Record<string, SitesConfigTab> = {
  hazard_types_updated: 'hazard-types',
  bmkg_settings_updated: 'earthquakes',
  dibi_settings_updated: 'past-disasters',
  dibi_imported: 'past-disasters',
  outbreak_settings_updated: 'past-disasters',
  air_quality_settings_updated: 'past-disasters',
  weather_settings_updated: 'past-disasters',
  waqi_settings_updated: 'past-disasters',
}

/** One line on what an RA action did, e.g. "Changed address, postal code" or "4 → 5 rows". */
export function raActivityDetail(row: AuditEvent): string {
  const detail = (row.detail ?? {}) as Record<string, unknown>
  const action = row.event.replace(/^ra\./, '')
  const parts: string[] = []
  if (Array.isArray(detail.fields) && detail.fields.length) parts.push(`Changed ${detail.fields.map((field) => raField(String(field))).join(', ')}`)
  if (Array.isArray(detail.signers) && detail.signers.length) parts.push(`Signers of ${detail.signers.map((step) => String(step).replaceAll('_', ' ')).join(', ')}`)
  if (typeof detail.rows === 'number') parts.push(`${detail.before ?? 0} → ${detail.rows} ${detail.rows === 1 ? 'row' : 'rows'}`)
  if (Array.isArray(detail.hazards) && detail.hazards.length) parts.push(`${detail.hazards.length} ${detail.hazards.length === 1 ? 'hazard' : 'hazards'}: ${detail.hazards.join(', ')}`)
  if (action === 'assessment_created' && detail.reason) parts.push(String(detail.reason).replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase()))
  if (detail.step) parts.push(`Step ${String(detail.step).replaceAll('_', ' ')}`)
  if (detail.final) parts.push('Final')
  if (action === 'signer_changed' && (detail.from || detail.to)) parts.push(`${detail.from ?? '—'} → ${detail.to ?? '—'}`)
  if (action === 'approved_on_behalf' && detail.signer) parts.push(`for ${detail.signer}`)
  if (detail.task) parts.push(detail.task === 'deactivate' ? 'Make inactive' : detail.task === 'declare' ? 'Disaster or incident' : 'New')
  if (detail.waited) parts.push(`waited ${detail.waited}`)
  if (action === 'building_approval_requested' && detail.action) parts.push(detail.action === 'deactivate' ? 'Make inactive' : detail.again ? 'Sent again' : 'New')
  if (Array.isArray(detail.changes) && detail.changes.length) parts.push(detail.changes.join('. '))
  for (const key of action === 'assessment_created' ? ['comment', 'note'] : ['comment', 'note', 'reason']) {
    if (typeof detail[key] === 'string' && detail[key]) parts.push(`“${detail[key]}”`)
  }
  if (action === 'settings_updated' && detail.changed && typeof detail.changed === 'object') parts.push(`Changed ${Object.keys(detail.changed).map(raField).join(', ')}`)
  if (action.startsWith('config_diagram_') && typeof detail.diagram === 'string' && detail.diagram in RA_DIAGRAMS) {
    parts.push(`${RA_MODULES[detail.kind === 'branch' ? 'branch' : 'head_office'].title}: ${RA_DIAGRAMS[detail.diagram as RaDiagram].label}`)
    if (action === 'config_diagram_updated' && typeof detail.filename === 'string') parts.push(detail.filename)
  }
  return parts.join(' · ')
}
