/**
 * The guidance of the BIA workbook (Template BIA ver 2.4) on the web: the notes on its cells, the
 * instructions in its headers and the reference tables at the bottom of its sheets. Each note is
 * keyed by the field it explains; a line starting with "- " is shown as a bullet.
 */
export const BIANCA_NOTES = {
  // Sign Off Page, Section A
  group: 'The Directorate, Sub Directorate and Group this BIA is for. The BIA helps them set the Maximum Tolerable Downtime (MTD) of their business functions, the recovery priorities and the resources recovery needs.',
  group_description: 'Describe the main functions of the Group.',
  main_location: 'The building the Group works from: full address, building name and floor.',
  alt_location: 'Where the Group works when the main location can\'t be used: full address, building name and floor.',
  recovery_strategy: 'Write the Group\'s high-level recovery strategy. The recovery level of each function (Part 3) should align with it.',
  bcm_person: 'The PIC appointed as BCM Coordinator / Alternate BCM Coordinator for the Group. They sign the BIA as its maker.',
  ra_considers_bc: 'Have you considered business continuity in your risk assessment process?',
  ra_controls_included: 'Have you included business continuity controls in the risk score cards / profiling?',
  ra_tools: 'If Yes, name the risk assessment tools used to identify and assess risk, e.g. ShARP, ORMS.',
  ra_justification: 'Needed if business continuity was neither considered in the risk assessment process nor included in the risk score cards / profiling.',

  // RA Questionnaire
  staff_senior: 'Grade U1–U3. At CIMB Niaga:\n- First VP\n- Senior VP\n- Executive VP',
  staff_middle: 'Grade U4–U5. At CIMB Niaga:\n- AVP\n- VP',
  staff_manager: 'Grade U6–U9. At CIMB Niaga:\n- Officer\n- AM\n- Manager\n- Senior Manager',
  staff_non_staff: 'Grade U10–U11.',
  staff_others: 'At CIMB Niaga: contract employees (karyawan kontrak) or outsourced employees (karyawan outsource). Say who they are.',
  staff_total: 'The total should match the Group\'s current organisation chart (the workbook asks for it to be attached).',
  ra_completed: 'Has the Business Continuity Risk Assessment been completed for your location? If No, the Head of Sub Directorate coordinates completing it, or check with BCM.',

  // Part 1
  part1: 'Impact if the business activities STOP TOTALLY, from the point of disruption to the end of week 4. Losses are cumulative.',
  loss: 'Potential cumulative financial loss in IDR. Above IDR 4 billion is Very High and makes that period the Suggested MTD. See the matrix in Reference.',
  regulatory_score: '3: breach of laws and/or regulations, including the requirements of the local bank regulators.\n2: non-compliance with guidelines or best practices of the internal / local bank associations / regulators.\n1: no foreseeable breach or non-compliance.',
  customer_score: '3: more than 20% of the business unit\'s customers affected by the disaster.\n2: less than 20% affected.\n1: no customer affected.',
  suggested_mtd: 'The first period in which:\n- the cumulative financial loss is more than IDR 4 billion, or\n- the regulatory impact is rated 3, or\n- the customer service impact is rated 3.\nWhichever comes first. If none does, pick 4 weeks.',

  // Part 2a
  expected_mtd: 'Equal to or shorter than the Suggested MTD, e.g. when a local regulator requires it. It sets the Business Function Category (see Reference).',
  it_system: 'Pick from the application list (A–Z). If the function uses no application, pick NA. If the system isn\'t in the list, use Others and type its name.',
  rto: 'The IT committed RTO of the system. Justify it in the Part 2a note if the RTO is equal to or longer than the Expected MTD. For a system under Others, confirm it with IT / the vendor supporting the app.',
  rpo: 'The IT committed RPO. For a system under Others, confirm it with IT / the vendor supporting the app.',
  workaround: 'Is there a process workaround in place (Yes / No)? Describe the workaround in the BCP.',
  backlog: 'Type 0 if there is no backlog. Backlog is the delayed transactions / work that must be keyed into the system again. It relates to the IT committed RPO.',
  system_usage: 'How much the business function depends on the system: for inquiry only, or for transactions.',
  gaps: 'Mandatory when the RTO is longer than the MTD, there is no workaround and the function fully depends on the system.',
  daat: 'Damage Assessment Allowable Time for BCP / DR activation:\nDAAT = Expected MTD − system RTO − backlog clearing time.\nWorked out automatically.',

  // Part 2b
  planned_capacity: 'The capacity (%) this business function must run at during a disruption.',
  upstream: 'Who triggers the activity. If there is no upstream, type NA.',
  downstream: 'Who receives or processes your output / instruction. If there is no downstream, type NA.',
  dependency_capacity: 'Planned capacity (%) of the upstream / downstream. Justify it in the Part 2b note if it is lower than your function\'s.',
  dependency_mtd: 'Expected MTD of the upstream / downstream. Justify it in the Part 2b note if it is longer than your function\'s.',
  sla: 'The SLA time in the agreement. If there is no SLA, pick or type NA.',
  outsourced: 'Are they an outsourcing service provider?',
  material: 'Do they provide material services?',

  // Part 3
  total_staff: 'Must tally with the total head count in the department organisation chart.',
  staff_required: 'Staff needed to deliver the planned capacity. A 50% planned capacity doesn\'t mean half of the staff. See the example in Reference.',
  recovery_level: 'The expected business / support recovery level, aligned with the Group recovery strategy on the Sign off page. See the example in Reference.',
  prioritization_strategy: '- Which transactions are processed first?\n- Which support function is prioritised first?\n- Can all project work stop?',
  outstanding_strategy: '- Can the outstanding work be outsourced to a 3rd party?\n- Can staff work in shifts (2–3 shifts round the clock) to clear the daily outstanding work?\n- Can the shift arrangement run for up to 4 weeks of disruption?\n- Must a system be brought offline for a batch job run?',
  alt_site_strategy: 'See the recommended alternate site strategy for each Business Function Category in Reference.',
  seats_current: 'BCP seats available at the alternate site today, if any.',
  seats_required: 'Total BCP seats needed after this BIA. This lets you plan the BCP seats.',
  resources: 'Resources needed at the alternate site to meet the planned capacity, excluding work from home.',
  res_others: 'For example:\n- office connection to SIBS or to UAT development\n- email\n- laptop\n- a specific application such as a Bloomberg terminal or Reuters Messenger',
  vital_record: 'Mandatory for a Business Critical function.',

  // Part 4
  description: 'A brief description of the critical business function.',
  frequency: 'E.g. daily, weekly, monthly, quarterly, semi-annually, annually, a specific date / deadline.',
  critical_timings: 'Deadlines the Bank must meet to fulfil its business obligations.',
  critical_activity: 'The activity that must be performed at the critical timing / deadline to meet the Bank\'s obligation.',
} as const

