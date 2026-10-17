import { expect, test } from '@playwright/test'

test('unauthenticated users are sent to the login page', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({ status: 401, json: { error: 'unauthenticated' } }),
  )

  await page.goto('/')

  await expect(page).toHaveURL(/\/login\?redirect=\/$/)
  await expect(page.getByRole('link', { name: 'Sign in with Microsoft' })).toHaveAttribute(
    'href',
    '/auth/login?next=%2F',
  )
})

test('the sign-in button starts the Microsoft sign-in flow', async ({ page }) => {
  await page.route('**/auth/login**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Microsoft sign-in</h1>' }),
  )

  await page.goto('/login?redirect=/profile')
  await page.getByRole('link', { name: 'Sign in with Microsoft' }).click()

  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fprofile$/)
})

test('signed-in users see their profile', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { id: 'u1', name: 'Test User', email: 'test@example.com', roles: ['BCM.Admin'] },
    }),
  )

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome, Test User' })).toBeVisible()
  await expect(page.getByText('Roles: BCM.Admin')).toBeVisible()
  await page.getByRole('button', { name: 'User menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute('href', '/auth/logout')
})

test('sign-in errors are shown', async ({ page }) => {
  await page.goto('/login?error=signin_failed')
  await expect(page.getByText('Sign-in failed. Please try again.')).toBeVisible()
})
