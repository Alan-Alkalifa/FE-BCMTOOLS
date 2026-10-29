import { expect, type Page } from '@playwright/test'
import { signIn } from './scca'
// Recorded from the backend with the Griya CIMB Niaga 2 sample of the 2025 workbook, edited so that
// one hazard (H28) has a high residual risk without an action plan and one (H09) is still incomplete.
// The location (Griya CIMB Niaga 2) carries the workbook's contacts, occupants, recovery team and call tree.
import ASSESSMENT from './ra/assessment.json' with { type: 'json' }
import FORMULA from './ra/formula.json' with { type: 'json' }
import LOCATION from './ra/location.json' with { type: 'json' }
// RA Branch, recorded the same way: KCP Bogor Pajajaran with 26 of 33 hazards rated on the branch
// formula (one residual risk per hazard). The mock serves it as branch 11, assessment 12.
import BRANCH_RAW from './ra/branch-assessment.json' with { type: 'json' }
import BRANCH_FORMULA from './ra/branch-formula.json' with { type: 'json' }
import BRANCH_LOCATION_RAW from './ra/branch-location.json' with { type: 'json' }

export const BRANCH_ID = 11
export const BRANCH_ASSESSMENT_ID = 12

const BRANCH_ASSESSMENT = {
  ...BRANCH_RAW,
  id: BRANCH_ASSESSMENT_ID,
  location: { ...BRANCH_RAW.location, id: BRANCH_ID },
}
const BRANCH_SUMMARY = {
  ...BRANCH_LOCATION_RAW.assessments[0]!,
  id: BRANCH_ASSESSMENT_ID,
  location: { ...BRANCH_LOCATION_RAW.assessments[0]!.location, id: BRANCH_ID },
}
const BRANCH_LOCATION = { ...BRANCH_LOCATION_RAW, id: BRANCH_ID, latest_assessment: BRANCH_SUMMARY, assessments: [BRANCH_SUMMARY] }

/** Pinned branches for the nearby-branches overlay: two within 5 km of Griya CIMB Niaga 2, one far away. */
export const PINNED_BRANCHES = [
  { name: 'KCP Bintaro Sektor 9', latitude: -6.2853, longitude: 106.7272, province: 'Banten' },
  { name: 'KCP Pondok Indah', latitude: -6.2655, longitude: 106.7834, province: 'DKI Jakarta' },
  { name: 'KC Bandung Asia Afrika', latitude: -6.9215, longitude: 107.6106, province: 'Jawa Barat' },
].map((branch, index) => ({
  ...BRANCH_LOCATION,
  ...branch,
  id: 31 + index,
  address: null,
  assessment_count: 0,
  latest_assessment: null,
  assessments: [],
}))

export { ASSESSMENT, BRANCH_ASSESSMENT, BRANCH_FORMULA, BRANCH_LOCATION, FORMULA, LOCATION }

/** The texts RA configuration adds to a version (the backend's defaults). */
export const HAZARD_INTRO = 'Identify all threats relevant to the location. Threats that are not relevant to the workplace do not need to be filled in and may be marked as Not Applicable (NA). Threats classified as "Historical of Occurrence" must be assessed.'
export const STATEMENT_EN = 'I declare that the Risk Assessment carried out on the business functions is ACCURATE and CORRECT.'
export const CIM_NOTE_EN = 'All threats with a Residual Risk above "Medium" must be followed up through Control Issue Management (CIM) by the unit concerned.'
const ROLE_LABELS = {
  head_office: [
    { role: 'prepared_by', label: 'Prepared by', title: 'Location Incident Coordinator (LIC)' },
    { role: 'acknowledged_by_unit', label: 'Acknowledged by', title: 'Unit Critical Business Function' },
    { role: 'reviewed_by', label: 'Reviewed by', title: 'Alternate Location Incident Commander' },
    { role: 'acknowledged_by_bcm', label: 'Acknowledged by', title: 'Business Continuity Management Head' },
  ],
  branch: [
    { role: 'prepared_by', label: 'Prepared by', title: 'BOSM' },
    { role: 'approved_by', label: 'Approved by', title: 'Branch Manager (BM)' },
    { role: 'reviewed_by', label: 'Reviewed by', title: 'NRSOH' },
  ],
}

export function withTexts<T extends { kind: string }>(formula: T) {
  return {
    ...formula,
    status: 'active',
    hazard_intro: HAZARD_INTRO,
    signoff_statement_en: STATEMENT_EN,
    risk_summary_note_en: CIM_NOTE_EN,
    type_description: formula.kind === 'branch' ? 'The branch that is assessed each RA cycle.' : 'The building or work location that is assessed each RA cycle.',
    signoff_role_labels: ROLE_LABELS[formula.kind as keyof typeof ROLE_LABELS],
  }
}

export const BUILDING_TYPES = [
  { kind: 'head_office', label: 'Head office building', description: 'The building or work location that is assessed each RA cycle.' },
  { kind: 'branch', label: 'Branch', description: 'The branch that is assessed each RA cycle.' },
]

export const DIVISIONS = [
  { id: 101, name: 'Cash & Payment Operations', mtd: '0-4 hours', critical_rating: 'Critical', is_active: true },
  { id: 102, name: 'Human Resources', mtd: '24-48 hours', critical_rating: 'Necessary', is_active: true },
]

export const LOCATIONS = [
  {
    id: 1,
    code: 'RA-HQ-0001',
    kind: 'head_office',
    name: 'Griya CIMB Niaga 2',
    region: null,
    province: 'Banten' as string | null,
    latitude: -6.271633,
    longitude: 106.719358,
    address: 'Jl. Wahid Hasyim Blok B4 No.3 Bintaro Jaya Sektor 7 Tangerang 15224',
    is_active: true,
    assessment_count: 1,
    latest_assessment: null,
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'RA-HQ-0002',
    kind: 'head_office',
    name: 'Graha CIMB Niaga',
    region: null,
    province: 'DKI Jakarta' as string | null,
    latitude: null,
    longitude: null,
    address: 'Jl. Jend. Sudirman Kav. 58, Jakarta',
    is_active: true,
    assessment_count: 0,
    latest_assessment: null,
    updated_at: '2026-03-01T00:00:00Z',
  },
]

