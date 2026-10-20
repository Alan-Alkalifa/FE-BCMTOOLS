import { expect, test } from '@playwright/test'

test('backend is reachable through the frontend proxy', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toMatchObject({ status: 'ok' })
})

test('unauthenticated users are sent to the login page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('ID')).toBeVisible()
})

test('a wrong password is refused by the backend', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('ID').fill('smoke-test-nobody@example.com')
  await page.getByLabel('Password', { exact: true }).fill('not-a-real-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid ID or password.')).toBeVisible()
})
