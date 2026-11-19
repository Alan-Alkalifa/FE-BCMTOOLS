import type { BiaCategory, BiaReason, BiaRevisionState, BiaStatus, BiaWaitLevel } from '~/utils/bia'

export type BiaRenewalBucket = 'overdue' | 'due_30' | 'due_90' | 'later'

export interface BiaAssessmentRef {
  id: number
  ref_no: string | null
  period_year: number
  assessment_date: string | null
  reason: BiaReason
  status: BiaStatus
  is_returned?: boolean
  revision_state?: BiaRevisionState | null
  current_signoff_role: string | null
  current_step_title: string | null
  highest_category: BiaCategory | null
  shortest_mtd: string | null
  function_count: number
  approved_at: string | null
}

export interface BiaGroupUser {
  id: number
  name: string
  job_title: string | null
  email: string | null
  org_level?: string | null
  directorate?: string | null
  sub_directorate?: string | null
  org_group?: string | null
  roles: string[]
}

export interface BiaGroupInfo {
  id: number
  code: string
  name: string
  directorate: string
  sub_directorate: string
  main_building: string
  alt_building: string
}

export interface BiaMonitorGroupRow {
  group: BiaGroupInfo
  group_status?: string
  group_status_label?: string
  approved: BiaAssessmentRef | null
  open: BiaAssessmentRef | null
  assessment_count: number
  renewal_date: string | null
  days_left: number | null
  bucket: BiaRenewalBucket | null
  assessor: string | null
  alt_coordinator: string | null
  group_users?: BiaGroupUser[]
  directorate_users?: BiaGroupUser[]
  can_generate: boolean
  history: BiaAssessmentRef[]
}

export interface BiaSignoffWaitingRow {
  id: number
  ref_no: string | null
  group: BiaGroupInfo
  step: string
  step_title: string
  coordinator?: string | null
  signer: { name: string, job_title: string } | null
  waiting_since: string
  working_days_waiting: number
  working_days_in_signoff: number
  reminders_sent: number
  escalated_at: string | null
  level: BiaWaitLevel
}

export interface BiaItDependencyItem {
  app_code: string
  app_name: string
  rto: string
  rpo: string
  workaround: string
  backlog_time: string
  daat: string
  daat_negative?: boolean
  daat_warnings?: string[]
  system_usage: string
  critical_gap: string | null
}

export interface BiaNonItDependencyItem {
  direction: 'Upstream' | 'Downstream'
  party_name: string
  planned_capacity: string
  expected_mtd: string
  sla: string
  is_outsourcing: string
  is_material: string
}

export interface BiaFunctionItem {
  seq_no: number
  name: string
  suggested_mtd: string
  expected_mtd: string
  computed_suggested_mtd?: string | null
  suggested_trigger_index?: number | null
  suggested_trigger_period?: string | null
  suggested_triggers?: ('loss' | 'regulatory' | 'customer')[]
  suggested_mtd_matches?: boolean | null
  expected_within_suggested?: boolean | null
  category: BiaCategory
  planned_capacity: string
  fin_loss_4h: number
  fin_loss_d1: number
  fin_loss_w1: number
  fin_loss_w4: number
  losses?: number[]
  regulatory_scores?: number[]
  customer_scores?: number[]
  reg_score_max: number
  cust_score_max: number
  total_staff: number
  required_staff: number
  recovery_level: string
  alt_site_strategy: string
  bcp_seats_current: number
  bcp_seats_required: number
  vital_record: string
  vital_record_location: string
  frequency: string
  critical_timing: string
  critical_activity: string
  it_dependencies: BiaItDependencyItem[]
  non_it_dependencies: BiaNonItDependencyItem[]
}

