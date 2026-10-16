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

test('signed-in users see their profile', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { id: 'u1', name: 'Test User', email: 'test@example.com', roles: ['BCM.Admin'] },
    }),
  )

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome, Test User' })).toBeVisible()
  await expect(page.getByText('Roles: BCM.Admin')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign out' })).toHaveAttribute('href', '/auth/logout')
})

test('sign-in errors are shown', async ({ page }) => {
  await page.goto('/login?error=signin_failed')
  await expect(page.getByText('Sign-in failed. Please try again.')).toBeVisible()
})
