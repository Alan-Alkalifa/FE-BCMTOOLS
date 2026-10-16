import { expect, test } from '@playwright/test'

test('backend is reachable through the frontend proxy', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toMatchObject({ status: 'ok' })
})

test('unauthenticated users are sent to the login page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('link', { name: 'Sign in with Microsoft' })).toHaveAttribute(
    'href',
    /^\/auth\/login/,
  )
})
