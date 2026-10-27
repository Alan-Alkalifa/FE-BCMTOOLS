import { expect, test } from '@playwright/test'
import { USER, menuFor, signIn } from '../fixtures/auth'
import { mockSealKey, unseal } from '../fixtures/seal'

test.setTimeout(60_000)

test('unauthenticated users are sent to the login page', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ status: 401, json: { error: 'unauthenticated' } }))
  await page.goto('/')
  await expect(page).toHaveURL(/\/login\/?$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('ID')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()

  await page.goto('/scca')
  await expect(page).toHaveURL(/\/login\?redirect=\/scca$/)
})

test('signing in with ID and password sends the user where they were going', async ({ page }) => {
  let signedIn = false
  await page.route('**/api/me', (route) =>
    signedIn ? route.fulfill({ json: USER }) : route.fulfill({ status: 401, json: { error: 'unauthenticated' } }))
  await page.route('**/api/me/menu', (route) => route.fulfill({ json: { items: menuFor(USER.permissions) } }))
  let body: unknown
  await mockSealKey(page)
  await page.route('**/api/auth/login', async (route) => {
    body = route.request().postDataJSON()
    signedIn = true
    await route.fulfill({ json: USER })
  })
  await page.route('**/api/me/profile', (route) => route.fulfill({ status: 404, json: { error: 'not_found' } }))

  await page.goto('/login?redirect=/profile')
  await page.getByLabel('ID').fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('Secret-password-1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/profile')
  // The ID and password are sealed: nothing readable in the request body.
  expect(JSON.stringify(body)).not.toContain('Secret-password-1')
  expect(JSON.stringify(body)).not.toContain('test@example.com')
  expect(unseal(body)).toEqual({ username: 'test@example.com', password: 'Secret-password-1', purpose: 'login' })
})

test('a wrong password and a locked account are explained', async ({ page }) => {
  let locked = false
  await mockSealKey(page)
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: locked
        ? { error: 'locked', message: 'Too many failed attempts. Try again in 15 minutes.' }
        : { error: 'invalid_credentials', message: 'Invalid ID or password.' },
    }))
  await page.goto('/login')
  await page.getByLabel('ID').fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid ID or password.')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')

  locked = true
  await page.getByLabel('Password', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Account locked')).toBeVisible()
  await expect(page.getByText('Too many failed attempts. Try again in 15 minutes.')).toBeVisible()
})

test('the password can be shown while typing', async ({ page }) => {
  await page.goto('/login')
  const input = page.getByLabel('Password', { exact: true })
  await input.fill('abc')
  await expect(input).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(input).toHaveAttribute('type', 'text')
})

test('forgot password always says the link is on its way', async ({ page }) => {
  let body: unknown
  await page.route('**/api/auth/forgot', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 202, json: { message: 'ok' } })
  })
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL('/forgot-password')
  await page.getByLabel('ID').fill('test@example.com')
  await page.getByRole('button', { name: 'Email me a reset link' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
  expect(body).toEqual({ username: 'test@example.com' })
})

test('a reset link sets a new password', async ({ page }) => {
  let body: unknown
  await mockSealKey(page)
  await page.route('**/api/auth/reset', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 204 })
  })
  await page.goto('/reset-password?token=abc123')
  const submit = page.getByRole('button', { name: 'Set password' })
  await page.getByLabel('New password', { exact: true }).fill('short')
  await expect(submit).toBeDisabled()
  await page.getByLabel('New password', { exact: true }).fill('Long-enough-pass-1')
  await page.getByLabel('Repeat the new password').fill('Long-enough-pass-1')
  await expect(page.getByText('Both entries match')).toBeVisible()
  await submit.click()
  await expect(page).toHaveURL('/login?reset=1')
  await expect(page.getByText('Your password is set. Sign in with it.')).toBeVisible()
  expect(JSON.stringify(body)).not.toContain('Long-enough-pass-1')
  expect(unseal(body)).toEqual({ token: 'abc123', password: 'Long-enough-pass-1', purpose: 'reset_password' })
})

