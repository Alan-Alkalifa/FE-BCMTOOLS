import { expect, test, type Page } from '@playwright/test'
import { ADMIN_MENU, ALL_PERMISSIONS, signIn } from '../fixtures/auth'

test.setTimeout(60_000)

const ROLES = [
  { id: 1, code: 'administrator', name: 'Administrator', description: 'Full access, including Administration.', is_system: true, permissions: ALL_PERMISSIONS, user_count: 1 },
  { id: 2, code: 'bcm_admin', name: 'BCM Admin', description: 'Works on every SCCA.', is_system: false, permissions: ['scca.access', 'scca.create', 'scca.view_all', 'scca.report.download'], user_count: 0 },
  { id: 3, code: 'bcm_user', name: 'BCM User', description: 'Creates SCCAs.', is_system: false, permissions: ['scca.access', 'scca.create', 'scca.report.download'], user_count: 2 },
  { id: 4, code: 'viewer', name: 'Viewer', description: 'Opens the SCCAs they sign off.', is_system: false, permissions: ['scca.access'], user_count: 0 },
]

// In the backend's order (by module code): admin, ra, scca.
const PERMISSIONS = [
  { code: 'admin.users.manage', module: 'admin', description: 'Create, edit, deactivate and unlock users' },
  { code: 'admin.roles.manage', module: 'admin', description: 'Create roles and grant permissions' },
  { code: 'admin.menus.manage', module: 'admin', description: 'Edit, reorder and hide menu items' },
  { code: 'admin.settings.mail', module: 'admin', description: 'Edit the SMTP settings and send a test email' },
  { code: 'admin.audit.view', module: 'admin', description: 'Read the sign-in, admin and email logs' },
  { code: 'ra.access', module: 'ra', description: 'See the RA menus and the location map; open assessments and locations; sign off when assigned' },
  { code: 'ra.crisis.declare', module: 'ra', description: 'Declare, update and close crisis events on the location map' },
  { code: 'ra.edit', module: 'ra', description: 'Create and edit RA locations and assessments; delete what you created' },
  { code: 'ra.manage', module: 'ra', description: 'Delete any RA location or assessment, approve or return on behalf of a signer, edit the crisis playbook' },
  { code: 'scca.access', module: 'scca', description: 'See the SCCA menu and open the SCCAs you take part in' },
  { code: 'scca.create', module: 'scca', description: 'Create a new assessment' },
  { code: 'scca.view_all', module: 'scca', description: 'Open and list every SCCA' },
  { code: 'scca.report.download', module: 'scca', description: 'Download the PDF and Excel of final SCCAs' },
]

function adminUser(id: number, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    username: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    display_name: name,
    given_name: null,
    surname: null,
    job_title: 'Analyst',
    department: 'BCM',
    company_name: null,
    office_location: null,
    employee_id: null,
    mobile_phone: null,
    preferred_language: null,
    auth_provider: 'local',
    is_active: true,
    is_locked: false,
    has_password: true,
    must_change_password: false,
    roles: [{ id: 3, code: 'bcm_user', name: 'BCM User' }],
    last_login_at: '2026-10-18T02:00:00Z',
    created_at: '2026-10-01T02:00:00Z',
    ...extra,
  }
}

const scca = (id: number, event: string, actor: string | null, detail: Record<string, unknown>, assessment = 1) => ({
  id,
  event: `scca.${event}`,
  username: actor ? `${actor.toLowerCase().replace(' ', '.')}@example.com` : null,
  actor,
  target_type: 'scca_assessments',
  target_id: assessment,
  detail: { ref_no: assessment === 1 ? 'SCCA-2026-0001' : 'SCCA-2026-0002', application: assessment === 1 ? 'CC Omni Channel' : 'HR Portal', ...detail },
  ip: '10.0.0.5',
  created_at: `2026-10-20T0${Math.min(id, 9)}:00:00Z`,
})
const SCCA_ACTIVITY_ROWS = [
  scca(6, 'report_downloaded', 'Test User', { format: 'xlsx' }),
  scca(5, 'finalised', null, {}),
  scca(4, 'rejected', 'Rina Analyst', { role: 'it_support_pic', note: 'RTO is wrong' }),
  scca(3, 'ratings_saved', 'Test User', { sections: ['rating'], fields: ['answers'], category_from: 'Very Important', category_to: 'Critical' }),
  scca(2, 'comment_added', 'Rina Analyst', { tab: 'result', role: 'it_support_pic', note: 'Check the RTO' }, 2),
  scca(1, 'created', 'Test User', { reason: 'new_application', category_to: 'Critical', backfilled: true }),
]

