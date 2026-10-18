import type { Page } from '@playwright/test'

export const USER = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  roles: ['BCM.Admin'],
}

const CATEGORIES = ['Critical', 'Very Important', 'Important', 'Necessary', 'Other'] as const

const CHART: Record<number, string[]> = {
  5: ['Important', 'Very Important', 'Very Important', 'Critical', 'Critical'],
  4: ['Important', 'Important', 'Very Important', 'Very Important', 'Critical'],
  3: ['Necessary', 'Important', 'Important', 'Important', 'Very Important'],
  2: ['Other', 'Necessary', 'Important', 'Important', 'Important'],
  1: ['Other', 'Other', 'Necessary', 'Important', 'Important'],
}

const QUESTIONS = [
  { code: 'C1', dimension: 'C', options: [5, 3, 1], label: 'Regulatory', component: 'Regulatory' },
  { code: 'C2', dimension: 'C', options: [5, 4, 3, 1], label: 'Customer data', component: 'Customer data' },
  { code: 'C3', dimension: 'C', options: [5, 3, 1], label: 'Internal data', component: 'Internal data' },
  { code: 'C4', dimension: 'C', options: [5, 3, 1], label: 'Staff data', component: 'Staff data' },
  { code: 'C5', dimension: 'C', options: [5, 3, 1], label: 'Intellectual property', component: 'IP' },
  { code: 'I1', dimension: 'I', options: [5, 4, 3, 2, 1], label: 'Accuracy', component: 'Accuracy' },
  { code: 'I2', dimension: 'I', options: [5, 3, 1], label: 'Completeness', component: 'Completeness' },
  { code: 'I3', dimension: 'I', options: [5, 4, 3, 2, 1], label: 'Timeliness', component: 'Timeliness' },
  { code: 'I4', dimension: 'I', options: [5, 4, 3, 2, 1], label: 'Validity', component: 'Validity' },
  { code: 'I5', dimension: 'I', options: [5, 3, 1], label: 'Authenticity', component: 'Authenticity' },
  { code: 'A1', dimension: 'A', options: [5, 4, 3, 1], label: 'Uptime', component: 'Uptime' },
  { code: 'A2', dimension: 'A', options: [5, 3, 1], label: 'Recoverability', component: 'Recoverability' },
  { code: 'A3', dimension: 'A', options: [5, 4, 3, 2, 1], label: 'Performance', component: 'Performance' },
  { code: 'A4', dimension: 'A', options: [5, 4, 3, 2, 1], label: 'Capacity', component: 'Capacity' },
  { code: 'P1', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Financial', component: 'Financial' },
  { code: 'P2', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Customer', component: 'Customer' },
  { code: 'P3', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Reputation', component: 'Reputation' },
  { code: 'P4', dimension: 'P', options: [5, 4, 3, 2, 1], label: 'Regulatory loss', component: 'Regulatory' },
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

export function assessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    can_delete: true,
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
      { direction: 'upstream', seq: 1, system_name: 'Core Banking', criticality_category: 'Critical', rto: '2 hours', rpo: null, dr_capacity: null, processing_mode: 'Online', dependency: 'Full', workaround: null, gaps: null },
    ],
    recovery_values: [],
    signoffs: [],
    created_by: 'Test User',
    updated_by: 'Test User',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
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
      created_by: 'Test User',
      updated_at: '2026-03-01T00:00:00Z',
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
      created_by: 'Test User',
      updated_at: '2026-03-02T00:00:00Z',
    },
  ],
  page: 1,
  per_page: 25,
  total: 2,
  pages: 1,
}

export async function signIn(page: Page) {
  await page.route('**/api/me', (route) => route.fulfill({ json: USER }))
}

export async function mockScca(page: Page, current = assessment()) {
  await signIn(page)
  await page.route('**/api/users**', (route) =>
    route.fulfill({
      json: {
        items: [
          { id: 1, display_name: 'Cards Owner', email: 'cards@example.com', job_title: 'Owner', department: 'Cards' },
          { id: 2, display_name: 'IT Support', email: 'it@example.com', job_title: 'Engineer', department: 'IT' },
          { id: 3, display_name: 'Retail Lead', email: 'retail@example.com', job_title: 'Lead', department: 'Retail' },
        ],
      },
    }),
  )
  await page.route('**/api/scca/formula', (route) => route.fulfill({ json: FORMULA }))
  await page.route('**/api/scca/recovery-standards', (route) => route.fulfill({ json: STANDARDS }))
  await page.route('**/api/scca/calculate', (route) =>
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
      await route.fulfill({ json: { ...LIST, items, total: items.length } })
      return
    }
    if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      Object.assign(current, body)
      if (Array.isArray(body.answers)) current.answers = body.answers
      if (Array.isArray(body.interdependencies)) current.interdependencies = body.interdependencies
      await route.fulfill({ json: current })
      return
    }
    await route.fulfill({ json: current })
  })
}