/** A newly added location (id 3) with no profile yet. */
export const EMPTY_LOCATION = {
  ...LOCATIONS[1],
  id: 3,
  can_delete: true,
  assessments: [],
  contacts: [],
  occupants: [],
  occupant_summary: { units: 0, employees: 0, disabled: 0, pregnant: 0, with_bcp: 0, with_alternate_site: 0 },
  recovery_team: [],
  call_tree: [],
  created_by: 'Test User',
  updated_by: 'Test User',
}

export const SUMMARY = {
  id: 1,
  ref_no: 'RA-2025-0001',
  period_year: 2025,
  assessment_date: '2025-03-10',
  due_date: '2026-03-10',
  reason: 'new_building',
  location: { id: 1, code: 'RA-HQ-0001', kind: 'head_office', name: 'Griya CIMB Niaga 2', region: null },
  rated_count: 32,
  hazard_count: 33,
  highest_gross_level: 'High',
  highest_residual_level: 'High',
  is_complete: false,
  status: 'draft',
  current_signoff_role: null,
  is_returned: false,
  created_by: 'Test User',
  updated_at: '2026-03-01T00:00:00Z',
}

/** BCM Tools users offered as signers. */
export const USERS = [
  { id: 1, display_name: 'Legiran', email: 'legiran@example.com', job_title: 'LIC', department: 'SPAPM', mobile_phone: '081312262739' },
  { id: 2, display_name: 'Rina Kartika', email: 'rina@example.com', job_title: 'Head of Retail Operations', department: 'Retail', mobile_phone: null },
  { id: 3, display_name: 'Budi Hartono', email: 'budi@example.com', job_title: 'Alternate LICOM', department: 'GA', mobile_phone: '0812-3333-4444' },
  { id: 4, display_name: 'Dewi Lestari', email: 'dewi@example.com', job_title: 'Head of BCM', department: 'BCM', mobile_phone: '0811-5555-6666' },
]
/** The location incident team of the mocked RAs: Legiran (LIC) and Budi Hartono (LICOM). */
const LIC_ID = 1
const LICOM_ID = 3
const TEAM_ROLES: Record<string, 'lic' | 'licom'> = { prepared_by: 'lic', reviewed_by: 'licom' }
const HO_ROLES = ['prepared_by', 'acknowledged_by_unit', 'reviewed_by', 'acknowledged_by_bcm']
const BRANCH_ROLES = ['prepared_by', 'approved_by', 'reviewed_by']

function userRef(id: number | null | undefined) {
  const user = USERS.find((item) => item.id === id)
  return user ? { id: user.id, name: user.display_name, email: user.email, job_title: user.job_title } : null
}

type MockSignoff = {
  role: string
  signer: ReturnType<typeof userRef>
  name: string | null
  designation: string | null
  signed_on: string | null
  approved_at: string | null
  approved_by: string | null
  comment: string | null
  evidence?: { id: number, filename: string, size: number, url: string } | null
}
type MockEvent = {
  action: string
  role: string | null
  user: string | null
  comment: string | null
  at: string
  on_behalf?: boolean
  for_user?: string | null
  to_user?: string | null
  attachment?: MockSignoff['evidence']
}
type MockAssessment = {
  kind: string
  lic_user: ReturnType<typeof userRef>
  lic_name: string | null
  licom_user: ReturnType<typeof userRef>
  licom_name: string | null
  status: string
  is_complete: boolean
  current_signoff_role: string | null
  awaiting_signer: ReturnType<typeof userRef>
  can_edit: boolean
  can_submit: boolean
  can_approve: boolean
  can_return: boolean
  can_act_for_signer?: boolean
  signoffs: MockSignoff[]
  returned_comment: string | null
  returned_by: string | null
  returned_at: string | null
  approved_at: string | null
  location_approved?: boolean
  signoff_history: MockEvent[]
}

const NOW = '2026-10-20T03:00:00Z'
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** Every role signed by users 1–4 in turn; a complete assessment ready to submit. */
function readyToSubmit(assessment: MockAssessment) {
  const roles = assessment.kind === 'branch' ? BRANCH_ROLES : HO_ROLES
  assessment.is_complete = true
  assessment.signoffs = roles.map((role, index) => signoffRow(role, index + 1))
}

/** The team picked on the assessment, and the two signers who follow it (as the backend does). */
function setTeam(assessment: MockAssessment, member: 'lic' | 'licom', userId: number) {
  const user = userRef(userId)
  assessment[`${member}_user`] = user
  assessment[`${member}_name`] = user?.name ?? null
  for (const [role, follows] of Object.entries(TEAM_ROLES)) {
    if (follows !== member) continue
    const index = assessment.signoffs.findIndex((row) => row.role === role)
    if (index >= 0) assessment.signoffs[index] = signoffRow(role, userId)
    else assessment.signoffs.push(signoffRow(role, userId))
  }
}

function signoffRow(role: string, signerId: number | null): MockSignoff {
  const signer = userRef(signerId)
  return {
    role,
    signer,
    name: signer?.name ?? null,
    designation: signer?.job_title ?? null,
    signed_on: null,
    approved_at: null,
    approved_by: null,
    comment: null,
  }
}

function setStatus(assessment: MockAssessment, status: string, role: string | null = null) {
  assessment.status = status
  assessment.current_signoff_role = role
  assessment.awaiting_signer = role ? assessment.signoffs.find((row) => row.role === role)?.signer ?? null : null
  assessment.can_edit = assessment.can_submit = status === 'draft'
  assessment.can_approve = status === 'in_signoff'
  assessment.can_return = status !== 'draft'
}

