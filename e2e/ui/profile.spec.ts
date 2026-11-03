import { expect, test, type Page } from '@playwright/test'
import { USER, signIn } from '../fixtures/auth'

const PROFILE = {
  id: 1,
  username: 'test@example.com',
  display_name: 'Test User',
  given_name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  job_title: 'Engineer',
  department: 'IT',
  company_name: null,
  office_location: null,
  employee_id: null,
  mobile_phone: null,
  business_phones: ['+62 21 000'],
  preferred_language: 'en-US',
  directorate: null,
  sub_directorate: null,
  org_group: null,
  division: null,
  org_level: null,
  city: null,
  province: null,
  supervisor_nip: null,
  supervisor_name: null,
  supervisor_email: null,
  supervisor: null,
  auth_provider: 'local',
  roles: [{ code: 'administrator', name: 'Administrator' }],
  permissions: USER.permissions,
  has_photo: false,
  password_changed_at: '2026-10-01T08:00:00Z',
  last_login_at: '2026-10-16T08:00:00Z',
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function withProfile(page: Page, profile: { status?: number, json: unknown }, user = {}) {
  await signIn(page, user)
  await page.route('**/api/me/profile', (route) => route.fulfill(profile))
}

test('home greets the user with job title, department, roles and modules', async ({ page }) => {
  await withProfile(page, { json: PROFILE })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Engineer · IT')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SCCA', exact: true })).toBeVisible()
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Monitoring' }).first()).toHaveAttribute('href', '/scca/monitoring')
  await expect(main.getByRole('link', { name: 'Manage' }).first()).toHaveAttribute('href', '/scca/manage')
  await expect(main.getByRole('link', { name: 'Approval' }).first()).toHaveAttribute('href', '/scca/approval')
  await expect(main.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users')
})

test('profile page shows the account', async ({ page }) => {
  const iconRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('_nuxt_icon')) iconRequests.push(request.url())
  })
  await withProfile(page, { json: PROFILE })
  await page.goto('/')
  await page.getByRole('button', { name: 'User menu' }).click()
  await page.getByRole('menuitem', { name: 'Profile' }).click()

  await expect(page).toHaveURL('/profile')
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible()
  await expect(page.getByText('+62 21 000')).toBeVisible()
  await expect(page.getByText('BCM Tools password')).toBeVisible()
  await expect(page.getByRole('main').getByText('Administrator', { exact: true })).toBeVisible()
  await expect(page.getByText('Job Name', { exact: true })).toHaveCount(1)
  expect(iconRequests, 'icons must come from the client bundle').toEqual([])
})

test('a photo can be uploaded', async ({ page }) => {
  let hasPhoto = false
  await signIn(page)
  await page.route('**/api/me/profile', (route) => route.fulfill({ json: { ...PROFILE, has_photo: hasPhoto } }))
  let method = ''
  await page.route('**/api/me/photo**', async (route) => {
    if (route.request().method() === 'PUT') {
      method = 'PUT'
      hasPhoto = true
      return route.fulfill({ json: { has_photo: true } })
    }
    return route.fulfill({ body: PNG, contentType: 'image/png' })
  })
  await page.goto('/profile')
  await page.getByLabel('Choose a profile photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('Photo updated', { exact: true })).toBeVisible()
  expect(method).toBe('PUT')
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible()
})

test('initials are shown without a photo', async ({ page }) => {
  let photoRequested = false
  await withProfile(page, { json: PROFILE })
  await page.route('**/api/me/photo**', (route) => {
    photoRequested = true
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  await page.goto('/profile')
  await expect(page.getByText('TU', { exact: true }).first()).toBeVisible()
  expect(photoRequested).toBe(false)
})

test('slow loads show one announced skeleton region, then the content', async ({ page }) => {
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  await signIn(page)
  await page.route('**/api/me/profile', async (route) => {
    await released
    await route.fulfill({ json: PROFILE })
  })

  await page.goto('/profile')
  await expect(page.getByRole('status', { name: 'Loading profile' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveCount(0)

  release()
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('fast loads never flash a skeleton', async ({ page }) => {
  await withProfile(page, { json: PROFILE })
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[role="status"][aria-busy="true"]')) {
        (window as unknown as { sawSkeleton: boolean }).sawSkeleton = true
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { sawSkeleton?: boolean }).sawSkeleton)).toBeFalsy()
})

test('profile page shows the HR details and the direct supervisor', async ({ page }) => {
  await withProfile(page, { json: {
    ...PROFILE,
    employee_id: 'N0001',
    job_title: 'IT Officer',
    org_level: 'D-3',
    directorate: 'Operation, Technology, Analytics and AI',
    sub_directorate: 'Information Technology',
    org_group: 'IT Operations',
    division: 'Infrastructure',
    department: 'IT Application',
    mobile_phone: '+62 812 0000 0001',
    office_location: 'Graha Niaga',
    city: 'Jakarta',
    province: 'DKI Jakarta',
    supervisor_nip: 'N0002',
    supervisor_name: 'Rina Head',
    supervisor_email: 'rina@example.com',
    supervisor: { id: 2, name: 'Rina Head', email: 'rina@example.com' },
  } })
  await page.goto('/profile')
  const main = page.getByRole('main')
  await expect(main.getByText('IT Officer · Information Technology · NIP N0001')).toBeVisible({ timeout: 30_000 })
  for (const heading of ['Employee', 'Organization', 'Contact', 'Location', 'Direct supervisor', 'Account']) {
    await expect(main.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  for (const value of ['N0001', 'D-3', 'Operation, Technology, Analytics and AI', 'IT Operations', 'Infrastructure', 'IT Application', '+62 812 0000 0001', 'Graha Niaga', 'Jakarta', 'DKI Jakarta', 'N0002', 'Rina Head', 'rina@example.com', 'Rina Head · rina@example.com']) {
    await expect(main.getByText(value, { exact: true }).first()).toBeVisible()
  }
})

test('a DS NIP that matches no user says the account is not linked', async ({ page }) => {
  await withProfile(page, { json: { ...PROFILE, supervisor_nip: 'N9999', supervisor_name: 'Someone' } })
  await page.goto('/profile')
  await expect(page.getByText('Not linked (no user has that NIP)')).toBeVisible({ timeout: 30_000 })
})