export type BiancaNoteKey = keyof typeof BIANCA_NOTES

/** Part 3 reference: the recommended alternate site strategies of each category. */
export const BIANCA_ALT_SITE_BY_CATEGORY: Record<string, { strategies: string[], text: string }> = {
  'Business Critical': {
    strategies: ['Dedicated BCP Site', 'Split Operations for BAU Activities'],
    text: 'Dedicated BCP site (dedicated BCP PCs) / split operations for BAU activities.',
  },
  'Important': {
    strategies: ['Reciprocal BCP Site'],
    text: 'Reciprocal BCP site: two departments at different locations agree to share / release certain PCs as BCP PCs for each other when they activate their BC plan.',
  },
  'Others': {
    strategies: ['Work from Home/ Place with Internet/ Office Network Connection'],
    text: 'Work from home / a place with internet / office network connection, to keep supporting the expected business / support recovery level.',
  },
}

/** Part 1 reference: the potential cumulative financial loss matrix (SOP BIA 2026). */
export const BIANCA_LOSS_MATRIX = [
  { impact: 'Very High', loss: 'IDR 4 billion' },
  { impact: 'High', loss: '≥ IDR 2 billion – IDR 4 billion' },
  { impact: 'Medium', loss: '≥ IDR 300 million – IDR 2 billion' },
  { impact: 'Low', loss: '> IDR 200 million – IDR 300 million' },
  { impact: 'Very Low', loss: '< IDR 200 million' },
]

/** Part 2a reference: the Business Function Categorization Criteria. */
export const BIANCA_CATEGORY_CRITERIA = [
  {
    category: 'Business Critical',
    mtd: 'Recovery time requirement ≤ 4 hours',
    points: [
      'Critical business functions and processes with the greatest impact on the company\'s operations and potential for recovery.',
      'An outage exposes the financial services industry to systemic risk.',
      'An outage exposes customers / service providers / stakeholders to excessive risk and leads to serious legal and financial ramifications.',
      'The tolerance for such an outage is very low.',
    ],
  },
  {
    category: 'Important',
    mtd: 'Recovery time requirement > 4 hours and ≤ 24 hours',
    points: [
      'Important business functions and processes that don\'t stop the business from operating immediately but have a longer-term impact.',
      'An outage may have some legal or financial ramifications and may affect functional units and business systems.',
    ],
  },
  {
    category: 'Others',
    mtd: 'Recovery time requirement > 24 hours',
    points: ['Other / minor business functions and processes, prioritised last while business operations are being recovered.'],
  },
]

/**
 * Part 1's rule for the Suggested MTD: the first period where the loss is more than the alert
 * (IDR 4 billion) or a score is 3; otherwise the last (4 weeks). Null until something is filled.
 */
export function biancaSuggestedMtd(
  fn: { loss?: (number | null | undefined)[] | null, regulatory_scores?: (number | null | undefined)[] | null, customer_scores?: (number | null | undefined)[] | null },
  options: { suggested: readonly string[], lossAlert: number },
): string | null {
  const loss = fn.loss ?? []
  const reg = fn.regulatory_scores ?? []
  const cust = fn.customer_scores ?? []
  const filled = [...loss, ...reg, ...cust].some((value) => value != null && String(value) !== '')
  if (!filled || !options.suggested.length) return null
  for (let i = 0; i < options.suggested.length; i++) {
    if ((Number(loss[i]) || 0) > options.lossAlert || Number(reg[i]) === 3 || Number(cust[i]) === 3) {
      return options.suggested[i] ?? null
    }
  }
  return options.suggested[options.suggested.length - 1] ?? null
}