async function mockAdmin(page: Page) {
  await signIn(page)
  const users = [
    adminUser(1, 'Test User', { roles: [{ id: 1, code: 'administrator', name: 'Administrator' }] }),
    adminUser(2, 'Rina Analyst', { is_locked: true }),
    adminUser(3, 'Budi Baru', { has_password: false, last_login_at: null, roles: [] }),
  ]
  const calls: { method: string, url: string, body: unknown }[] = []
  const menus = ADMIN_MENU.map((m, index) => ({
    id: index + 1,
    code: m.code,
    label: m.label,
    icon: m.icon,
    route: m.route,
    parent_id: m.parent ? ADMIN_MENU.findIndex((p) => p.code === m.parent) + 1 : null,
    sort_order: (index + 1) * 10,
    permission: m.permission,
    is_active: true,
  }))
  const providers: { id: number, name: string, is_active: boolean, password_set: boolean, [key: string]: unknown }[] = [
    { id: 1, name: 'Gmail', kind: 'gmail', host: 'smtp.gmail.com', port: 587, security: 'starttls', username: 'alanalkalifa77@gmail.com', from_address: 'alanalkalifa77@gmail.com', from_name: 'BCM Tools', is_active: true, password_set: true, created_at: null, updated_at: null, updated_by: 'Test User' },
    { id: 2, name: 'Resend', kind: 'resend', host: 'smtp.resend.com', port: 465, security: 'ssl', username: 'resend', from_address: 'noreply@bemlanja.com', from_name: 'BCM Tools', is_active: false, password_set: false, created_at: null, updated_at: null, updated_by: null },
  ]
  const providerList = () => ({
    items: [...providers].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)),
    active_id: providers.find((row) => row.is_active)?.id ?? null,
  })
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const body = request.postDataJSON?.() ?? null
    calls.push({ method, url: url.pathname, body })
    const path = url.pathname
    if (path === '/api/admin/users' && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const items = users.filter((u) => u.display_name.toLowerCase().includes(q))
      return route.fulfill({ json: { items, page: 1, per_page: 25, total: items.length, pages: 1 } })
    }
    if (path === '/api/admin/users' && method === 'POST') {
      const created = adminUser(9, body.display_name, { email: body.email, username: body.email, has_password: false, last_login_at: null })
      users.push(created)
      return route.fulfill({ status: 201, json: { user: created, invitation_sent: true } })
    }
    const unlock = path.match(/^\/api\/admin\/users\/(\d+)\/unlock$/)
    if (unlock) {
      const user = users.find((u) => u.id === Number(unlock[1]))!
      user.is_locked = false
      return route.fulfill({ json: user })
    }
    const edit = path.match(/^\/api\/admin\/users\/(\d+)$/)
    if (edit && method === 'PUT') {
      const user = users.find((u) => u.id === Number(edit[1]))!
      Object.assign(user, body)
      return route.fulfill({ json: user })
    }
    if (path === '/api/admin/roles') return route.fulfill({ json: { items: ROLES } })
    if (path === '/api/admin/permissions') return route.fulfill({ json: { items: PERMISSIONS } })
    const role = path.match(/^\/api\/admin\/roles\/(\d+)$/)
    if (role && method === 'PUT') {
      const found = ROLES.find((r) => r.id === Number(role[1]))!
      return route.fulfill({ json: { ...found, ...body } })
    }
    if (path === '/api/admin/menus' && method === 'GET') return route.fulfill({ json: { items: menus } })
    const menu = path.match(/^\/api\/admin\/menus\/(\d+)$/)
    if (menu && method === 'PUT') {
      const found = menus.find((m) => m.id === Number(menu[1]))!
      Object.assign(found, body)
      return route.fulfill({ json: found })
    }
    if (path === '/api/admin/menus/order') return route.fulfill({ json: { items: menus } })
    if (path === '/api/admin/settings/mail/providers' && method === 'GET') return route.fulfill({ json: providerList() })
    if (path === '/api/admin/settings/mail/providers' && method === 'POST') {
      const created = { ...body, id: providers.length + 1, is_active: false, password_set: !!body.password, password: undefined, created_at: null, updated_at: null, updated_by: 'Test User' }
      providers.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    const provider = path.match(/^\/api\/admin\/settings\/mail\/providers\/(\d+)(?:\/(\w+))?$/)
    if (provider) {
      const found = providers.find((row) => row.id === Number(provider[1]))!
      if (provider[2] === 'activate') {
        for (const row of providers) row.is_active = row.id === found.id
        return route.fulfill({ json: providerList() })
      }
      if (provider[2] === 'test') {
        return route.fulfill({ json: { to: body?.to ?? 'test@example.com', provider: found.name, sent: false, error: '535 Username and Password not accepted' } })
      }
      if (method === 'PUT') {
        Object.assign(found, { ...body, password: undefined, password_set: found.password_set || !!body.password })
        return route.fulfill({ json: found })
      }
    }
    if (path === '/api/admin/audit/events' && url.searchParams.get('kind') === 'scca') {
      const event = url.searchParams.get('event')
      const assessment = Number(url.searchParams.get('assessment_id')) || null
      const items = SCCA_ACTIVITY_ROWS
        .filter((row) => !event || row.event === `scca.${event}`)
        .filter((row) => !assessment || row.target_id === assessment)
      return route.fulfill({ json: { items, page: 1, per_page: 50, total: items.length, pages: 1 } })
    }
    if (path === '/api/admin/audit/events') {
      return route.fulfill({
        json: {
          items: [
            { id: 2, event: 'auth.login_failed', username: 'rina.analyst@example.com', actor: 'Rina Analyst', target_type: null, target_id: null, detail: { attempt: 2 }, ip: '10.0.0.8', created_at: '2026-10-19T03:00:00Z' },
            { id: 1, event: 'admin.user_created', username: 'test@example.com', actor: 'Test User', target_type: 'users', target_id: 3, detail: { email: 'budi.baru@example.com' }, ip: '10.0.0.1', created_at: '2026-10-19T02:00:00Z' },
          ],
          page: 1, per_page: 50, total: 2, pages: 1,
        },
      })
    }
    if (path === '/api/admin/audit/emails') {
      return route.fulfill({
        json: {
          items: [{ id: 5, to: ['rina.analyst@example.com'], subject: 'Approval needed: SCCA-2026-0001', status: 'failed', attempts: 1, last_error: 'Email is not set up.', provider: 'Gmail', related_type: 'scca_assessments', related_id: 1, created_at: '2026-10-19T02:00:00Z', sent_at: null }],
          page: 1, per_page: 50, total: 1, pages: 1,
        },
      })
    }
    if (path.endsWith('/retry')) return route.fulfill({ json: { id: 5, status: 'sent', last_error: null } })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  return { calls, users }
}

