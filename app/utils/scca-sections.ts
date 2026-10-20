/**
 * The SCCA menu has three sections, and each has its own record page:
 *
 * - Manage (`/scca/manage/{id}`): drafts the user assesses or contributes to. Edit and submit.
 * - Approval (`/scca/approval/{id}`): SCCAs in approval the user can act on (decide, comment,
 *   or the BCM board). Read-only tabs with the decision on top.
 * - Monitoring (`/scca/monitoring/{id}`): everything else, read-only, with the reports and
 *   Start renewal.
 *
 * Old links and emails point to `/scca/{id}`, which sends the reader to their section.
 */
export type SccaSection = 'manage' | 'approval' | 'monitoring'

export const SCCA_SECTIONS: Record<SccaSection, { label: string, to: string }> = {
  manage: { label: 'Manage', to: '/scca/manage' },
  approval: { label: 'Approval', to: '/scca/approval' },
  monitoring: { label: 'Monitoring', to: '/scca/monitoring' },
}

interface SectionInput {
  status: SccaStatus
  my_role?: 'assessor' | 'contributor' | null
  permissions: { can_edit: boolean, can_decide: boolean, comment_tabs: readonly string[] }
}

/** Where this SCCA belongs for the signed-in user. `board`: they can use the BCM board. */
export function sccaSectionFor(assessment: SectionInput, board = false): SccaSection {
  const { status, permissions } = assessment
  if (status === 'draft' && permissions.can_edit) return 'manage'
  if (status === 'in_approval') {
    const acts = permissions.can_decide || permissions.comment_tabs.length > 0
    if (acts || (board && !assessment.my_role)) return 'approval'
  }
  return 'monitoring'
}

/** `/scca/{section}/{id}`, or its report. */
export function sccaPath(section: SccaSection, id: number, page: 'record' | 'report' = 'record') {
  return `${SCCA_SECTIONS[section].to}/${id}${page === 'report' ? '/report' : ''}`
}
