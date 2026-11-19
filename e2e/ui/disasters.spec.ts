import { expect, test } from '@playwright/test'
import { mockRaMap } from '../fixtures/ra'

test.setTimeout(90_000)

test('Disaster and Incident each have Monitoring, Manage and Approval', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/disasters/monitoring')
  await expect(page.getByRole('heading', { name: 'Disaster monitoring' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Open now: 1' })).toHaveAttribute('href', '/disasters?status=open')
  await expect(page.getByRole('link', { name: 'Places affected now: 2' })).toHaveAttribute('href', '/locations/map')
  await expect(page.getByRole('row', { name: /DS-2026-0001/ })).toContainText('Banjir/ Banjir Bandang')

  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const href of ['/disasters/monitoring', '/disasters', '/disasters/approval', '/incidents/monitoring', '/incidents', '/incidents/approval']) {
    await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(1)
  }
  await page.goto('/incidents/monitoring')
  await expect(page.getByRole('heading', { name: 'Incident monitoring' })).toBeVisible()
  await expect(page.getByText('No incident is open or waiting for approval.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open now: 0' })).toHaveAttribute('href', '/incidents?status=open')

  // Manage lists only its own type.
  await page.goto('/incidents')
  await expect(page.getByRole('heading', { name: 'Manage incidents' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('No incident has been declared yet.')).toBeVisible()
  await page.goto('/disasters')
  await expect(page.getByRole('heading', { name: 'Manage disasters' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'DS-2026-0001' })).toHaveAttribute('href', '/disasters/7')
})

test('an incident is declared with the incident hazards only', async ({ page }) => {
  const log = await mockRaMap(page, { crisis: false, incident: true })
  await page.goto('/incidents')
  await page.getByRole('button', { name: 'Declare Incident' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare Incident' })
  await dialog.getByText('Choose one of the 24 incident hazards').click({ timeout: 30_000 })
  await expect(page.getByRole('option', { name: /Banjir/ })).toHaveCount(0)
  await page.getByRole('option', { name: /^Kebakaran/ }).first().click()
  await dialog.getByRole('button', { name: 'Put the pin on a building or branch' }).click()
  await page.getByRole('option', { name: /KC Pondok Indah/ }).click()
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page).toHaveURL(/\/incidents\/7$/)
  expect(log.declared[0]).toMatchObject({ type: 'incident', hazard_code: 'H14' })
  await expect(page.getByRole('heading', { name: 'DS-2026-0001' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Incident')
})

test('an incident opened at a disaster address moves to its own', async ({ page }) => {
  await mockRaMap(page, { incident: true })
  await page.goto('/disasters/7')
  await expect(page).toHaveURL(/\/incidents\/7$/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Update incident' })).toBeVisible()
})

test('Approval lists what waits for someone else; it is decided on its page', async ({ page }) => {
  const log = await mockRaMap(page, { pending: true })
  await page.goto('/disasters/approval')
  await expect(page.getByRole('heading', { name: 'Disaster approval' })).toBeVisible({ timeout: 30_000 })
  const row = page.getByRole('row', { name: /DS-2026-0001/ })
  await expect(row).toContainText('Rina')
  await expect(row.getByRole('button', { name: /Approve|Reject/ })).toHaveCount(0)
  await row.getByRole('link', { name: 'DS-2026-0001' }).click()
  await expect(page).toHaveURL(/\/disasters\/\d+$/)
  await page.getByTestId('approval-banner').getByRole('button', { name: 'Approve' }).click()
  await page.getByRole('dialog', { name: 'Approve this disaster?' }).getByRole('button', { name: 'Approve' }).click()
  await expect.poll(() => log.decisions.length).toBe(1)
  expect(log.decisions[0]![0]).toBe('approve')
  await page.goto('/disasters/approval?tab=decided')
  await expect(page.getByRole('row', { name: /DS-2026-0001/ })).toContainText('Open', { timeout: 30_000 })

  await page.goto('/incidents/approval')
  await expect(page.getByText('No incident is waiting for approval.')).toBeVisible({ timeout: 30_000 })
})

test('the map offers only the types the user may declare', async ({ page }) => {
  await mockRaMap(page, { declareTypes: ['disaster'] })
  await page.goto('/locations/map')
  await expect(page.getByRole('button', { name: 'Declare Disaster', exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Declare Incident', exact: true })).toHaveCount(0)
})