export interface RaMockLog {
  ratings: unknown[][]
  /** Bodies of POST /api/ra/assessments and /api/ra/locations. */
  created: Record<string, unknown>[]
  /** Sign-off calls: [action, body]; action is "signers", "submit", "approve" or "return". */
  signoff: [string, unknown][]
  /** Bodies of PUT /api/ra/locations/{id}/contacts, /occupants, /recovery-team and /call-tree. */
  lists: Record<string, Record<string, unknown[]>[]>
  deletedLocations: number[]
  /** Paths and queries of GET /api/ra/monitoring/* and /api/ra/approvals/*. */
  workflow: string[]
  /** Query strings of GET /api/ra/locations (the register and the pickers). */
  locationQueries: string[]
  /** Approval calls on a building: [action, body]; approve, reject, withdraw or resubmit. */
  approvals: [string, unknown][]
}

/** The address fields Building Data Entry requires. */
export const ADDRESS = { address: 'Jl. Jend. Sudirman Kav. 25', province: 'DKI Jakarta', city: 'Jakarta Selatan', district: 'Setiabudi', zip_code: '12920' }

/** Fills in the address of Building Data Entry. */
export async function fillAddress(page: Page) {
  await page.getByRole('textbox', { name: /^Address/ }).fill(ADDRESS.address)
  await page.getByRole('textbox', { name: /^Province/ }).fill(ADDRESS.province)
  await page.getByRole('textbox', { name: /^City/ }).fill(ADDRESS.city)
  await page.getByRole('textbox', { name: /^District/ }).fill(ADDRESS.district)
  await page.getByRole('textbox', { name: /^Zip code/ }).fill(ADDRESS.zip_code)
  // The messages clear as the fields are filled in (before the submit button moves up).
  await expect(page.getByText(/^Enter the (address|province|city|district|zip code)\.$/)).toHaveCount(0)
}

/** A building added by Rina that waits for approval; the signed-in user may approve it. */
export const PENDING_APPROVAL = {
  status: 'pending', action: 'register', requested_by: 'Rina', requested_at: '2026-10-26T02:00:00Z',
  decided_by: null, decided_at: null, note: null,
}
const APPROVED = { status: 'approved', action: null, requested_by: null, requested_at: null, decided_by: null, decided_at: null, note: null }
const NO_APPROVAL_ACTIONS = { approve: false, reject: false, withdraw: false, resubmit: false }

/**
 * Mocks /api/ra/* for RA and RA Branch (`?kind=branch`, branch 11, assessment 12). Saving ratings
 * echoes the assessment back; the log records what was sent.
 */
/** Two regions of the DataRegion sheet, as GET /api/ra/regions returns them. */
export const REGION_DIRECTORY = [
  {
    region: 'Network - Jabar & Jateng Region',
    directorate: 'Network & Digital Banking',
    level: 'D-1',
    head: 'Region Head Jabar',
    office: 'KC - Bandung - Asia Afrika - BAA',
    city: 'BANDUNG',
    areas: [
      { area: 'Network - Jabar & Jateng Region - Jabar Area I', level: 'D-2', head: 'Area Head Jabar I', office: 'KC - Bandung - Asia Afrika - BAA', city: 'BANDUNG' },
      { area: 'Network - Jabar & Jateng Region - Jabar Area II', level: 'D-2', head: 'Area Head Jabar II', office: 'KC - Bandung - Dago - DGO', city: 'BANDUNG' },
    ],
  },
  {
    region: 'Network - Jakarta Region',
    directorate: 'Network & Digital Banking',
    level: 'D-1',
    head: 'Region Head Jakarta',
    office: 'KC - Tangerang - Alam Sutera Icon - CAS',
    city: 'TANGERANG SELATAN',
    areas: [
      { area: 'Jakarta Region Area I', level: 'D-2', head: 'Area Head Jakarta I', office: 'KC - Jakarta - Graha CIMB Niaga - NAA', city: 'JAKARTA SELATAN' },
    ],
  },
]

