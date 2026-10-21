import { expect, test } from '@playwright/test'
import { mockRaMap } from '../fixtures/ra'

test.setTimeout(90_000)

test('the location map shows every place, the open crisis, and measures a distance', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/ra/map')
  await expect(page.getByRole('heading', { name: 'Location map' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Banjir/ Banjir Bandang at Griya CIMB Niaga 2')).toBeVisible()
  await expect(page.getByText('CR-2026-0001 · since 21 Okt 2026, 11.52 WIB · 5 km radius · 2 places affected')).toBeVisible()
  await expect(page.getByLabel('Head office buildings (2)')).toBeChecked()
  await expect(page.getByLabel('Branches (3)')).toBeChecked()
  await expect(page.getByText('Not on the map yet (no pin): 1 building. Set the pin on their Map tab.')).toBeVisible()

  // The text version of the map lists every place; picking one shows what is near it.
  const table = page.getByRole('table')
  await expect(table.locator('tbody tr')).toHaveCount(5)
  await table.getByRole('button', { name: 'Griya CIMB Niaga 2' }).click()
  await expect(page).toHaveURL(/place=1/)
  const nearest = page.getByRole('list').filter({ hasText: 'KCP Bintaro Sektor 9' })
  await expect(nearest.getByRole('button').first()).toContainText('KCP Bintaro Sektor 9')
  await expect(nearest.getByRole('button').first()).toContainText('2 km')

  await page.getByRole('button', { name: 'Measure from here' }).click()
  await table.getByRole('button', { name: 'KC Pondok Indah' }).click()
  await page.getByRole('button', { name: 'Measure to here' }).click()
  await expect(page.getByRole('status')).toContainText('7,1 km')
  await expect(page.getByRole('status')).toContainText('Straight line from Griya CIMB Niaga 2 to KC Pondok Indah.')
  await expect(page.getByRole('link', { name: 'Road route in Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&origin=-6.271633,106.719358&destination=-6.2652,106.7837',
  )
  // The table gains the distance from the measured place.
  await expect(table.getByRole('columnheader', { name: 'From Griya CIMB Niaga 2' })).toBeVisible()

  // Hiding the branches leaves the buildings.
  await page.getByLabel('Branches (3)').uncheck()
  await expect(table.locator('tbody tr')).toHaveCount(2)
})

test('declaring a crisis at a building sends the hazard, place, radius and WIB time', async ({ page }) => {
  const log = await mockRaMap(page, { crisis: false })
  await page.goto('/ra/map?place=1')
  await page.getByRole('button', { name: 'Declare crisis here' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare a crisis' })
  await expect(dialog.getByText('Griya CIMB Niaga 2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Declare crisis' }).click()
  await expect(dialog.getByText('Choose the hazard.')).toBeVisible()

  await dialog.getByText('Choose one of the 33 RA hazards').click()
  await page.getByRole('option', { name: /Banjir/ }).first().click()
  await dialog.getByRole('button', { name: '5 km', exact: true }).click()
  await dialog.getByLabel('Time (WIB)').fill('14:30')
  await dialog.getByLabel('What is happening').fill('Basement flooded.')
  await dialog.getByRole('button', { name: 'Declare crisis' }).click()

  await expect(page).toHaveURL(/\/ra\/crises\/7$/)
  expect(log.declared).toHaveLength(1)
  expect(log.declared[0]).toMatchObject({
    hazard_code: 'H01',
    location_id: 1,
    radius_m: 5000,
    description: 'Basement flooded.',
  })
  expect(log.declared[0]!.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T14:30:00\+07:00$/)
})

test('a crisis gives each affected place its instructions and keeps a history', async ({ page }) => {
  const log = await mockRaMap(page)
  await page.goto('/ra/crises/7')
  await expect(page.getByRole('heading', { name: 'Banjir/ Banjir Bandang at Griya CIMB Niaga 2' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('These are the starter steps')).toBeVisible()
  await expect(page.getByText('Move people, documents and equipment to upper floors.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible()

  // The first place is open: its own RA, contacts, call tree and where to go.
  await expect(page.getByText('Pompa Buang (8 sampit) dan genset di GF')).toBeVisible()
  await expect(page.getByRole('link', { name: '113' })).toHaveAttribute('href', 'tel:113')
  await expect(page.getByRole('link', { name: '0812-1111-2222' })).toHaveAttribute('href', 'tel:081211112222')
  await expect(page.getByRole('link', { name: 'KC Pondok Indah', exact: true })).toHaveAttribute('href', '/ra-branch/locations/12')
  await page.getByRole('button', { name: 'KCP Bintaro Sektor 9 Branch · 2 km from the crisis point' }).click()
  await expect(page.getByText('No RA for this place yet.')).toBeVisible()

  await page.getByLabel('Add an update').fill('Floor wardens evacuated level 1.')
  await page.getByRole('button', { name: 'Add update' }).click()
  await expect(page.getByText('Floor wardens evacuated level 1.')).toBeVisible()
  expect(log.notes).toEqual([{ note: 'Floor wardens evacuated level 1.' }])

  await page.getByRole('button', { name: 'Close crisis' }).click()
  const dialog = page.getByRole('dialog', { name: 'Close CR-2026-0001?' })
  await dialog.getByLabel('How it ended').fill('Water receded.')
  await dialog.getByRole('button', { name: 'Close crisis' }).click()
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible()
  expect(log.closed).toEqual([{ note: 'Water receded.' }])
})

test('without the declare permission the map and crisis are read-only', async ({ page }) => {
  await mockRaMap(page, { declare: false })
  await page.goto('/ra/map?place=1')
  await expect(page.getByRole('heading', { name: 'Location map' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Measure from here' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Declare crisis/ })).toHaveCount(0)
  await page.goto('/ra/crises/7')
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Close crisis' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add update' })).toBeVisible()
})

test('the crisis history lists crises with their status', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/ra/crises')
  const row = page.getByRole('row', { name: /CR-2026-0001/ })
  await expect(row).toContainText('Banjir/ Banjir Bandang', { timeout: 30_000 })
  await expect(row).toContainText('Griya CIMB Niaga 2')
  await expect(row).toContainText('5 km')
  await expect(row).toContainText('Open')
})

test('the playbook is edited per hazard, one step per line', async ({ page }) => {
  const log = await mockRaMap(page)
  await page.goto('/ra/playbook')
  await page.getByRole('button', { name: /Gempa Bumi/ }).click({ timeout: 30_000 })
  await expect(page).toHaveURL(/hazard=H03/)
  await page.getByRole('button', { name: 'Review and edit steps' }).click()
  await page.getByLabel('Right away').fill('Drop, cover, hold on\n\nEvacuate by the stairs')
  await page.getByLabel('Within the first hours').fill('')
  await page.getByLabel('Recovery').fill('Inspect the structure')
  await page.getByRole('button', { name: 'Save steps' }).click()
  await expect(page.getByText('Reviewed by BCM', { exact: true })).toBeVisible()
  expect(log.playbook).toEqual([['H03', { steps: [
    { phase: 'immediate', text: 'Drop, cover, hold on' },
    { phase: 'immediate', text: 'Evacuate by the stairs' },
    { phase: 'recover', text: 'Inspect the structure' },
  ] }]])
})

test('the sidebar marks only the section of the page as current', async ({ page }) => {
  await mockRaMap(page)
  await page.route(/\/api\/ra\/locations/, (route) => route.fulfill({ json: { items: [] } }))
  await page.goto('/ra/locations')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Locations' })).toHaveAttribute('aria-current', 'page', { timeout: 30_000 })
  await expect(nav.getByRole('link', { name: 'Assessments' }).first()).not.toHaveAttribute('aria-current', 'page')
})
