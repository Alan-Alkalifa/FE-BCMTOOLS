import { expect, test, type Page } from '@playwright/test'
import { signIn, ALL_PERMISSIONS } from '../fixtures/auth'

test.setTimeout(90_000)

const BIANCA_PERMISSIONS = [
  ...ALL_PERMISSIONS,
  'bianca.access',
  'bianca.create',
  'bianca.view_all',
  'bianca.monitor',
  'bianca.report.download',
  'bianca.approval.manage',
  'bianca.settings.manage',
  'bianca.config.view',
]

function makeLookups() {
  return {
    periods: ['4 hours', 'Day 1', 'Day 2', 'Day 3', 'Week 1', 'Week 2', 'Week 3', 'Week 4'],
    suggested_mtd: ['4 hours', '1 day', '2 days', '5 days'],
    expected_mtd: [
      { value: '4 hours', category: 'Business Critical' },
      { value: '1 day', category: 'Important' },
      { value: '5 days', category: 'Others' },
    ],
    dependency_mtd: ['4 hours', '1 day', 'NA', 'SLA'],
    percentages: ['0%', '50%', '100%'],
    upstream_capacity: ['0%', '50%', '100%', 'NA', 'SLA'],
    yes_no: ['Yes', 'No'],
    downstream_capacity: ['0%', '50%', '100%', 'NA', 'SLA'],
    generic_values: ['0%', '50%', '100%', 'NA', 'SLA'],
    expected_support_capacity: ['0%', '50%', '100%', 'NA', 'SLA'],
    financial_bands: [{ code: 'very_high', label: 'Very High', description: 'IDR 4 Billion' }],
    impact_matrix: [{ score: 3, regulatory: 'Breach of laws', customer: '>20% affected' }],
    system_usage: ['Minimal Dependency', 'Full Dependency', 'Partial Dependency'],
    alt_site_strategies: ['Work From Home', 'Hyspace'],
    frequencies: ['Daily'],
    scores: [1, 2, 3],
    loss_alert_idr: 4_000_000_000,
    score_alert: 3,
    hours_per_day: 24,
    days_per_week: 7,
    max_functions: 30,
    it_slots: 4,
    dependency_slots: 4,
    personnel_grades: [
      { code: 'staff_senior', label: 'Senior Management', min_level: 1, max_level: 3, active: true, requires_note: false },
      { code: 'staff_middle', label: 'Middle Management', min_level: 4, max_level: 5, active: true, requires_note: false },
      { code: 'staff_manager', label: 'Executive–Manager', min_level: 6, max_level: 9, active: true, requires_note: false },
      { code: 'staff_non_staff', label: 'Non Staff–Staff', min_level: 10, max_level: 11, active: true, requires_note: false },
      { code: 'staff_others', label: 'Others', min_level: null, max_level: null, active: true, requires_note: true },
    ],
    staff_grades: {},
    list_items: {
      suggested_mtd: [{ value: '4 hours', active: true }, { value: '1 day', active: true }],
      expected_mtd: [{ value: '4 hours', category: 'Business Critical', active: true }],
      dependency_mtd: [{ value: '4 hours', active: true }, { value: 'NA', active: true }],
      upstream_capacity: [{ value: '100%', active: true }, { value: 'NA', active: true }],
      downstream_capacity: [{ value: '100%', active: true }, { value: 'NA', active: true }],
      expected_support_capacity: [{ value: '100%', active: true }, { value: 'NA', active: true }],
      system_usage: [{ value: 'Full Dependency', active: true }],
      alt_site_strategies: [{ value: 'Work From Home', active: true }, { value: 'Hyspace', active: true }],
      frequencies: [{ value: 'Daily', active: true }],
      yes_no: [{ value: 'Yes', active: true }, { value: 'No', active: true }],
    },
    signoff_steps: [
      { code: 'bcm_coordinator', title: 'BCM Coordinator / RTF', required: true, signer_mode: 'creator', user_id: 1 },
      { code: 'group_head', title: 'Group Head / IMT', required: true, signer_mode: 'chosen', user_id: 2 },
      { code: 'head_of', title: 'Head of', required: true, signer_mode: 'chosen', user_id: 3 },
      { code: 'bcm_head', title: 'BCM Head', required: true, signer_mode: 'chosen', user_id: 4 },
    ],
    guides: { attestation: 'I confirm this BIA.', suggested_mtd: 'Follow workbook guide.' },
    config_version_id: 1,
    config_version: 'V1',
    organisation: { directorate: 'Retail Banking', sub_directorate: 'Digital Banking', org_group: 'Digital Channels Group' },
  }
}

function makeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ref_no: 'BIA-2026-0001',
    directorate: 'Retail Banking',
    sub_directorate: 'Digital Banking',
    org_group: 'Digital Channels Group',
    status: 'draft',
    pending_role: null,
    in_revision: false,
    input_method: 'web',
    functions: [
      {
        name: 'OCTO Mobile Onboarding',
        loss: [1_500_000_000, 4_500_000_000, 6_000_000_000, 8_000_000_000, 12_000_000_000, 15_000_000_000, 18_000_000_000, 20_000_000_000],
        regulatory_scores: [3, 3, 3, 3, 3, 3, 3, 3],
        customer_scores: [2, 2, 3, 3, 3, 3, 3, 3],
        suggested_mtd: '4 hours',
        expected_mtd: '4 hours',
        planned_capacity: '100%',
        it_dependencies: [],
        dependencies: [],
        total_staff: 10,
        staff_required: 5,
        recovery_level: 'Work From Home',
        prioritization_strategy: 'Prioritize critical onboarding',
        outstanding_strategy: 'Queue offline requests',
        alt_site_strategy: 'Work From Home',
        seats_current: 10,
        seats_required: 5,
        res_pc: 5,
        res_phone: 2,
        res_fax: 0,
        res_copier: 0,
        res_others: '',
        vital_record: 'Onboarding logs',
        vital_record_location: 'Cloud Archive',
        description: 'Mobile customer registration',
        frequency: 'Daily',
        critical_timings: '08:00-17:00',
        critical_activity: 'KYC verification',
        category: 'Business Critical',
        within_suggested_mtd: true,
      },
      {
        name: 'QRIS Settlement',
        loss: [200_000_000, 600_000_000, 1_200_000_000, 2_000_000_000, 3_200_000_000, 5_000_000_000, 7_500_000_000, 10_000_000_000],
        regulatory_scores: [2, 2, 3, 3, 3, 3, 3, 3],
        customer_scores: [2, 2, 2, 3, 3, 3, 3, 3],
        suggested_mtd: '4 hours',
        expected_mtd: '4 hours',
        planned_capacity: '100%',
        it_dependencies: [],
        dependencies: [],
        total_staff: 8,
        staff_required: 4,
        recovery_level: 'Work From Home',
        prioritization_strategy: 'Batch reconcile',
        outstanding_strategy: 'Reprocess backlog',
        alt_site_strategy: 'Work From Home',
        seats_current: 8,
        seats_required: 4,
        res_pc: 4,
        res_phone: 1,
        res_fax: 0,
        res_copier: 0,
        res_others: '',
        vital_record: 'Settlement reports',
        vital_record_location: 'Cloud Archive',
        description: 'Merchant settlement',
        frequency: 'Daily',
        critical_timings: 'End of day',
        critical_activity: 'Clearing',
        category: 'Business Critical',
        within_suggested_mtd: true,
      },
    ],
    highest_category: 'Business Critical',
    shortest_mtd: '4 hours',
    created_at: '2026-11-01T09:00:00Z',
    submitted_at: null,
    finalised_at: null,
    updated_at: '2026-11-25T09:00:00Z',
    created_by: 'Test User',
    created_by_id: 1,
    renewal_of: null,
    personnel_counts: { staff_senior: 1, staff_middle: 2, staff_manager: 3, staff_non_staff: 4, staff_others: 0 },
    personnel_notes: {},
    signoff_users: { group_head: 2, head_of: 3, bcm_head: 4 },
    group_description: 'Digital banking group',
    main_location_id: 1,
    main_location_mode: null,
    main_floor: '12',
    alt_location_id: null,
    alt_location_mode: 'work_from_home',
    alt_floor: null,
    recovery_strategy: 'Work from home & alternate site',
    bcm_coordinator_id: 1,
    bcm_alternate_id: null,
    bcm_coordinator: 'Test User',
    bcm_coordinator_nik: 'NIK001',
    bcm_coordinator_phone: '081111111',
    bcm_coordinator_phone_2: null,
    bcm_coordinator_email: 'test@example.com',
    bcm_alternate: null,
    bcm_alternate_nik: null,
    bcm_alternate_phone: null,
    bcm_alternate_phone_2: null,
    bcm_alternate_email: null,
    ra_considers_bc: true,
    ra_tools: 'BCM Checklist',
    ra_controls_included: true,
    ra_justification: 'Reviewed',
    staff_senior: 1,
    staff_middle: 2,
    staff_manager: 3,
    staff_non_staff: 4,
    staff_others: 0,
    staff_others_note: null,
    ra_completed: true,
    loss_formula: 'Sum of hourly loss',
    justification_regulatory: 'BI compliance',
    justification_customer: 'High customer impact',
    justification_rto: 'Aligned with IT RTO',
    justification_dependency: 'Covered by SLA',
    config_version_id: 1,
    config_version: 'V1',
    org_structure: null,
    signoffs: [
      { role: 'bcm_coordinator', title: 'BCM Coordinator / RTF', order: 1, required: true, user_id: 1, name: 'Test User', designation: 'Coordinator', status: 'approved', decided_at: '2026-11-10T08:00:00Z', decision_note: null, current: false },
      { role: 'group_head', title: 'Group Head / IMT', order: 2, required: true, user_id: 2, name: 'Group Head User', designation: 'Group Head', status: 'pending', decided_at: null, decision_note: null, current: true },
      { role: 'head_of', title: 'Head of', order: 3, required: true, user_id: 3, name: 'Head Of User', designation: 'Head', status: 'pending', decided_at: null, decision_note: null, current: false },
      { role: 'bcm_head', title: 'BCM Head', order: 4, required: true, user_id: 4, name: 'BCM Head User', designation: 'BCM Head', status: 'pending', decided_at: null, decision_note: null, current: false },
    ],
    can_decide: false,
    main_location: { id: 1, label: 'Menara Sudirman (HO-01)', address: 'Jl. Sudirman' },
    bcm_coordinator_user: { id: 1, display_name: 'Test User', email: 'test@example.com' },
    bcm_alternate_user: null,
    alt_location: null,
    total_staff: 10,
    loss_totals: [1_700_000_000, 5_100_000_000, 7_200_000_000, 10_000_000_000, 15_200_000_000, 20_000_000_000, 25_500_000_000, 30_000_000_000],
    loss_alerts: [false, true, true, true, true, true, true, true],
    events: [],
    problems: [],
    warnings: [],
    gaps: { details: [], impact: [], dependencies: [], recovery: [] },
    approval_problems: [],
    can_edit: true,
    can_delete: true,
    my_role: 'owner',
    comments: [],
    can_comment: true,
    renewal_due: null,
    can_renew: false,
    renewal: null,
    ...overrides,
  }
}

