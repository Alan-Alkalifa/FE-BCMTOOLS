/** Administration > BCP configuration: its tabs, and where each part of the BCP template is set. */

export const BCP_CONFIG_TABS = [
  { value: 'versions', label: 'Versions', icon: 'i-lucide-git-branch' },
  { value: 'scope', label: 'Scope and triggers', icon: 'i-lucide-target', part: 'scope' },
  { value: 'text', label: 'Standard text', icon: 'i-lucide-file-text', part: 'standard_text' },
  { value: 'glossary', label: 'Glossary', icon: 'i-lucide-book-open', part: 'glossary' },
  { value: 'teams', label: 'Crisis teams', icon: 'i-lucide-users', part: 'crisis_teams' },
  { value: 'lod', label: 'Level of disruption', icon: 'i-lucide-siren', part: 'lod' },
  { value: 'workaround', label: 'Workaround conditions', icon: 'i-lucide-route', part: 'workaround' },
  { value: 'contacts', label: 'Contacts and checklists', icon: 'i-lucide-contact', part: 'contacts' },
  { value: 'steps', label: 'Approval template', icon: 'i-lucide-signature', part: 'approval_steps' },
  { value: 'rules', label: 'Document rules', icon: 'i-lucide-settings-2', part: 'document' },
  { value: 'changes', label: 'Changes', icon: 'i-lucide-git-compare' },
] as const

export type BcpConfigTab = (typeof BCP_CONFIG_TABS)[number]['value']

/** Standard text keys, grouped by the chapter of the template they print in. */
export const BCP_STANDARD_TEXT_GROUPS: { title: string, keys: { key: string, label: string }[] }[] = [
  {
    title: 'Proposal for approval',
    keys: [
      { key: 'proposal_objective', label: 'Objective' },
      { key: 'proposal_reasons', label: 'Reasons for approval required' },
      { key: 'proposal_background', label: 'Background' },
    ],
  },
  {
    title: '1. Pendahuluan',
    keys: [
      { key: 'kata_pengantar', label: '1.1 Kata pengantar' },
      { key: 'tujuan', label: '1.2 Tujuan' },
      { key: 'dasar_penyusunan', label: '1.3 Dasar penyusunan' },
      { key: 'ruang_lingkup', label: '1.4 Ruang lingkup' },
      { key: 'penggunaan', label: '1.5 Penggunaan dokumen BC Plan' },
      { key: 'uji_coba', label: '1.6 Uji coba' },
      { key: 'pengkinian', label: '1.7 Pengkinian' },
      { key: 'asumsi', label: '1.8 Asumsi dan batasan' },
      { key: 'budget', label: '1.9 Budget/anggaran' },
    ],
  },
  {
    title: '2. Manajemen krisis',
    keys: [
      { key: 'cmt', label: '2.1 Crisis Management Team (CMT)' },
      { key: 'cct', label: '2.2 Crisis Coordination Team (CCT)' },
      { key: 'imt', label: '2.3 Incident Management Team (IMT)' },
      { key: 'rtf', label: '2.4 Recovery Task Force (RTF)' },
      { key: 'keterkaitan', label: '2.5 Keterkaitan dokumen BCM lainnya' },
      { key: 'eskalasi', label: '2.6 Eskalasi krisis' },
      { key: 'mekanisme_eskalasi', label: '2.7 Mekanisme eskalasi' },
    ],
  },
  {
    title: '3. Lokasi',
    keys: [
      { key: 'lokasi_assembly', label: '3.3 Assembly area' },
      { key: 'ccc', label: '3.4 Crisis Command Centre (CCC)' },
    ],
  },
  {
    title: '5, 7–9. Pemulihan, kembali normal, uji coba dan pengkinian',
    keys: [
      { key: 'prosedur_pemulihan', label: '5.2–5.3 Prosedur dan kebutuhan pemulihan' },
      { key: 'kembali_normal', label: '7. Kembali ke kondisi normal' },
      { key: 'uji_coba_dokumen', label: '8. Uji coba dokumen BC Plan' },
      { key: 'pengkinian_dokumen', label: '9. Pengkinian dokumen BC Plan' },
    ],
  },
]

/**
 * Where each chapter and appendix of Template BCP Unit Kerja ver.23 is configured. Parts that
 * come from the BIA or are filled in on each BCP are named, so the map covers the whole template.
 */
export const BCP_DOCUMENT_MAP: { part: string, purpose: string, targets: { label: string, tab: BcpConfigTab }[] }[] = [
  {
    part: 'Proposal for approval',
    purpose: 'The approval sheet: objective, reasons, background, and who prepares, reviews and approves the BCP.',
    targets: [{ label: 'Proposal text', tab: 'text' }, { label: 'Approval template', tab: 'steps' }],
  },
  {
    part: '1. Pendahuluan',
    purpose: 'Foreword, objective, regulations, scope, use, testing, updates, assumptions and budget, and the glossary.',
    targets: [{ label: 'Standard text', tab: 'text' }, { label: 'Glossary (1.10)', tab: 'glossary' }, { label: 'Review and test periods', tab: 'rules' }],
  },
  {
    part: '2. Manajemen krisis',
    purpose: 'CMT, CCT, IMT and RTF, escalation, and the level of disruption with who activates which plan.',
    targets: [{ label: 'Standard text', tab: 'text' }, { label: 'Crisis teams', tab: 'teams' }, { label: 'Level of disruption (2.8)', tab: 'lod' }],
  },
  {
    part: '3. Lokasi',
    purpose: 'Main and alternate work locations come from the BIA; the assembly area and CCC text are standard.',
    targets: [{ label: 'Assembly area and CCC text', tab: 'text' }],
  },
  {
    part: '4. Fungsi bisnis dan sistem aplikasi',
    purpose: 'Functions, MTD and RTO come from the BIA and SCCA. The categories and their chapter titles are set here.',
    targets: [{ label: 'Scope and triggers', tab: 'scope' }],
  },
  {
    part: '5. Proses pemulihan',
    purpose: 'Recovery priority is filled in on each BCP; the relocation and recovery procedures are standard.',
    targets: [{ label: 'Recovery procedures', tab: 'text' }, { label: 'Which categories get a priority', tab: 'scope' }],
  },
  {
    part: '6. Prosedur workaround',
    purpose: 'The conditions, the columns each BCP fills in per critical function, the pandemic alert levels and the split operation and WFH rules.',
    targets: [{ label: 'Workaround conditions', tab: 'workaround' }],
  },
  {
    part: '7–9. Kembali normal, uji coba, pengkinian',
    purpose: 'Return to normal, plan testing and document updates.',
    targets: [{ label: 'Standard text', tab: 'text' }, { label: 'Document rules', tab: 'rules' }],
  },
  {
    part: 'Lampiran 1–5 · Tim dan eskalasi',
    purpose: 'IMT, RTF and staff lists are filled in on each BCP. The roles, CMT members and CMT secretary of the escalation chart are set here.',
    targets: [{ label: 'Crisis teams', tab: 'teams' }],
  },
  {
    part: 'Lampiran 6–7, 13 · Kontak',
    purpose: 'Default internal contacts and emergency numbers; each BCP adds its own dependencies.',
    targets: [{ label: 'Contacts and checklists', tab: 'contacts' }],
  },
  {
    part: 'Lampiran 11–12 · Kesiapan lokasi alternatif',
    purpose: 'Categories of what the alternate site needs, and the readiness checklist.',
    targets: [{ label: 'Contacts and checklists', tab: 'contacts' }],
  },
]
