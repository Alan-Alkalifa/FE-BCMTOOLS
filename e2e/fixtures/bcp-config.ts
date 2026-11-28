import type { Page } from '@playwright/test'
import type { BcpConfigPayload, BcpConfigVersion } from '../../app/composables/useBcpConfigAdmin'
import { signIn, ALL_PERMISSIONS } from './auth'

export const BCP_PERMISSIONS = [...ALL_PERMISSIONS, 'bcp.config.view', 'bcp.config.manage', 'bcp.config.publish']

const LEVELS = ['black', 'red', 'amber', 'yellow', 'green'] as const
const byLevel = (text: string) => Object.fromEntries(LEVELS.map((code) => [code, `${text} ${code}`]))

/** A small payload of the same shape as the backend's template ver.23 baseline. */
export function bcpPayload(): BcpConfigPayload {
  return {
    scope: {
      required_categories: ['Business Critical'],
      workaround_categories: ['Business Critical'],
      chapter_categories: [
        { category: 'Business Critical', title: 'Fungsi bisnis kritikal', definition: 'MTD <= 4 jam.' },
        { category: 'Important', title: 'Fungsi bisnis important', definition: 'MTD > 4 jam dan <= 24 jam.' },
        { category: 'Others', title: 'Fungsi bisnis others', definition: 'MTD > 24 jam.' },
      ],
    },
    standard_text: Object.fromEntries(BCP_STANDARD_TEXT_KEYS.map((key) => [key, `Teks ${key} untuk {unit_name}.`])) as BcpConfigPayload['standard_text'],
    glossary: [
      { code: 'mtd', term: 'Maximum Tolerable Downtime (MTD)', definition: 'Waktu maksimum yang dapat diterima.' },
      { code: 'rto', term: 'Recovery Time Objective (RTO)', definition: 'Periode waktu pemulihan.' },
    ],
    crisis_teams: {
      imt: [{ code: 'lead', label: 'Ketua', min_level: 'D2', required: true, min_count: 1 }],
      rtf: [{ code: 'lead', label: 'Ketua', min_level: 'D3', required: true, min_count: 1 }],
      cmt_members: [{ code: 'vice_risk', title: 'Vice Chairman (Risk Management)', name: 'Henky Sulistyo' }],
      cmt_secretary: { code: 'cmt_secretary', title: 'Head of OTAA Risk Control Unit', name: 'Daniel Liunando' },
    },
    lod: {
      levels: LEVELS.map((code) => ({ code, label: code[0]!.toUpperCase() + code.slice(1), color: code })),
      criteria: [{ code: 'regulatory', label: 'Regulatory', descriptions: byLevel('Pelanggaran') }],
      activation: [{ code: 'plans', label: 'Aktivasi Plans', by_level: byLevel('BCP') }],
      notes: '',
    },
    workaround: {
      conditions: [{
        code: 'k1_main_site', title: 'Kondisi 1: Ruang kerja utama tidak dapat diakses', intro: '', scope: 'per_function', active: true,
        show_pandemic_levels: false, columns: [],
      }],
      pandemic_levels: [{ code: 'normal', phase: 'Aman', level: 'Normal', description: 'Tidak ada wabah' }],
      split_wfh_text: '',
    },
    contacts: {
      internal: [{ code: 'bcm', name: 'Bernard Budidharma', organization: 'BCM', service: '', phone_mobile: '0817', phone_office: '021', email: '' }],
      emergency: [{ code: 'e01', name: 'Polisi', phone: '112', fax: '-' }],
      needs_categories: [{ code: 'network', label: 'Jaringan / Network', example: 'Intranet' }],
      checklist: [{ code: 'c01', label: 'Listrik' }],
    },
    approval_steps: [
      { code: 'rtf_lead', group: 'prepared', title: 'Disiapkan oleh: Ketua RTF', signer_mode: 'plan_role', plan_role: 'rtf_lead', name: null, position: null, required: true },
      { code: 'head_of', group: 'approval', title: 'Approval by: Head of terkait', signer_mode: 'chosen', plan_role: null, name: null, position: null, required: true },
    ],
    document: { review_period_months: 12, test_period_months: 12, template_label: 'ver.23_2026' },
    scenarios: [{
      code: 'k1_alternate_site', name: 'Menggunakan lokasi kerja alternatif', condition_code: 'k1_main_site', description: '', active: true,
      procedures: [{ code: 'relocate', name: 'Pindah ke lokasi kerja alternatif', procedure: '- Pindah ke ruang kerja alternatif', form: '', pic: 'Ketua RTF', notes: '', active: true }],
    }],
  }
}