async function setupBiancaMocks(page: Page, initial = makeAssessment()) {
  let current = initial
  const lookups = makeLookups()

  await page.route('**/api/users?*', (route) => route.fulfill({
    json: {
      items: [
        { id: 1, username: 'test@example.com', display_name: 'Test User', email: 'test@example.com', job_title: 'Coordinator' },
        { id: 2, username: 'gh@example.com', display_name: 'Group Head User', email: 'gh@example.com', job_title: 'Group Head' },
        { id: 3, username: 'ho@example.com', display_name: 'Head Of User', email: 'ho@example.com', job_title: 'Head of' },
        { id: 4, username: 'bcm@example.com', display_name: 'BCM Head User', email: 'bcm@example.com', job_title: 'BCM Head' },
      ],
    },
  }))

  await page.route('**/api/bianca/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    if (path === '/api/bianca/lookups') return route.fulfill({ json: lookups })
    if (path === '/api/bianca/org-options') {
      return route.fulfill({
        json: {
          directorates: ['Retail Banking'],
          sub_directorates: ['Digital Banking'],
          groups: ['Digital Channels Group'],
        },
      })
    }
    if (path === '/api/bianca/locations') {
      return route.fulfill({ json: { items: [{ id: 1, label: 'Menara Sudirman (HO-01)', address: 'Jl. Sudirman' }] } })
    }
    if (path === '/api/bianca/applications') {
      return route.fulfill({ json: { items: [] } })
    }
    if (path === '/api/bianca/calculate') {
      return route.fulfill({
        json: {
          functions: current.functions,
          total_staff: 10,
          loss_totals: current.loss_totals,
          loss_alerts: current.loss_alerts,
        },
      })
    }
    if (path === '/api/bianca/assessments' && method === 'GET') {
      return route.fulfill({
        json: {
          items: [
            {
              id: current.id,
              ref_no: current.ref_no,
              directorate: current.directorate,
              sub_directorate: current.sub_directorate,
              org_group: current.org_group,
              status: current.status,
              pending_role: current.pending_role,
              in_revision: current.in_revision,
              input_method: current.input_method,
              functions: current.functions.length,
              highest_category: current.highest_category,
              shortest_mtd: current.shortest_mtd,
              created_by: current.created_by,
              my_role: 'owner',
              renewal_of: null,
              due_date: null,
              next_step: 'Submit for approval',
              updated_at: current.updated_at,
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/assessments/1' && method === 'GET') {
      return route.fulfill({ json: current })
    }
    if (path === '/api/bianca/assessments/1' && method === 'PUT') {
      const body = route.request().postDataJSON()
      current = { ...current, ...body, updated_at: '2026-11-25T10:00:00Z' }
      return route.fulfill({ json: current })
    }
    if (path === '/api/bianca/assessments/1/submit' && method === 'POST') {
      current = { ...current, status: 'in_approval', pending_role: 'group_head', can_edit: false, can_decide: true, submitted_at: '2026-11-25T10:05:00Z' }
      return route.fulfill({ json: current })
    }
    if (path === '/api/bianca/assessments/1/reject' && method === 'POST') {
      const body = route.request().postDataJSON()
      current = {
        ...current,
        status: 'draft',
        in_revision: true,
        pending_role: null,
        can_decide: false,
        can_edit: true,
        signoffs: current.signoffs.map((s) => (s.role === 'group_head' ? { ...s, status: 'rejected', decision_note: body.note, current: false } : s)),
      }
      return route.fulfill({ json: current })
    }
    if (path === '/api/bianca/assessments/1/approve' && method === 'POST') {
      current = {
        ...current,
        status: 'final',
        pending_role: null,
        can_decide: false,
        can_edit: false,
        finalised_at: '2026-11-25T10:15:00Z',
        signoffs: current.signoffs.map((s) => ({ ...s, status: 'approved', current: false })),
      }
      return route.fulfill({ json: current })
    }
    if (path === '/api/bianca/assessments/1/export') {
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('PK\x03\x04mock-xlsx'),
      })
    }
    if (path === '/api/bianca/assessments/1/report.pdf') {
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4\n%mock'),
      })
    }
    if (path === '/api/bianca/approvals/inbox') {
      return route.fulfill({
        json: {
          items: [
            {
              id: 1,
              ref_no: 'BIA-2026-0001',
              directorate: 'Retail Banking',
              sub_directorate: 'Digital Banking',
              org_group: 'Digital Channels Group',
              functions: 2,
              highest_category: 'Business Critical',
              step: 'group_head',
              step_title: 'Group Head / IMT',
              my_step: 'group_head',
              my_step_title: 'Group Head / IMT',
              submitted_by: 'Test User',
              submitted_at: '2026-11-25T09:00:00Z',
              pending_since: '2026-11-25T09:00:00Z',
              working_days_waiting: 2,
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/approvals/upcoming') {
      return route.fulfill({ json: { items: [], page: 1, per_page: 10, total: 0, pages: 0 } })
    }
    if (path === '/api/bianca/approvals/history') {
      return route.fulfill({
        json: {
          items: [
            {
              id: 10,
              action: 'approved',
              role: 'group_head',
              role_title: 'Group Head / IMT',
              note: 'Looks complete',
              at: '2026-11-24T09:00:00Z',
              assessment: {
                id: 1,
                ref_no: 'BIA-2026-0001',
                org_group: 'Digital Channels Group',
                directorate: 'Retail Banking',
                status: 'final',
                pending_role: null,
                in_revision: false,
              },
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/approvals/board') {
      return route.fulfill({
        json: {
          items: [
            {
              id: 1,
              ref_no: 'BIA-2026-0001',
              directorate: 'Retail Banking',
              sub_directorate: 'Digital Banking',
              org_group: 'Digital Channels Group',
              highest_category: 'Business Critical',
              step: 'group_head',
              step_title: 'Group Head / IMT',
              approver: 'Group Head User',
              approver_id: 2,
              level: 'escalated',
              waiting_since: '2026-11-10',
              working_days_waiting: 10,
              reminders_sent: 2,
              escalated_at: '2026-11-19',
              can_act: true,
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/monitoring/org-values') {
      return route.fulfill({
        json: {
          directorates: ['Retail Banking'],
          sub_directorates: ['Digital Banking'],
          groups: ['Digital Channels Group'],
        },
      })
    }
    if (path === '/api/bianca/monitoring/overview') {
      return route.fulfill({
        json: {
          cards: {
            groups: 16,
            assessed: 7,
            not_assessed: 9,
            drafts: 6,
            waiting_submission: 6,
            need_revision: 1,
            in_revision: 1,
            returned: 2,
            in_signoff: 1,
            waiting_approval: 0,
            waiting_group_head: 0,
            waiting_head_of: 0,
            waiting_bcm_head: 0,
            full_approved: 2,
            expired: 3,
            cancelled: 0,
            overdue_renewals: 3,
            due_30: 2,
            due_60: 0,
            due_90: 0,
            due_in_90_days: 5,
            business_critical: 5,
            stuck_approvals: 1,
          },
          by_status_group: [
            { group: 'draft', label: 'Draft', count: 8 },
            { group: 'in_approval', label: 'In Approval', count: 1 },
            { group: 'final', label: 'Final', count: 2 },
            { group: 'in_renewal', label: 'In Renewal', count: 5 },
          ],
          by_category: [
            { category: 'Business Critical', groups: 5 },
            { category: 'Important', groups: 3 },
            { category: 'Others', groups: 2 },
            { category: 'none', groups: 0 },
          ],
          approved_per_month: [
            { month: '2026-11', assessments: 2 },
          ],
        },
      })
    }
    if (path === '/api/bianca/monitoring/renewals') {
      return route.fulfill({
        json: {
          items: [
            {
              group: { id: 10, code: 'GRP-DCG-05', name: 'Digital Channels Group', directorate: 'Retail Banking', sub_directorate: 'Digital Banking', main_building: 'Menara Sudirman', alt_building: '—' },
              approved: { id: 1, ref_no: 'BIA-2025-0001', raw_status: 'final', status: 'approved', status_group: 'in_renewal', status_group_label: 'In Renewal', status_detail: 'overdue', status_detail_label: 'Overdue', highest_category: 'Business Critical', shortest_mtd: '4 hours', function_count: 2, approved_at: '2025-10-01', created_at: '2025-09-15' },
              open: null,
              renewal_date: '2026-10-01',
              days_left: -45,
              bucket: 'overdue',
              assessor: 'Test User',
              alt_coordinator: null,
              can_generate: true,
              group_users: [],
              directorate_users: [],
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
          counts: { overdue: 3, due_30: 2, due_60: 0, due_90: 0 },
        },
      })
    }
    if (path === '/api/bianca/monitoring/directorates') {
      return route.fulfill({
        json: {
          items: [
            {
              name: 'Retail Banking',
              sub_directorate_count: 1,
              group_count: 1,
              coverage: { valid_final: 0, total_final: 1, total: 1, pct: 0, overdue: 1, due_soon: 0, no_final: 0 },
              status_counts: { approved: 0, renewal_due: 0, due_soon: 0, overdue: 1, no_final: 0, not_started: 0 },
              open_counts: { total: 1, in_signoff: 1, draft: 0, returned: 0, longest_working_days: 10 },
              alerts: [{ key: 'overdue', count: 1, severity: 'error', groups: ['Digital Channels Group'] }],
              needs_attention: true,
              severity: 'error',
              highest_category: 'Business Critical',
              critical_count: 1,
              category_counts: { critical: 1, important: 0, others: 0 },
              shortest_mtd: '4 hours',
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
          total_directorates: 1,
          total_groups: 1,
          attention_directorates: 1,
          escalation_days: 7,
          summary: { total_groups: 1, valid_final: 0, overdue: 1, returned: 0, stuck: 1, due_soon: 0, not_started: 0, as_of: '2026-11-25' },
        },
      })
    }
    if (path === '/api/bianca/monitoring/register') {
      return route.fulfill({
        json: {
          items: [
            {
              group: { id: 10, code: 'GRP-DCG-05', name: 'Digital Channels Group', directorate: 'Retail Banking', sub_directorate: 'Digital Banking', main_building: 'Menara Sudirman', alt_building: '—' },
              group_status: 'in_signoff',
              group_status_label: 'In Approval',
              approved: { id: 1, ref_no: 'BIA-2025-0001', raw_status: 'final', status: 'approved', status_group: 'in_renewal', status_group_label: 'In Renewal', status_detail: 'overdue', status_detail_label: 'Overdue', highest_category: 'Business Critical', shortest_mtd: '4 hours', function_count: 2, approved_at: '2025-10-01', created_at: '2025-09-15' },
              open: { id: 4, ref_no: 'BIA-2026-0002', raw_status: 'in_approval', status: 'in_signoff', status_group: 'in_approval', status_group_label: 'In Approval', status_detail: 'escalated', status_detail_label: 'Escalated', is_returned: false, current_step_title: 'Group Head / IMT', highest_category: 'Business Critical', shortest_mtd: '4 hours', function_count: 2, approved_at: null, created_at: '2026-11-01' },
              assessment_count: 2,
              renewal_date: '2026-10-01',
              days_left: -45,
              bucket: 'overdue',
              assessor: 'Test User',
              alt_coordinator: null,
              can_generate: false,
              stuck_approval: true,
              history: [
                { id: 4, ref_no: 'BIA-2026-0002', raw_status: 'in_approval', status: 'in_signoff', status_group: 'in_approval', status_group_label: 'In Approval', status_detail: 'escalated', status_detail_label: 'Escalated', reason: 'annual_review', highest_category: 'Business Critical', shortest_mtd: '4 hours', function_count: 2, approved_at: null, created_at: '2026-11-01' },
                { id: 1, ref_no: 'BIA-2025-0001', raw_status: 'final', status: 'approved', status_group: 'in_renewal', status_group_label: 'In Renewal', status_detail: 'overdue', status_detail_label: 'Overdue', reason: 'new_group', highest_category: 'Business Critical', shortest_mtd: '4 hours', function_count: 2, approved_at: '2025-10-01', created_at: '2025-09-15' },
              ],
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/monitoring/assessments') {
      return route.fulfill({
        json: {
          items: [
            {
              id: 4,
              ref_no: 'BIA-2026-0002',
              raw_status: 'in_approval',
              status: 'in_signoff',
              status_group: 'in_approval',
              status_group_label: 'In Approval',
              status_detail: 'escalated',
              status_detail_label: 'Escalated',
              reason: 'annual_review',
              current_step_title: 'Group Head / IMT',
              highest_category: 'Business Critical',
              shortest_mtd: '4 hours',
              function_count: 2,
              approved_at: null,
              created_at: '2026-11-01',
              group: { id: 10, code: 'GRP-DCG-05', name: 'Digital Channels Group', directorate: 'Retail Banking', sub_directorate: 'Digital Banking', main_building: 'Menara Sudirman', alt_building: '—' },
              renewal_date: null,
              days_left: null,
              bucket: null,
              assessor: 'Test User',
              alt_coordinator: null,
            },
            {
              id: 1,
              ref_no: 'BIA-2025-0001',
              raw_status: 'final',
              status: 'approved',
              status_group: 'final',
              status_group_label: 'Final',
              status_detail: 'expired',
              status_detail_label: 'Expired',
              reason: 'new_group',
              current_step_title: null,
              highest_category: 'Business Critical',
              shortest_mtd: '4 hours',
              function_count: 2,
              approved_at: '2025-10-01',
              created_at: '2025-09-15',
              group: { id: 10, code: 'GRP-DCG-05', name: 'Digital Channels Group', directorate: 'Retail Banking', sub_directorate: 'Digital Banking', main_building: 'Menara Sudirman', alt_building: '—' },
              renewal_date: null,
              days_left: null,
              bucket: null,
              assessor: 'Test User',
              alt_coordinator: null,
            },
          ],
          page: 1,
          per_page: 20,
          total: 2,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/monitoring/bottlenecks') {
      return route.fulfill({
        json: {
          items: [
            {
              id: 4,
              ref_no: 'BIA-2026-0002',
              group: { id: 10, code: 'GRP-DCG-05', name: 'Digital Channels Group', directorate: 'Retail Banking', sub_directorate: 'Digital Banking', main_building: 'Menara Sudirman', alt_building: '—' },
              step: 'group_head',
              step_title: 'Group Head / IMT',
              signer: { id: 2, name: 'Group Head User', email: 'gh@example.com' },
              level: 'escalated',
              waiting_since: '2026-11-10',
              working_days_waiting: 10,
              reminders_sent: 2,
              escalated_at: '2026-11-19',
              working_days_in_signoff: 10,
              can_remind: true,
              highest_category: 'Business Critical',
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          pages: 1,
        },
      })
    }
    if (path === '/api/bianca/monitoring/bottlenecks/step-averages') {
      return route.fulfill({
        json: {
          items: [{ step: 'group_head', step_title: 'Group Head / IMT', approvals: 4, average_working_days: 3.5 }],
        },
      })
    }
    if (path === '/api/bianca/monitoring/assessments/4') {
      return route.fulfill({
        json: {
          id: 4,
          ref_no: 'BIA-2026-0002',
          config_version_id: 1,
          config_version: 'V1',
          group: {
            id: 10,
            code: 'GRP-DCG-05',
            name: 'Digital Channels Group',
            directorate: 'Retail Banking',
            sub_directorate: 'Digital Banking',
            main_building: 'Menara Sudirman',
            alt_building: 'Work From Home',
            description: 'Digital channels unit',
            main_address: 'Jl. Sudirman',
            alt_address: 'Work From Home',
            recovery_strategy: 'Alternate site & WFH',
          },
          coordinator: { id: 1, name: 'Test User', nik: 'NIK001', email: 'test@example.com', phone: '081111111', phone_2: null },
          alt_coordinator: { id: null, name: '—', nik: '—', email: '—', phone: '—', phone_2: null },
          period_year: 2026,
          assessment_date: '2026-11-01',
          reason: 'annual_review',
          status: 'in_signoff',
          status_group: 'in_approval',
          status_group_label: 'In Approval',
          status_detail: 'escalated',
          status_detail_label: 'Escalated',
          raw_status: 'in_approval',
          can_edit: false,
          current_signoff_role: 'group_head',
          current_step_title: 'Group Head / IMT',
          highest_category: 'Business Critical',
          shortest_mtd: '4 hours',
          function_count: 1,
          created_by: 'Test User',
          approved_at: null,
          renewal_date: null,
          days_left: null,
          bucket: null,
          assessor: 'Test User',
          periods: ['4 hours', 'Day 1'],
          ra_questionnaire: {
            considered_bc: 'Yes',
            considered_bc_flag: true,
            tools_used: 'ORMS',
            controls_included: 'Yes',
            controls_included_flag: true,
            ra_justification_required: false,
            location_ra_completed: 'Yes',
            location_ra_completed_flag: true,
            senior_mgmt: 1,
            middle_mgmt: 2,
            executive_mgr: 3,
            staff: 4,
            others: 0,
            others_note: null,
            personnel_breakdown: [
              { code: 'staff_senior', label: 'Senior Management', count: 1, note: null },
            ],
            total_staff: 10,
          },
          impact_reference: {
            loss_alert_idr: 4_000_000_000,
            score_alert: 3,
            scores: [1, 2, 3],
            financial_bands: [],
            impact_matrix: [],
            expected_mtd: [{ value: '4 hours', category: 'Business Critical' }],
            alternate_site_by_category: { 'Business Critical': ['Work From Home'] },
          },
          guides: { attestation: 'I confirm this BIA.' },
          loss_totals: { fin_loss_4h: 1_500_000_000, fin_loss_d1: 4_500_000_000, fin_loss_w1: 12_000_000_000, fin_loss_w4: 20_000_000_000, peak_loss: 20_000_000_000, peak_period: 'Day 1' },
          notes: {},
          gaps: {
            details: ['Missing alternate phone.'],
            impact: ['Function 1 (OCTO Mobile Onboarding): Expected MTD (1 day) is longer than Suggested MTD (4 hours).'],
            dependencies: ['Function 1 (OCTO Mobile Onboarding) > Core Banking: Negative DAAT (-1 day).'],
            recovery: ['Function 1 (OCTO Mobile Onboarding): BCP seat shortage of 2 seats at alternate site (current 4, required 6).'],
          },
          functions: [
            {
              seq_no: 1,
              name: 'OCTO Mobile Onboarding',
              category: 'Business Critical',
              planned_capacity: '100%',
              suggested_mtd: '4 hours',
              expected_mtd: '1 day',
              expected_within_suggested: false,
              suggested_mtd_matches: true,
              total_staff: 10,
              required_staff: 5,
              recovery_level: '50%',
              prioritization_strategy: 'Prioritize critical onboarding',
              outstanding_strategy: 'Queue requests',
              alt_site_strategy: 'Hyspace',
              alt_site_strategy_code: 'Hyspace',
              is_wfh: false,
              bcp_seats_current: 4,
              bcp_seats_required: 6,
              equipment: { pc: 4, phone: 2, fax: 0, copier: 0, others: '' },
              vital_record: 'Onboarding logs',
              vital_record_location: 'Cloud Archive',
              losses: [1_500_000_000, 4_500_000_000],
              reg_scores: [3, 3],
              cust_scores: [2, 3],
              reg_score_max: 3,
              cust_score_max: 3,
              peak_loss: 4_500_000_000,
              it_dependencies: [
                {
                  app_code: 'CORE',
                  app_name: 'Core Banking',
                  rto: '2 days',
                  rpo: 'LST',
                  workaround: 'No',
                  backlog_time: '4 hours',
                  daat: '-1 day',
                  daat_negative: true,
                  daat_warnings: ['Negative DAAT (-1 day).'],
                  system_usage: 'Full Dependency',
                  rto_reaches_mtd: true,
                  workaround_gap_required: true,
                  critical_gap: '',
                  is_other: false,
                },
              ],
              non_it_dependencies: [],
            },
          ],
          signoffs: [],
          events: [],
          comments: [],
          group_users: [],
          directorate_users: [],
          org_structure: null,
          renewal_of: null,
        },
      })
    }
    if (path === '/api/bianca/monitoring/history') {
      return route.fulfill({
        json: {
          items: [
            { id: 4, ref_no: 'BIA-2026-0002', reason: 'annual_review', status: 'in_signoff', status_group: 'in_approval', status_group_label: 'In Approval', status_detail: 'escalated', status_detail_label: 'Escalated', assessment_date: '2026-11-01', approved_at: null, highest_category: 'Business Critical', shortest_mtd: '4 hours', assessor: 'Test User', alt_coordinator: null, mark: null },
            { id: 1, ref_no: 'BIA-2025-0001', reason: 'new_group', status: 'approved', status_group: 'final', status_group_label: 'Final', status_detail: 'expired', status_detail_label: 'Expired', assessment_date: '2025-09-15', approved_at: '2025-10-01', highest_category: 'Business Critical', shortest_mtd: '4 hours', assessor: 'Test User', alt_coordinator: null, mark: 'replaced' },
          ],
          page: 1,
          per_page: 20,
          total: 2,
          pages: 1,
        },
      })
    }
    return route.fulfill({ json: { items: [] } })
  })
}

test('Manage -> Edit/Submit -> Report PDF & Excel buttons work without regressions', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  await signIn(page, { permissions: BIANCA_PERMISSIONS })
  await setupBiancaMocks(page, makeAssessment({ status: 'draft' }))

  await page.goto('/bianca/manage')
  await expect(page.getByRole('link', { name: 'BIA-2026-0001' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('link', { name: 'BIA-2026-0001' }).click()
  await expect(page).toHaveURL(/\/bianca\/manage\/1/)
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible({ timeout: 45_000 })

  const putPromise = page.waitForRequest((req) => req.method() === 'PUT' && req.url().endsWith('/api/bianca/assessments/1'))
  await page.getByRole('button', { name: 'Save draft' }).click()
  await putPromise

  // Navigate to Report on a submitted BIA to verify Download PDF & independent Excel export buttons
  await setupBiancaMocks(page, makeAssessment({ status: 'in_approval', pending_role: 'group_head', can_edit: false, can_decide: true }))
  await page.goto('/bianca/report/1')
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible({ timeout: 45_000 })
  const exportAllBtn = page.getByRole('button', { name: 'Export all to Excel' })
  const exportFnBtn = page.getByRole('button', { name: 'Export this function to Excel' })
  await expect(exportAllBtn).toBeVisible()
  await expect(exportFnBtn).toBeVisible()

  const exportFnReq = page.waitForRequest((req) => req.url().includes('/api/bianca/assessments/1/export?functions=1'))
  await exportFnBtn.click()
  await exportFnReq

  const exportAllReq = page.waitForRequest((req) => req.url().endsWith('/api/bianca/assessments/1/export'))
  await exportAllBtn.click()
  await exportAllReq

  const pdfReq = page.waitForRequest((req) => req.url().endsWith('/api/bianca/assessments/1/report.pdf'))
  await page.getByRole('button', { name: 'Download PDF' }).click()
  await pdfReq

  expect(pageErrors).toEqual([])
})

test('Approval Inbox, History, BCM Board exports and Return/Approve flow', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  await signIn(page, { permissions: BIANCA_PERMISSIONS })
  await setupBiancaMocks(page, makeAssessment({ status: 'in_approval', pending_role: 'group_head', can_edit: false, can_decide: true }))

  await page.goto('/bianca/approval')
  await expect(page.getByRole('heading', { name: 'Waiting for my sign-off' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/bianca/approvals/inbox.xlsx')

  await page.getByRole('tab', { name: 'My history' }).click()
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/bianca/approvals/history.xlsx')

  await page.getByRole('tab', { name: 'BCM board' }).click()
  await expect(page.getByRole('columnheader', { name: 'Assess since' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Assess days' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/bianca/approvals/board.xlsx')

  await page.goto('/bianca/approval/1')
  await expect(page.getByRole('button', { name: 'Return for changes' })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Return for changes' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Return for changes' }).click()
  await expect(page.getByText('Say what has to change.')).toBeVisible()
  await dialog.getByRole('textbox').fill('Please attach org structure')
  const rejectReq = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/bianca/assessments/1/reject'))
  await dialog.getByRole('button', { name: 'Return for changes' }).click()
  expect((await rejectReq).postDataJSON().note).toBe('Please attach org structure')

  expect(pageErrors).toEqual([])
})

test('Monitoring Overview, Renewals, List (By directorate / All groups / All BIA), Approval, and Gap Summary', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  await signIn(page, { permissions: BIANCA_PERMISSIONS })
  await setupBiancaMocks(page)

  // Overview
  await page.goto('/bianca/monitoring')
  await expect(page.getByText('BIA status by group')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('4 standardized status groups across 16 groups.')).toBeVisible()
  await expect(page.getByRole('link', { name: /In Approval: 1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Escalated: 1/ })).toBeVisible()
  await expect(page.getByText('Groups by highest category')).toBeVisible()

  // Renewals
  await page.getByRole('tab', { name: 'Renewals' }).click()
  const renewalsPanel = page.getByRole('tabpanel', { name: 'Renewals' })
  await expect(renewalsPanel.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/bianca/monitoring/export.xlsx?tab=renewals')

  // List: All groups -> By directorate -> All BIA
  await page.getByRole('tab', { name: 'List' }).click()
  const listPanel = page.getByRole('tabpanel', { name: 'List' })
  await expect(listPanel.getByRole('columnheader', { name: 'Open BIA' })).toBeVisible()
  await expect(listPanel.getByText('GRP-DCG-05')).toBeVisible()
  await expect(listPanel.getByText('BIA-2026-0002').first()).toBeVisible()

  // History dialog
  await listPanel.getByRole('button', { name: /BIA history of Digital Channels Group|2/i }).first().click()
  const historyDialog = page.getByRole('dialog', { name: 'BIAs of Digital Channels Group' })
  await expect(historyDialog).toBeVisible()
  await expect(historyDialog.getByText('Expired', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await listPanel.getByRole('button', { name: 'By directorate', exact: true }).click()
  await expect(listPanel.getByRole('columnheader', { name: 'Final coverage' })).toBeVisible()
  await expect(listPanel.getByRole('link', { name: 'Export to Excel' })).toBeVisible()

  await listPanel.getByRole('button', { name: 'All BIA', exact: true }).click()
  await expect(listPanel.getByRole('columnheader', { name: 'BIA ref. no.' })).toBeVisible()
  await expect(listPanel.getByRole('columnheader', { name: 'Open BIA' })).toHaveCount(0)
  await expect(listPanel.getByText('Expired', { exact: true })).toBeVisible()
  await listPanel.getByRole('checkbox', { name: 'Select BIA-2026-0002' }).click()
  await expect(listPanel.getByRole('link', { name: 'Export selected (1)' })).toHaveAttribute('href', '/api/bianca/monitoring/export.xlsx?tab=assessments&bia_ids=4')

  // Open BIA from All BIA -> breadcrumb & back button return to All BIA (not directorate drilldown)
  await listPanel.getByRole('link', { name: 'BIA-2026-0002' }).click()
  await expect(page).toHaveURL(/\/bianca\/monitoring\/4\?from=assessments/)
  await expect(page.getByRole('link', { name: 'Back to All BIA' })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'All BIA' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Retail Banking' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to All BIA' }).click()
  await expect(page).toHaveURL(/\/bianca\/monitoring\?tab=register&view=assessments/)
  await expect(listPanel.getByRole('columnheader', { name: 'BIA ref. no.' })).toBeVisible()

  // Approval bottlenecks tab
  await page.getByRole('tab', { name: 'Approval' }).click()
  const approvalPanel = page.getByRole('tabpanel', { name: 'Approval' })
  await expect(approvalPanel.getByRole('columnheader', { name: 'Assess since' })).toBeVisible()
  await expect(approvalPanel.getByRole('columnheader', { name: 'Assess days' })).toBeVisible()
  await expect(approvalPanel.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/bianca/monitoring/export.xlsx?tab=bottlenecks')

  // Detail Gap check + Check button jump & fade highlight
  await page.goto('/bianca/monitoring/4')
  await expect(page.getByText('Missing alternate phone.')).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText('Function 1 (OCTO Mobile Onboarding) > Core Banking: Negative DAAT (-1 day).')).toBeVisible()

  const checkButtons = page.getByRole('button', { name: 'Check', exact: true })
  await expect(checkButtons).toHaveCount(4)

  // Click Check on Impact gap -> switches to impact tab and flashes the row
  await checkButtons.nth(1).click()
  await expect(page).toHaveURL(/tab=impact/)
  await expect(page.locator('.gap-target-impact-fn-1.gap-flash-row')).toBeVisible()

  // Click Check on Dependencies gap -> switches to dependencies tab and flashes Core Banking row
  await checkButtons.nth(2).click()
  await expect(page).toHaveURL(/tab=dependencies/)
  await expect(page.locator('[data-gap-target="dep-it-1-core-banking"].gap-flash-row')).toBeVisible()

  // Click Check on Recovery gap -> switches to recovery tab and flashes row + BCP seats cell
  await checkButtons.nth(3).click()
  await expect(page).toHaveURL(/tab=recovery/)
  await expect(page.locator('[data-gap-target="recovery-fn-1"].gap-flash-row')).toBeVisible()
  await expect(page.locator('[data-gap-target="recovery-cell-1-seats"].gap-flash-cell')).toBeVisible()

  expect(pageErrors).toEqual([])
})

test('Monitoring detail Appendix supports Export all and Export selected to Excel', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  await signIn(page, { permissions: BIANCA_PERMISSIONS })
  await setupBiancaMocks(page)

  await page.goto('/bianca/monitoring/4?tab=appendix')
  const appendixPanel = page.getByRole('tabpanel', { name: 'Appendix' })
  const exportSelectedBtn = appendixPanel.getByRole('button', { name: /Export .*selected to Excel/ })
  const exportAllBtn = appendixPanel.getByRole('button', { name: 'Export all to Excel' })
  await expect(exportAllBtn).toBeVisible({ timeout: 45_000 })
  await expect(exportSelectedBtn).toBeDisabled()

  await appendixPanel.getByRole('checkbox', { name: 'Select OCTO Mobile Onboarding' }).click()
  await expect(appendixPanel.getByRole('button', { name: 'Export 1 selected to Excel' })).toBeEnabled()

  const selectedReq = page.waitForRequest((req) => req.url().includes('/api/bianca/assessments/4/export?functions=1'))
  await appendixPanel.getByRole('button', { name: 'Export 1 selected to Excel' }).click()
  await selectedReq

  const allReq = page.waitForRequest((req) => req.url().endsWith('/api/bianca/assessments/4/export'))
  await exportAllBtn.click()
  await allReq

  expect(pageErrors).toEqual([])
})
