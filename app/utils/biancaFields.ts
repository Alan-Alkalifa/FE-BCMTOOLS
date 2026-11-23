/**
 * Readable names for the fields the BIA API names in its errors (`details`), so a message says
 * which field it is about: `functions.0.name` → "Function 1 · Name of business function".
 */
const HEADER: Record<string, string> = {
  directorate: 'Sign off page · Directorate',
  sub_directorate: 'Sign off page · Sub directorate',
  org_group: 'Sign off page · Group',
  group_description: 'Sign off page · Group description',
  main_location_id: 'Sign off page · Main location building',
  main_location_mode: 'Sign off page · Main location',
  main_floor: 'Sign off page · Main location floor',
  alt_location_id: 'Sign off page · Alternate location building',
  alt_location_mode: 'Sign off page · Alternate location',
  alt_floor: 'Sign off page · Alternate location floor',
  recovery_strategy: 'Sign off page · High-level recovery strategy',
  bcm_coordinator_id: 'Sign off page · BCM Coordinator',
  bcm_coordinator_phone_2: 'Sign off page · BCM Coordinator additional phone',
  bcm_alternate_id: 'Sign off page · Alternate BCM Coordinator',
  bcm_alternate_phone_2: 'Sign off page · Alternate BCM Coordinator additional phone',
  ra_considers_bc: 'Sign off page · Risk assessment question 1',
  ra_tools: 'Sign off page · Risk assessment tools',
  ra_controls_included: 'Sign off page · Risk assessment question 2',
  ra_justification: 'Sign off page · Risk assessment justification',
  personnel_counts: 'RA questionnaire · Number of personnel',
  personnel_notes: 'RA questionnaire · Please specify',
  ra_completed: 'RA questionnaire · Risk assessment completed',
  org_structure: 'RA questionnaire · Organisation structure',
  file: 'Organisation structure file',
  signoff_users: 'Approval template · Signers',
  loss_formula: 'Part 1 note · Loss formula',
  justification_regulatory: 'Part 1 note · Regulatory impact justification',
  justification_customer: 'Part 1 note · Customer service impact justification',
  justification_rto: 'Part 2a note · RTO justification',
  justification_dependency: 'Part 2b note · Justification',
  functions: 'Business functions',
}

const FUNCTION: Record<string, string> = {
  name: 'Name of business function',
  loss: 'Part 1 · Financial loss',
  regulatory_scores: 'Part 1 · Regulatory impact score',
  customer_scores: 'Part 1 · Customer service impact score',
  suggested_mtd: 'Part 1 · Suggested MTD',
  expected_mtd: 'Part 2a · Expected MTD',
  planned_capacity: 'Part 2b · Planned capacity',
  total_staff: 'Part 3 · Total staff strength',
  staff_required: 'Part 3 · Staff required',
  recovery_level: 'Part 3 · Expected recovery level',
  prioritization_strategy: 'Part 3 · Prioritization recovery strategy',
  outstanding_strategy: 'Part 3 · Outstanding recovery strategy',
  alt_site_strategy: 'Part 3 · Alternate site strategy',
  seats_current: 'Part 3 · Current BCP seats',
  seats_required: 'Part 3 · BCP seats required',
  res_pc: 'Part 3 · PC',
  res_phone: 'Part 3 · Phone',
  res_fax: 'Part 3 · Fax',
  res_copier: 'Part 3 · Copier',
  res_others: 'Part 3 · Other resources',
  vital_record: 'Part 3 · Vital records',
  vital_record_location: 'Part 3 · Vital records location',
  description: 'Part 4 · Description',
  frequency: 'Part 4 · Frequency',
  critical_timings: 'Part 4 · Critical timings',
  critical_activity: 'Part 4 · Critical activity',
}

const IT: Record<string, string> = {
  application_id: 'IT application system',
  application_name: 'IT application system',
  rto: 'RTO',
  rpo: 'RPO',
  workaround: 'Process workaround',
  backlog_hours: 'Time to clear backlog',
  system_usage: 'System usage',
  gaps: 'Workaround critical gaps',
}

const SIDE: Record<string, string> = {
  name: 'name',
  capacity: 'planned capacity',
  mtd: 'Expected MTD',
  sla: 'SLA',
  outsourced: 'outsourcing service provider',
  material: 'material services',
  justification: 'justification',
}

const words = (text: string) => text.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase())

export function biancaFieldLabel(path: string) {
  const parts = path.split('.')
  if (parts[0] !== 'functions' || parts.length < 3) {
    const [name, key] = parts
    const base = HEADER[name!] ?? words(name!)
    return key ? `${base} (${words(key)})` : base
  }
  const fn = `Function ${Number(parts[1]) + 1}`
  const field = parts[2]!
  if (field === 'it_dependencies' && parts.length >= 5) {
    return `${fn} · Part 2a · IT system ${Number(parts[3]) + 1} · ${IT[parts[4]!] ?? words(parts[4]!)}`
  }
  if (field === 'dependencies' && parts.length >= 5) {
    const [side, ...rest] = parts[4]!.split('_')
    const label = side === 'up' ? 'Upstream' : 'Downstream'
    const key = rest.join('_')
    return `${fn} · Part 2b · ${label} ${Number(parts[3]) + 1} · ${SIDE[key] ?? words(key)}`
  }
  const base = FUNCTION[field] ?? words(field)
  return parts.length > 3 && /^\d+$/.test(parts[3]!) ? `${fn} · ${base} (column ${Number(parts[3]) + 1})` : `${fn} · ${base}`
}

/** The API's field errors as lines naming each field. */
export function biancaFieldErrors(details: Record<string, string>) {
  return Object.entries(details).map(([path, message]) => `${biancaFieldLabel(path)}: ${message}`)
}
