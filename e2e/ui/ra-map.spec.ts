import { expect, test } from '@playwright/test'
import { mockRaMap } from '../fixtures/ra'

test.setTimeout(90_000)

test('the building map shows every place, the open incident, and measures a distance', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/locations/map')
  await expect(page.getByRole('heading', { name: 'Building map' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Banjir/ Banjir Bandang at Griya CIMB Niaga 2')).toBeVisible()
  await expect(page.getByText('CR-2026-0001 · since 21 Oct 2026, 11:52 WIB · 5 km radius · 2 places affected')).toBeVisible()
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

test('declaring an incident at a building sends the hazard, place, radius and WIB time', async ({ page }) => {
  const log = await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map?place=1')
  await page.getByRole('button', { name: 'Declare incident here' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare an incident' })
  // Declaring from a place puts the pin on it; the text says what the ring covers.
  await expect(dialog.getByRole('button', { name: 'Incident point' })).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText('-6.271633, 106.719358 · 1 place in the area: Griya CIMB Niaga 2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit disaster/incident' }).click()
  await expect(dialog.getByText('Choose the hazard.')).toBeVisible()

  await dialog.getByText('Choose one of the 33 RA hazards').click()
  await page.getByRole('option', { name: /Banjir/ }).first().click()
  await dialog.getByRole('button', { name: '5 km', exact: true }).click()
  await expect(dialog.getByText(/^-6\.271633, 106\.719358 · 2 places in the area: Griya CIMB Niaga 2, KCP Bintaro Sektor 9$/)).toBeVisible()
  await dialog.getByLabel('Time (WIB)').fill('14:30')
  await dialog.getByLabel('What is happening').fill('Basement flooded.')
  await dialog.getByRole('button', { name: 'Submit disaster/incident' }).click()

  await expect(page).toHaveURL(/\/crises\/7$/)
  expect(log.declared).toHaveLength(1)
  expect(log.declared[0]).toMatchObject({
    hazard_code: 'H01',
    location_id: 1,
    latitude: -6.271633,
    longitude: 106.719358,
    radius_m: 5000,
    description: 'Basement flooded.',
  })
  expect(log.declared[0]!.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T14:30:00\+07:00$/)
})

test('the incident point is a pin dropped on the map or put on a place', async ({ page }) => {
  const log = await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map')
  await page.getByRole('button', { name: 'Declare incident', exact: true }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare an incident' })
  await dialog.getByText('Choose one of the 33 RA hazards').click()
  await page.getByRole('option', { name: /Banjir/ }).first().click()
  await expect(dialog.getByText('No pin yet.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit disaster/incident' }).click()
  await expect(dialog.getByText('Click the map to drop the pin, or choose a building or branch.')).toBeVisible()

  // The list puts the pin on a place; its marker does the same.
  await dialog.getByRole('button', { name: 'Put the pin on a building or branch' }).click()
  await page.getByRole('option', { name: /KC Pondok Indah/ }).click()
  await expect(dialog.getByText(/^-6\.265200, 106\.783700 · 1 place in the area: KC Pondok Indah$/)).toBeVisible()

  // Clicking the map drops the pin there instead: no longer that branch, just a point.
  const map = dialog.getByRole('region', { name: /Map for the incident point/ })
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6)
  await expect(dialog.getByText(/^-6\.265200, 106\.783700/)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Submit disaster/incident' }).click()
  await expect(page).toHaveURL(/\/crises\/7$/)
  const body = log.declared[0]!
  expect(body.location_id).toBeNull()
  expect(typeof body.latitude).toBe('number')
  expect(body.latitude).not.toBe(-6.2652)
})

test('an incident gives each affected place its instructions and keeps a history', async ({ page }) => {
  const log = await mockRaMap(page)
  await page.goto('/crises/7')
  await expect(page.getByRole('heading', { name: 'Banjir/ Banjir Bandang at Griya CIMB Niaga 2' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('These are the starter steps')).toBeVisible()
  await expect(page.getByText('Move people, documents and equipment to upper floors.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible()

  // The first place is open: its own RA, contacts, call tree and where to go.
  await expect(page.getByText('Pompa Buang (8 sampit) dan genset di GF')).toBeVisible()
  await expect(page.getByRole('link', { name: '113' })).toHaveAttribute('href', 'tel:113')
  await expect(page.getByRole('link', { name: '0812-1111-2222' })).toHaveAttribute('href', 'tel:081211112222')
  await expect(page.getByRole('link', { name: 'KC Pondok Indah', exact: true })).toHaveAttribute('href', '/locations/12')
  // The call tree chart of the place's kind.
  await page.getByRole('button', { name: 'View call tree chart' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Location call tree (RA HO)' }).getByRole('img'))
    .toHaveAttribute('src', '/api/ra/diagrams/call_tree?kind=head_office')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'KCP Bintaro Sektor 9 Branch · 2 km from the incident point' }).click()
  await expect(page.getByText('No RA for this place yet.')).toBeVisible()

  await page.getByLabel('Add an update').fill('Floor wardens evacuated level 1.')
  await page.getByRole('button', { name: 'Add update' }).click()
  await expect(page.getByText('Floor wardens evacuated level 1.')).toBeVisible()
  expect(log.notes).toEqual([{ note: 'Floor wardens evacuated level 1.' }])

  await page.getByRole('button', { name: 'Close incident' }).click()
  const dialog = page.getByRole('dialog', { name: 'Close CR-2026-0001?' })
  await dialog.getByLabel('How it ended').fill('Water receded.')
  await dialog.getByRole('button', { name: 'Close incident' }).click()
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reopen incident' })).toBeVisible()
  expect(log.closed).toEqual([{ note: 'Water receded.' }])
})

test('without the declare permission the map and incident are read-only', async ({ page }) => {
  await mockRaMap(page, { declare: false })
  await page.goto('/locations/map?place=1')
  await expect(page.getByRole('heading', { name: 'Building map' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Measure from here' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Declare crisis/ })).toHaveCount(0)
  await page.goto('/crises/7')
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Close incident' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add update' })).toBeVisible()
})

test('the incident history lists incidents with their status', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/crises')
  const row = page.getByRole('row', { name: /CR-2026-0001/ })
  await expect(row).toContainText('Banjir/ Banjir Bandang', { timeout: 30_000 })
  await expect(row).toContainText('Griya CIMB Niaga 2')
  await expect(row).toContainText('5 km')
  await expect(row).toContainText('Open')
})

test('the guidebook is edited per hazard, one step per line', async ({ page }) => {
  const log = await mockRaMap(page)
  await page.goto('/ra/playbook')
  // The old addresses open the guidebook.
  await expect(page).toHaveURL(/\/crises\/guidebook$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Incident guidebook' })).toBeVisible()
  // No review status on the guidebook: no count, no badge, no icons in the list.
  await expect(page.getByText(/reviewed by BCM/)).toHaveCount(0)
  // Hazards are grouped; every group starts closed and opens on click.
  const group = page.getByRole('button', { name: /Natural disasters/ })
  await expect(group).toHaveAttribute('aria-expanded', 'false', { timeout: 30_000 })
  await expect(group).toHaveText('Natural disasters')
  await expect(page.getByRole('button', { name: /Gempa Bumi/ })).toBeHidden()
  await group.click()
  await page.getByRole('button', { name: /Gempa Bumi/ }).click()
  await expect(page).toHaveURL(/hazard=H03/)
  await page.getByRole('button', { name: 'Review and edit steps' }).click()
  await page.getByLabel('Right away').fill('Drop, cover, hold on\n\nEvacuate by the stairs')
  await page.getByLabel('Within the first hours').fill('')
  await page.getByLabel('Recovery').fill('Inspect the structure')
  await page.getByRole('button', { name: 'Save steps' }).click()
  await expect(page.getByRole('button', { name: 'Edit steps' })).toBeVisible()
  await expect(page.getByText('Starter steps')).toHaveCount(0)
  expect(log.playbook).toEqual([['H03', { steps: [
    { phase: 'immediate', text: 'Drop, cover, hold on' },
    { phase: 'immediate', text: 'Evacuate by the stairs' },
    { phase: 'recover', text: 'Inspect the structure' },
  ] }]])
})

test('the sidebar marks only the section of the page as current', async ({ page }) => {
  await mockRaMap(page)
  await page.route(/\/api\/ra\/locations/, (route) =>
    route.fulfill({ json: { items: [], page: 1, per_page: 25, total: 0, pages: 1 } }),
  )
  await page.goto('/locations')
  const nav = page.getByRole('navigation', { name: 'Main' })
  const register = nav.getByRole('link', { name: 'Buildings', exact: true })
  const map = nav.getByRole('link', { name: 'Building map' })
  await expect(register).toHaveAttribute('aria-current', 'page', { timeout: 30_000 })
  // The group is Location: Home › Location › Buildings.
  await expect(nav.getByRole('button', { name: 'Location', exact: true })).toBeVisible()
  await expect(map).not.toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Monitoring' }).first()).not.toHaveAttribute('aria-current', 'page')
  // Buildings has its own group, outside RA: RA keeps Monitoring, Manage and Approval.
  await expect(nav.getByRole('link', { name: 'Incidents' })).toHaveAttribute('href', '/crises')
  await expect(nav.getByRole('link', { name: 'Incident guidebook' })).toHaveAttribute('href', '/crises/guidebook')
  await expect(nav.getByRole('link', { name: 'Branches' })).toHaveCount(0)

  await map.click()
  await expect(page).toHaveURL(/\/locations\/map$/)
  await expect(map).toHaveAttribute('aria-current', 'page')
  await expect(register).not.toHaveAttribute('aria-current', 'page')
})

test('a declared incident waits for someone else\'s approval', async ({ page }) => {
  const log = await mockRaMap(page, { pending: true })
  await page.goto('/crises/7')
  const banner = page.getByTestId('approval-banner')
  await expect(banner).toContainText('Waiting for approval. Rina declared this incident', { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Close incident' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Update incident' })).toHaveCount(0)
  await banner.getByRole('button', { name: 'Approve' }).click()
  await page.getByRole('dialog', { name: 'Approve this incident?' }).getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('This incident is approved').first()).toBeVisible()
  expect(log.decisions).toEqual([['approve', { note: null }]])
  await expect(page.getByRole('button', { name: 'Close incident' })).toBeVisible()
})

test('the map flags an incident waiting for approval, with an orange area', async ({ page }) => {
  await mockRaMap(page, { pending: true })
  await page.goto('/locations/map')
  await expect(page.getByText(/^Pending approval: Banjir/)).toBeVisible({ timeout: 30_000 })
  // Orange (and dashed) while it waits; red once approved.
  await expect(page.locator('path.ra-radius-pending')).toHaveCount(1)
  await expect(page.locator('path.ra-radius-crisis')).toHaveCount(0)
  await expect(page.locator('.ra-pin-crisis.text-warning')).toHaveCount(1)
})

test('the map legend shows the symbols the map draws', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/locations/map')
  await expect(page.getByText('Incident and its affected area')).toBeVisible({ timeout: 30_000 })
  const symbols = page.getByTestId('ra-map-symbol')
  await expect(symbols).toHaveCount(4)
  // The branch in the legend is the map's branch marker (a rounded square with a bank).
  const branch = page.locator('[data-testid="ra-map-symbol"][data-symbol="branch"] svg rect[rx="5"]')
  await expect(branch).toHaveCount(1)
  await expect(page.locator('path.ra-radius-crisis')).toHaveCount(1)
})

test('an incident is approved or rejected on its page, not in the Incidents list', async ({ page }) => {
  const log = await mockRaMap(page, { pending: true })
  await page.goto('/crises')
  const row = page.getByRole('row', { name: /CR-2026-0001/ })
  await expect(row).toContainText('Pending approval', { timeout: 30_000 })
  await expect(row.getByRole('button')).toHaveCount(0)
  await row.getByRole('link', { name: 'CR-2026-0001' }).click()
  await expect(page).toHaveURL(/\/crises\/7$/)
  await page.getByTestId('approval-banner').getByRole('button', { name: 'Reject' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reject this incident?' })
  await dialog.getByLabel('Reason').fill('A drill, not a flood.')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await expect.poll(() => log.decisions).toEqual([['reject', { note: 'A drill, not a flood.' }]])
  // No Delete button: an incident declared by mistake is rejected (or closed).
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})

test('who declared an incident is told someone else approves it', async ({ page }) => {
  await mockRaMap(page, { pending: true, own: true })
  await page.goto('/crises/7')
  const banner = page.getByTestId('approval-banner')
  await expect(banner).toContainText('This request requires approval by another user with approval rights (BCM Admin or BCM Management).', { timeout: 30_000 })
  await expect(banner.getByRole('button', { name: 'Approve' })).toHaveCount(0)
})

test('leaving the map while it zooms raises no error', async ({ page }) => {
  // Leaflet ends a zoom 250 ms later from a timer that remove() doesn't cancel; it used to throw
  // "Cannot read properties of undefined (reading '_leaflet_pos')" once the map was gone.
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockRaMap(page)
  // Open Buildings once first, so leaving the map later is instant.
  await page.goto('/locations')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Building map' }).click({ timeout: 30_000 })
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 })
  for (let round = 0; round < 3; round++) {
    // Zoom (animated), then leave while the zoom is still running.
    await page.evaluate(async () => {
      const container = document.querySelector('.leaflet-container')!
      const box = container.getBoundingClientRect()
      container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: box.left + 200, clientY: box.top + 150 }))
      await new Promise((resolve) => setTimeout(resolve, 60))
      document.querySelector<HTMLAnchorElement>('nav[aria-label="Main"] a[href="/locations"]')!.click()
    })
    await expect(page).toHaveURL(/\/locations$/)
    await page.waitForTimeout(500)
    await nav.getByRole('link', { name: 'Building map' }).click()
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  }
  expect(errors).toEqual([])
})