export async function mockRa(
  page: Page,
  options: {
    locationInUse?: boolean
    ready?: boolean
    status?: 'in_signoff' | 'approved'
    pendingLocation?: boolean
    /** Signed in as BCM, not the waiting step's signer: change the signer or approve on behalf. */
    actForSigner?: boolean
    /** Signed in with only these permissions (default: an Administrator). */
    permissions?: string[]
    /** The region directory has regions (the DataRegion sheet, LDAP in production). */
    regions?: boolean
  } = {},
) {
  const log: RaMockLog = { ratings: [], created: [], signoff: [], lists: {}, deletedLocations: [], workflow: [], locationQueries: [], approvals: [] }
  const current = structuredClone(ASSESSMENT) as typeof ASSESSMENT & MockAssessment
  const branchCurrent = structuredClone(BRANCH_ASSESSMENT) as typeof BRANCH_ASSESSMENT & MockAssessment
  for (const assessment of [current, branchCurrent]) {
    setTeam(assessment, 'lic', LIC_ID)
    setTeam(assessment, 'licom', LICOM_ID)
  }
  if (options.ready || options.status) readyToSubmit(current)
  if (options.status === 'in_signoff') setStatus(current, 'in_signoff', 'prepared_by')
  if (options.status === 'approved') setStatus(current, 'approved')
  const actForSigner = (assessment: MockAssessment) => {
    if (!options.actForSigner) return
    assessment.can_act_for_signer = assessment.status === 'in_signoff'
    assessment.can_approve = false
  }
  actForSigner(current)
  await signIn(page, options.permissions ? { permissions: options.permissions } : {})
  await page.route('**/api/ra/regions', (route) => route.fulfill({ json: { items: options.regions ? REGION_DIRECTORY : [] } }))
  await page.route('**/api/users**', (route) => {
    const term = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase()
    return route.fulfill({ json: { items: USERS.filter((user) => user.display_name.toLowerCase().includes(term)) } })
  })
  // Map tiles: a blank 1x1 PNG from a local path, so tests never reach a real tile server.
  await page.route('**/api/ra/map-settings', (route) =>
    route.fulfill({ json: { tile_url: '/e2e-tiles/{z}/{x}/{y}.png', attribution: 'Test tiles', max_zoom: 19 } }),
  )
  await page.route('**/e2e-tiles/**', (route) => route.fulfill({ contentType: 'image/png', body: BLANK_PNG }))
  await page.route(/\/api\/ra\/formula/, (route) => {
    const params = new URL(route.request().url()).searchParams
    const branch = params.get('kind') === 'branch' || (params.get('version') ?? '').startsWith('branch')
    return route.fulfill({ json: withTexts(branch ? BRANCH_FORMULA : FORMULA) })
  })
  await page.route('**/api/ra/building-types', (route) => route.fulfill({ json: { items: BUILDING_TYPES } }))
  const divisions = structuredClone(DIVISIONS)
  await page.route(/\/api\/ra\/divisions/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, string>
      log.created.push({ division: body })
      const division = { id: 200 + divisions.length, is_active: true, ...body }
      divisions.push(division)
      await route.fulfill({ status: 201, json: division })
      return
    }
    await route.fulfill({ json: { items: divisions } })
  })
  const location = structuredClone(LOCATION) as typeof LOCATION & Record<string, unknown>
  const branchLocation = structuredClone(BRANCH_LOCATION) as typeof BRANCH_LOCATION & Record<string, unknown>
  for (const row of [location, branchLocation]) {
    Object.assign(row, { approval: { ...APPROVED }, approval_can: { ...NO_APPROVAL_ACTIONS } })
    // Building Data Entry requires the full address.
    Object.assign(row, { ...ADDRESS, ...Object.fromEntries(Object.entries(ADDRESS).map(([key, value]) => [key, (row as Record<string, unknown>)[key] || value])) })
    // The workbook leaves some of these blank; the app requires all but the home phone.
    for (const member of (row.recovery_team ?? []) as Record<string, unknown>[]) {
      for (const field of ['role', 'name', 'mobile']) member[field] ||= '-'
    }
    for (const entry of (row.call_tree ?? []) as Record<string, unknown>[]) {
      for (const field of ['caller', 'contact_name', 'division', 'mobile']) entry[field] ||= '-'
    }
  }
  if (options.pendingLocation) {
    location.approval = { ...PENDING_APPROVAL }
    location.approval_can = { ...NO_APPROVAL_ACTIONS, approve: true, reject: true }
    current.location_approved = false
  }
  /** Any other id: the location added last (EMPTY_LOCATION until one is added). */
  let added: Record<string, unknown> = EMPTY_LOCATION
  await page.route(/\/api\/ra\/locations/, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const list = url.pathname.match(/\/(contacts|occupants|recovery-team|call-tree)$/)?.[1]
    if (list) {
      log.lists[list] = [...(log.lists[list] ?? []), route.request().postDataJSON()]
      await route.fulfill({ json: url.pathname.includes(`/${BRANCH_ID}/`) ? branchLocation : location })
      return
    }
    const decision = url.pathname.match(/\/(\d+)\/(approve|reject|withdraw|resubmit)$/)
    if (decision) {
      const body = route.request().postDataJSON?.() ?? null
      log.approvals.push([decision[2]!, body])
      const target = Number(decision[1]) === BRANCH_ID ? branchLocation : location
      const note = (body as { note?: string | null } | null)?.note ?? null
      target.approval = decision[2] === 'reject'
        ? { ...PENDING_APPROVAL, status: 'rejected', decided_by: 'Test User', decided_at: '2026-10-26T03:00:00Z', note }
        : decision[2] === 'resubmit'
          ? { ...PENDING_APPROVAL, requested_by: 'Test User' }
          : { ...APPROVED, decided_by: 'Test User', decided_at: '2026-10-26T03:00:00Z', note }
      target.approval_can = { ...NO_APPROVAL_ACTIONS }
      current.location_approved = decision[2] === 'approve'
      await route.fulfill({ json: target })
      return
    }
    const id = Number(url.pathname.split('/').pop())
    const target = id === BRANCH_ID ? branchLocation : location
    if (method === 'DELETE') {
      if (options.locationInUse) {
        await route.fulfill({ status: 409, json: { error: 'conflict' } })
      } else {
        log.deletedLocations.push(id)
        await route.fulfill({ status: 204, body: '' })
      }
      return
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      log.created.push(body)
      added = { ...EMPTY_LOCATION, ...body, approval: { ...PENDING_APPROVAL, requested_by: 'Test User' }, approval_can: { ...NO_APPROVAL_ACTIONS } }
      await route.fulfill({ status: 201, json: added })
      return
    }
    if (method === 'PUT') {
      Object.assign(target, route.request().postDataJSON())
      await route.fulfill({ json: target })
      return
    }
    if (Number.isInteger(id) && id > 0) {
      await route.fulfill({ json: id === 1 || id === BRANCH_ID ? target : added })
      return
    }
    log.locationQueries.push(url.search)
    const params = url.searchParams
    const kind = params.get('kind') ?? 'head_office'
    const branches = [branchLocation, ...PINNED_BRANCHES]
    const q = (params.get('q') ?? '').toLowerCase()
    const ofKind = (kind === 'all' ? [...LOCATIONS, ...branches] : kind === 'branch' ? branches : LOCATIONS) as (typeof LOCATIONS[number] & { province?: string | null })[]
    if (url.pathname.endsWith('/provinces')) {
      await route.fulfill({ json: { items: [...new Set(ofKind.map((row) => row.province).filter(Boolean))].sort() } })
      return
    }
    const items = ofKind
      .filter((row) => !q || [row.name, row.region, row.address].some((text) => text?.toLowerCase().includes(q)))
      .filter((row) => !params.get('region') || row.region === params.get('region'))
      .filter((row) => !params.get('province') || row.province === params.get('province'))
      .filter((row) => !params.get('active') || String(row.is_active) === params.get('active'))
      .sort((a, b) => a.name.localeCompare(b.name))
      // Building 1 carries its approval (pending with `pendingLocation`).
      .map((row) => (row.id === 1 ? { ...row, approval: location.approval, approval_can: location.approval_can } : row))
    if (!params.get('page')) {
      await route.fulfill({ json: { items } })
      return
    }
    // The register pages on the server, like the API: {items, page, per_page, total, pages}.
    const page = Number(params.get('page'))
    const perPage = Number(params.get('per_page') ?? 25)
    await route.fulfill({
      json: {
        items: items.slice((page - 1) * perPage, page * perPage),
        page,
        per_page: perPage,
        total: items.length,
        pages: Math.max(1, Math.ceil(items.length / perPage)),
      },
    })
  })
  await page.route(/\/api\/ra\/assessments/, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const collection = /\/ra\/assessments\/?$/.test(url.pathname)
    if (collection && method === 'GET') {
      const level = url.searchParams.get('level')
      const summary = url.searchParams.get('kind') === 'branch' ? BRANCH_SUMMARY : SUMMARY
      const items = level && level !== summary.highest_residual_level ? [] : [summary]
      await route.fulfill({ json: { items, page: 1, per_page: 25, total: items.length, pages: 1 } })
      return
    }
    if (collection && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      log.created.push(body)
      await route.fulfill({ status: 201, json: body.location_id === BRANCH_ID ? branchCurrent : current })
      return
    }
    const assessment: MockAssessment = url.pathname.includes(`/assessments/${BRANCH_ASSESSMENT_ID}`) ? branchCurrent : current
    const roles = assessment.kind === 'branch' ? BRANCH_ROLES : HO_ROLES
    if (method === 'POST' && url.pathname.endsWith('/nudge')) {
      log.signoff.push(['nudge', null])
      await route.fulfill({ json: { sent: true, assessment } })
      return
    }
    // The BCM board's rows are fixtures: the RA they act on is put in sign-off first.
    if (method === 'POST' && /\/(change-signer|approve-on-behalf)$/.test(url.pathname) && !assessment.current_signoff_role) {
      readyToSubmit(assessment)
      setStatus(assessment, 'in_signoff', roles[0]!)
    }
    if (method === 'POST' && url.pathname.endsWith('/change-signer')) {
      const body = route.request().postDataJSON() as { user_id: number, reason: string }
      log.signoff.push(['change-signer', body])
      const role = assessment.current_signoff_role!
      const index = assessment.signoffs.findIndex((row) => row.role === role)
      const previous = assessment.signoffs[index]?.name ?? null
      assessment.signoffs[index] = signoffRow(role, body.user_id)
      assessment.awaiting_signer = assessment.signoffs[index]!.signer
      assessment.signoff_history.push({
        action: 'reassigned', role, user: 'Test User', comment: body.reason, at: NOW,
        for_user: previous, to_user: assessment.signoffs[index]!.name,
      })
      await route.fulfill({ json: { sent: true, assessment } })
      return
    }
    if (method === 'POST' && url.pathname.endsWith('/approve-on-behalf')) {
      const body = route.request().postData() ?? ''
      log.signoff.push(['approve-on-behalf', body])
      const role = assessment.current_signoff_role!
      const row = assessment.signoffs.find((item) => item.role === role)!
      const evidence = { id: 1, filename: 'approval.pdf', size: 13, url: '/api/ra/assessments/1/attachments/1' }
      const reason = /name="reason"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? null
      Object.assign(row, { approved_at: NOW, signed_on: '2026-10-20', approved_by: 'Test User', comment: reason, evidence })
      assessment.signoff_history.push({
        action: 'approved', role, user: 'Test User', comment: reason, at: NOW,
        on_behalf: true, for_user: row.name, attachment: evidence,
      })
      const next = roles[roles.indexOf(role) + 1]
      setStatus(assessment, next ? 'in_signoff' : 'approved', next ?? null)
      actForSigner(assessment)
      await route.fulfill({ json: { sent: true, assessment } })
      return
    }
    const action = url.pathname.match(/\/(submit|approve|return)$/)?.[1]
    if (method === 'POST' && action) {
      const body = route.request().postDataJSON() as { comment?: string } | null
      log.signoff.push([action, body])
      if (action === 'submit') {
        setStatus(assessment, 'in_signoff', roles[0]!)
        assessment.returned_comment = null
        assessment.signoff_history.push({ action: 'submitted', role: null, user: 'Test User', comment: null, at: NOW })
      } else if (action === 'approve') {
        const role = assessment.current_signoff_role!
        Object.assign(assessment.signoffs.find((row) => row.role === role)!, {
          approved_at: NOW, signed_on: '2026-10-20', approved_by: 'Test User', comment: body?.comment ?? null,
        })
        assessment.signoff_history.push({ action: 'approved', role, user: 'Test User', comment: body?.comment ?? null, at: NOW })
        const next = roles[roles.indexOf(role) + 1]
        setStatus(assessment, next ? 'in_signoff' : 'approved', next ?? null)
      } else {
        assessment.signoff_history.push({ action: 'returned', role: assessment.current_signoff_role, user: 'Test User', comment: body?.comment ?? null, at: NOW })
        for (const row of assessment.signoffs) Object.assign(row, { approved_at: null, signed_on: null, approved_by: null, comment: null })
        setStatus(assessment, 'draft')
        Object.assign(assessment, { returned_comment: body?.comment ?? null, returned_by: 'Test User', returned_at: NOW })
      }
      await route.fulfill({ json: assessment })
      return
    }
    if (method === 'PUT' && !url.pathname.endsWith('/ratings')) {
      const body = route.request().postDataJSON() as {
        signoffs?: { role: string, signer_id: number | null }[]
        lic_user_id?: number
        licom_user_id?: number
      }
      if (body.lic_user_id) setTeam(assessment, 'lic', body.lic_user_id)
      if (body.licom_user_id) setTeam(assessment, 'licom', body.licom_user_id)
      if (body.signoffs) {
        log.signoff.push(['signers', body])
        for (const item of body.signoffs) {
          const row = signoffRow(item.role, item.signer_id)
          const index = assessment.signoffs.findIndex((existing) => existing.role === item.role)
          if (index >= 0) assessment.signoffs[index] = row
          else assessment.signoffs.push(row)
        }
      }
    }
    if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (method === 'PUT' && url.pathname.endsWith('/ratings')) {
      log.ratings.push((route.request().postDataJSON() as { ratings: unknown[] }).ratings)
    }
    await route.fulfill({ json: assessment })
  })
  await mockRaWorkflow(page, log)
  return log
}