test('users are listed with their roles and status', async ({ page }) => {
  await mockAdmin(page)
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Rina Analyst', exact: true })).toBeVisible()
  await expect(page.getByText('Locked')).toBeVisible()
  await expect(page.getByText('Not signed in yet')).toBeVisible()
  await expect(page.getByText('No role', { exact: true })).toBeVisible()
})

test('a new user gets roles and an invitation', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'New user' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email (ID)').fill('dewi@example.com')
  await dialog.getByLabel('Full name').fill('Dewi Lestari')
  await dialog.getByLabel('Job title').fill('BCM Officer')
  await dialog.getByRole('checkbox', { name: 'BCM User' }).click()
  await dialog.getByRole('button', { name: 'Create user' }).click()
  await expect(page.getByText('An invitation to set a password was emailed to dewi@example.com.', { exact: true })).toBeVisible()
  const create = calls.find((call) => call.method === 'POST' && call.url === '/api/admin/users')!
  expect(create.body).toMatchObject({ email: 'dewi@example.com', display_name: 'Dewi Lestari', job_title: 'BCM Officer', role_ids: [3] })
  expect((create.body as Record<string, unknown>).password).toBeUndefined()
})

test('a locked user is unlocked from the row menu', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Actions for Rina Analyst' }).click({ timeout: 30_000 })
  await page.getByRole('menuitem', { name: 'Unlock' }).click()
  await expect(page.getByText('User unlocked', { exact: true })).toBeVisible()
  expect(calls.some((call) => call.url === '/api/admin/users/2/unlock')).toBe(true)
})

test('a role is given more permissions', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/roles')
  await page.getByRole('button', { name: /^Viewer/ }).click({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Viewer' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Create a new assessment' }).click()
  await page.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByText('Role saved', { exact: true })).toBeVisible()
  const save = calls.find((call) => call.method === 'PUT' && call.url === '/api/admin/roles/4')!
  expect(save.body).toMatchObject({ name: 'Viewer', permissions: ['scca.access', 'scca.create'] })
})

