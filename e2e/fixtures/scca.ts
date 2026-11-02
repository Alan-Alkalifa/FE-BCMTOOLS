import type { Page } from '@playwright/test'

import { USER, signIn } from './auth'
import { sccaConfig } from './scca-config'

export { USER, signIn }

const CATEGORIES = ['Critical', 'Very Important', 'Important', 'Necessary', 'Other'] as const

const CHART: Record<number, string[]> = {
  5: ['Important', 'Very Important', 'Very Important', 'Critical', 'Critical'],
  4: ['Important', 'Important', 'Very Important', 'Very Important', 'Critical'],
  3: ['Necessary', 'Important', 'Important', 'Important', 'Very Important'],
  2: ['Other', 'Necessary', 'Important', 'Important', 'Important'],
  1: ['Other', 'Other', 'Necessary', 'Important', 'Important'],
}

const QUESTIONS = [
  { code: 'C1', dimension: 'C', options: [5, 3, 1], label: 'Customer Information', component: 'Informasi Nasabah' },
  { code: 'C2', dimension: 'C', options: [5, 4, 3, 1], label: 'Organisation Information', component: 'Informasi organisasi' },
  { code: 'C3', dimension: 'C', options: [5, 3, 1], label: 'System & Operational Information', component: 'Informasi Sistem dan Operasional' },
  { code: 'C4', dimension: 'C', options: [5, 3, 1], label: 'Staff Information', component: 'Informasi Karyawan' },
  { code: 'C5', dimension: 'C', options: [5, 3, 1], label: 'Legal/Requlatory Requirements', component: 'Kepatuhan hukum/ regulasi' },
  { code: 'I1', dimension: 'I', options: [5, 4, 3, 2, 1], label: 'System Change', component: 'Perubahan Sistem' },
  { code: 'I2', dimension: 'I', options: [5, 3, 1], label: 'System Complexity', component: 'Kompleksitas Sistem' },
  { code: 'I3', dimension: 'I', options: [5, 4, 3, 2, 1], label: 'Number of users', component: 'Jumlah User' },
  { code: 'I4', dimension: 'I', options: [5, 4, 3, 2, 1], label: 'System Interfaces', component: 'Konektifitas Sistem (System Interface)' },
  { code: 'I5', dimension: 'I', options: [5, 3, 1], label: 'Information Usage', component: 'Penggunaan Informasi' },
  { code: 'A1', dimension: 'A', options: [5, 4, 3, 1], label: 'Customer Facing Application', component: 'Aplikasi yang berinteraksi langsung dengan nasabah' },
  { code: 'A2', dimension: 'A', options: [5, 3, 1], label: 'Time Sensitivity of transactions', component: 'Sensitifitas Waktu dari Transaksi (Time Sensitivity of Transactions)' },
  { code: 'A3', dimension: 'A', options: [5, 4, 3, 2, 1], label: 'Inter dependency', component: 'Keterkaitan (Inter dependency) dan "Critical Business Function"' },
  { code: 'A4', dimension: 'A', options: [5, 4, 3, 2, 1], label: 'Alternative Solution', component: 'Solusi alternatif' },
  { code: 'P1', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Financial Impact', component: 'Dampak Keuangan (Financial)' },
  { code: 'P2', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Customer Impact', component: 'Dampak terhadap Nasabah (Custumer)' },
  { code: 'P3', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Reputation Impact', component: 'Dampak Reputasi (Reputation)' },
  { code: 'P4', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Regulatory Impact', component: 'Dampak Kepatuhan Regulasi (Regulatory)' },
] as const

export const SAMPLE_RATINGS: Record<string, number> = {
  C1: 5, C2: 1, C3: 3, C4: 3, C5: 5,
  I1: 5, I2: 5, I3: 1, I4: 2, I5: 3,
  A1: 5, A2: 5, A3: 5, A4: 4,
  P1: 3, P2: 4, P3: 2, P4: 5,
}

export const SAMPLE_RESULT = {
  confidentiality_score: 0.88,
  confidentiality_weight_set: 'C:C1=5',
  integrity_score: 0.64,
  availability_score: 0.96,
  cia_score: 0.84,
  cia_level: 5,
  poloss_score: 0.7,
  poloss_weight_set: 'P:TYPE0',
  poloss_level: 4,
  computed_category: 'Critical' as const,
  final_category: 'Critical' as const,
  calculated_at: '2026-03-01T00:00:00Z',
}

export const FORMULA = {
  code: 'V4.2',
  name: 'SCCA Tools V4.2 for CIMB Niaga',
  categories: CATEGORIES,
  questions: QUESTIONS.map((question) => ({
    code: question.code,
    dimension: question.dimension,
    component: question.component,
    label: question.label,
    question: `How would you rate ${question.label.toLowerCase()}?`,
    options: question.options.map((rating) => ({
      rating,
      label: `${rating}.${rating === 5 ? 'Critical' : rating === 4 ? 'Major' : rating === 3 ? 'Moderate' : rating === 2 ? 'Minor' : 'Insignificant'}`,
      guidance: `Guidance for ${question.code} rating ${rating}.`,
    })),
  })),
  thresholds: [5, 4, 3, 2, 1].flatMap((level) => [
    { kind: 'CIA', level, min_score: [0, 0.21, 0.41, 0.61, 0.81][level - 1] },
    { kind: 'POLOSS', level, min_score: [0, 0.21, 0.41, 0.61, 0.81][level - 1] },
  ]),
  matrix: [5, 4, 3, 2, 1].flatMap((poloss) =>
    [1, 2, 3, 4, 5].map((cia) => ({
      cia_level: cia,
      poloss_level: poloss,
      category: CHART[poloss][cia - 1],
    })),
  ),
}

export const STANDARDS = {
  items: [
    { category: 'Critical', mtd: '(0 - 4 jam)', rto: '(0 - 2 jam)', uptime: '99.5%' },
    { category: 'Very Important', mtd: '(4 - 12 jam)', rto: '( 2 - 6 jam)', uptime: '99%' },
    { category: 'Important', mtd: '(12 - 24 jam)', rto: '( 6 - 12 jam)', uptime: '98%' },
    { category: 'Necessary', mtd: '(24 - 48 jam)', rto: '(12 - 24 jam)', uptime: '95% atau kurang' },
    { category: 'Other', mtd: '( > 48 jam)', rto: '( > 24 jam)', uptime: 'Not applicable' },
  ],
}

export const USERS = [
  { id: 1, display_name: 'Cards Owner', email: 'cards@example.com', job_title: 'Owner', department: 'Cards' },
  { id: 2, display_name: 'IT Support', email: 'it@example.com', job_title: 'Engineer', department: 'IT' },
  { id: 3, display_name: 'Retail Lead', email: 'retail@example.com', job_title: 'Lead', department: 'Retail' },
  { id: 4, display_name: 'Bima Reviewer', email: 'bima@example.com', job_title: 'BCM Analyst', department: 'BCM' },
]

export const SIGNOFF_ROLES = [
  'system_user_lead',
  'it_support_pic',
  'bcm_reviewer',
  'enterprise_architecture',
  'service_level_mgmt',
  'app_owner_d2',
  'app_owner_d1',
  'it_support_approval',
  'bcm_acknowledgement',
] as const

export const EDITOR = {
  can_view: true,
  can_edit: true,
  can_set_contributor: true,
  can_submit: true,
  can_decide: false,
  comment_tabs: [] as string[],
}

/** A saved sign-off step for a fixture user. */
export function signoff(role: string, userId: number, extra: Record<string, unknown> = {}) {
  const user = USERS.find((item) => item.id === userId)!
  return {
    role,
    user_id: user.id,
    name: user.display_name,
    designation: user.job_title,
    sub_dir: user.department,
    email: user.email,
    status: null,
    decided_at: null,
    decision_note: null,
    ...extra,
  }
}

/** Every step assigned: Bima is the BCM reviewer, the rest rotate through the other users. */
export function allSignoffs(extra: Record<string, unknown> = {}) {
  return SIGNOFF_ROLES.map((role, index) => signoff(role, role === 'bcm_reviewer' ? 4 : (index % 3) + 1, extra))
}

export function assessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    permissions: { ...EDITOR },
    // The signed-in test user assesses it, so a draft opens in Manage (utils/scca-sections.ts).
    my_role: 'assessor',
    status: 'draft',
    pending_role: null,
    submitted_at: null,
    finalised_at: null,
    assessor_user: { id: 9, display_name: 'Test User', email: 'test@example.com', job_title: null, department: null },
    contributor: null,
    contributor_id: null,
    comments: [] as Record<string, unknown>[],
    events: [] as Record<string, unknown>[],
    formula_version: 'V4.2',
    ref_no: 'SCCA-2026-0001',
    application_code: 'CCOMNI',
    application_name: 'CC Omni Channel',
    application_description: 'Omni channel',
    assessment_reason: 'new_application',
    assessment_date: '2026-03-01',
    due_date: '2028-03-01',
    application_owner: 'Cards',
    it_support: 'IT',
    business_stakeholders: 'Retail',
    assessor: 'BCM',
    country: 'Indonesia',
    vendor_name: null,
    deployment_model: 'On-premise',
    customer_facing: true,
    business_days: 'Mon-Sun',
    business_hours: '00-24',
    override_type: null,
    override_category: null,
    justification: null,
    cim_ref_no: null,
    answers: Object.entries(SAMPLE_RATINGS).map(([code, rating]) => ({
      code,
      rating,
      justification: `Why ${code}`,
    })),
    missing_answers: [],
    result: SAMPLE_RESULT,
    interdependencies: [
      { direction: 'upstream', seq: 1, application_id: 3, system_name: 'Core Banking', criticality_category: 'Critical', rto: '2 hours', rpo: null, dr_capacity: null, processing_mode: 'Online', dependency: 'Full', workaround: null, gaps: null, gaps_note: null },
    ],
    recovery_values: [],
    signoffs: [] as ReturnType<typeof signoff>[],
    created_by: 'Test User',
    updated_by: 'Test User',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

/** Every recovery block an SCCA needs before Submit (Regulatory may stay empty). */
export function completeRecovery() {
  const empty = { availability_sla: null, mtd: null, rto: null, rpo: null, ha: null, dr_capacity: null, instance_type: null, dr_type: null }
  return [
    { ...empty, kind: 'current_it', availability_sla: '99.5', rto: '2', rpo: 'LST', ha: 'Yes (Prod)', dr_capacity: '100', instance_type: 'Different' },
    { ...empty, kind: 'business', availability_sla: '99.5', mtd: '4', rto: '2', rpo: 'LST', dr_capacity: '100' },
    { ...empty, kind: 'regulatory' },
    { ...empty, kind: 'cimbn_standard', availability_sla: '99.5', rto: '2', rpo: 'LST', ha: 'Yes (Prod)', dr_capacity: '100', dr_type: 'Warm DR' },
    { ...empty, kind: 'final', availability_sla: '99.5', mtd: '4', rto: '2', rpo: 'LST', ha: 'Active - Active', dr_capacity: '100%' },
  ]
}

/** An upstream application with every required field. */
export const COMPLETE_INTERDEPENDENCY = {
  direction: 'upstream', seq: 1, application_id: 3, system_name: 'Core Banking', criticality_category: 'Critical', rto: '2', rpo: 'LST', dr_capacity: '100', processing_mode: 'Online', dependency: 'Full', workaround: null, gaps: null, gaps_note: null,
}

export function draft() {
  return assessment({
    answers: [],
    missing_answers: Object.keys(SAMPLE_RATINGS),
    result: {
      confidentiality_score: null,
      confidentiality_weight_set: null,
      integrity_score: null,
      availability_score: null,
      cia_score: null,
      cia_level: null,
      poloss_score: null,
      poloss_weight_set: null,
      poloss_level: null,
      computed_category: null,
      final_category: null,
      calculated_at: null,
    },
  })
}

export const LIST = {
  items: [
    {
      id: 1,
      ref_no: 'SCCA-2026-0001',
      application_code: 'CCOMNI',
      application_name: 'CC Omni Channel',
      assessment_reason: 'annual_review',
      due_date: '2028-03-01',
      application_owner: 'Cards',
      assessment_date: '2026-03-01',
      computed_category: 'Critical',
      final_category: 'Critical',
      is_complete: true,
      status: 'in_approval',
      pending_role: 'bcm_reviewer',
      pending_step: 'Reviewed by BCM Reviewer',
      waiting_for_me: true,
      created_by: 'Test User',
      updated_at: '2026-03-01T00:00:00Z',
      my_role: 'assessor',
      next_step: 'Waiting: BCM Reviewer (Bima Reviewer), 4 working days',
      renewal_of: null,
    },
    {
      id: 2,
      ref_no: 'SCCA-2026-0002',
      application_code: 'HR',
      application_name: 'HR Portal',
      assessment_reason: 'new_application',
      due_date: null,
      application_owner: 'HR',
      assessment_date: null,
      computed_category: null,
      final_category: null,
      is_complete: false,
      status: 'draft',
      pending_role: null,
      pending_step: null,
      waiting_for_me: false,
      created_by: 'Test User',
      updated_at: '2026-03-02T00:00:00Z',
      my_role: 'contributor',
      next_step: 'Rate all 18 questions',
      renewal_of: null,
    },
  ],
  page: 1,
  per_page: 25,
  total: 2,
  pages: 1,
}

const NO_FINAL = { criticality_category: null, rto: null, rpo: null, dr_capacity: null, final: null }

/** GET /api/scca/applications: active applications of the master, with the header of their
 * latest SCCA and their final characteristics. */
export const APPLICATIONS = [
  {
    application_id: 1,
    category: 'Very Important',
    rto_hours: '4',
    rpo: 'LST',
    characteristics: {
      criticality_category: 'Very Important',
      rto: '4',
      rpo: 'LST',
      dr_capacity: '100',
      final: { id: 7, ref_no: 'SCCA-2024-0007', finalised_at: '2024-09-20T03:00:00Z' },
    },
    application_code: 'CCOMNI',
    application_name: 'CC Omni Channel',
    application_description: 'Contact center voice, digital and video banking',
    application_owner: 'Cards Owner',
    it_support: 'IT Support',
    business_stakeholders: 'Retail Lead',
    country: 'Indonesia',
    vendor_name: 'KPSG',
    deployment_model: 'SaaS',
    customer_facing: true,
    business_days: 'Mon-Sun',
    business_hours: '00-24',
    last_assessment: { id: 7, ref_no: 'SCCA-2024-0007', status: 'final', assessment_date: '2024-09-16', due_date: '2026-09-16' },
  },
  {
    application_id: 2,
    category: null,
    rto_hours: null,
    rpo: null,
    characteristics: NO_FINAL,
    application_code: 'HR',
    application_name: 'HR Portal',
    application_description: null,
    application_owner: 'HR Owner',
    it_support: 'IT Support',
    business_stakeholders: 'HR',
    country: 'Indonesia',
    vendor_name: null,
    deployment_model: 'On-premise',
    customer_facing: false,
    business_days: 'Mon-Fri',
    business_hours: '08-18',
    last_assessment: { id: 2, ref_no: 'SCCA-2026-0002', status: 'in_approval', assessment_date: '2026-02-01', due_date: '2028-02-01' },
  },
  {
    application_id: 3,
    category: 'Critical',
    rto_hours: '12',
    rpo: 'LST',
    characteristics: {
      criticality_category: 'Critical',
      rto: '12',
      rpo: 'LST',
      dr_capacity: '100',
      final: { id: 9, ref_no: 'SCCA-2025-0009', finalised_at: '2025-11-02T03:00:00Z' },
    },
    application_code: 'CBS',
    application_name: 'Core Banking',
    application_description: null,
    application_owner: 'Ops Owner',
    it_support: 'IT Support',
    business_stakeholders: 'Operations',
    country: 'Indonesia',
    vendor_name: null,
    deployment_model: 'On-premise',
    customer_facing: false,
    business_days: 'Mon-Fri',
    business_hours: '08-18',
    last_assessment: null,
  },
]

export async function mockScca(page: Page, current = assessment(), config: Record<string, unknown> = sccaConfig()) {
  await signIn(page)
  await page.route('**/api/users**', (route) => route.fulfill({ json: { items: USERS } }))
  await page.route('**/api/scca/formula**', (route) => route.fulfill({ json: FORMULA }))
  await page.route('**/api/scca/recovery-standards**', (route) => route.fulfill({ json: STANDARDS }))
  await page.route('**/api/scca/config**', (route) => route.fulfill({ json: config }))
  await page.route('**/api/scca/applications**', (route) => {
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase()
    const items = APPLICATIONS.filter((row) =>
      `${row.application_code} ${row.application_name}`.toLowerCase().includes(q))
    return route.fulfill({ json: { items } })
  })
  await page.route(/\/api\/applications\/\d+$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').pop())
    const row = APPLICATIONS.find((item) => item.application_id === id)
    return row
      ? route.fulfill({ json: { id, application_code: row.application_code, application_name: row.application_name, characteristics: row.characteristics } })
      : route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  await page.route('**/api/scca/calculate**', (route) =>
    route.fulfill({
      json: { result: { ...SAMPLE_RESULT, category: 'Critical' }, missing: [] },
    }),
  )
  await page.route(/\/api\/scca\/assessments\b/, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const collection = /\/scca\/assessments\/?$/.test(url.pathname)
    if (collection && method === 'POST') {
      await route.fulfill({ status: 201, json: current })
      return
    }
    if (collection && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const category = url.searchParams.get('category')
      let items = LIST.items
      if (q) items = items.filter((item) => item.application_name.toLowerCase().includes(q))
      if (category) items = items.filter((item) => item.final_category === category)
      if (url.searchParams.get('waiting') === '1') items = items.filter((item) => item.waiting_for_me)
      if (url.searchParams.get('needs_action') === '1') items = items.filter((item) => item.status === 'draft')
      const status = url.searchParams.get('status')
      if (status) items = items.filter((item) => item.status === status)
      await route.fulfill({ json: { ...LIST, items, total: items.length } })
      return
    }
    if (url.pathname.endsWith('/renew') && method === 'POST') {
      await route.fulfill({ status: 201, json: { ...current, id: 9, ref_no: 'SCCA-2026-0009', status: 'draft', renewal_of: { id: current.id, ref_no: current.ref_no, status: 'final' } } })
      return
    }
    const action = url.pathname.match(/\/(submit|approve|reject|comments)$/)?.[1]
    if (action && method === 'POST') {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, string | null>
      const now = '2026-03-02T09:00:00Z'
      if (action === 'comments') {
        current.comments = [...current.comments, { id: current.comments.length + 1, tab: body.tab, body: body.body, author: USER.name, author_role: 'bcm_reviewer', created_at: now }]
        await route.fulfill({ status: 201, json: current })
        return
      }
      if (action === 'submit') Object.assign(current, { status: 'in_approval', pending_role: 'system_user_lead', permissions: { ...current.permissions, can_edit: false, can_submit: false, comment_tabs: [] } })
      if (action === 'reject') Object.assign(current, { status: 'draft', pending_role: null })
      current.events = [...current.events, { action: action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : `${action}ed`, role: null, actor: USER.name, note: body.note ?? null, created_at: now }]
      await route.fulfill({ json: { ...current, email_sent: true } })
      return
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      if (Array.isArray(body.signoffs)) {
        current.signoffs = (body.signoffs as { role: string, user_id: number | null }[])
          .filter((row) => row.user_id)
          .map((row) => signoff(row.role, row.user_id!))
        delete body.signoffs
      }
      Object.assign(current, body)
      if (Array.isArray(body.answers)) current.answers = body.answers
      if (Array.isArray(body.interdependencies)) current.interdependencies = body.interdependencies
      await route.fulfill({ json: current })
      return
    }
    await route.fulfill({ json: current })
  })
  // Registered last so its routes win (Playwright tries the newest route first).
  return mockSccaWorkflow(page)
}

const MONITOR_REF = (id: number, ref: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  ref_no: ref,
  status,
  category: 'Critical',
  assessment_date: '2024-09-16',
  finalised_at: '2024-10-01T03:00:00Z',
  due_date: '2026-09-16',
  pending_role: null,
  pending_step: null,
  ...extra,
})

export const OVERVIEW = {
  cards: { applications_assessed: 12, in_approval: 3, drafts: 2, overdue_renewals: 1, due_in_90_days: 4, stuck_approvals: 1 },
  by_category: [
    { category: 'Critical', applications: 4 },
    { category: 'Very Important', applications: 3 },
    { category: 'Important', applications: 3 },
    { category: 'Necessary', applications: 1 },
    { category: 'Other', applications: 1 },
  ],
  finalised_per_month: [
    { month: '2026-05', sccas: 1 },
    { month: '2026-06', sccas: 3 },
    { month: '2026-07', sccas: 0 },
    { month: '2026-08', sccas: 2 },
    { month: '2026-09', sccas: 4 },
    { month: '2026-10', sccas: 2 },
  ],
}

export const RENEWALS = [
  {
    key: 'CCOMNI', application_name: 'CC Omni Channel', application_code: 'CCOMNI', department: 'DBCC', category: 'Critical',
    last_final: MONITOR_REF(7, 'SCCA-2024-0007', 'final'), renewal_date: '2026-09-16', days_left: -34, bucket: 'overdue',
    assessor: 'Test User', owner: 'Cards Owner', renewal: MONITOR_REF(1, 'SCCA-2026-0001', 'in_approval'), renewal_status: 'in_approval',
    application_id: 1, directorate: 'Operations, Technology, Analytics & AI', contributor: 'Rina Analyst', contributor_id: 2, can_generate: false,
  },
  {
    key: 'PAY', application_name: 'Payment Gateway', application_code: 'PAY', department: 'Payments', category: 'Very Important',
    last_final: MONITOR_REF(5, 'SCCA-2024-0005', 'final', { category: 'Very Important', due_date: '2026-11-10' }), renewal_date: '2026-11-10', days_left: 21, bucket: 'due_30',
    assessor: 'Rina Analyst', owner: 'Payments Head', renewal: null, renewal_status: 'not_started',
    application_id: 5, directorate: 'Operations, Technology, Analytics & AI', contributor: 'Dewi Head', contributor_id: 6, can_generate: true,
  },
]

export const REGISTER = [
  {
    key: 'CCOMNI', application_name: 'CC Omni Channel', application_code: 'CCOMNI', department: 'DBCC', category: 'Critical',
    latest_final: MONITOR_REF(7, 'SCCA-2024-0007', 'final'), renewal_date: '2026-09-16',
    open: MONITOR_REF(1, 'SCCA-2026-0001', 'in_approval', { pending_role: 'bcm_reviewer', pending_step: 'Reviewed by BCM Reviewer' }),
    latest_status: 'in_approval', assessor: 'Test User', owner: 'Cards Owner', it_support: 'IT Support', scca_count: 2,
    application_id: 1, directorate: 'Operations, Technology, Analytics & AI', contributor: 'Rina Analyst',
    history: [MONITOR_REF(1, 'SCCA-2026-0001', 'in_approval'), MONITOR_REF(7, 'SCCA-2024-0007', 'final')],
  },
  {
    key: 'HR', application_name: 'HR Portal', application_code: 'HR', department: null, category: null,
    latest_final: null, renewal_date: null, open: MONITOR_REF(2, 'SCCA-2026-0002', 'draft'),
    latest_status: 'draft', assessor: 'Test User', owner: 'HR', it_support: 'IT Support', scca_count: 1,
    application_id: 2, directorate: null, contributor: null,
    history: [MONITOR_REF(2, 'SCCA-2026-0002', 'draft')],
  },
]

export const BOTTLENECKS = [
  {
    id: 1, ref_no: 'SCCA-2026-0001', application_name: 'CC Omni Channel', application_code: 'CCOMNI', department: 'DBCC', category: 'Critical',
    step: 'bcm_reviewer', step_title: 'Reviewed by BCM Reviewer', approver: 'Bima Reviewer', approver_email: 'bima@example.com', approver_id: 4,
    waiting_since: '2026-10-08T02:00:00Z', working_days_waiting: 8, level: 'escalated', reminders_sent: 3, escalated_at: '2026-10-17T02:00:00Z',
    submitted_at: '2026-10-01T02:00:00Z', working_days_in_approval: 13, can_act: true,
  },
  {
    id: 3, ref_no: 'SCCA-2026-0003', application_name: 'Teller System', application_code: 'TELLER', department: 'Branch', category: 'Important',
    step: 'it_support_pic', step_title: 'Assessment by IT Support PIC', approver: 'Indrawan', approver_email: 'indrawan@example.com', approver_id: 5,
    waiting_since: '2026-10-15T02:00:00Z', working_days_waiting: 3, level: 'reminder', reminders_sent: 1, escalated_at: null,
    submitted_at: '2026-10-14T02:00:00Z', working_days_in_approval: 4, can_act: false,
  },
]

export const STEP_AVERAGES = [
  'system_user_lead', 'it_support_pic', 'bcm_reviewer', 'enterprise_architecture', 'service_level_mgmt',
  'app_owner_d2', 'app_owner_d1', 'it_support_approval', 'bcm_acknowledgement',
].map((step, index) => ({ step, step_title: step, approvals: 4, average_working_days: [1.5, 2, 4.2, 1, 0.5, 3, 2.5, 1, 0.8][index] }))

export const INBOX = [
  {
    id: 1, ref_no: 'SCCA-2026-0001', application_name: 'CC Omni Channel', application_code: 'CCOMNI', category: 'Critical',
    step: 'bcm_reviewer', step_title: 'Reviewed by BCM Reviewer', submitted_by: 'Test User', submitted_at: '2026-10-01T02:00:00Z',
    waiting_since: '2026-10-08T02:00:00Z', working_days_waiting: 8, level: 'escalated', reminders_sent: 3,
  },
]

export const UPCOMING = [
  {
    id: 3, ref_no: 'SCCA-2026-0003', application_name: 'Teller System', category: 'Important',
    my_step: 'bcm_acknowledgement', my_step_title: 'Acknowledged by BCM', current_step: 'it_support_pic',
    current_step_title: 'Assessment by IT Support PIC', steps_before_mine: 7,
  },
]

export const HISTORY = [
  {
    kind: 'rejected', decision: 'Rejected', by: null, at: '2026-10-10T04:00:00Z', id: 2, ref_no: 'SCCA-2026-0002',
    application_name: 'HR Portal', step: 'bcm_reviewer', step_title: 'Reviewed by BCM Reviewer', note: 'RTO is wrong', status_now: 'draft',
  },
  {
    kind: 'approved_on_behalf', decision: 'Approved on my behalf', by: 'Rina Analyst', at: '2026-10-05T04:00:00Z', id: 7, ref_no: 'SCCA-2024-0007',
    application_name: 'CC Omni Channel', step: 'bcm_reviewer', step_title: 'Reviewed by BCM Reviewer', note: 'Approved by email on 4 Oct', status_now: 'final',
  },
]

export const SCCA_SETTINGS = {
  reminders_enabled: true,
  reminder_after_days: 3,
  reminder_every_days: 2,
  escalate_after_days: 7,
  escalate_to_supervisor: true,
  extra_escalation_emails: [],
  renewal_notice_days: [90, 30, 7],
  overdue_repeat_days: 30,
  window_start_hour: 8,
  window_end_hour: 17,
  updated_at: null,
  updated_by: null,
}

/** Register > SCCA(s) of CC Omni Channel: the open renewal, the current final and an older one. */
export const APPLICATION_SCCAS = [
  { ...MONITOR_REF(1, 'SCCA-2026-0001', 'in_approval'), application_name: 'CC Omni Channel', application_code: 'CCOMNI', reason: 'annual_review', assessor: 'Test User', contributor: 'Rina Analyst', renews: MONITOR_REF(7, 'SCCA-2024-0007', 'final'), mark: null },
  { ...MONITOR_REF(7, 'SCCA-2024-0007', 'final'), application_name: 'CC Omni Channel', application_code: 'CCOMNI', reason: 'annual_review', assessor: 'Test User', contributor: null, renews: MONITOR_REF(4, 'SCCA-2022-0004', 'final'), mark: 'current' },
  { ...MONITOR_REF(4, 'SCCA-2022-0004', 'final'), application_name: 'CC Omni Channel', application_code: 'CCOMNI', reason: 'new_application', assessor: 'Old Assessor', contributor: null, renews: null, mark: 'replaced' },
]

export const CONTRIBUTORS = [
  { id: 6, display_name: 'Dewi Head', email: 'dewi@example.com', job_title: 'Head of IT Application', division: 'IT Application', directorate: 'Operations, Technology, Analytics & AI', org_level: 'D-2' },
  { id: 8, display_name: 'Candra Head', email: 'candra@example.com', job_title: 'Head of Retail Banking', division: 'Retail Banking', directorate: 'Consumer & Emerging Business Banking', org_level: 'D-2' },
]

/** Pages `items` like the server does, from the request's `page` and `per_page` (20 by default). */
function paged<T>(items: T[], url: URL, perPage = 20) {
  const size = Number(url.searchParams.get('per_page')) || perPage
  const number = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const start = (number - 1) * size
  return { items: items.slice(start, start + size), page: number, per_page: size, total: items.length, pages: Math.ceil(items.length / size) }
}

/** Monitoring, the Approval menu and the SCCA settings, with the calls recorded. `rows` replaces a list's rows. */
export async function mockSccaWorkflow(page_: Page, rows: { inbox?: unknown[], upcoming?: unknown[], history?: typeof HISTORY, renewals?: unknown[] } = {}) {
  const calls: { method: string, url: string, search: string, body: unknown }[] = []
  const settings = { ...SCCA_SETTINGS }
  const board = BOTTLENECKS.map((row) => ({ ...row }))
  await page_.route(/\/api\/(scca\/(monitoring|approvals)|admin\/settings\/scca)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }
    calls.push({ method: request.method(), url: url.pathname, search: url.search, body })
    const path = url.pathname
    if (path.endsWith('/monitoring/overview')) return route.fulfill({ json: OVERVIEW })
    if (path.endsWith('/monitoring/departments')) return route.fulfill({ json: { items: ['Branch', 'DBCC', 'Payments'] } })
    if (path.endsWith('/monitoring/org-values')) {
      return route.fulfill({ json: { directorates: ['Consumer & Emerging Business Banking', 'Operations, Technology, Analytics & AI'], sub_directorates: ['Information Technology'], divisions: ['IT Application'], departments: ['Branch', 'DBCC', 'Payments'] } })
    }
    if (path.endsWith('/monitoring/renewals/contributors')) return route.fulfill({ json: { levels: ['D-2'], items: CONTRIBUTORS } })
    if (path.endsWith('/monitoring/renewals/generate')) {
      const ids = (body as { assessment_ids: number[] }).assessment_ids
      return route.fulfill({ json: { created: ids.map((id, index) => ({ id: 90 + index, ref_no: `SCCA-2026-00${90 + index}`, renews: `#${id}`, application_name: 'Payment Gateway' })), skipped: [], refused: [] } })
    }
    if (path.endsWith('/monitoring/application-sccas')) return route.fulfill({ json: paged(APPLICATION_SCCAS, url) })
    if (path.endsWith('/approvals/nudge')) {
      const ids = (body as { assessment_ids: number[] }).assessment_ids
      const sent = board.filter((row) => ids.includes(row.id) && row.reminders_sent < 3)
      const skipped = board.filter((row) => ids.includes(row.id) && row.reminders_sent >= 3)
      return route.fulfill({ json: { sent: sent.map((row) => ({ id: row.id, ref_no: row.ref_no })), skipped: skipped.map((row) => ({ id: row.id, ref_no: row.ref_no, reason: 'The approver was already reminded today. Try again tomorrow.' })), failed: [] } })
    }
    if (path.endsWith('/monitoring/renewals')) return route.fulfill({ json: { ...paged(rows.renewals ?? RENEWALS, url), counts: { overdue: 1, due_30: 1, due_90: 0 }, contributor_levels: ['D-2'] } })
    if (path.endsWith('/monitoring/register')) {
      const status = url.searchParams.get('status')
      const list = status === 'final' ? REGISTER.filter((row) => row.latest_final) : REGISTER
      return route.fulfill({ json: paged(list, url) })
    }
    if (path.endsWith('/monitoring/bottlenecks')) return route.fulfill({ json: { ...paged(board, url), step_averages: STEP_AVERAGES } })
    if (path.endsWith('.xlsx')) return route.fulfill({ body: 'xlsx', contentType: 'application/octet-stream' })
    if (path.endsWith('/approvals/inbox')) return route.fulfill({ json: paged(rows.inbox ?? INBOX, url) })
    if (path.endsWith('/approvals/upcoming')) return route.fulfill({ json: paged(rows.upcoming ?? UPCOMING, url, 10) })
    if (path.endsWith('/approvals/history')) {
      const decision = url.searchParams.get('decision')
      const history = rows.history ?? HISTORY
      return route.fulfill({ json: paged(decision ? history.filter((row) => row.kind === decision) : history, url) })
    }
    if (path.endsWith('/approvals/board')) return route.fulfill({ json: paged(board, url) })
    if (path.endsWith('/admin/settings/scca/signers')) return route.fulfill({ json: { items: [] } })
    if (path.endsWith('/admin/settings/scca')) {
      if (request.method() === 'PUT') Object.assign(settings, body as object, { updated_at: '2026-10-20T04:00:00Z', updated_by: 'Test User' })
      return route.fulfill({ json: settings })
    }
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  await page_.route(/\/api\/scca\/assessments\/\d+\/(nudge|reassign|approve-on-behalf)$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    calls.push({ method: request.method(), url: url.pathname, search: '', body: request.postData() })
    const id = Number(url.pathname.split('/').at(-2))
    if (url.pathname.endsWith('/nudge')) {
      const row = board.find((item) => item.id === id)!
      row.reminders_sent += 1
    }
    return route.fulfill({ json: { ...assessment({ id }), email_sent: true } })
  })
  return { calls, settings }
}