/** A head office (or branch) RA as Monitoring and Approval list it. */
function workflowRef(branch: boolean, status: string, role: string | null = null) {
  return {
    id: branch ? BRANCH_ASSESSMENT_ID : 1,
    ref_no: branch ? 'RAB-2025-0001' : 'RA-2025-0001',
    period_year: 2025,
    assessment_date: '2025-03-10',
    status,
    current_signoff_role: role,
    highest_residual_level: 'Medium',
    approved_at: status === 'approved' ? '2025-03-20T03:00:00Z' : null,
    is_returned: false,
  }
}

function workflowLocations(branch: boolean) {
  const first = branch
    ? { id: BRANCH_ID, code: 'RA-BR-0001', kind: 'branch', name: BRANCH_LOCATION.name, region: BRANCH_LOCATION.region ?? 'Jabodetabek' }
    : { id: 1, code: 'RA-HQ-0001', kind: 'head_office', name: 'Griya CIMB Niaga 2', region: null }
  const second = branch
    ? { id: 31, code: 'RA-BR-0002', kind: 'branch', name: 'KCP Pondok Indah', region: 'Jabodetabek' }
    : { id: 2, code: 'RA-HQ-0002', kind: 'head_office', name: 'Graha CIMB Niaga', region: null }
  const approved = workflowRef(branch, 'approved')
  // The 2026 cycle, returned for changes and being worked on again.
  const open = { ...workflowRef(branch, 'draft'), id: 99, ref_no: branch ? 'RAB-2026-0002' : 'RA-2026-0002', period_year: 2026, assessment_date: '2026-03-02', is_returned: true }
  return [
    { location: first, approved, open, assessment_count: 2, renewal_date: '2026-03-10', days_left: -225, bucket: 'overdue', lic_name: 'Legiran', history: [open, approved] },
    { location: second, approved: null, open: null, assessment_count: 0, renewal_date: null, days_left: null, bucket: null, lic_name: null, history: [] },
  ]
}