test('a temporary password must be changed before anything else', async ({ page }) => {
  await signIn(page, { must_change_password: true })
  let body: unknown
  await mockSealKey(page)
  await page.route('**/api/auth/password', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ json: { ...USER, must_change_password: false } })
  })
  await page.goto('/scca')
  await expect(page).toHaveURL('/account/password')
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Current password').fill('Temporary-pass-1')
  await page.getByLabel('New password', { exact: true }).fill('My-own-password-9')
  await page.getByLabel('Repeat the new password').fill('My-own-password-9')
  await page.getByRole('button', { name: 'Set password and continue' }).click()
  await expect(page).toHaveURL('/')
  expect(JSON.stringify(body)).not.toContain('My-own-password-9')
  expect(unseal(body)).toEqual({ current_password: 'Temporary-pass-1', password: 'My-own-password-9', purpose: 'change_password' })
})

test('writes send the CSRF token from the session', async ({ page }) => {
  await signIn(page)
  let header: string | null = null
  await page.route('**/api/auth/logout', async (route) => {
    header = route.request().headers()['x-csrf-token'] ?? null
    await route.fulfill({ status: 204 })
  })
  await page.route('**/api/me/profile', (route) => route.fulfill({ status: 404, json: {} }))
  await page.goto('/')
  await page.getByRole('button', { name: 'User menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login?signed_out=1')
  await expect(page.getByText('You\'ve signed out of BCM Tools.')).toBeVisible()
  expect(header).toBe('csrf-test')
})

test('the sidebar shows only the menus the role allows', async ({ page }) => {
  await signIn(page, { roles: [{ code: 'viewer', name: 'Viewer' }], permissions: ['scca.access'] })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Manage' })).toBeVisible({ timeout: 30_000 })
  await expect(nav.getByRole('link', { name: 'Approval' })).toBeVisible()
  // Monitoring is open to every SCCA user (their own SCCAs); Administration is not.
  await expect(nav.getByRole('link', { name: 'Monitoring' })).toBeVisible()
  await expect(nav.getByText('Administration')).toHaveCount(0)
})

test('a page outside the role shows no access', async ({ page }) => {
  await signIn(page, { roles: [{ code: 'viewer', name: 'Viewer' }], permissions: ['scca.access'] })
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/forbidden\?from=(%2F|\/)admin(%2F|\/)users/)
  await expect(page.getByRole('heading', { name: 'You don\'t have access to this page' })).toBeVisible({ timeout: 30_000 })
})

test('a user without a role is told to ask an administrator', async ({ page }) => {
  await signIn(page, { roles: [], permissions: [] })
  await page.goto('/')
  await expect(page.getByText('You don\'t have a role yet')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Modules' })).toHaveCount(0)
})

test('the user menu and a notification bell sit at the right of the top bar', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const userMenu = page.getByRole('button', { name: 'User menu' })
  const bell = page.getByRole('button', { name: 'Notifications' })
  await expect(userMenu).toBeVisible({ timeout: 60_000 })
  const userBox = (await userMenu.boundingBox())!
  const bellBox = (await bell.boundingBox())!
  expect(userBox.y).toBeLessThan(64)
  expect(bellBox.x).toBeLessThan(userBox.x)
  expect(userBox.x + userBox.width).toBeGreaterThan(1200)
  await expect(page.getByRole('complementary').getByRole('button', { name: 'User menu' })).toHaveCount(0)

  await bell.click()
  const panel = page.getByRole('region', { name: 'Notifications' })
  await expect(panel.getByText('No notifications yet')).toBeVisible()
  await expect(panel.getByText('Coming soon')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0)
})

test('on a phone the page buttons move under the top bar, which keeps the bell and user menu', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: 390, height: 800 })
  await page.route('**/api/admin/settings/mail/providers', (route) => route.fulfill({ json: { items: [], active_id: null } }))
  await page.goto('/admin/settings/email')
  const add = page.getByRole('button', { name: 'Add provider' })
  await expect(add).toBeVisible({ timeout: 60_000 })
  const userBox = (await page.getByRole('button', { name: 'User menu' }).boundingBox())!
  expect(userBox.x + userBox.width).toBeLessThanOrEqual(390)
  expect(userBox.y).toBeLessThan(64)
  expect((await add.boundingBox())!.y).toBeGreaterThan(userBox.y + userBox.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
