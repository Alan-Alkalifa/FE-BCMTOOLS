import { expect, test } from '@playwright/test'
import { mockRaMap } from '../fixtures/ra'

test.setTimeout(90_000)

test('the building map shows every place, the open disaster, and measures a distance', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/locations/map')
  await expect(page.getByRole('heading', { name: 'Building map' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Banjir/ Banjir Bandang at Griya CIMB Niaga 2')).toBeVisible()
  await expect(page.getByText('DS-2026-0001 · since 21 Oct 2026, 11:52 WIB · 5 km radius · 2 places affected')).toBeVisible()
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
  // Each place empties on its own (x), and Clear empties both.
  await page.getByLabel('Clear To').click()
  await expect(page.getByText('Straight line from')).toHaveCount(0)
  await expect(table.getByRole('columnheader', { name: 'From Griya CIMB Niaga 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(table.getByRole('columnheader', { name: /^From / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled()

  // Hiding the branches leaves the buildings.
  await page.getByLabel('Branches (3)').uncheck()
  await expect(table.locator('tbody tr')).toHaveCount(2)
})

test('declaring a disaster at a building sends the hazard, place, radius and WIB time', async ({ page }) => {
  const log = await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map?place=1')
  await page.getByRole('button', { name: 'Declare Disaster here' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare Disaster' })
  // Declaring from a place puts the pin on it; the text says what the ring covers.
  await expect(dialog.getByRole('button', { name: 'Disaster point' })).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText('-6.271633, 106.719358 · 1 place in the area: Griya CIMB Niaga 2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(dialog.getByText('Choose the hazard.')).toBeVisible()

  await dialog.getByText('Choose one of the 9 disaster hazards').click()
  await page.getByRole('option', { name: /Banjir/ }).first().click()
  await dialog.getByRole('button', { name: '5 km', exact: true }).click()
  await expect(dialog.getByText(/^-6\.271633, 106\.719358 · 2 places in the area: Griya CIMB Niaga 2, KCP Bintaro Sektor 9$/)).toBeVisible()
  await dialog.getByLabel('Time (WIB)').fill('14:30')
  await dialog.getByLabel('What is happening').fill('Basement flooded.')
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click()

  await expect(page).toHaveURL(/\/disasters\/7$/)
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

test('the disaster point is a pin dropped on the map or put on a place', async ({ page }) => {
  const log = await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map')
  await page.getByRole('button', { name: 'Declare Disaster', exact: true }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare Disaster' })
  await expect(dialog.getByRole('group', { name: 'Map legend' })).toContainText('Disaster point and its affected area', { timeout: 30_000 })
  await dialog.getByText('Choose one of the 9 disaster hazards').click()
  await page.getByRole('option', { name: /Banjir/ }).first().click()
  await expect(dialog.getByText('No pin yet.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(dialog.getByText('Click the map to drop the pin, or choose a building or branch.')).toBeVisible()

  // The list puts the pin on a place; its marker does the same.
  await dialog.getByRole('button', { name: 'Put the pin on a building or branch' }).click()
  await page.getByRole('option', { name: /KC Pondok Indah/ }).click()
  await expect(dialog.getByText(/^-6\.265200, 106\.783700 · 1 place in the area: KC Pondok Indah$/)).toBeVisible()

  // Clicking the map drops the pin there instead: no longer that branch, just a point.
  const map = dialog.getByRole('region', { name: /Map for the disaster point/ })
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6)
  await expect(dialog.getByText(/^-6\.265200, 106\.783700/)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page).toHaveURL(/\/disasters\/7$/)
  const body = log.declared[0]!
  expect(body.location_id).toBeNull()
  expect(typeof body.latitude).toBe('number')
  expect(body.latitude).not.toBe(-6.2652)
})

test('a disaster gives each affected place its instructions and keeps a history', async ({ page }) => {
  const log = await mockRaMap(page)
  await page.goto('/disasters/7')
  await expect(page.getByRole('heading', { name: 'Banjir/ Banjir Bandang at Griya CIMB Niaga 2' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('These are the starter steps')).toBeVisible()
  await expect(page.getByText('Move people, documents and equipment to upper floors.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible()

  // The first place is open: its own RA, contacts, call tree and where to go.
  await expect(page.getByText('Pompa Buang (8 sampit) dan genset di GF')).toBeVisible()
  await expect(page.getByRole('link', { name: '113' })).toHaveAttribute('href', 'tel:113')
  await expect(page.getByRole('link', { name: '0812-1111-2222' })).toHaveAttribute('href', 'tel:081211112222')
  await expect(page.getByRole('link', { name: 'KC Pondok Indah', exact: true })).toHaveAttribute('href', '/masterdata/masterbuilding/12')
  // The call tree chart of the place's kind.
  await page.getByRole('button', { name: 'View call tree chart' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Location call tree (RA HO)' }).getByRole('img'))
    .toHaveAttribute('src', '/api/ra/diagrams/call_tree?kind=head_office')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'KCP Bintaro Sektor 9 Branch · 2 km from the disaster point' }).click()
  await expect(page.getByText('No RA for this place yet.')).toBeVisible()

  // Add update opens the update dialog: the radius and the rest, with the update (required).
  await page.getByRole('button', { name: 'Add update' }).click()
  const update = page.getByRole('dialog', { name: 'Update DS-2026-0001' })
  await expect(update.getByLabel('Update')).toBeVisible({ timeout: 30_000 })
  await update.getByRole('button', { name: 'Save update' }).click()
  await expect(update.getByText('Write the update: what is happening now, or why it changed.')).toBeVisible()
  expect(log.updates).toEqual([])
  await update.getByRole('button', { name: '10 km', exact: true }).click()
  await update.getByLabel('Update').fill('Floor wardens evacuated level 1.')
  await update.getByRole('button', { name: 'Save update' }).click()
  await expect(update).toBeHidden()
  await expect(page.getByText('Radius: 5 km → 10 km. Floor wardens evacuated level 1.')).toBeVisible()
  expect(log.updates).toEqual([expect.objectContaining({ radius_m: 10000, note: 'Floor wardens evacuated level 1.' })])
  expect(log.notes).toEqual([])

  await page.getByRole('button', { name: 'Close disaster' }).click()
  const dialog = page.getByRole('dialog', { name: 'Close DS-2026-0001?' })
  await dialog.getByLabel('How it ended').fill('Water receded.')
  await dialog.getByRole('button', { name: 'Close disaster' }).click()
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reopen disaster' })).toBeVisible()
  expect(log.closed).toEqual([{ note: 'Water receded.' }])
})

test('the disaster map has a legend and zooms with the scroll wheel; who to call is in tables', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/disasters/7')
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible({ timeout: 30_000 })
  const legend = page.getByRole('group', { name: 'Map legend' })
  await expect(legend).toContainText('Affected head office building')
  await expect(legend).toContainText('Affected branch')
  await expect(legend).toContainText('Residual risk for Banjir/ Banjir Bandang')

  const map = page.locator('.leaflet-container')
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  const zoom = () => map.evaluate((element) => element.querySelector<HTMLElement>('.leaflet-map-pane')!.style.transform
    + [...element.querySelectorAll<HTMLImageElement>('.leaflet-tile')].map((tile) => tile.src).join())
  const before = await zoom()
  const box = (await map.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -600)
  await expect.poll(zoom).not.toBe(before)

  // The open place's emergency contacts and call tree are tables; phones still dial.
  const contacts = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Area or address' }) }).first()
  await expect(contacts.getByRole('columnheader')).toHaveText(['Type', 'Name', 'Phone', 'Area or address'])
  await expect(contacts.getByRole('link', { name: '113' })).toHaveAttribute('href', 'tel:113')
  const callTree = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Called by' }) }).first()
  await expect(callTree.getByRole('columnheader')).toHaveText(['Level', 'Called by', 'Name', 'Division', 'Mobile'])
  await expect(callTree.getByRole('link', { name: '0812-1111-2222' })).toBeVisible()
})

test('the disaster has a print view with every place and its contacts', async ({ page }) => {
  await mockRaMap(page)
  await page.addInitScript(() => {
    window.print = () => {
      (window as unknown as { printed: number }).printed = ((window as unknown as { printed?: number }).printed ?? 0) + 1
    }
  })
  await page.goto('/disasters/7')
  await page.getByRole('link', { name: 'Print view' }).click({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/disasters\/7\/report$/)
  const report = page.getByTestId('crisis-report')
  await expect(report.getByRole('heading', { name: 'Banjir/ Banjir Bandang at Griya CIMB Niaga 2' })).toBeVisible({ timeout: 30_000 })
  await expect(report.getByRole('group', { name: 'Map legend' })).toBeVisible()
  await expect(report.getByRole('heading', { name: 'What to do' })).toBeVisible()
  await expect(report.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible()
  // One section per place, the contacts as plain text (nothing to click on paper).
  await expect(report.getByRole('region', { name: 'KCP Bintaro Sektor 9' })).toContainText('No RA for this place yet.')
  const first = report.getByRole('region', { name: 'Griya CIMB Niaga 2' })
  await expect(first.getByRole('columnheader', { name: 'Called by' })).toBeVisible()
  await expect(first.getByText('113', { exact: true })).toBeVisible()
  await expect(first.getByRole('link')).toHaveCount(0)
  await expect(report.getByRole('heading', { name: 'History' })).toBeVisible()

  await page.getByRole('button', { name: 'Print', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { printed?: number }).printed)).toBe(1)
})

test('without the declare permission the map and disaster are read-only', async ({ page }) => {
  const log = await mockRaMap(page, { declare: false })
  await page.goto('/locations/map?place=1')
  await expect(page.getByRole('heading', { name: 'Building map' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Measure from here' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Declare crisis/ })).toHaveCount(0)
  await page.goto('/disasters/7')
  await expect(page.getByRole('heading', { name: 'Affected places (2)' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Close disaster' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Update disaster' })).toHaveCount(0)
  // Without the right to manage it, Add update adds a note (required).
  await page.getByRole('button', { name: 'Add update' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add an update to DS-2026-0001' })
  await dialog.getByRole('button', { name: 'Add update' }).click()
  await expect(dialog.getByText('Write the update first.')).toBeVisible()
  await dialog.getByLabel('Update').fill('Seen from the branch: the road is flooded.')
  await dialog.getByRole('button', { name: 'Add update' }).click()
  await expect(page.getByText('Seen from the branch: the road is flooded.')).toBeVisible()
  expect(log.notes).toEqual([{ note: 'Seen from the branch: the road is flooded.' }])
})

test('the disaster history lists disasters with their status', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/disasters')
  const row = page.getByRole('row', { name: /DS-2026-0001/ })
  await expect(row).toContainText('Banjir/ Banjir Bandang', { timeout: 30_000 })
  await expect(row).toContainText('Griya CIMB Niaga 2')
  await expect(row).toContainText('5 km')
  await expect(row).toContainText('Open')
})

test('the guidebook is edited per hazard, one step per line', async ({ page }) => {
  const log = await mockRaMap(page)
  await page.goto('/ra/playbook')
  // The old addresses open the guidebook.
  await expect(page).toHaveURL(/\/disasters\/guidebook$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Guidebook' })).toBeVisible()
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
  await page.goto('/locations/map')
  const nav = page.getByRole('navigation', { name: 'Main' })
  const map = nav.getByRole('link', { name: 'Building map' })
  const guidebook = nav.locator('a[href="/disasters/guidebook"]')
  await expect(map).toHaveAttribute('aria-current', 'page', { timeout: 30_000 })
  // The group is Sites, with Disaster and Incident under it; no Buildings list.
  await expect(nav.getByRole('button', { name: 'Sites', exact: true })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Disaster', exact: true })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Incident', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Buildings', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Branches' })).toHaveCount(0)
  await expect(guidebook).toHaveAttribute('href', '/disasters/guidebook')
  await expect(guidebook).not.toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Monitoring' }).first()).not.toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('main').getByRole('navigation').first()).toContainText(/Home\s*Sites\s*Building map/)

  await guidebook.click()
  await expect(page).toHaveURL(/\/disasters\/guidebook$/)
  await expect(guidebook).toHaveAttribute('aria-current', 'page')
  await expect(map).not.toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('main').getByRole('navigation').first()).toContainText(/Home\s*Sites\s*Disaster\s*Guidebook/)
})

test('disasters and incidents each have their own guidebook', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/incidents/guidebook')
  await expect(page.getByRole('main').getByRole('navigation').first()).toContainText(/Home\s*Sites\s*Incident\s*Guidebook/, { timeout: 30_000 })
  const hazards = page.getByRole('navigation', { name: 'Hazards' })
  await expect(hazards.getByRole('button', { name: 'Technological' })).toBeVisible()
  await expect(hazards.getByRole('button', { name: 'Natural disasters' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Kebakaran' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.locator('a[href="/incidents/guidebook"]')).toHaveAttribute('aria-current', 'page')

  await page.goto('/disasters/guidebook')
  await expect(hazards.getByRole('button', { name: 'Natural disasters' })).toBeVisible({ timeout: 30_000 })
  await expect(hazards.getByRole('button', { name: 'Technological' })).toHaveCount(0)
  // A link to an incident's hazard opens the incident guidebook.
  await page.goto('/disasters/guidebook?hazard=H14')
  await expect(page).toHaveURL(/\/incidents\/guidebook\?hazard=H14$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Kebakaran' })).toBeVisible()
})

test('a disaster links to its hazard in the disaster guidebook', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/disasters/7')
  await expect(page.getByRole('main').getByRole('link', { name: 'Guidebook' })).toHaveAttribute('href', '/disasters/guidebook?hazard=H01', { timeout: 30_000 })
})

test('a declared disaster waits for someone else\'s approval', async ({ page }) => {
  const log = await mockRaMap(page, { pending: true })
  await page.goto('/disasters/7')
  const banner = page.getByTestId('approval-banner')
  await expect(banner).toContainText('Waiting for approval. Rina declared this disaster', { timeout: 30_000 })
  // It can't be closed yet, but it can be updated (its approver approves it as it stands).
  await expect(page.getByRole('button', { name: 'Close disaster' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Update disaster' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add update' })).toBeVisible()
  await banner.getByRole('button', { name: 'Approve' }).click()
  await page.getByRole('dialog', { name: 'Approve this disaster?' }).getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('This disaster is approved').first()).toBeVisible()
  expect(log.decisions).toEqual([['approve', { note: null }]])
  await expect(page.getByRole('button', { name: 'Close disaster' })).toBeVisible()
})

test('a rejected disaster leaves the building map at once', async ({ page }) => {
  await mockRaMap(page, { pending: true })
  await page.goto('/locations/map')
  await expect(page.locator('path.ra-radius-pending')).toHaveCount(1, { timeout: 30_000 })
  // Opened from the map and rejected there, then back to the map without reloading the app.
  await page.getByRole('link', { name: 'View instructions' }).click()
  await expect(page).toHaveURL(/\/disasters\/7$/)
  await page.getByTestId('approval-banner').getByRole('button', { name: 'Reject' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reject this disaster?' })
  await dialog.getByLabel('Reason').fill('A drill, not a flood.')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('navigation').getByRole('link', { name: 'Building map' }).click()
  await expect(page).toHaveURL(/\/locations\/map/)
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  await expect(page.locator('path.ra-radius-pending')).toHaveCount(0)
  await expect(page.locator('.ra-pin-crisis')).toHaveCount(0)
  await expect(page.getByText(/^Pending approval: Banjir/)).toHaveCount(0)
})

test('updating a disaster opens its map on the disaster, not zoomed out', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/disasters/7')
  await page.getByRole('button', { name: 'Update disaster' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Update DS-2026-0001' })
  const map = dialog.locator('.leaflet-container')
  const ring = dialog.locator('path.ra-radius-crisis')
  await expect(ring).toHaveCount(1, { timeout: 30_000 })
  // Once the dialog has settled, the affected area fills most of the map, in the middle.
  await expect.poll(async () => {
    const [box, area] = [await map.boundingBox(), await ring.boundingBox()]
    if (!box || !area) return false
    const centred = Math.abs((area.x + area.width / 2) - (box.x + box.width / 2)) < box.width * 0.1
      && Math.abs((area.y + area.height / 2) - (box.y + box.height / 2)) < box.height * 0.1
    return centred && area.height > box.height * 0.4
  }, { timeout: 10_000 }).toBe(true)
})

test('the map flags a disaster waiting for approval, with an orange area', async ({ page }) => {
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
  await expect(page.getByText('Disaster or incident and its affected area')).toBeVisible({ timeout: 30_000 })
  // The eight kinds, and a faded building for places not in service.
  const symbols = page.getByTestId('ra-map-symbol')
  await expect(symbols).toHaveCount(9)
  // The branch in the legend is the map's branch marker (a rounded square with a bank).
  const branch = page.locator('[data-testid="ra-map-symbol"][data-symbol="branch"] svg rect[rx="5"]')
  await expect(branch).toHaveCount(1)
  await expect(page.locator('path.ra-radius-crisis')).toHaveCount(1)
})

test('a place not approved yet, rejected or inactive is marked on the map, in the legend and in the list', async ({ page }) => {
  await mockRaMap(page, { unapproved: true })
  await page.goto('/locations/map')
  const legend = page.getByRole('group', { name: 'Map legend' })
  await expect(legend.getByText('Waiting for approval (new, or to deactivate)')).toBeVisible({ timeout: 30_000 })
  await expect(legend.getByText('Rejected', { exact: true })).toBeVisible()
  await expect(legend.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(legend).toContainText('Faded, not in service (inactive, new and waiting for approval, or rejected). No disaster or incident affects it.')
  await expect(page.locator('[data-testid="ra-map-symbol"][data-symbol="waiting"] .ra-pin-badge-waiting')).toHaveCount(1)
  await expect(page.locator('[data-testid="ra-map-symbol"][data-symbol="inactive"] .ra-pin-out .ra-pin-badge-inactive')).toHaveCount(1)

  // On the map: the new building and the branch being deactivated carry the hourglass badge,
  // the rejected building the cross and the inactive branch a pause sign; the others none.
  // The ones not in service (new, rejected, inactive) are faded. Their names say it too.
  await expect(page.locator('.leaflet-marker-icon.ra-pin-waiting')).toHaveCount(2)
  await expect(page.locator('.leaflet-marker-icon.ra-pin-rejected')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon.ra-pin-inactive')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon .ra-pin-badge')).toHaveCount(4)
  await expect(page.locator('.leaflet-marker-icon .ra-pin-out')).toHaveCount(3)
  await expect(page.locator('.leaflet-marker-icon[title="Menara Baru (Head office building): Waiting for approval"]')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon[title="Wisma Ditolak (Head office building): Rejected"]')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon[title="KCP Kemang Lama (Branch): Inactive"]')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon[title="KCP Depok Margonda (Branch): Deactivation requested"]')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon[title="Griya CIMB Niaga 2 (Head office building)"]')).toHaveCount(1)

  // In the list and on the selected place.
  const table = page.getByRole('table')
  // One status badge, as the Buildings register shows it.
  await expect(table.getByRole('row', { name: /Menara Baru/ })).toContainText('Waiting for approval')
  await expect(table.getByRole('row', { name: /Menara Baru/ })).not.toContainText('Inactive')
  await expect(table.getByRole('row', { name: /Wisma Ditolak/ })).toContainText('Rejected')
  await expect(table.getByRole('row', { name: /KCP Kemang Lama/ })).toContainText('Inactive')
  await expect(table.getByRole('row', { name: /KCP Depok Margonda/ })).not.toContainText('Inactive')
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).not.toContainText(/approval|Inactive/)
  await table.getByRole('button', { name: 'Menara Baru' }).click()
  await expect(page.getByRole('heading', { name: 'Menara Baru', level: 2 }).locator('..')).toContainText('Waiting for approval')

  // They can be hidden.
  await page.getByRole('checkbox', { name: 'Inactive (3)' }).click()
  await expect(page.locator('.leaflet-marker-icon .ra-pin-out')).toHaveCount(0)
  await expect(page.locator('.leaflet-marker-icon.ra-pin-waiting')).toHaveCount(1)
  await expect(table.getByRole('row', { name: /KCP Kemang Lama/ })).toHaveCount(0)
})

test('a disaster offers and counts only the places in service', async ({ page }) => {
  await mockRaMap(page, { unapproved: true })
  await page.goto('/locations/map')
  await expect(page.locator('.leaflet-marker-icon .ra-pin-out')).toHaveCount(3, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Declare Disaster' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 })
  // The branch being deactivated is still in service; the new, rejected and inactive ones aren't.
  await expect(dialog.locator('.leaflet-marker-icon[title^="KCP Depok Margonda"]')).toHaveCount(1)
  for (const name of ['Menara Baru', 'Wisma Ditolak', 'KCP Kemang Lama']) {
    await expect(dialog.locator(`.leaflet-marker-icon[title^="${name}"]`)).toHaveCount(0)
  }
  await expect(dialog.locator('.leaflet-marker-icon .ra-pin-badge')).toHaveCount(0)
})

test('the map zooms with the scroll wheel while Scroll to zoom is on', async ({ page }) => {
  await mockRaMap(page)
  await page.goto('/locations/map')
  const map = page.locator('.leaflet-container')
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 })
  const toggle = page.getByRole('switch', { name: 'Scroll to zoom' })
  await expect(toggle).toBeChecked()
  // The + and - buttons are there too.
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible()

  const zoom = () => map.evaluate((element) => element.querySelector<HTMLElement>('.leaflet-map-pane')!.style.transform
    + [...element.querySelectorAll<HTMLImageElement>('.leaflet-tile')].map((tile) => tile.src).join())
  const scrollIn = async () => {
    const box = (await map.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -600)
    await page.waitForTimeout(800)
  }
  let before = await zoom()
  await scrollIn()
  await expect.poll(zoom).not.toBe(before)

  // Off: the wheel scrolls the page, not the map.
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  before = await zoom()
  await scrollIn()
  expect(await zoom()).toBe(before)
})

test('BMKG earthquakes show on the map and in a list, credited to BMKG', async ({ page }) => {
  await mockRaMap(page, { quakes: true, crisis: false })
  await page.goto('/locations/map')
  const list = page.getByTestId('ra-earthquakes')
  await expect(list.getByRole('heading', { name: 'Recent earthquakes (BMKG)' })).toBeVisible({ timeout: 30_000 })
  await expect(list).toContainText('The last 7 days, magnitude 5,0 or more, or felt by people. BCM is emailed when a building or branch is within the earthquake\'s alert radius, e(M ÷ 1,01 − 0,13) km (124 km at M5,0).')
  await expect(list).toContainText('Updated 6 Nov 2026, 13:44 WIB')
  // BMKG is credited next to the map and under the list.
  await expect(page.getByText('Source: Earthquakes and weather warnings, BMKG (Badan Meteorologi, Klimatologi, dan Geofisika).')).toBeVisible()
  await expect(list.getByRole('link', { name: 'data.bmkg.go.id' })).toHaveAttribute('href', 'https://data.bmkg.go.id/gempabumi/')
  await expect(page.getByText('Earthquakes, BMKG (2)')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /^Earthquakes, BMKG/ })).toBeChecked()

  const strong = list.locator('[data-quake="3"]')
  await expect(strong).toContainText('M5,6')
  await expect(strong).toContainText('6 Nov 2026, 13:42 WIB · 10 km deep')
  await expect(strong).toContainText('Felt: IV Tangerang Selatan, III Jakarta')
  await expect(strong).toContainText('KCP Bintaro Sektor 9, 1,5 km from the epicentre and 1 more.')
  await expect(strong.getByRole('link', { name: 'Shakemap' })).toHaveAttribute('href', 'https://static.bmkg.go.id/20261106134210.mmi.jpg')
  // The latest earthquake (autogempa, with a shakemap) labels BMKG's Potensi as Potential; the others as Tsunami.
  await expect(strong).toContainText('Potential: Tidak berpotensi tsunami')
  await expect(list.locator('[data-quake="2"]')).toContainText('Tsunami: Tidak berpotensi tsunami')
  // The far one was declared already: its disaster instead of the button.
  const far = list.locator('[data-quake="2"]')
  await expect(far).toContainText('No building or branch within 25 km.')
  await expect(far.getByRole('link', { name: 'DS-2026-0001' })).toHaveAttribute('href', '/disasters/7')
  await expect(far.getByRole('button', { name: 'Declare Disaster' })).toHaveCount(0)

  // On the map: two epicentres (orange below M6.0); selecting one draws its alert radius.
  await expect(page.locator('.leaflet-marker-icon.ra-pin-quake')).toHaveCount(2)
  await expect(page.locator('.leaflet-marker-icon.ra-pin-quake.text-warning')).toHaveCount(2)
  await expect(page.locator('path.ra-radius-quake')).toHaveCount(0)
  // Show on map (from the list, under the map): back up to the map, zoomed to the earthquake
  // and its alert radius (the tiles of a closer zoom level load).
  const zoom = () => page.locator('#building-map .leaflet-tile').evaluateAll((tiles) =>
    Math.max(...tiles.map((tile) => Number((tile as HTMLImageElement).src.split('/e2e-tiles/')[1]?.split('/')[0] ?? 0))))
  const before = await zoom()
  await strong.scrollIntoViewIfNeeded()
  await expect(page.locator('#building-map')).not.toBeInViewport()
  await strong.getByRole('button', { name: 'Show on map' }).click()
  await expect(page).toHaveURL(/quake=3/)
  await expect(page.locator('#building-map')).toBeInViewport()
  await expect(page.locator('path.ra-radius-quake')).toHaveCount(1)
  await expect.poll(zoom).toBeGreaterThan(before)
  const zoomed = await zoom()
  // Another one, straight after: the map moves to it, zoomed in to its smaller radius (M3,4,
  // 25 km against 225 km), not out to every place.
  const centre = () => page.evaluate(() => {
    const pane = document.querySelector('#building-map .leaflet-map-pane') as HTMLElement
    return pane.style.transform
  })
  const first = await centre()
  await far.scrollIntoViewIfNeeded()
  await far.getByRole('button', { name: 'Show on map' }).click()
  await expect(page).toHaveURL(/quake=2/)
  await expect(page.locator('#building-map')).toBeInViewport()
  await expect.poll(centre).not.toBe(first)
  await page.waitForTimeout(800) // a late re-fit would zoom out here
  await expect.poll(zoom).toBeGreaterThan(zoomed)
  // And back to the first one.
  await strong.scrollIntoViewIfNeeded()
  await strong.getByRole('button', { name: 'Show on map' }).click()
  await expect(page).toHaveURL(/quake=3/)
  await page.waitForTimeout(800)
  await expect.poll(zoom).toBe(zoomed)
  // Hiding them takes them off the map.
  await page.getByRole('checkbox', { name: /^Earthquakes, BMKG/ }).uncheck()
  await expect(page.locator('.leaflet-marker-icon.ra-pin-quake')).toHaveCount(0)
})

test('the reports under the map switch between BMKG, WHO and OpenAQ with tabs', async ({ page }) => {
  await mockRaMap(page, { quakes: true, crisis: false })
  await page.goto('/locations/map')
  await expect(page.getByTestId('ra-earthquakes')).toBeVisible({ timeout: 30_000 })

  // The MMI scale sits above the earthquake list.
  const mmi = page.getByTestId('mmi-scale')
  await expect(mmi.getByRole('heading', { name: 'Modified Mercalli Intensity (MMI)' })).toBeVisible()
  await expect(mmi.getByRole('listitem')).toHaveCount(12)
  await expect(mmi).toContainText('VII · Very strong')

  await page.getByRole('tab', { name: 'Disease outbreaks (WHO)' }).click()
  await expect(page).toHaveURL(/report=outbreaks/)
  const who = page.getByTestId('ra-outbreaks')
  await expect(who.getByRole('heading', { name: 'Disease outbreaks in Indonesia (WHO)' })).toBeVisible()
  await expect(who).toContainText('Poliomyelitis - Indonesia')
  await expect(who).toContainText('The latest 2 of 154.')
  await expect(page.getByTestId('mmi-scale')).toHaveCount(0)
  // Filtered by year.
  await who.getByRole('button', { name: 'WHO news from year' }).click()
  await page.getByRole('option', { name: '2023', exact: true }).click()
  await who.getByRole('button', { name: 'WHO news to year' }).click()
  await page.getByRole('option', { name: '2023', exact: true }).click()
  await expect(who).toContainText('1 item.')
  await expect(who).toContainText('Measles - Indonesia')
  await expect(who).not.toContainText('Poliomyelitis - Indonesia')
  await expect(who.getByRole('link', { name: 'Read on who.int' }).first()).toHaveAttribute('href', 'https://www.who.int/emergencies/disease-outbreak-news/item/2023-DON462')
  await expect(page.getByTestId('ra-earthquakes')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Air quality (OpenAQ)' }).click()
  // Two charts: the latest PM2.5 per place, and the daily trend of the worst place.
  const charts = page.getByTestId('air-charts')
  await expect(charts.getByRole('heading', { name: 'Latest PM2.5 per place (µg/m³)' })).toBeVisible()
  await expect(charts).toContainText('1 of 2 places above 55,4 µg/m³ on their latest day.')
  await expect(charts.getByRole('heading', { name: 'Daily PM2.5 (µg/m³) near KCP Bintaro Sektor 9' })).toBeVisible()
  await expect(charts).toContainText('2 of 3 days above 55,4 µg/m³ at US Embassy Jakarta South, 2,5 km away.')
  const air = page.getByTestId('ra-air-quality')
  await expect(air.locator('li').first()).toContainText('160,2 · Sangat tidak sehat')
  await expect(air.locator('li').first()).toContainText('US Embassy Jakarta South, 2,5 km away')
  await expect(air.locator('li').first()).toContainText('Above 55,4 µg/m³ on 501 of 1.001 days since 1 Jan 2024')
  await expect(air.locator('li').nth(1)).toContainText('12,4 · Baik')
  await air.locator('li').first().getByRole('button', { name: 'Show on map' }).click()
  await expect(page).toHaveURL(/place=/)

  // Opened with the tab in the link.
  await page.goto('/locations/map?report=outbreaks')
  await expect(page.getByTestId('ra-outbreaks')).toBeVisible({ timeout: 30_000 })
})

test('BMKG\'s weather warnings show as areas on the map, in their tab and as history', async ({ page }) => {
  await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map')
  await expect(page.getByText('Weather warnings, BMKG (2)')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('checkbox', { name: /^Weather warnings, BMKG/ })).toBeChecked()
  await expect(page.locator('path.ra-area')).toHaveCount(2)
  await expect(page.getByRole('group', { name: 'Map legend' })).toContainText('Weather warning (BMKG) and its area')

  await page.getByRole('tab', { name: 'Weather warnings (BMKG)' }).click()
  await expect(page).toHaveURL(/report=weather/)
  const tab = page.getByTestId('ra-weather')
  await expect(tab.getByRole('heading', { name: 'Weather warnings (BMKG)' })).toBeVisible()
  await expect(tab.getByRole('tab', { name: 'Active (2)' })).toBeVisible()
  // The one over a branch first, with the branch.
  const first = tab.locator('li').first()
  await expect(first).toContainText('Hujan Lebat disertai Petir di Banten')
  await expect(first.getByRole('button', { name: 'KCP Bintaro Sektor 9' })).toBeVisible()
  await expect(tab.locator('li').nth(1)).toContainText('No building or branch inside.')
  // The badge's colour follows the severity, whether a building is inside or not.
  const badges = tab.locator('li').getByText('Moderate', { exact: true })
  await expect(badges).toHaveCount(2)
  const colours = await badges.evaluateAll((items) => items.map((item) => getComputedStyle(item).color))
  expect(new Set(colours).size).toBe(1)
  await expect(first.getByRole('link', { name: 'Infographic' })).toHaveAttribute('href', /nowcasting\.bmkg\.go\.id/)
  await first.getByRole('button', { name: 'Show on map' }).click()
  await expect(page).toHaveURL(/warning=CBT20261118001/)
  await expect(page.locator('path.ra-area-active')).toHaveCount(1)
  await expect(tab).toContainText('Source: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)')

  // The history: the warnings over a place, filtered by year.
  await tab.getByRole('tab', { name: 'History' }).click()
  await expect(tab.locator('li').first()).toContainText('1 Mar 2025')
  await tab.getByRole('button', { name: 'Weather warnings from year' }).click()
  await page.getByRole('option', { name: '2026', exact: true }).click()
  await expect(tab).toContainText('No warning was over a building or branch in these years.')

  // Unticked, the areas leave the map.
  await page.getByRole('checkbox', { name: /^Weather warnings, BMKG/ }).uncheck()
  await expect(page.locator('path.ra-area')).toHaveCount(0)
})

test('clicking a weather warning\'s area shows that warning in its tab, scrolled to', async ({ page }) => {
  await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map?report=weather')
  const tab = page.getByTestId('ra-weather')
  await expect(page.locator('path.ra-area')).toHaveCount(2, { timeout: 30_000 })
  // Even from the history, the list goes back to the active warnings.
  await tab.getByRole('tab', { name: 'History' }).click()
  await page.locator('path.ra-area').nth(1).dispatchEvent('click')
  await expect(page).toHaveURL(/warning=/)
  await expect(tab.getByRole('tab', { name: 'Active (2)' })).toHaveAttribute('aria-selected', 'true')
  const picked = tab.locator('li[aria-current="true"]')
  await expect(picked).toHaveCount(1)
  await expect(picked).toBeInViewport()
  await expect(page.locator('path.ra-area-active')).toHaveCount(1)

  // From another tab, the weather tab opens on it.
  await page.getByRole('tab', { name: 'Earthquakes (BMKG)' }).click()
  await page.locator('path.ra-area').nth(0).dispatchEvent('click')
  await expect(page).toHaveURL(/report=weather/)
  await expect(tab.locator('li[aria-current="true"]')).toBeInViewport()
})

const WAQI_REPORT = {
  enabled: true,
  radius_km: 5,
  threshold: 101,
  read_at: '2026-11-19T03:00:00Z',
  source: 'World Air Quality Index Project',
  source_url: 'https://waqi.info',
  message: null,
  area: { code: 'jakarta', label: 'Jakarta', bounds: [-6.45, 106.55, -6.05, 107.1] },
  areas: [{ code: 'jakarta', label: 'Jakarta' }, { code: 'java', label: 'Java' }, { code: 'indonesia', label: 'All of Indonesia' }],
  stations: [
    { id: 101, name: 'Bintaro, South Tangerang', latitude: -6.2536, longitude: 106.7194, aqi: 157, band: { code: 'unhealthy', label: 'Unhealthy' }, measured_at: '2026-11-19T10:00:00+07:00', affected: true, places: [{ id: 1, distance_km: 2 }] },
    { id: 103, name: 'Gelora Bung Karno', latitude: -6.226, longitude: 106.7982, aqi: 88, band: { code: 'moderate', label: 'Moderate' }, measured_at: '2026-11-19T09:00:00+07:00', affected: false, places: [{ id: 2, distance_km: 1.1 }] },
    { id: -523021, name: 'Pakubuwono', latitude: -6.2405, longitude: 106.7905, aqi: null, band: null, measured_at: null, affected: false, places: [] },
  ],
  places: [
    { location_id: 1, station_id: 101, distance_km: 2, aqi: 157, affected: true },
    { location_id: 2, station_id: 103, distance_km: 1.1, aqi: 88, affected: false },
  ],
}

const WAQI_STATION = {
  enabled: true,
  message: null,
  station: { id: 101, name: 'Bintaro, South Tangerang', url: 'https://aqicn.org/city/indonesia/south-tangerang/bintaro', widget_city: 'indonesia/south-tangerang/bintaro', latitude: -6.2536, longitude: 106.7194 },
  aqi: 157,
  band: { code: 'unhealthy', label: 'Unhealthy' },
  dominant: 'PM2.5',
  pollutants: [{ code: 'pm25', label: 'PM2.5', value: 157 }, { code: 'pm10', label: 'PM10', value: 61 }],
  read_at: '2026-11-19T03:00:00+00:00',
  attributions: [{ name: 'Nafas Indonesia', url: 'https://nafas.co.id/' }, { name: 'World Air Quality Index Project', url: 'https://waqi.info/' }],
}

test('WAQI\'s stations are drawn with their areas, and the WAQI tab lists the buildings they affect', async ({ page }) => {
  await mockRaMap(page, { crisis: false })
  await page.route('**/api/ra/map-settings', (route) => route.fulfill({ json: { tile_url: '/e2e-tiles/{z}/{x}/{y}.png', attribution: 'Test tiles', max_zoom: 19, waqi_enabled: true } }))
  const areas: string[] = []
  await page.route(/\/api\/ra\/waqi(\?|$)/, (route) => {
    const code = new URL(route.request().url()).searchParams.get('area') ?? ''
    areas.push(code)
    return route.fulfill({ json: code === 'java' ? { ...WAQI_REPORT, area: { code: 'java', label: 'Java', bounds: [-8.9, 105.1, -5.8, 114.7] } } : WAQI_REPORT })
  })
  const asked: string[] = []
  await page.route('**/api/ra/waqi/stations/*', (route) => {
    const path = new URL(route.request().url()).pathname
    asked.push(path)
    // A station from another network (negative uid) that WAQI has no feed for.
    if (path.endsWith('/-523021')) return route.fulfill({ json: { enabled: true, station: null, message: 'WAQI shows this station on its map but gives no details for it.' } })
    return route.fulfill({ json: WAQI_STATION })
  })
  // WAQI's widget script: it fills the container named in _aqiFeed's settings.
  await page.route('https://feed.aqicn.org/**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'var f = window._aqiFeed, c = f.c[f.n]; document.getElementById(c.container).textContent = "WAQI widget " + c.city + " " + c.lang',
  }))

  await page.goto('/locations/map')
  await expect(page.getByText('Air quality, WAQI (3)')).toBeVisible({ timeout: 30_000 })
  const toggle = page.getByRole('checkbox', { name: /^Air quality, WAQI/ })
  await expect(toggle).toBeChecked()
  // Every station from the API, each a dot with its AQI and a ring for its area.
  await expect(page.locator('.ra-aqi')).toHaveText(['157', '88', '–'])
  await expect(page.locator('path.ra-radius-air')).toHaveCount(3)
  const legend = page.getByRole('group', { name: 'Map legend' })
  await expect(legend).toContainText('Air quality, WAQI')
  await expect(legend).toContainText('Unhealthy 151–200')
  await expect(legend).toContainText('Dashed ring for a station\'s area')
  await expect(page.getByText('Air quality, World Air Quality Index Project and the stations\' own sources.')).toBeVisible()

  // A station clicked on the map opens its row in the WAQI tab, with its details.
  await page.locator('.leaflet-marker-icon.ra-pin-air').first().dispatchEvent('click')
  await expect(page).toHaveURL(/report=waqi/)
  await expect(page).toHaveURL(/station=101/)
  const card = page.getByTestId('ra-waqi')
  await expect(card).toContainText('Affected means AQI 101 or more within 5 km of a station')
  await expect(card.getByRole('tab', { name: 'Affected (1)' })).toHaveAttribute('aria-selected', 'true')
  await expect(card).toContainText('1 building or branch is affected now.')
  const row = card.locator('li[data-station="101"]')
  await expect(row).toHaveAttribute('aria-current', 'true')
  await expect(row).toBeInViewport()
  await expect(row.getByText('Affected', { exact: true })).toBeVisible()
  await expect(row.getByTestId('waqi-widget')).toHaveText('WAQI widget indonesia/south-tangerang/bintaro en')
  expect(asked).toEqual(['/api/ra/waqi/stations/101'])
  await expect(row).toContainText('AQI 157')
  await expect(row.getByRole('link', { name: 'aqicn.org' })).toHaveAttribute('href', 'https://aqicn.org/city/indonesia/south-tangerang/bintaro')
  await expect(row.getByRole('link', { name: 'Nafas Indonesia' })).toBeVisible()
  await expect(page.locator('path.ra-radius-air-active')).toHaveCount(1)

  // The other lists: stations with buildings in their area, and every station.
  await card.getByRole('tab', { name: 'With buildings (2)' }).click()
  await expect(card.locator('li[data-station]')).toHaveCount(2)
  const gbk = card.locator('li[data-station="103"]')
  await expect(gbk).toContainText('Graha CIMB Niaga (1,1 km)')
  await expect(gbk.getByText('Affected', { exact: true })).toHaveCount(0)
  await gbk.getByRole('button', { name: 'Details' }).click()
  await expect(page).toHaveURL(/station=103/)
  await expect.poll(() => asked.at(-1)).toBe('/api/ra/waqi/stations/103')
  await card.getByRole('tab', { name: 'All stations (3)' }).click()
  const paku = card.locator('li[data-station="-523021"]')
  await expect(paku).toContainText('No building or branch in its area.')
  await paku.getByRole('button', { name: 'Details' }).click()
  await expect(page).toHaveURL(/station=-523021/)
  await expect(paku.getByTestId('waqi-no-detail')).toHaveText('WAQI shows this station on its map but gives no details for it.')
  await expect(paku.getByTestId('waqi-widget')).toHaveCount(0)
  await expect(paku.getByText('Could not read the station')).toHaveCount(0)

  // A building in an area is shown on the map.
  await card.getByRole('tab', { name: 'Affected (1)' }).click()
  await card.getByRole('button', { name: 'Griya CIMB Niaga 2 (2 km)' }).click()
  await expect(page).toHaveURL(/place=1/)

  // Another area: its stations are read and the tab says which area it is.
  expect(areas[0]).toBe('jakarta')
  const areaPicker = card.getByRole('button', { name: 'Air quality area' })
  await expect(areaPicker).toContainText('Jakarta')
  await areaPicker.click()
  await page.getByRole('option', { name: 'Java' }).click()
  await expect(page).toHaveURL(/air_area=java/)
  await expect.poll(() => areas.at(-1)).toBe('java')
  await expect(areaPicker).toContainText('Java')

  await toggle.uncheck()
  await expect(page.locator('.ra-aqi')).toHaveCount(0)
})

test('every WAQI station over Indonesia is drawn, and the full list shows the worst 50 first', async ({ page }) => {
  await mockRaMap(page, { crisis: false })
  await page.route('**/api/ra/map-settings', (route) => route.fulfill({ json: { tile_url: '/e2e-tiles/{z}/{x}/{y}.png', attribution: 'Test tiles', max_zoom: 19, waqi_enabled: true } }))
  const many = Array.from({ length: 55 }, (_, index) => ({
    id: 1000 + index, name: `Station ${index + 1}`, latitude: -8 + index * 0.1, longitude: 110 + index * 0.2,
    aqi: 200 - index, band: { code: 'unhealthy', label: 'Unhealthy' }, measured_at: null, affected: false, places: [],
  }))
  await page.route(/\/api\/ra\/waqi(\?|$)/, (route) => route.fulfill({ json: { ...WAQI_REPORT, stations: [...WAQI_REPORT.stations, ...many] } }))
  await page.goto('/locations/map?report=waqi')
  await expect(page.getByText('Air quality, WAQI (58)')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.ra-aqi')).toHaveCount(58)
  const card = page.getByTestId('ra-waqi')
  await card.getByRole('tab', { name: 'All stations (58)' }).click()
  await expect(card.locator('li[data-station]')).toHaveCount(50)
  await card.getByRole('button', { name: 'Show all 58 stations' }).click()
  await expect(card.locator('li[data-station]')).toHaveCount(58)
})

test('without a WAQI token there is no WAQI layer or tab', async ({ page }) => {
  await mockRaMap(page, { crisis: false })
  await page.goto('/locations/map')
  await expect(page.getByRole('checkbox', { name: /^Weather warnings, BMKG/ })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('checkbox', { name: /^Air quality, WAQI/ })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Air quality now (WAQI)' })).toHaveCount(0)
  await expect(page.locator('.ra-aqi')).toHaveCount(0)
})

test('a disaster is declared from an earthquake, filled in from BMKG', async ({ page }) => {
  const log = await mockRaMap(page, { quakes: true, crisis: false })
  await page.goto('/locations/map?quake=3')
  const list = page.getByTestId('ra-earthquakes')
  await list.locator('[data-quake="3"]').getByRole('button', { name: 'Declare Disaster' }).click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Declare Disaster' })
  await expect(dialog.getByText('From the BMKG earthquake M5,6 on 6 Nov 2026, 13:42 WIB')).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByLabel('What is happening')).toHaveValue(
    'Earthquake M5,6 (BMKG), 10 km deep. Pusat gempa berada di darat 3 km Barat Laut Tangerang Selatan. Felt: IV Tangerang Selatan, III Jakarta. Tidak berpotensi tsunami',
  )
  await expect(dialog.getByLabel('Time (WIB)')).toHaveValue('13:42')
  // The hazard stays an earthquake.
  await expect(dialog.getByLabel('Hazard')).toBeDisabled()
  // The earthquake's alert radius is filled in (225 km at M5,6, held to the 200 km a disaster
  // allows), and it goes up and down by 0,1 km.
  const radius = dialog.getByLabel('Affected radius')
  await expect(radius).toHaveValue('200')
  await radius.fill('0.1')
  await radius.blur()
  await dialog.getByRole('button', { name: 'Increment' }).click()
  await expect(radius).toHaveValue('0.2')
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect.poll(() => log.declared.length).toBe(1)
  expect(log.declared[0]).toMatchObject({
    hazard_code: 'H03',
    latitude: -6.28,
    longitude: 106.73,
    radius_m: 200,
    earthquake_id: 3,
    started_at: '2026-11-06T13:42:00+07:00',
  })
})

test('the earthquake list says when BMKG is old news or switched off', async ({ page }) => {
  await mockRaMap(page, { quakes: 'stale', crisis: false })
  await page.goto('/locations/map')
  const list = page.getByTestId('ra-earthquakes')
  await expect(list.getByText('BMKG hasn\'t been read since 6 Nov 2026, 08:00 WIB')).toBeVisible({ timeout: 30_000 })
  await expect(list).toContainText('The last try: gempaterkini: timed out')

  await mockRaMap(page, { quakes: 'off', crisis: false })
  await page.reload()
  await expect(list.getByText('Earthquakes from BMKG are switched off')).toBeVisible({ timeout: 30_000 })
})

test('a disaster is approved or rejected on its page, not in the Disasters list', async ({ page }) => {
  const log = await mockRaMap(page, { pending: true })
  await page.goto('/disasters')
  const row = page.getByRole('row', { name: /DS-2026-0001/ })
  await expect(row).toContainText('Pending approval', { timeout: 30_000 })
  await expect(row.getByRole('button')).toHaveCount(0)
  await row.getByRole('link', { name: 'DS-2026-0001' }).click()
  await expect(page).toHaveURL(/\/disasters\/7$/)
  await page.getByTestId('approval-banner').getByRole('button', { name: 'Reject' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reject this disaster?' })
  await dialog.getByLabel('Reason').fill('A drill, not a flood.')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await expect.poll(() => log.decisions).toEqual([['reject', { note: 'A drill, not a flood.' }]])
  // No Delete button: a disaster declared by mistake is rejected (or closed).
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})

test('who declared a disaster is told someone else approves it', async ({ page }) => {
  await mockRaMap(page, { pending: true, own: true })
  await page.goto('/disasters/7')
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
  // Open Master building once first, so leaving the map later is instant.
  await page.goto('/admin/buildings')
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
      document.querySelector<HTMLAnchorElement>('nav[aria-label="Main"] a[href="/disasters/guidebook"]')!.click()
    })
    await expect(page).toHaveURL(/\/disasters\/guidebook$/)
    await page.waitForTimeout(500)
    await nav.getByRole('link', { name: 'Building map' }).click()
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  }
  expect(errors).toEqual([])
})
