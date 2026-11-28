import type { Page } from '@playwright/test'
import type { BcpEligible, BcpPlan, BcpPlanSummary } from '../../app/composables/useBcp'
import { signIn, ALL_PERMISSIONS } from './auth'

export const BCP_USER_PERMISSIONS = [...ALL_PERMISSIONS, 'bcp.access', 'bcp.create', 'bcp.report.download']

export function bcpPlan(extra: Partial<BcpPlan> = {}): BcpPlan {
  return {
    id: 7,
    ref_no: 'BCP-2026-0001',
    name: 'Trade Operations',
    status: 'draft',
    doc_version: 1,
    revision: 3,
    group: { directorate: 'Operations, Technology, Analytics & AI', sub_directorate: 'Central Operations', org_group: 'Trade Operations', description: 'Ekspor dan impor' },
    bia: { id: 11, ref_no: 'BIA-2026-0001', finalised_at: '2026-11-20T02:00:00Z', version: 0 },
    config: { version_id: 1, code: 'V1', latest_code: 'V1' },
    coordinator: { id: 1, name: 'Test User', nik: '3001661', phone: '0819', email: 'test@example.com' },
    alternate: null,
    functions: [
      { id: 21, seq: 1, name: 'Kliring', category: 'Business Critical', expected_mtd: '4 hours', apps: [{ application_id: 3, name: 'Murex', rto: '2-6', rto_hours: 6, is_other: false }], rto_over_mtd: true, critical: true, in_bia: true, fields: {} },
      { id: 22, seq: 2, name: 'Laporan', category: 'Important', expected_mtd: '1 day', apps: [], rto_over_mtd: null, critical: false, in_bia: true, fields: {} },
    ],
    conditions: [
      {
        code: 'k1_main_site', title: 'Kondisi 1: Ruang kerja utama tidak dapat diakses', intro: '- Gedung tidak bisa dimasuki', columns: [], show_pandemic_levels: false,
        rows: [{ id: 101, scenario_code: 'k1_alternate_site', scenario_name: 'Menggunakan lokasi kerja alternatif', procedure_code: 'relocate', procedure: '- Pindah ke ruang kerja alternatif', form: '', pic: 'Ketua RTF', functions: 'all' }],
      },
      {
        code: 'k2_system_network', title: 'Kondisi 2: Gangguan Sistem dan Jaringan', intro: '', show_pandemic_levels: false,
        columns: [{ code: 'core_banking', label: 'Core System (A)', example: 'SIBS-ETP', active: true }, { code: 'other_system', label: 'Other System (B)', example: 'RTGS', active: true }],
        rows: [{ id: 102, scenario_code: 'k2_local', scenario_name: 'Skenario lainnya', procedure_code: 'local', procedure: '- Workaround per sistem', form: '', pic: 'Ketua RTF', functions: 'all' }],
      },
    ],
    pandemic_levels: [],
    permissions: { can_edit: true, can_view: true },
    steps: [
      { code: 'rtf_lead', group: 'prepared', title: 'Disiapkan oleh: Ketua RTF', signer_mode: 'plan_role', required: true, name: null, position: null, pickable: true, user: { id: 41, display_name: 'Rudi RTF', email: 'rudi@example.com', job_title: 'Trade Ops Head' } },
      { code: 'bcm_head', group: 'reviewed', title: 'Kaji ulang: Business Continuity Management Head', signer_mode: 'fixed', required: true, name: 'Bernard Budidharma', position: 'Business Continuity Management Head', pickable: false, user: null },
      { code: 'head_of', group: 'approval', title: 'Approval by: Head of terkait', signer_mode: 'chosen', required: true, name: null, position: null, pickable: true, user: { id: 42, display_name: 'Hana Head', email: 'hana@example.com', job_title: 'Operations Director' } },
    ],
    missing: { summary: [], k1_main_site: [], k2_system_network: [] },
    can_submit: true,
    signoffs: [],
    pending_step: null,
    submitted_at: null,
    invalid_reason: null,
    no_longer_required: null,
    attachment: null,
    events: [
      { id: 2, action: 'saved', actor: 'Test User', detail: { section: 'k1_main_site' }, at: '2026-11-28T03:00:00Z' },
      { id: 1, action: 'created', actor: 'Test User', detail: {}, at: '2026-11-28T02:00:00Z' },
    ],
    created_at: '2026-11-28T02:00:00Z',
    updated_at: '2026-11-28T03:00:00Z',
    ...extra,
  }
}

