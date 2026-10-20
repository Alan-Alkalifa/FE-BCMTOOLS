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
  await expect(main.getByRole('link', { name: 'Monitoring' })).toHaveAttribute('href', '/scca/monitoring')
  await expect(main.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/scca/manage')
  await expect(main.getByRole('link', { name: 'Approval' })).toHaveAttribute('href', '/scca/approval')
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
  await expect(page.getByText('Job title', { exact: true })).toHaveCount(1)
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
