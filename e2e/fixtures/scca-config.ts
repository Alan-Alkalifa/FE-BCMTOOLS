/**
 * GET /api/scca/config for V4.2 (from backend/migrations/data/scca_config_v4_2.json), with the
 * questions, formula and standards of the SCCA fixture.
 */
import { FORMULA, STANDARDS } from './scca'

export const CONFIG_LISTS = {
  assessment_reason: [
    {
      code: 'new_application',
      label: 'New application',
      report_text: 'New application',
      attrs: {},
      active: true,
    },
    {
      code: 'annual_review',
      label: 'Annual review',
      report_text: 'Annual review',
      attrs: {
        renewal: true,
      },
      active: true,
    },
    {
      code: 'system_change',
      label: 'System change',
      report_text: 'System change',
      attrs: {
        custom_due_date: true,
      },
      active: true,
    },
  ],
  deployment_model: [
    {
      code: 'On-premise',
      label: 'On Premises',
      report_text: 'On Premises',
      attrs: {},
      active: true,
    },
    {
      code: 'SaaS',
      label: 'SaaS',
      report_text: 'SaaS',
      attrs: {},
      active: true,
    },
    {
      code: 'PaaS',
      label: 'PaaS',
      report_text: 'PaaS',
      attrs: {},
      active: true,
    },
    {
      code: 'IaaS',
      label: 'IaaS',
      report_text: 'IaaS',
      attrs: {},
      active: true,
    },
  ],
  business_days: [
    {
      code: 'Mon-Fri',
      label: 'Mon–Fri',
      report_text: 'Mon-Fri',
      attrs: {},
      active: true,
    },
    {
      code: 'Mon-Sat',
      label: 'Mon–Sat',
      report_text: 'Mon-Sat',
      attrs: {},
      active: true,
    },
    {
      code: 'Mon-Sun',
      label: 'Mon–Sun',
      report_text: 'Mon-Sun',
      attrs: {},
      active: true,
    },
  ],
  business_hours: [
    {
      code: '08-18',
      label: '08.00–18.00',
      report_text: '08.00-18.00',
      attrs: {},
      active: true,
    },
    {
      code: '08-21',
      label: '08.00–21.00',
      report_text: '08.00-21.00',
      attrs: {},
      active: true,
    },
    {
      code: '00-24',
      label: '00.00–24.00 (24×7)',
      report_text: '00.00-24.00',
      attrs: {},
      active: true,
    },
  ],
  category: [
    {
      code: 'Critical',
      label: 'Critical',
      report_text: 'Critical',
      attrs: {
        rank: 5,
        a3_rating: 5,
        color: 'error',
      },
      active: true,
    },
    {
      code: 'Very Important',
      label: 'Very important',
      report_text: 'Very Important',
      attrs: {
        rank: 4,
        a3_rating: 4,
        color: 'warning',
      },
      active: true,
    },
    {
      code: 'Important',
      label: 'Important',
      report_text: 'Important',
      attrs: {
        rank: 3,
        a3_rating: 3,
        color: 'info',
      },
      active: true,
    },
    {
      code: 'Necessary',
      label: 'Necessary',
      report_text: 'Necessary',
      attrs: {
        rank: 2,
        a3_rating: 2,
        color: 'neutral',
      },
      active: true,
    },
    {
      code: 'Other',
      label: 'Other',
      report_text: 'Other',
      attrs: {
        rank: 1,
        a3_rating: 1,
        color: 'neutral',
      },
      active: true,
    },
  ],
  hours: [
    {
      code: 'NA',
      label: 'NA',
      report_text: 'NA',
      attrs: {
        hours: null,
      },
      active: true,
    },
    {
      code: '1',
      label: '1 Hour',
      report_text: '1',
      attrs: {
        hours: 1,
      },
      active: true,
    },
    {
      code: '2',
      label: '2 Hours',
      report_text: '2',
      attrs: {
        hours: 2,
      },
      active: true,
    },
    {
      code: '3',
      label: '3 Hours',
      report_text: '3',
      attrs: {
        hours: 3,
      },
      active: true,
    },
    {
      code: '4',
      label: '4 Hours',
      report_text: '4',
      attrs: {
        hours: 4,
      },
      active: true,
    },
    {
      code: '5',
      label: '5 Hours',
      report_text: '5',
      attrs: {
        hours: 5,
      },
      active: true,
    },
    {
      code: '6',
      label: '6 Hours',
      report_text: '6',
      attrs: {
        hours: 6,
      },
      active: true,
    },
    {
      code: '7',
      label: '7 Hours',
      report_text: '7',
      attrs: {
        hours: 7,
      },
      active: true,
    },
    {
      code: '8',
      label: '8 Hours',
      report_text: '8',
      attrs: {
        hours: 8,
      },
      active: true,
    },
    {
      code: '9',
      label: '9 Hours',
      report_text: '9',
      attrs: {
        hours: 9,
      },
      active: true,
    },
    {
      code: '10',
      label: '10 Hours',
      report_text: '10',
      attrs: {
        hours: 10,
      },
      active: true,
    },
    {
      code: '11',
      label: '11 Hours',
      report_text: '11',
      attrs: {
        hours: 11,
      },
      active: true,
    },
    {
      code: '12',
      label: '12 Hours',
      report_text: '12',
      attrs: {
        hours: 12,
      },
      active: true,
    },
    {
      code: '13',
      label: '13 Hours',
      report_text: '13',
      attrs: {
        hours: 13,
      },
      active: true,
    },
    {
      code: '14',
      label: '14 Hours',
      report_text: '14',
      attrs: {
        hours: 14,
      },
      active: true,
    },
    {
      code: '15',
      label: '15 Hours',
      report_text: '15',
      attrs: {
        hours: 15,
      },
      active: true,
    },
    {
      code: '16',
      label: '16 Hours',
      report_text: '16',
      attrs: {
        hours: 16,
      },
      active: true,
    },
    {
      code: '17',
      label: '17 Hours',
      report_text: '17',
      attrs: {
        hours: 17,
      },
      active: true,
    },
    {
      code: '18',
      label: '18 Hours',
      report_text: '18',
      attrs: {
        hours: 18,
      },
      active: true,
    },
    {
      code: '19',
      label: '19 Hours',
      report_text: '19',
      attrs: {
        hours: 19,
      },
      active: true,
    },
    {
      code: '20',
      label: '20 Hours',
      report_text: '20',
      attrs: {
        hours: 20,
      },
      active: true,
    },
    {
      code: '21',
      label: '21 Hours',
      report_text: '21',
      attrs: {
        hours: 21,
      },
      active: true,
    },
    {
      code: '22',
      label: '22 Hours',
      report_text: '22',
      attrs: {
        hours: 22,
      },
      active: true,
    },
    {
      code: '23',
      label: '23 Hours',
      report_text: '23',
      attrs: {
        hours: 23,
      },
      active: true,
    },
    {
      code: '24',
      label: '24 Hours',
      report_text: '24',
      attrs: {
        hours: 24,
      },
      active: true,
    },
    {
      code: '36',
      label: '36 Hours',
      report_text: '36',
      attrs: {
        hours: 36,
      },
      active: true,
    },
    {
      code: '48',
      label: '48 Hours',
      report_text: '48',
      attrs: {
        hours: 48,
      },
      active: true,
    },
    {
      code: '72',
      label: '72 Hours',
      report_text: '72',
      attrs: {
        hours: 72,
      },
      active: true,
    },
  ],
  rpo: [
    {
      code: 'LDB',
      label: 'LDB',
      report_text: 'LDB',
      attrs: {
        rank: 2,
      },
      active: true,
    },
    {
      code: 'NA',
      label: 'NA',
      report_text: 'NA',
      attrs: {
        rank: null,
      },
      active: true,
    },
    {
      code: 'LST',
      label: 'LST',
      report_text: 'LST',
      attrs: {
        rank: 1,
      },
      active: true,
    },
  ],
  ha: [
    {
      code: 'Yes (Prod)',
      label: 'Yes (Prod)',
      report_text: 'Yes (Prod)',
      attrs: {
        counts_as_ha: true,
      },
      active: true,
    },
    {
      code: 'Active - Active',
      label: 'Active - Active',
      report_text: 'Active - Active',
      attrs: {
        counts_as_ha: true,
      },
      active: true,
    },
    {
      code: 'Active - Passive',
      label: 'Active - Passive',
      report_text: 'Active - Passive',
      attrs: {
        counts_as_ha: true,
      },
      active: true,
    },
    {
      code: 'No',
      label: 'No',
      report_text: 'No',
      attrs: {
        counts_as_ha: false,
      },
      active: true,
    },
  ],
  instance_type: [
    {
      code: 'Shared',
      label: 'Shared',
      report_text: 'Shared',
      attrs: {},
      active: true,
    },
    {
      code: 'Different',
      label: 'Different',
      report_text: 'Different',
      attrs: {},
      active: true,
    },
  ],
  dr_type: [
    {
      code: 'Hot DR',
      label: 'Hot DR',
      report_text: 'Hot DR',
      attrs: {},
      active: true,
    },
    {
      code: 'Warm DR',
      label: 'Warm DR',
      report_text: 'Warm DR',
      attrs: {},
      active: true,
    },
    {
      code: 'Cold DR',
      label: 'Cold DR',
      report_text: 'Cold DR',
      attrs: {},
      active: true,
    },
  ],
  dr_capacity: [
    {
      code: '100%',
      label: '100%',
      report_text: '100%',
      attrs: {
        percent: 100,
      },
      active: true,
    },
    {
      code: '50% - 50%',
      label: '50% - 50%',
      report_text: '50% - 50%',
      attrs: {
        percent: 50,
      },
      active: true,
    },
    {
      code: 'NA',
      label: 'NA',
      report_text: 'NA',
      attrs: {
        percent: null,
      },
      active: true,
    },
  ],
  processing_mode: [
    {
      code: 'Online',
      label: 'Online',
      report_text: 'Online',
      attrs: {},
      active: true,
    },
    {
      code: 'Batch',
      label: 'Batch',
      report_text: 'Batch',
      attrs: {},
      active: true,
    },
  ],
  dependency: [
    {
      code: 'Full',
      label: 'Full',
      report_text: 'Full',
      attrs: {
        counts_for_a3: true,
      },
      active: true,
    },
    {
      code: 'Partial',
      label: 'Partial',
      report_text: 'Partial',
      attrs: {
        needs_workaround: true,
      },
      active: true,
    },
    {
      code: 'No',
      label: 'No',
      report_text: 'No',
      attrs: {},
      active: true,
    },
  ],
}