export function bcpSummary(plan = bcpPlan()): BcpPlanSummary {
  return {
    id: plan.id, ref_no: plan.ref_no, name: plan.name, status: plan.status, org_group: plan.group.org_group,
    directorate: plan.group.directorate, sub_directorate: plan.group.sub_directorate, bia_ref_no: plan.bia.ref_no,
    critical: 1, coordinator: 'Test User', config_code: 'V1', next_step: 'Fill in the BCP', no_longer_required: false, updated_at: plan.updated_at,
  }
}

export const BCP_USERS = [
  { id: 41, display_name: 'Rudi RTF', email: 'rudi@example.com', job_title: 'Trade Ops Head', department: 'Trade Operations' },
  { id: 43, display_name: 'Sari Signer', email: 'sari@example.com', job_title: 'Trade Finance Head', department: 'Trade Operations' },
]

export const ELIGIBLE: BcpEligible = {
  bia_id: 11, bia_ref_no: 'BIA-2026-0001', finalised_at: '2026-11-20T02:00:00Z', directorate: 'Operations, Technology, Analytics & AI',
  sub_directorate: 'Central Operations', org_group: 'Trade Operations', functions: 2, critical: 1,
}

type Call = { method: string, path: string, body: unknown }

/** BCP > Manage with the given drafts, Groups waiting to start and one plan to open. */
export async function mockBcp(page: Page, options: { drafts?: BcpPlanSummary[], eligible?: BcpEligible[], plan?: BcpPlan, permissions?: string[], conflictOnSubmit?: boolean } = {}) {
  await signIn(page, { permissions: options.permissions ?? BCP_USER_PERMISSIONS })
  const calls: Call[] = []
  let plan = options.plan ?? bcpPlan()
  let conflict = options.conflictOnSubmit ?? false
  await page.route('**/api/bcp/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method: request.method(), path, body })
    if (path.endsWith('/api/bcp/eligible')) return route.fulfill({ json: { items: options.eligible ?? [] } })
    if (path.endsWith('/api/bcp/plans') && request.method() === 'GET') {
      const drafts = options.drafts ?? []
      return route.fulfill({ json: { items: drafts, total: drafts.length, page: 1, per_page: 20 } })
    }
    if (path.endsWith('/api/bcp/plans') && request.method() === 'POST') return route.fulfill({ status: 201, json: plan })
    if (path.endsWith('/attachment') && request.method() === 'POST') {
      plan = {
        ...plan,
        attachment: { filename: 'Lampiran BCP.docx', content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 20480, uploaded_by: 'Test User', uploaded_at: '2026-11-28T04:00:00Z' },
        events: [{ id: 9, action: 'attachment_added', actor: 'Test User', detail: { filename: 'Lampiran BCP.docx' }, at: '2026-11-28T04:00:00Z' }, ...plan.events],
      }
      return route.fulfill({ json: plan })
    }
    if (path.endsWith('/attachment') && request.method() === 'DELETE') {
      plan = { ...plan, attachment: null }
      return route.fulfill({ json: plan })
    }
    if (path.endsWith('/submit') && conflict) {
      // The alternate saved meanwhile: the next read returns the newer revision.
      conflict = false
      plan = { ...plan, revision: plan.revision + 1 }
      return route.fulfill({ status: 409, json: { error: 'conflict', message: 'This BCP changed. Reload it before continuing.' } })
    }
    if (path.endsWith('/submit')) {
      plan = {
        ...plan,
        status: 'in_approval',
        revision: plan.revision + 1,
        can_submit: false,
        permissions: { can_edit: false, can_view: true },
        pending_step: 'rtf_lead',
        submitted_at: '2026-11-28T05:00:00Z',
        signoffs: plan.steps.map((step) => ({
          code: step.code, title: step.title, signer_mode: step.signer_mode, user_id: step.user?.id ?? null,
          name: step.user?.display_name ?? step.name, position: step.user?.job_title ?? step.position, required: step.required,
          status: 'pending', pending_since: step.code === 'rtf_lead' ? '2026-11-28T05:00:00Z' : null, decided_at: null,
        })),
        events: [{ id: 10, action: 'submitted', actor: 'Test User', detail: {}, at: '2026-11-28T05:00:00Z' }, ...plan.events],
      }
      return route.fulfill({ json: plan })
    }
    if (request.method() === 'PUT') {
      plan = { ...plan, revision: plan.revision + 1 }
      return route.fulfill({ json: plan })
    }
    if (/\/api\/bcp\/plans\/\d+$/.test(path)) return route.fulfill({ json: plan })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  await page.route('**/api/users**', (route) => route.fulfill({ json: { items: BCP_USERS } }))
  return { calls }
}