function stepTitle(branch: boolean, role: string) {
  return ROLE_LABELS[branch ? 'branch' : 'head_office'].find((row) => row.role === role)?.title ?? role
}

function waitingRow(branch: boolean, step: string, signerId: number, days: number) {
  return {
    ...workflowRef(branch, 'in_signoff', step),
    location: workflowLocations(branch)[0]!.location,
    step,
    step_title: stepTitle(branch, step),
    signer: userRef(signerId),
    waiting_since: '2026-10-12T03:00:00Z',
    working_days_waiting: days,
    working_days_in_signoff: days + 2,
    submitted_at: '2026-10-08T03:00:00Z',
    submitted_by: 'Rina Kartika',
    reminders_sent: 0,
    escalated_at: null,
    level: days >= 7 ? 'escalated' : days >= 3 ? 'reminder' : 'ok',
  }
}

function paged<T>(items: T[], extra: Record<string, unknown> = {}) {
  return { items, page: 1, per_page: 25, total: items.length, pages: 1, ...extra }
}

/** Mocks the RA Monitoring (overview, renewals, register, bottlenecks) and Approval lists. */
async function mockRaWorkflow(page: Page, log: RaMockLog) {
  await page.route(/\/api\/ra\/(monitoring|approvals)\//, async (route) => {
    const url = new URL(route.request().url())
    log.workflow.push(`${url.pathname}${url.search}`)
    const branch = url.searchParams.get('kind') === 'branch'
    const roles = branch ? BRANCH_ROLES : HO_ROLES
    const name = url.pathname.split('/').slice(-2).join('/')
    const locations = workflowLocations(branch)
    const waiting = [waitingRow(branch, roles[2]!, 3, 6)]
    const step = url.searchParams.get('step')
    if (name === 'monitoring/overview') {
      await route.fulfill({
        json: {
          cards: { locations: 2, assessed: 1, not_assessed: 1, drafts: 0, in_signoff: 1, overdue_renewals: 1, due_in_90_days: 0, high_residual: 0, stuck_approvals: 0 },
          by_level: [{ level: 'Low', locations: 0 }, { level: 'Medium', locations: 1 }, { level: 'High', locations: 0 }, { level: 'none', locations: 1 }],
          approved_per_month: Array.from({ length: 12 }, (_, index) => ({
            month: `${index < 2 ? 2025 : 2026}-${String(((index + 10) % 12) + 1).padStart(2, '0')}`,
            assessments: index === 4 ? 1 : 0,
          })),
        },
      })
    } else if (name === 'monitoring/renewals') {
      await route.fulfill({ json: paged([locations[0]], { counts: { overdue: 1, due_30: 0, due_90: 0, later: 0 } }) })
    } else if (name === 'monitoring/register') {
      const state = url.searchParams.get('state')
      const rows = state === 'none' ? [locations[1]] : state === 'approved' ? [locations[0]] : state ? [] : locations
      await route.fulfill({ json: paged(rows) })
    } else if (name === 'monitoring/regions') {
      await route.fulfill({ json: { items: branch ? ['Jabodetabek', 'Region Jabar'] : [] } })
    } else if (name === 'bottlenecks/step-averages') {
      // Average working days per sign-off step over the approvals in the period.
      await route.fulfill({
        json: { items: roles.map((role, index) => ({ step: role, step_title: stepTitle(branch, role), approvals: index < 2 ? 2 : 0, average_working_days: index < 2 ? 1.5 + index * 3 : null })) },
      })
    } else if (name === 'monitoring/bottlenecks' || name === 'approvals/board') {
      await route.fulfill({ json: paged(step && step !== roles[2] ? [] : waiting) })
    } else if (name === 'approvals/inbox') {
      await route.fulfill({ json: paged([waitingRow(branch, roles[1]!, 1, 2)]) })
    } else if (name === 'approvals/upcoming') {
      await route.fulfill({ json: paged(waiting) })
    } else if (name === 'approvals/history') {
      const rows = [
        { action: 'approved', role: roles[0], comment: 'Checked with the floor wardens.', at: '2026-10-14T03:00:00Z', assessment: { ...workflowRef(branch, 'in_signoff', roles[1]!), location: locations[0]!.location } },
        { action: 'submitted', role: null, comment: null, at: '2026-10-08T03:00:00Z', assessment: { ...workflowRef(branch, 'in_signoff', roles[1]!), location: locations[0]!.location } },
        // BCM approved a step for me (on my behalf).
        { action: 'approved', on_behalf: true, for_user: 'Test User', user: 'Dewi Lestari', role: roles[0], comment: 'Approved by email on 12 Oct.', at: '2026-10-06T03:00:00Z', assessment: { ...workflowRef(branch, 'approved', null), location: locations[0]!.location } },
      ]
      const action = url.searchParams.get('action')
      const filtered = action === 'on_behalf'
        ? rows.filter((row) => row.on_behalf)
        : rows.filter((row) => !action || (row.action === action && !row.on_behalf))
      await route.fulfill({ json: paged(filtered) })
    } else {
      await route.fulfill({ status: 404, json: { error: 'not_found' } })
    }
  })
}

