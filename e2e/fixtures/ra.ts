import type { Page } from '@playwright/test'
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
  { name: 'KCP Bintaro Sektor 9', latitude: -6.2853, longitude: 106.7272 },
  { name: 'KCP Pondok Indah', latitude: -6.2655, longitude: 106.7834 },
  { name: 'KC Bandung Asia Afrika', latitude: -6.9215, longitude: 107.6106 },
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

export const LOCATIONS = [
  {
    id: 1,
    kind: 'head_office',
    name: 'Griya CIMB Niaga 2',
    region: null,
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
    kind: 'head_office',
    name: 'Graha CIMB Niaga',
    region: null,
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
  location: { id: 1, kind: 'head_office', name: 'Griya CIMB Niaga 2', region: null },
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
  { id: 1, display_name: 'Legiran', email: 'legiran@example.com', job_title: 'LIC', department: 'SPAPM' },
  { id: 2, display_name: 'Rina Kartika', email: 'rina@example.com', job_title: 'Head of Retail Operations', department: 'Retail' },
  { id: 3, display_name: 'Budi Hartono', email: 'budi@example.com', job_title: 'Alternate LICOM', department: 'GA' },
  { id: 4, display_name: 'Dewi Lestari', email: 'dewi@example.com', job_title: 'Head of BCM', department: 'BCM' },
]
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
}
type MockAssessment = {
  kind: string
  status: string
  is_complete: boolean
  current_signoff_role: string | null
  awaiting_signer: ReturnType<typeof userRef>
  can_edit: boolean
  can_submit: boolean
  can_approve: boolean
  can_return: boolean
  signoffs: MockSignoff[]
  returned_comment: string | null
  returned_by: string | null
  returned_at: string | null
  approved_at: string | null
  signoff_history: { action: string, role: string | null, user: string | null, comment: string | null, at: string }[]
}

const NOW = '2026-10-20T03:00:00Z'
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** Every role signed by users 1–4 in turn; a complete assessment ready to submit. */
function readyToSubmit(assessment: MockAssessment) {
  const roles = assessment.kind === 'branch' ? BRANCH_ROLES : HO_ROLES
  assessment.is_complete = true
  assessment.signoffs = roles.map((role, index) => signoffRow(role, index + 1))
}

function signoffRow(role: string, signerId: number | null, designation?: string | null): MockSignoff {
  const signer = userRef(signerId)
  return {
    role,
    signer,
    name: signer?.name ?? null,
    designation: designation ?? signer?.job_title ?? null,
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
}

/**
 * Mocks /api/ra/* for RA and RA Branch (`?kind=branch`, branch 11, assessment 12). Saving ratings
 * echoes the assessment back; the log records what was sent.
 */
export async function mockRa(
  page: Page,
  options: { locationInUse?: boolean, ready?: boolean, status?: 'in_signoff' | 'approved' } = {},
) {
  const log: RaMockLog = { ratings: [], created: [], signoff: [], lists: {}, deletedLocations: [] }
  const current = structuredClone(ASSESSMENT) as typeof ASSESSMENT & MockAssessment
  const branchCurrent = structuredClone(BRANCH_ASSESSMENT) as typeof BRANCH_ASSESSMENT & MockAssessment
  if (options.ready || options.status) readyToSubmit(current)
  if (options.status === 'in_signoff') setStatus(current, 'in_signoff', 'prepared_by')
  if (options.status === 'approved') setStatus(current, 'approved')
  await signIn(page)
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
    const branch = new URL(route.request().url()).searchParams.get('kind') === 'branch'
    return route.fulfill({ json: branch ? BRANCH_FORMULA : FORMULA })
  })
  const location = structuredClone(LOCATION)
  const branchLocation = structuredClone(BRANCH_LOCATION)
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
      added = { ...EMPTY_LOCATION, ...body }
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
    const branch = url.searchParams.get('kind') === 'branch'
    await route.fulfill({ json: { items: branch ? [branchLocation, ...PINNED_BRANCHES] : LOCATIONS } })
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
      const body = route.request().postDataJSON() as { signoffs?: { role: string, signer_id: number | null, designation: string | null }[] }
      if (body.signoffs) {
        log.signoff.push(['signers', body])
        for (const item of body.signoffs) {
          const row = signoffRow(item.role, item.signer_id, item.designation)
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
  return log
}
