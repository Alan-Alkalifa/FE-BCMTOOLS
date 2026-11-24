/**
 * The guidance texts of the BIA form (what each part is for, the guides beside the form, the help
 * under the fields) and their defaults. BCM changes them in Administration › BIA configuration ›
 * Guides › Form texts (saved as `text_<key>`); a text left empty there shows the default.
 */
export const BIANCA_TEXTS = {
  part_p1_objective: ['Part 1: objective', 'To assess the financial impact, the non-financial impact and the Suggested MTD of the business function.'],
  part_p1_notes: ['Part 1: notes (one per line)', 'Impact assessment if the business activities STOP TOTALLY, from the point of disruption to the end of week 4.\nPotential cumulative financial loss in IDR; potential regulatory impact (A) and customer service impact (B) scored 1 to 3 for each period.\nThe Suggested MTD is the first period with a loss above the financial loss alert or a score that reaches the impact score alert.'],
  part_p2a_objective: ['Part 2a: objective', 'To determine the business function\'s Expected MTD and category, and to identify the inter-dependency between the business function and IT (systems supported internally and / or externally).'],
  part_p2a_notes: ['Part 2a: notes (one per line)', 'Expected MTD: equal to or shorter than the Suggested MTD (e.g. a local regulator requirement).\nBusiness function category: verify it with the categorization table (Reference).\nPick the IT application system from the application master; when it isn\'t listed, type it (confirm its RTO and RPO with IT or the vendor). IT systems are optional: add the ones the function uses.\nJustify at the bottom (Notes for all functions) when an RTO is equal to or longer than the MTD.\nDAAT = Expected MTD − system RTO − backlog clearing time. Workaround critical gaps are mandatory when RTO > MTD, there is no workaround and the system dependency is full.'],
  part_p2b_objective: ['Part 2b: objective', 'To identify the inter-dependency between the business function and its upstream and downstream, and to make sure their MTDs are in sync.'],
  part_p2b_notes: ['Part 2b: notes (one per line)', 'Upstream: who triggers the activity. Downstream: who receives or processes your output / instruction. Both are optional: add the ones the function depends on.\nJustify on its row when their planned capacity is less than your function\'s, or their MTD longer than your Expected MTD.\nSLA: the time agreed in the agreement, or NA when there is no SLA.'],
  part_p3_objective: ['Part 3: objective', 'To determine the business / support operations\' recovery prioritization and the outstanding recovery strategies.'],
  part_p3_notes: ['Part 3: notes (one per line)', 'Expected recovery level: aligned with the Group recovery strategies.\nResources at the alternate site to meet the planned capacity (excluding work from home).\nVital record and its location: mandatory for a Business Critical function.'],
  part_p4_objective: ['Part 4: objective', 'To identify the critical timing and frequency, and to describe briefly the critical business activities that must be performed at those times.'],
  part_p4_notes: ['Part 4: notes (one per line)', ''],
  sign_guide_group: ['Sign off guide: Section A · the Group', 'Directorate, Sub Directorate and Group come from the organisation in the system. Describe what the Group does.'],
  sign_guide_locations: ['Sign off guide: Work locations', 'The building and floor the Group works from, and where it works when that one can\'t be used. The address comes from the building master.'],
  sign_guide_recovery: ['Sign off guide: Recovery strategy', 'Write the Group\'s recovery strategy at a high level.'],
  sign_guide_people: ['Sign off guide: BCM Coordinator and Alternate', 'Two different people, picked from the user directory: their NIK, phone and email are filled in and locked. Give an additional phone only when the one there is no longer active.'],
  sign_guide_footer: ['Sign off guide: footer', 'The BIA helps the Directorate / Sub Directorate / Group set the Maximum Tolerable Downtime (MTD) of its business functions, the recovery priorities and the resources recovery needs.'],
  sign_org_help: ['Sign off: help under Directorate / Group', 'From the organisation in the system. Picking a Group fills the main location.'],
  sign_recovery_help: ['Sign off: help under Group recovery strategy', 'Write the Group\'s high-level recovery strategy.'],
  ra_guide_personnel: ['RA guide: Number of personnel', 'How many people of the Group are in each grade / ranking. Not sure of a grade? The CIMB Niaga titles under each one tell which, and ⓘ has the workbook\'s note.\nOthers: contract (karyawan kontrak) or outsourced (karyawan outsource) staff, and say who they are.\nThe total should match the Group\'s current organisation chart.'],
  ra_guide_org_structure: ['RA guide: Organisation structure', 'Attach the Group\'s organisation chart in force now (PDF, image, PowerPoint, Word, Excel or Visio, up to 10 MB). Attaching another replaces it.'],
  ra_guide_risk_assessment: ['RA guide: Risk assessment', 'Yes when the Business Continuity Risk Assessment of your location is done. If No, the Head of Sub Directorate coordinates completing it, or check with BCM.'],
  ra_guide_bc_practice: ['RA guide: Business continuity in your risk assessment', 'Yes to the first question: name the tools (e.g. ShARP, ORMS). No to both: justify it.'],
  ra_specify_help: ['RA: help under "please specify" (Others)', 'Who they are, e.g. contract or outsourced staff.'],
  ra_tools_help: ['RA: help under Risk assessment tools used', 'Name the tools used to identify and assess risk.'],
  fn_name_help: ['Function: help under its name', 'Type it here, in Part 1; the other parts show it.'],
  expected_mtd_help: ['Part 2a: help under Expected MTD', 'Should be equal to or shorter than the Suggested MTD.'],
  category_help: ['Part 2a: help under Business function category', 'Follows the Expected MTD (BIA Category)'],
  it_systems: ['Part 2a: IT application systems', 'Optional. Add the IT systems the function uses: pick one from the application master, or type one that isn\'t in it.'],
  planned_capacity_help: ['Part 2b: help under Planned capacity', 'Its upstreams and downstreams are compared with it.'],
  upstream: ['Part 2b: Upstream', 'Optional. Who triggers the activity: pick a Group from the master, or type another party.'],
  downstream: ['Part 2b: Downstream', 'Optional. Who receives or processes your output / instruction: pick a Group from the master, or type another party.'],
  p3_staff: ['Part 3: Staff and recovery level', 'How many people the function has, how many it needs to run at the planned capacity, and the level it recovers to.'],
  p3_strategies: ['Part 3: Recovery strategies', 'Which work comes first when the function recovers, and how the work left over is cleared.'],
  p3_alt_site: ['Part 3: Alternate site', 'Where the function works from when its main location can\'t be used, and the BCP seats it has there.'],
  p3_resources: ['Part 3: Resources at the alternate site', 'What the function needs at the alternate site to meet the planned capacity (excluding work from home).'],
  p3_resources_wfh: ['Part 3: Resources, when the function works from home', 'Not needed: the function works from home.'],
  p3_vital: ['Part 3: Vital records', 'The records the function can\'t recover without, and where they are kept. Mandatory for a Business Critical function.'],
  p4_about: ['Part 4: About the function', 'What the business function does, in a few sentences.'],
  p4_timings: ['Part 4: Critical timings', 'How often the function runs, when it is most critical, and the activities that must be done at those times.'],
  na_help: ['Part 4: help under Critical timings and activity', 'Type N/A when there is none.'],
} as const satisfies Record<string, readonly [string, string]>

export type BiancaTextKey = keyof typeof BIANCA_TEXTS
