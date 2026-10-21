import type { Page } from '@playwright/test'

export const ALL_PERMISSIONS = [
  'scca.access',
  'scca.create',
  'scca.view_all',
  'scca.report.download',
  'scca.monitor',
  'scca.approval.manage',
  'scca.settings.manage',
  'scca.config.view',
  'scca.config.manage',
  'scca.config.publish',
  'ra.access',
  'ra.edit',
  'ra.manage',
  'ra.crisis.declare',
  'admin.users.manage',
  'admin.roles.manage',
  'admin.menus.manage',
  'admin.settings.mail',
  'admin.audit.view',
]

/** The signed-in user (GET /api/me): an Administrator unless a test says otherwise. */
export const USER = {
  id: 1,
  username: 'test@example.com',
  name: 'Test User',
  email: 'test@example.com',
  job_title: 'Engineer',
  department: 'IT',
  has_photo: false,
  roles: [{ code: 'administrator', name: 'Administrator' }],
  permissions: ALL_PERMISSIONS,
  must_change_password: false,
  csrf_token: 'csrf-test',
}

export type TestUser = typeof USER

const MENUS = [
  { code: 'home', label: 'Home', icon: 'i-lucide-house', route: '/', parent: null, permission: null },
  { code: 'scca', label: 'SCCA', icon: 'i-lucide-shield-check', route: null, parent: null, permission: null },
  { code: 'scca.monitoring', label: 'Monitoring', icon: 'i-lucide-chart-column', route: '/scca/monitoring', parent: 'scca', permission: 'scca.access' },
  { code: 'scca.manage', label: 'Manage', icon: 'i-lucide-list-checks', route: '/scca/manage', parent: 'scca', permission: 'scca.access' },
  { code: 'scca.approval', label: 'Approval', icon: 'i-lucide-badge-check', route: '/scca/approval', parent: 'scca', permission: 'scca.access' },
  { code: 'admin', label: 'Administration', icon: 'i-lucide-settings', route: null, parent: null, permission: null },
  { code: 'admin.users', label: 'Users', icon: 'i-lucide-users', route: '/admin/users', parent: 'admin', permission: 'admin.users.manage' },
  { code: 'admin.roles', label: 'Roles and permissions', icon: 'i-lucide-key-round', route: '/admin/roles', parent: 'admin', permission: 'admin.roles.manage' },
  { code: 'admin.menus', label: 'Menus', icon: 'i-lucide-panel-left', route: '/admin/menus', parent: 'admin', permission: 'admin.menus.manage' },
  { code: 'admin.mail', label: 'Email settings', icon: 'i-lucide-mail', route: '/admin/settings/email', parent: 'admin', permission: 'admin.settings.mail' },
  { code: 'admin.scca_config', label: 'SCCA configuration', icon: 'i-lucide-file-cog', route: '/admin/scca-config', parent: 'admin', permission: 'scca.config.view' },
  { code: 'admin.audit', label: 'Audit log', icon: 'i-lucide-scroll-text', route: '/admin/audit', parent: 'admin', permission: 'admin.audit.view' },
  { code: 'ra', label: 'RA', icon: 'i-lucide-building-2', route: null, parent: null, permission: null },
  { code: 'ra.assessments', label: 'Assessments', icon: 'i-lucide-clipboard-list', route: '/ra', parent: 'ra', permission: 'ra.access' },
  { code: 'ra.locations', label: 'Locations', icon: 'i-lucide-building', route: '/ra/locations', parent: 'ra', permission: 'ra.access' },
  { code: 'ra.map', label: 'Location map', icon: 'i-lucide-map', route: '/ra/map', parent: 'ra', permission: 'ra.access' },
  { code: 'ra.crises', label: 'Crises', icon: 'i-lucide-siren', route: '/ra/crises', parent: 'ra', permission: 'ra.access' },
  { code: 'ra.playbook', label: 'Crisis guidebook', icon: 'i-lucide-book-marked', route: '/ra/guidebook', parent: 'ra', permission: 'ra.access' },
  { code: 'ra_branch', label: 'RA Branch', icon: 'i-lucide-landmark', route: null, parent: null, permission: null },
  { code: 'ra_branch.assessments', label: 'Assessments', icon: 'i-lucide-clipboard-list', route: '/ra-branch', parent: 'ra_branch', permission: 'ra.access' },
  { code: 'ra_branch.locations', label: 'Branches', icon: 'i-lucide-landmark', route: '/ra-branch/locations', parent: 'ra_branch', permission: 'ra.access' },
] as const

/** GET /api/me/menu for these permissions, built the way the backend builds it. */
export function menuFor(permissions: string[]) {
  const visible = MENUS.filter((m) => !m.permission || permissions.includes(m.permission))
  const node = (m: (typeof MENUS)[number], id: number) => ({
    id,
    code: m.code,
    label: m.label,
    icon: m.icon,
    route: m.route,
    children: visible
      .filter((child) => child.parent === m.code)
      .map((child) => node(child, MENUS.indexOf(child) + 1)),
  })
  return visible
    .filter((m) => m.parent === null)
    .map((m) => node(m, MENUS.indexOf(m) + 1))
    .filter((n) => n.route !== null || n.children.length > 0)
}

export const ADMIN_MENU = MENUS

/** Mock the signed-in user and their menu. */
export async function signIn(page: Page, user: Partial<TestUser> = {}) {
  const me = { ...USER, ...user }
  await page.route('**/api/me', (route) => route.fulfill({ json: me }))
  await page.route('**/api/me/menu', (route) => route.fulfill({ json: { items: menuFor(me.permissions) } }))
  return me
}