export const CONFIG_STEPS = [
  {
    code: 'system_user_lead',
    title: 'Assessment by System User/ User Lead',
    short: 'User Lead',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 1,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'it_support_pic',
    title: 'Assessment by IT Support PIC',
    short: 'IT Support PIC',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 2,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'bcm_reviewer',
    title: 'Reviewed by BCM Reviewer',
    short: 'BCM Reviewer',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: null,
    comments_all_tabs: true,
    signer: null,
  },
  {
    code: 'enterprise_architecture',
    title: 'Reviewed by Enterprise Architecture',
    short: 'Enterprise Architecture',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 3,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'service_level_mgmt',
    title: 'Reviewed by Service Level Mgt.',
    short: 'Service Level Mgt.',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 4,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'app_owner_d2',
    title: 'Approved by Application Owner/ Business Unit D-2',
    short: 'App Owner D-2',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 5,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'app_owner_d1',
    title: 'Approved by Application Owner/ Business Unit D-1',
    short: 'App Owner D-1',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 6,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'it_support_approval',
    title: 'Approved by IT Support',
    short: 'IT Support',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 7,
    comments_all_tabs: false,
    signer: null,
  },
  {
    code: 'bcm_acknowledgement',
    title: 'Acknowledged by BCM',
    short: 'BCM',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: 8,
    comments_all_tabs: false,
    signer: null,
  },
]

