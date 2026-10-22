import { expect, test } from '@playwright/test'
import { BRANCH_ID, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

test('one register lists head office buildings and branches', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toBeVisible()
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toContainText('Head office')
  await expect(table.getByRole('row', { name: /KCP Bogor Pajajaran/ })).toContainText('Branch')
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toHaveAttribute('href', `/locations/${BRANCH_ID}`)
  expect(new URLSearchParams(log.locationQueries.at(-1)).get('kind')).toBe('all')
  await expect(page.getByText('Showing 1–6 of 6')).toBeVisible()
})

test('the register filters by type, region, status and search, in the URL', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toBeVisible({ timeout: 60_000 })

  await page.getByLabel('Type', { exact: true }).click()
  await page.getByRole('option', { name: 'Branches', exact: true }).click()
  await expect(page).toHaveURL(/type=branch/)
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toHaveCount(0)
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toBeVisible()

  await page.getByLabel('Region', { exact: true }).click()
  await page.getByRole('option', { name: 'Region Jabar', exact: true }).click()
  await expect(page).toHaveURL(/region=Region\+Jabar|region=Region%20Jabar/)
  const query = new URLSearchParams(log.locationQueries.at(-1))
  expect(query.get('kind')).toBe('branch')
  expect(query.get('region')).toBe('Region Jabar')
  expect(query.get('page')).toBe('1')

  await page.getByLabel('Status', { exact: true }).click()
  await page.getByRole('option', { name: 'Inactive', exact: true }).click()
  await expect(page).toHaveURL(/status=inactive/)
  await expect(page.getByText('No locations match these filters.')).toBeVisible()
  expect(new URLSearchParams(log.locationQueries.at(-1)).get('active')).toBe('false')

  // Head office buildings have no region, so the region filter goes away with it.
  await page.goto('/locations?type=head_office&region=Region+Jabar&q=graha')
  await expect(table.getByRole('link', { name: 'Graha CIMB Niaga', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Region', { exact: true })).toHaveCount(0)
  expect(new URLSearchParams(log.locationQueries.at(-1)).get('region')).toBeNull()
})

test('adding a location asks for its type first', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/new')
  await expect(page.getByRole('radio', { name: /Head office building/ })).toBeChecked({ timeout: 60_000 })
  await expect(page.getByRole('textbox', { name: /Region/ })).toHaveCount(0)
  await page.getByRole('radio', { name: /Branch/ }).check()
  await page.getByRole('textbox', { name: /Branch name/ }).fill('KC Bandung Asia Afrika')
  await page.getByRole('textbox', { name: /Region/ }).fill('Region Jabar')
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/locations\/3\?tab=contacts$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch', name: 'KC Bandung Asia Afrika', region: 'Region Jabar' })
})

test('Add location from New assessment returns to the new assessment', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/new?type=branch&then=assessment')
  await page.getByRole('textbox', { name: /Branch name/ }).fill('KC Bandung Asia Afrika', { timeout: 60_000 })
  await page.getByRole('textbox', { name: /Region/ }).fill('Region Jabar')
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/ra-branch\/manage\/new\?location_id=3$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch' })
})

test('old RA links open the new pages', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/locations?q=griya')
  await expect(page).toHaveURL(/\/locations\?.*type=head_office/, { timeout: 60_000 })
  await expect(page).toHaveURL(/q=griya/)
  await page.goto('/ra-branch/locations')
  await expect(page).toHaveURL(/\/locations\?type=branch$/)
  await page.goto(`/ra-branch/locations/${BRANCH_ID}?tab=occupants`)
  await expect(page).toHaveURL(new RegExp(`/locations/${BRANCH_ID}\\?tab=occupants$`))
  await expect(page.getByRole('tab', { name: 'Occupants', exact: true }).first()).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  await page.goto('/ra/map')
  await expect(page).toHaveURL(/\/locations\/map$/)
  await page.goto('/ra/crises/7')
  await expect(page).toHaveURL(/\/crises\/7$/)
  await page.goto('/ra/guidebook')
  await expect(page).toHaveURL(/\/crises\/guidebook$/)
})