const PLACE = (id: number, kind: 'head_office' | 'branch', name: string, latitude: number, longitude: number, level: string | null = null) => ({
  id,
  kind,
  name,
  region: kind === 'branch' ? 'Jabodetabek' : null,
  address: null,
  latitude,
  longitude,
  latest: level ? { id: id * 10, ref_no: `RA-2025-00${id}`, period_year: 2025, status: 'approved', highest_residual_level: level } : null,
})

/** The location map: two buildings and three branches; Griya to KC Pondok Indah is 7,1 km. */
export const MAP_PLACES = [
  PLACE(1, 'head_office', 'Griya CIMB Niaga 2', -6.271633, 106.719358, 'Medium'),
  PLACE(2, 'head_office', 'Graha CIMB Niaga', -6.226012, 106.808215, 'High'),
  PLACE(11, 'branch', 'KCP Bintaro Sektor 9', -6.2716, 106.7375),
  PLACE(12, 'branch', 'KC Pondok Indah', -6.2652, 106.7837),
  PLACE(13, 'branch', 'KC Bandung Asia Afrika', -6.9214, 107.607),
]

const HAZARD = { code: 'H01', no: 1, short_name: 'Banjir/ Banjir Bandang', name: 'Banjir/ Banjir Bandang', category: { code: 'NAT', label: 'Natural disasters' } }
const STEPS = {
  immediate: ['Move people, documents and equipment to upper floors.', 'Call the emergency services (112) if anyone is hurt.'],
  stabilise: ['LIC: start the call tree.'],
  recover: ['Decide with the BCM team whether units move to their alternate site.'],
}

export const CRISIS = {
  id: 7,
  ref_no: 'CR-2026-0001',
  hazard_code: 'H01',
  hazard: HAZARD,
  location: { id: 1, kind: 'head_office', name: 'Griya CIMB Niaga 2' },
  latitude: -6.271633,
  longitude: 106.719358,
  radius_m: 5000,
  description: 'Kali Pesanggrahan overflowing.',
  started_at: '2026-10-21T04:52:00Z',
  status: 'open',
  closed_at: null,
  affected_count: 2,
  declared_by: 'Test User',
  closing_note: null,
  closed_by: null,
  updated_at: '2026-10-21T04:52:00Z',
  can_manage: true,
  can_delete: true,
  playbook: { reviewed: false, steps: STEPS, updated_at: null, updated_by: null },
  affected: [
    {
      location: { ...MAP_PLACES[0], latest: undefined },
      distance_m: 0,
      assessment: {
        id: 1,
        kind: 'head_office',
        ref_no: 'RA-2025-0001',
        period_year: 2025,
        status: 'approved',
        rating: {
          gross_level: 'Medium',
          residual_probability: 1,
          residual_impact: 2,
          residual_level: 'Low',
          mitigation: 'Pompa Buang (8 sampit) dan genset di GF',
          action_plan: null,
          cim_ref_no: null,
        },
      },
      contacts: [{ kind: 'fire_brigade', seq: 1, name: 'Damkar Tangerang Selatan', phone: '113', group_name: null, floor: null, address: null }],
      call_tree: [{ seq: 1, level: 1, caller: 'LICOM', contact_name: 'Budi Santoso', division: 'LIC', mobile: '0812-1111-2222', home_phone: null }],
      recovery_team: [],
      alternates: [{ location: { ...MAP_PLACES[3], latest: undefined }, distance_m: 7100 }],
    },
    {
      location: { ...MAP_PLACES[2], latest: undefined },
      distance_m: 2000,
      assessment: null,
      contacts: [],
      call_tree: [],
      recovery_team: [],
      alternates: [],
    },
  ],
  history: [{ action: 'declared', note: null, user: 'Test User', at: '2026-10-21T04:52:00Z' }],
}

