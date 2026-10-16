import { expect, test, type Page } from '@playwright/test'

const USER = { id: 'u1', name: 'Test User', email: 'test@example.com', roles: ['BCM.Admin'] }

const PROFILE = {
  id: 'u1',
  display_name: 'Test User',
  given_name: 'Test',
  surname: 'User',
  email: 'test.user@example.com',
  user_principal_name: 'test@example.com',
  job_title: 'Engineer',
  department: 'IT',
  company_name: null,
  office_location: null,
  employee_id: null,
  mobile_phone: null,
  business_phones: ['+62 21 000'],
  preferred_language: 'en-US',
  roles: ['BCM.Admin'],
  graph_profile: { jobTitle: 'Engineer', city: 'Jakarta', accountEnabled: true },
  has_photo: false,
  last_login_at: '2026-10-16T08:00:00Z',
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function signIn(page: Page, profile: { status?: number, json: unknown }) {
  await page.route('**/api/me', (route) => route.fulfill({ json: USER }))
  await page.route('**/api/me/profile', (route) => route.fulfill(profile))
}

test('home shows job title and department', async ({ page }) => {
  await signIn(page, { json: PROFILE })
  await page.goto('/')
  await expect(page.getByText('Engineer · IT')).toBeVisible()
})

test('profile page shows the Microsoft profile', async ({ page }) => {
  const iconRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('_nuxt_icon')) iconRequests.push(request.url())
  })
  await signIn(page, { json: PROFILE })
  await page.goto('/')
  await page.getByRole('link', { name: 'Profile' }).first().click()

  await expect(page).toHaveURL('/profile')
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible()
  await expect(page.getByText('+62 21 000')).toBeVisible()
  await expect(page.getByText('Jakarta')).toBeVisible()
  await expect(page.getByText('BCM.Admin')).toBeVisible()
  await expect(page.getByText('Job title', { exact: true })).toHaveCount(1)
  expect(iconRequests, 'icons must come from the client bundle').toEqual([])
})

test('profile photo is shown in the header and on the profile page', async ({ page }) => {
  await signIn(page, { json: { ...PROFILE, has_photo: true } })
  await page.route('**/api/me/photo', (route) =>
    route.fulfill({ body: PNG, contentType: 'image/png' }),
  )
  await page.goto('/profile')
  await expect(page.locator('img[src="/api/me/photo"]')).toHaveCount(2)
})

test('initials are shown without a photo', async ({ page }) => {
  let photoRequested = false
  await signIn(page, { json: PROFILE })
  await page.route('**/api/me/photo', (route) => {
    photoRequested = true
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  await page.goto('/profile')
  await expect(page.getByText('TU', { exact: true }).first()).toBeVisible()
  expect(photoRequested).toBe(false)
})

test('profile page explains a missing profile', async ({ page }) => {
  await signIn(page, { status: 404, json: { error: 'not_found' } })
  await page.goto('/profile')
  await expect(page.getByText('No profile saved yet')).toBeVisible()
})

test('sign-out is confirmed on the login page', async ({ page }) => {
  await page.goto('/login?signed_out=1')
  await expect(page.getByText('You\'ve signed out of BCM Tools.')).toBeVisible()
})
