import { expect, test, type Page } from '@playwright/test'
import { assessment, mockScca } from '../fixtures/scca'

/** In-app tabs (docs/tabs.md): one tab per page, kept alive in the background. */
test.setTimeout(120_000)

const tabBar = (page: Page) => page.getByRole('tablist', { name: 'Open pages' })
const tab = (page: Page, name: string | RegExp) => tabBar(page).getByRole('tab', { name })

test('tabs are always on: Profile has no setting for them', async ({ page }) => {
  await mockScca(page)
  await page.goto('/profile')
  await expect(tab(page, 'Profile')).toHaveAttribute('aria-selected', 'true', { timeout: 90_000 })
  await expect(tab(page, 'Home')).toBeVisible()
  await expect(page.getByRole('switch', { name: /tabs/i })).toHaveCount(0)
})

test('a page opens once: the menu switches to its tab and brings back its filters', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/monitoring?tab=register&q=portal')
  await expect(page.getByRole('table').getByRole('link', { name: 'HR Portal' })).toBeVisible({ timeout: 90_000 })
  await expect(tab(page, 'Home')).toBeVisible()
  await expect(tab(page, 'Monitoring')).toHaveAttribute('aria-selected', 'true')

  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Manage' }).first().click()
  await expect(page).toHaveURL(/\/scca\/manage$/)
  await expect(tab(page, 'Manage SCCAs')).toHaveAttribute('aria-selected', 'true')

  // While Manage is in front, the Monitoring tab in the background asks nothing with Manage's query.
  const leaked: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/scca/monitoring/register') && request.url().includes('q=omni')) leaked.push(request.url())
  })
  await page.getByLabel('Search by name, code, or ref. no.').fill('omni')
  await expect(page).toHaveURL(/q=omni/)

  await nav.getByRole('link', { name: 'Monitoring' }).first().click()
  await expect(page).toHaveURL(/\/scca\/monitoring\?tab=register&q=portal/)
  await expect(page.getByText('SCCA monitoring is already open', { exact: true })).toBeVisible()
  await expect(tabBar(page).getByRole('tab')).toHaveCount(3)
  expect(leaked).toEqual([])

  // Back to Manage: its search is as it was.
  await tab(page, 'Manage SCCAs').click()
  await expect(page).toHaveURL(/\/scca\/manage\?q=omni/)
  await expect(page.getByLabel('Search by name, code, or ref. no.')).toHaveValue('omni')
})

test('unsaved edits survive a tab switch, mark the tab, and closing it asks first', async ({ page }) => {
  await mockScca(page, assessment())
  await page.goto('/scca/1?tab=recovery')
  const rto = page.getByRole('combobox', { name: 'Current IT committed values RTO (hours)' })
  await expect(rto).toBeVisible({ timeout: 90_000 })
  // The resolver page /scca/1 opened the record in its own tab, not one of its own.
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2)
  await rto.click()
  await page.getByRole('option', { name: '6 Hours', exact: true }).click()
  const record = tabBar(page).getByRole('tab', { selected: true })
  await expect(tabBar(page).getByRole('img', { name: 'Unsaved changes' })).toBeVisible()

  await tab(page, 'Home').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await tabBar(page).getByRole('tab').nth(1).click()
  await expect(rto).toContainText('6 Hours')

  const name = (await record.getAttribute('title')) ?? ''
  // With unsaved edits the tab shows a dot; its × shows on hover.
  await record.hover()
  await page.getByRole('button', { name: `Close ${name}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Close this tab?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2)
  await record.hover()
  await page.getByRole('button', { name: `Close ${name}` }).click()
  await page.getByRole('dialog', { name: 'Close this tab?' }).getByRole('button', { name: 'Close without saving' }).click()
  await expect(tabBar(page).getByRole('tab')).toHaveCount(1)
})

test('at 10 tabs the longest-unused one closes; a reload keeps the tabs', async ({ page }) => {
  await mockScca(page, assessment())
  // Pages that stay where they are (a record may forward to its section).
  const pages = ['/scca/monitoring', '/scca/manage', '/scca/approval', '/profile', '/tasks', '/admin/roles', '/admin/audit', '/admin/menus', '/admin/settings/email']
  for (const path of pages) {
    await page.goto(path)
    await expect(tabBar(page)).toBeVisible({ timeout: 90_000 })
  }
  await expect(tabBar(page).getByRole('tab')).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'All open tabs (10 of 10)' })).toBeVisible()

  await page.reload()
  await expect(tabBar(page).getByRole('tab')).toHaveCount(10, { timeout: 90_000 })

  // An 11th page: Monitoring, used longest ago and not pinned, makes room.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
  await page.goto('/admin/users')
  await expect(tabBar(page).getByRole('tab')).toHaveCount(10, { timeout: 90_000 })
  await expect(tab(page, 'SCCA monitoring')).toHaveCount(0)
  await expect(tab(page, 'Home')).toBeVisible()
})

test('on a phone the tabs are a list behind a button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockScca(page)
  await page.goto('/scca/monitoring')
  await expect(page.getByRole('button', { name: 'Open tabs (2)' })).toBeVisible({ timeout: 90_000 })
  await expect(tabBar(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Open tabs (2)' }).click()
  const sheet = page.getByRole('dialog', { name: 'Open tabs (2 of 10)' })
  await expect(sheet.getByRole('button', { name: 'SCCA monitoring', exact: true })).toHaveAttribute('aria-current', 'page')
  await sheet.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})