test('RA permissions are their own group, between SCCA and Administration', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/roles')
  await page.getByRole('button', { name: /^Viewer/ }).click({ timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['SCCA', 'RA and RA Branch', 'Administration'])
  await page.getByRole('checkbox', { name: 'Create and edit RA locations and assessments; delete what you created' }).click()
  await page.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByText('Role saved', { exact: true })).toBeVisible()
  const save = calls.find((call) => call.method === 'PUT' && call.url === '/api/admin/roles/4')!
  expect(save.body).toMatchObject({ permissions: ['scca.access', 'ra.edit'] })
})

test('the Administrator role cannot lose permissions', async ({ page }) => {
  await mockAdmin(page)
  await page.goto('/admin/roles')
  await expect(page.getByText('The Administrator role always holds every permission.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('checkbox', { name: 'Create a new assessment' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Delete role' })).toHaveCount(0)
})

test('a menu item is hidden and moved', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/menus')
  await expect(page.getByText('Roles and permissions').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('switch', { name: 'Show Audit log' }).click()
  await expect(page.getByText('Audit log is hidden', { exact: true })).toBeVisible()
  const hide = calls.find((call) => call.method === 'PUT' && call.url === '/api/admin/menus/12')!
  expect(hide.body).toMatchObject({ is_active: false, label: 'Audit log' })

  await page.getByRole('button', { name: 'Move Menus up' }).click()
  await expect.poll(() => calls.some((call) => call.url === '/api/admin/menus/order')).toBe(true)
  const order = calls.find((call) => call.url === '/api/admin/menus/order')!.body as { items: { id: number }[] }
  expect(order.items.map((item) => item.id)).toEqual([7, 9, 8, 10, 11, 12])
  await expect(page.getByRole('button', { name: 'Home is built in' })).toBeDisabled()
})

test('an admin stores the Resend API key and switches the emails to Resend', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/settings/email')
  await expect(page.getByText('Emails go through Gmail')).toBeVisible({ timeout: 30_000 })
  const resend = page.getByRole('group', { name: 'Resend' })
  await expect(resend.getByText('smtp.resend.com:465')).toBeVisible()
  await expect(resend.getByText('SSL/TLS', { exact: true })).toBeVisible()
  await expect(resend.getByText('Not set')).toBeVisible()

  await resend.getByRole('button', { name: 'Add API key' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Resend' })
  await expect(dialog.getByLabel('Host')).toHaveValue('smtp.resend.com')
  await expect(dialog.getByLabel('Username')).toHaveValue('resend')
  await dialog.getByLabel('API key').fill('re_test_key_123')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Resend saved', { exact: true })).toBeVisible()
  const save = calls.find((call) => call.method === 'PUT' && call.url === '/api/admin/settings/mail/providers/2')!
  expect(save.body).toMatchObject({ kind: 'resend', host: 'smtp.resend.com', port: 465, security: 'ssl', username: 'resend', password: 're_test_key_123', from_address: 'noreply@bemlanja.com' })

  await resend.getByRole('button', { name: 'Use this provider' }).click()
  await expect(page.getByText('Gmail stops sending.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Use Resend' }).click()
  await expect(page.getByText('Emails go through Resend')).toBeVisible()
  expect(calls.some((call) => call.method === 'POST' && call.url === '/api/admin/settings/mail/providers/2/activate')).toBe(true)
  await expect(page.getByRole('group', { name: 'Resend' }).getByText('Active')).toBeVisible()
})

test('picking Gmail fills in its server, and a failed test shows the SMTP error', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/settings/email')
  await expect(page.getByText('Emails go through Gmail')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Add provider' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add an SMTP provider' })
  await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveValue('Resend 2')
  await dialog.getByText('Gmail', { exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveValue('Gmail 2')
  await expect(dialog.getByLabel('Host')).toHaveValue('smtp.gmail.com')
  await expect(dialog.getByLabel('Username')).toHaveValue('')
  await dialog.getByRole('textbox', { name: /^Name/ }).fill('Gmail backup')
  await dialog.getByLabel('Username').fill('bcm.backup@gmail.com')
  await dialog.getByLabel('App password').fill('abcd efgh ijkl mnop')
  await dialog.getByLabel('From address').fill('bcm.backup@gmail.com')
  await dialog.getByRole('button', { name: 'Add provider' }).click()
  await expect(page.getByText('Gmail backup added', { exact: true })).toBeVisible()
  const create = calls.find((call) => call.method === 'POST' && call.url === '/api/admin/settings/mail/providers')!
  expect(create.body).toMatchObject({ name: 'Gmail backup', kind: 'gmail', host: 'smtp.gmail.com', port: 587, security: 'starttls', password: 'abcd efgh ijkl mnop' })

  await page.getByRole('button', { name: 'Send test email' }).click()
  await expect(page.getByText('Not sent via Gmail', { exact: true })).toBeVisible()
  await expect(page.getByText('535 Username and Password not accepted')).toBeVisible()
  expect(calls.some((call) => call.url === '/api/admin/settings/mail/providers/1/test')).toBe(true)
})

test('the audit log shows sign-ins and failed emails can be sent again', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/audit')
  await expect(page.getByText('Sign-in failed')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('User created')).toBeVisible()
  await page.getByRole('tab', { name: 'Email outbox' }).click()
  await expect(page.getByText('Approval needed: SCCA-2026-0001')).toBeVisible()
  await page.getByRole('button', { name: 'Send again' }).click()
  await expect(page.getByText('Email sent', { exact: true })).toBeVisible()
  expect(calls.some((call) => call.url === '/api/admin/audit/emails/5/retry')).toBe(true)
})