export interface BiaAssessmentDetail {
  id: number
  ref_no: string
  config_version_id?: number | null
  config_version?: string
  created_by?: string | null
  group_users?: BiaGroupUser[]
  directorate_users?: BiaGroupUser[]
  period_year: number
  assessment_date: string
  approved_at: string | null
  renewal_date: string | null
  reason: BiaReason
  status: BiaStatus
  is_returned?: boolean
  revision_state?: BiaRevisionState | null
  can_edit?: boolean
  current_signoff_role: string | null
  current_step_title: string | null
  highest_category: BiaCategory | null
  shortest_mtd: string | null
  periods?: string[]
  impact_reference?: {
    loss_alert_idr: number
    score_alert: number
    financial_bands: { code: string, label: string, description: string }[]
    impact_matrix: { score: number, regulatory: string, customer: string }[]
  }
  guides?: Record<string, string>
  loss_totals?: {
    fin_loss_4h: number
    fin_loss_d1: number
    fin_loss_w1: number
    fin_loss_w4: number
  }
  notes?: {
    ra_justification: string | null
    loss_formula: string | null
    justification_regulatory: string | null
    justification_customer: string | null
    justification_rto: string | null
    justification_dependency: string | null
  }
  group: BiaGroupInfo & {
    description: string
    main_address: string
    alt_address: string
    recovery_strategy: string
  }
  coordinator: {
    name: string
    nik: string
    email: string
    phone: string
  }
  alt_coordinator: {
    name: string
    nik: string
    email: string
    phone: string
  }
  ra_questionnaire: {
    considered_bc: 'Yes' | 'No'
    tools_used: string
    controls_included: 'Yes' | 'No'
    location_ra_completed: 'Yes' | 'No'
    senior_mgmt: number
    middle_mgmt: number
    executive_mgr: number
    staff: number
    others: number
    others_note?: string | null
    personnel_breakdown?: {
      code: string
      label: string
      count: number
    }[]
    total_staff: number
  }
  functions: BiaFunctionItem[]
  signoffs: {
    role: string
    label: string
    title: string
    signer_name: string
    signer_title: string
    status: 'approved' | 'pending' | 'rejected'
    signed_at: string | null
    decision_note?: string | null
  }[]
}

export interface BiaMonitoringFilters {
  q?: string
  category?: BiaCategory | 'none'
  state?: 'approved' | 'draft' | 'need_revision' | 'in_revision' | 'returned' | 'in_signoff' | 'none'
  reason?: BiaReason
  from?: string
  to?: string
  directorate?: string
  sub_directorate?: string
  org_group?: string
  page?: number
  per_page?: number
  bucket?: Exclude<BiaRenewalBucket, 'later'>
}

export interface BiaGroupHistoryRow {
  id: number
  ref_no: string | null
  reason: BiaReason
  status: BiaStatus
  is_returned?: boolean
  revision_state?: BiaRevisionState | null
  assessment_date: string | null
  approved_at: string | null
  highest_category: BiaCategory | null
  shortest_mtd: string | null
  function_count: number
  assessor: string | null
  alt_coordinator: string | null
  mark: 'current' | 'replaced' | null
}

export interface BiaGenerateResult {
  created: { id: number, ref_no: string, renews: string | null, group: string }[]
  skipped: { id: number, ref_no: string | null, group?: string, reason: string }[]
  refused: { id: number, ref_no: string | null, group?: string, reason: string }[]
}

export interface BiaOverviewResponse {
  cards: {
    groups: number
    assessed: number
    not_assessed: number
    drafts: number
    need_revision: number
    in_revision: number
    returned: number
    in_signoff: number
    overdue_renewals: number
    due_in_90_days: number
    business_critical: number
    stuck_approvals: number
  }
  by_category: { category: BiaCategory | 'none', groups: number }[]
  approved_per_month: { month: string, assessments: number }[]
}

export interface BiaPaginatedResponse<T> {
  items: T[]
  page: number
  per_page: number
  total: number
  pages: number
}

export interface BiaRenewalsResponse extends BiaPaginatedResponse<BiaMonitorGroupRow> {
  counts: {
    overdue: number
    due_30: number
    due_90: number
  }
}

export interface BiaStepAverageRow {
  step: string
  step_title: string
  approvals: number
  average_working_days: number | null
}

export function useBiaMonitoringOrgValues(filters?: MaybeRefOrGetter<BiaMonitoringFilters>) {
  return useFetch<{ directorates: string[], sub_directorates: string[], groups: string[] }>(
    '/api/bianca/monitoring/org-values',
    {
      query: computed(() => toValue(filters) ?? {}),
      default: () => ({ directorates: [], sub_directorates: [], groups: [] }),
    },
  )
}

export function useBiaOverview(filters: MaybeRefOrGetter<BiaMonitoringFilters>) {
  return useFetch<BiaOverviewResponse>('/api/bianca/monitoring/overview', {
    query: computed(() => toValue(filters)),
  })
}