export const CONFIG_NOTES = [
  {
    kind: 'follows',
    params: {
      question: 'C1',
      rating: 5,
      then: [
        'C5',
        'P4',
      ],
    },
  },
  {
    kind: 'a3',
    params: {
      question: 'A3',
    },
  },
  {
    kind: 'i4',
    params: {
      question: 'I4',
      from: [
        10,
        20,
        30,
        40,
      ],
    },
  },
]

export const LIST_LABELS = {
  assessment_reason: 'Reason for assessment',
  deployment_model: 'Deployment model',
  business_days: 'Business days',
  business_hours: 'Business hours',
  category: 'System criticality category (SCC)',
  hours: 'Hours (RTO, MTD)',
  rpo: 'RPO',
  ha: 'HA (Prod / DR)',
  instance_type: 'Instance (Shared / Different)',
  dr_type: 'DR type',
  dr_capacity: 'DR capacity',
  processing_mode: 'Processing mode',
  dependency: 'Dependency',
}

export function sccaConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'V4.2',
    name: 'SCCA Tools V4.2 for CIMB Niaga',
    status: 'active',
    notes: null,
    renewal_months: 24,
    based_on: null,
    published_at: null,
    questions: FORMULA.questions,
    weights: [],
    thresholds: FORMULA.thresholds,
    matrix: FORMULA.matrix,
    recovery_standards: STANDARDS.items,
    lists: JSON.parse(JSON.stringify(CONFIG_LISTS)),
    list_labels: LIST_LABELS,
    steps: JSON.parse(JSON.stringify(CONFIG_STEPS)),
    rating_notes: CONFIG_NOTES,
    ...overrides,
  }
}
