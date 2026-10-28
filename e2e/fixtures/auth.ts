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
  'ra_branch.access',
  'ra_branch.edit',
  'ra_branch.manage',
  'ra.crisis.declare',
  'ra.location.approve',
  'ra.config.view',
  'ra.config.manage',
  'ra.config.publish',
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
  { code: 'ra.monitoring', label: 'Monitoring', icon: 'i-lucide-chart-column', route: '/ra/monitoring', parent: 'ra', permission: 'ra.access' },
  { code: 'ra.manage', label: 'Manage', icon: 'i-lucide-list-checks', route: '/ra/manage', parent: 'ra', permission: 'ra.access' },
  { code: 'ra.approval', label: 'Approval', icon: 'i-lucide-badge-check', route: '/ra/approval', parent: 'ra', permission: 'ra.access' },
  { code: 'ra_branch', label: 'RA Branch', icon: 'i-lucide-landmark', route: null, parent: null, permission: null },
  { code: 'ra_branch.monitoring', label: 'Monitoring', icon: 'i-lucide-chart-column', route: '/ra-branch/monitoring', parent: 'ra_branch', permission: 'ra_branch.access' },
  { code: 'ra_branch.manage', label: 'Manage', icon: 'i-lucide-list-checks', route: '/ra-branch/manage', parent: 'ra_branch', permission: 'ra_branch.access' },
  { code: 'ra_branch.approval', label: 'Approval', icon: 'i-lucide-badge-check', route: '/ra-branch/approval', parent: 'ra_branch', permission: 'ra_branch.access' },
  { code: 'locations', label: 'Location', icon: 'i-lucide-map-pinned', route: null, parent: null, permission: null },
  { code: 'locations.register', label: 'Buildings', icon: 'i-lucide-building', route: '/locations', parent: 'locations', permission: 'ra.access' },
  { code: 'locations.map', label: 'Building map', icon: 'i-lucide-map', route: '/locations/map', parent: 'locations', permission: 'ra.access' },
  { code: 'locations.crises', label: 'Incidents', icon: 'i-lucide-siren', route: '/crises', parent: 'locations', permission: 'ra.access' },
  { code: 'locations.guidebook', label: 'Incident guidebook', icon: 'i-lucide-book-marked', route: '/crises/guidebook', parent: 'locations', permission: 'ra.access' },
  // Added last so the other menus keep their ids (the menu admin tests use them).
  { code: 'admin.ra_config', label: 'RA configuration', icon: 'i-lucide-file-cog', route: '/admin/ra-config', parent: 'admin', permission: 'ra.config.view' },
] as const

/** GET /api/me/menu for these permissions, built the way the backend builds it. */
export function menuFor(permissions: string[]) {
  // As the backend: the shared Location menus open with RA or RA Branch access.
  const shared: Record<string, string> = { 'ra.access': 'ra_branch.access', 'ra.edit': 'ra_branch.edit' }
  const visible = MENUS.filter((m) => !m.permission || permissions.includes(m.permission)
    || (m.parent === 'locations' && permissions.includes(shared[m.permission] ?? '')))
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