export function useBiaRenewals(filters: MaybeRefOrGetter<BiaMonitoringFilters>) {
  return useFetch<BiaRenewalsResponse>('/api/bianca/monitoring/renewals', {
    query: computed(() => toValue(filters)),
  })
}

export function useBiaRegister(filters: MaybeRefOrGetter<BiaMonitoringFilters>) {
  return useFetch<BiaPaginatedResponse<BiaMonitorGroupRow>>('/api/bianca/monitoring/register', {
    query: computed(() => toValue(filters)),
  })
}

export function useBiaBottlenecks(filters: MaybeRefOrGetter<BiaMonitoringFilters>) {
  return useFetch<BiaPaginatedResponse<BiaSignoffWaitingRow>>('/api/bianca/monitoring/bottlenecks', {
    query: computed(() => toValue(filters)),
  })
}

export function useBiaBottlenecksStepAverages(filters?: MaybeRefOrGetter<BiaMonitoringFilters>) {
  return useFetch<{ items: BiaStepAverageRow[] }>('/api/bianca/monitoring/step-averages', {
    query: computed(() => toValue(filters) ?? {}),
  })
}

export function useBiaGroupHistory(params: MaybeRefOrGetter<{ group_id: number, page?: number, per_page?: number }>) {
  return useFetch<BiaPaginatedResponse<BiaGroupHistoryRow>>('/api/bianca/monitoring/history', {
    query: computed(() => toValue(params)),
  })
}

export function useBiaAssessmentDetail(id: MaybeRefOrGetter<number>) {
  return useFetch<BiaAssessmentDetail>(
    () => `/api/bianca/monitoring/assessments/${toValue(id)}`,
    {
      key: computed(() => `bianca-monitoring-detail-${toValue(id)}`),
    },
  )
}

export function biaExportUrl(filters: BiaMonitoringFilters, groupIds?: number[]) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && key !== 'page' && key !== 'per_page') {
      query.set(key, String(value))
    }
  }
  if (groupIds?.length) {
    query.set('group_ids', groupIds.join(','))
  }
  const text = query.toString()
  return `/api/bianca/monitoring/export.xlsx${text ? `?${text}` : ''}`
}

export interface BiancaSettings {
  reminders_enabled: boolean
  reminder_after_days: number
  reminder_every_days: number
  escalate_after_days: number
  escalate_to_supervisor: boolean
  extra_escalation_emails: string[]
  renewal_notice_days: number[]
  overdue_repeat_days: number
  window_start_hour: number
  window_end_hour: number
  updated_at?: string | null
  updated_by?: string | null
}

export interface BiancaRunRemindersResult {
  reminded: number
  escalated: number
  renewal_notices: number
  overdue_notices: number
  skipped: string | null
}

export const biancaSettingsApi = {
  get: () => $fetch<BiancaSettings>('/api/bianca/settings'),
  save: (body: Omit<BiancaSettings, 'updated_at' | 'updated_by'>) =>
    $fetch<BiancaSettings>('/api/bianca/settings', { method: 'PUT', body }),
  runNow: () =>
    $fetch<BiancaRunRemindersResult>('/api/bianca/settings/run-reminders', { method: 'POST' }),
}

export interface BiaManualRemindResult {
  reminded: { id: number, ref_no: string | null, group: string, signer?: string, coordinator?: string, reminders_sent?: number }[]
  skipped: { id: number, ref_no: string | null, group?: string, reason: string }[]
}

export async function biaGenerateRenewals(sourceIds: number[], _actorName?: string | null): Promise<BiaGenerateResult> {
  const result = await $fetch<BiaGenerateResult>('/api/bianca/monitoring/renewals/generate', {
    method: 'POST',
    body: { ids: sourceIds },
  })
  await refreshNuxtData()
  return result
}

export async function biaRemindRenewals(sourceIds: number[]): Promise<BiaManualRemindResult> {
  const result = await $fetch<BiaManualRemindResult>('/api/bianca/monitoring/renewals/remind', {
    method: 'POST',
    body: { ids: sourceIds },
  })
  await refreshNuxtData()
  return result
}

export async function biaRemindBottlenecks(biaIds: number[]): Promise<BiaManualRemindResult> {
  const result = await $fetch<BiaManualRemindResult>('/api/bianca/monitoring/bottlenecks/remind', {
    method: 'POST',
    body: { ids: biaIds },
  })
  await refreshNuxtData()
  return result
}