const PLAYBOOK = ['H01', 'H02', 'H03'].map((code, index) => ({
  ...HAZARD,
  code,
  no: index + 1,
  short_name: ['Banjir/ Banjir Bandang', 'Tanah Longsor', 'Gempa Bumi'][index]!,
  name: ['Banjir/ Banjir Bandang', 'Tanah Longsor', 'Gempa Bumi'][index]!,
  reviewed: false,
  steps: STEPS,
  updated_at: null,
  updated_by: null,
}))

export interface RaMapLog {
  declared: Record<string, unknown>[]
  closed: unknown[]
  notes: unknown[]
  playbook: [string, unknown][]
  /** Approve / reject calls on the incident: [action, body]. */
  decisions: [string, unknown][]
}

/**
 * Mocks the location map, incidents and the playbook. `crisis: false` starts with no open incident;
 * `declare: false` signs in without ra.crisis.declare and ra.manage.
 */
export async function mockRaMap(page: Page, options: { crisis?: boolean, declare?: boolean, pending?: boolean, own?: boolean } = {}) {
  const log: RaMapLog = { declared: [], closed: [], notes: [], playbook: [], decisions: [] }
  const canDeclare = options.declare !== false
  await signIn(page, canDeclare ? {} : { permissions: ['ra.access'] })
  await page.route('**/api/ra/map-settings', (route) =>
    route.fulfill({ json: { tile_url: '/e2e-tiles/{z}/{x}/{y}.png', attribution: 'Test tiles', max_zoom: 19 } }),
  )
  await page.route('**/e2e-tiles/**', (route) => route.fulfill({ contentType: 'image/png', body: BLANK_PNG }))
  await page.route(/\/api\/ra\/formula/, (route) => route.fulfill({ json: withTexts(FORMULA) }))
  const crisis = structuredClone({
    ...CRISIS,
    can_manage: canDeclare,
    can_delete: canDeclare,
    approval_can: { approve: false, reject: false },
    decided_by: null as string | null,
    decided_at: null as string | null,
    decision_note: null as string | null,
  })
  if (options.pending) {
    // Declared by Rina; the signed-in user approves it.
    Object.assign(crisis, options.own
      ? { status: 'pending', declared_by: 'Test User', approval_can: { approve: false, reject: false, own: true } }
      : { status: 'pending', declared_by: 'Rina', approval_can: { approve: true, reject: true } })
  }
  const open = () => (options.crisis === false || !['open', 'pending'].includes(crisis.status) ? [] : [crisis])
  await page.route('**/api/ra/map', (route) => route.fulfill({
    json: { places: MAP_PLACES, unpinned: { head_office: 1, branch: 0 }, crises: open(), can_declare: canDeclare },
  }))
  await page.route(/\/api\/ra\/crises/, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const body = route.request().postDataJSON?.() as Record<string, unknown> | null
    if (/\/crises\/?$/.test(url.pathname) && method === 'POST') {
      log.declared.push(body!)
      await route.fulfill({ status: 201, json: crisis })
      return
    }
    if (/\/crises\/?$/.test(url.pathname)) {
      await route.fulfill({ json: { items: [crisis], page: 1, per_page: 25, total: 1, pages: 1 } })
      return
    }
    const decision = url.pathname.match(/\/(approve|reject)$/)?.[1]
    if (decision) {
      log.decisions.push([decision, body])
      const note = (body as { note?: string | null } | null)?.note ?? null
      Object.assign(crisis, {
        status: decision === 'approve' ? 'open' : 'rejected',
        decided_by: 'Test User',
        decided_at: '2026-10-21T05:30:00Z',
        decision_note: note,
        approval_can: { approve: false, reject: false },
      })
      crisis.history.push({ action: decision === 'approve' ? 'approved' : 'rejected', note, user: 'Test User', at: '2026-10-21T05:30:00Z' })
    }
    if (url.pathname.endsWith('/close')) {
      log.closed.push(body)
      Object.assign(crisis, { status: 'closed', closed_at: '2026-10-21T08:00:00Z', closed_by: 'Test User', closing_note: (body as { note?: string })?.note ?? null })
      crisis.history.push({ action: 'closed', note: crisis.closing_note, user: 'Test User', at: '2026-10-21T08:00:00Z' })
    }
    if (url.pathname.endsWith('/notes')) {
      log.notes.push(body)
      crisis.history.push({ action: 'note', note: (body as { note: string }).note, user: 'Test User', at: '2026-10-21T06:00:00Z' })
    }
    await route.fulfill({ json: crisis })
  })
  const playbook = structuredClone(PLAYBOOK)
  await page.route(/\/api\/ra\/playbook/, async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'PUT') {
      const code = url.pathname.split('/').pop()!
      const body = route.request().postDataJSON() as { steps: { phase: 'immediate' | 'stabilise' | 'recover', text: string }[] }
      log.playbook.push([code, body])
      const entry = playbook.find((item) => item.code === code)!
      entry.reviewed = true
      entry.updated_by = 'Test User'
      entry.updated_at = '2026-10-21T05:00:00Z' as never
      entry.steps = { immediate: [], stabilise: [], recover: [] } as never
      for (const step of body.steps) (entry.steps[step.phase] as string[]).push(step.text)
      await route.fulfill({ json: entry })
      return
    }
    await route.fulfill({ json: { items: playbook, can_edit: canDeclare } })
  })
  return log
}