test('the audit log is paged by the server, 25 a page', async ({ page }) => {
  await mockAdmin(page)
  const rows = Array.from({ length: 60 }, (_, index) => ({ ...SCCA_ACTIVITY_ROWS[0]!, id: 1000 + index }))
  const asked: string[] = []
  await page.route(/\/api\/admin\/audit\/events\?.*kind=scca/, (route) => {
    const url = new URL(route.request().url())
    asked.push(url.search)
    const size = Number(url.searchParams.get('per_page'))
    const number = Number(url.searchParams.get('page'))
    return route.fulfill({ json: { items: rows.slice((number - 1) * size, number * size), page: number, per_page: size, total: rows.length, pages: Math.ceil(rows.length / size) } })
  })
  await page.goto('/admin/audit?tab=scca')
  const pager = page.getByRole('navigation', { name: 'SCCA activity pages' })
  await expect(pager.getByText('Showing 1–25 of 60')).toBeVisible({ timeout: 60_000 })
  await pager.getByRole('button', { name: 'Page 3' }).click()
  await expect(pager.getByText('Showing 51–60 of 60')).toBeVisible()
  expect(asked.at(-1)).toContain('page=3')
  expect(asked.every((search) => search.includes('per_page=25'))).toBe(true)
  await expect(page.getByRole('navigation', { name: 'Sign-in and admin activity pages' })).toHaveCount(0)
})

test('administrators see who did what on each SCCA', async ({ page }) => {
  const { calls } = await mockAdmin(page)
  await page.goto('/admin/audit?tab=scca')
  const table = page.getByRole('table')
  await expect(table.getByText('Report downloaded')).toBeVisible({ timeout: 30_000 })
  await expect(table.getByText('Rejected', { exact: true })).toBeVisible()
  await expect(table.getByText('IT Support PIC · “RTO is wrong”')).toBeVisible()
  await expect(table.getByText('Changed Rating · Category Very Important → Critical')).toBeVisible()
  await expect(table.getByText('On Result and sign-off · as IT Support PIC · “Check the RTO”')).toBeVisible()
  await expect(table.getByText('New application · Category Critical')).toBeVisible()
  await expect(table.getByText('Earlier history')).toBeVisible()
  await expect(table.getByText('BCM Tools', { exact: true })).toBeVisible()
  await expect(table.getByRole('link', { name: 'HR Portal' })).toHaveAttribute('href', '/scca/2')
  expect(calls.some((call) => call.url === '/api/admin/audit/events')).toBe(true)

  await page.getByLabel('Action', { exact: true }).click()
  await page.getByRole('option', { name: 'Rejected' }).click()
  await expect(table.getByText('Report downloaded')).toHaveCount(0)
  await expect(table.getByText('Rejected', { exact: true })).toBeVisible()
})

test('an assessment\'s activity opens filtered to it', async ({ page }) => {
  await mockAdmin(page)
  await page.goto('/admin/audit?tab=scca&assessment=2')
  await expect(page.getByRole('table').getByText('Comment', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('table').getByText('Rejected')).toHaveCount(0)
  await expect(page.getByText('SCCA-2026-0002').first()).toBeVisible()
  await page.getByRole('button', { name: 'Show every assessment' }).click()
  await expect(page).not.toHaveURL(/assessment=/)
  await expect(page.getByRole('table').getByText('Rejected', { exact: true })).toBeVisible()
})