export function bcpVersion(code: string, status: BcpConfigVersion['status'], extra: Partial<BcpConfigVersion> = {}): BcpConfigVersion {
  const draft = status === 'draft'
  return {
    id: draft ? 2 : 1,
    code,
    name: draft ? `BCP configuration ${code}` : 'BCP template ver.23 baseline',
    notes: null,
    status,
    revision: 1,
    based_on: draft ? 'V1' : null,
    created_by: draft ? 'Rina' : null,
    created_at: '2026-11-28T02:00:00Z',
    requested_by: null,
    requested_by_id: null,
    requested_at: null,
    published_by: null,
    published_at: draft ? null : '2026-11-27T02:00:00Z',
    used_by: 0,
    payload: bcpPayload(),
    problems: [],
    locked: { levels: ['amber', 'black', 'green', 'red', 'yellow'], conditions: ['k1_main_site'], columns: {} },
    can: { edit: draft, request_publish: draft, withdraw_request: false, publish: false, discard: draft },
    changes: [],
    ...extra,
  }
}

type Call = { method: string, path: string, body: unknown }

/** Administration > BCP configuration with V1 active and, when given, a draft. */
export async function mockBcpConfig(page: Page, options: { draft?: BcpConfigVersion | null, permissions?: string[] } = {}) {
  await signIn(page, { permissions: options.permissions ?? BCP_PERMISSIONS })
  const calls: Call[] = []
  const versions: { active: BcpConfigVersion, draft: BcpConfigVersion | null } = {
    active: bcpVersion('V1', 'active'),
    draft: options.draft ?? null,
  }
  await page.route('**/api/admin/bcp-config/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method: request.method(), path, body })
    const rows = [versions.draft, versions.active].filter((row): row is BcpConfigVersion => !!row)
    if (path.endsWith('/versions') && request.method() === 'GET') {
      return route.fulfill({ json: { items: rows, can_start_draft: !versions.draft } })
    }
    if (path.endsWith('/versions') && request.method() === 'POST') {
      versions.draft = bcpVersion('V2', 'draft')
      return route.fulfill({ status: 201, json: versions.draft })
    }
    const part = path.match(/\/parts\/(\w+)$/)?.[1]
    if (part && versions.draft) {
      const value = (body as { value: unknown }).value
      versions.draft = { ...versions.draft, revision: versions.draft.revision + 1, payload: { ...versions.draft.payload, [part]: value } }
      return route.fulfill({ json: versions.draft })
    }
    const code = path.match(/\/versions\/(V\d+)$/)?.[1]
    const row = rows.find((item) => item.code === code)
    if (row) return route.fulfill({ json: row })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  return { calls, versions }
}

const BCP_STANDARD_TEXT_KEYS = [
  'kata_pengantar', 'tujuan', 'dasar_penyusunan', 'ruang_lingkup', 'penggunaan', 'uji_coba', 'pengkinian',
  'asumsi', 'budget', 'cmt', 'cct', 'imt', 'rtf', 'keterkaitan', 'eskalasi', 'mekanisme_eskalasi',
  'lokasi_assembly', 'ccc', 'prosedur_pemulihan', 'kembali_normal', 'uji_coba_dokumen', 'pengkinian_dokumen',
  'proposal_objective', 'proposal_reasons', 'proposal_background',
] as const
