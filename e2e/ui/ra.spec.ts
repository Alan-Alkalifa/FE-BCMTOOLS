import { expect, test } from '@playwright/test'
import { mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

test('the home page links to the RA module', async ({ page }) => {
  await mockRa(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'RA', exact: true })).toBeVisible({ timeout: 60_000 })
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Location map' })).toHaveAttribute('href', '/ra/map')
  await main.getByRole('link', { name: 'Assessments' }).first().click()
  await expect(page).toHaveURL(/\/ra$/)
})

test('the list shows the highest residual risk and keeps filters in the URL', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra')
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Griya CIMB Niaga 2')).toBeVisible()
  await expect(page.getByText('32 of 33')).toBeVisible()
  await expect(page.getByText('Draft')).toBeVisible()

  await page.getByLabel('Filter by highest residual level').click()
  await page.getByRole('option', { name: 'Medium' }).click()
  await expect(page).toHaveURL(/level=Medium/)
  await expect(page.getByText('No assessments match these filters.')).toBeVisible()
})

test('creating an assessment can start from the previous cycle', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/new')
  await expect(page.getByRole('heading', { name: 'Assessment', exact: true })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: /^Location\*?$/ }).click()
  await page.getByRole('option', { name: /Griya CIMB Niaga 2/ }).click()
  await expect(page.getByText('Start from RA-2025-0001 (2025)')).toBeVisible()
  // The location incident team of the previous cycle fills the empty team fields.
  await expect(page.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Legiran')
  const request = page.waitForRequest((r) => r.url().endsWith('/api/ra/assessments') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Create assessment' }).click()
  expect((await request).postDataJSON()).toMatchObject({ location_id: 1, copy_from_id: 1, lic_name: 'Legiran', licom_name: 'Crispina Arumardi' })
  await expect(page).toHaveURL(/\/ra\/1$/)
})

test('rating a hazard updates its level and saves only that hazard', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/1?tab=hazards&hazard=H03')
  await expect(page.getByRole('heading', { name: '3. Gempa Bumi' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('3 × 4', { exact: true }).filter({ visible: true })).toBeVisible()

  await page.getByRole('combobox', { name: 'Monetary impact' }).first().click()
  await page.getByRole('option', { name: '5 · Critical' }).click()
  await expect(page.getByText('3 × 5', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('1 hazard has unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Save ratings' }).click()
  await expect(page.getByText('1 hazard saved').first()).toBeVisible()
  expect(log.ratings).toHaveLength(1)
  expect(log.ratings[0]).toEqual([expect.objectContaining({ code: 'H03', monetary: 5, historical: 3 })])
})

test('the action plan is optional, also for a high residual risk', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1?tab=hazards&hazard=H28')
  await expect(page.getByRole('heading', { name: '28. Peretasan Sistem Komputer' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('High', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText('Optional. A high residual risk is followed up through CIM.')).toBeVisible()
  await expect(page.getByText(/needs an action plan/)).toHaveCount(0)
  await expect(page.getByText('Still needed for this hazard')).toHaveCount(0)
})

test('the questionnaire guide opens the Lampiran tables', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1?tab=hazards')
  await page.getByRole('button', { name: 'How to fill in the questionnaire' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'How to fill in the questionnaire' })
  await expect(dialog.getByRole('tab')).toHaveText(['Historical', 'Probability', 'Impact', 'Mitigation'])
  await expect(dialog.getByRole('tab', { name: 'Historical' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('cell', { name: 'Terjadi sekali dalam 10 tahun kebelakang' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Probability' }).click()
  await expect(dialog.getByRole('cell', { name: '5 (Almost certain)' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Impact' }).click()
  await expect(dialog.getByRole('columnheader', { name: 'Infrastructure impact' })).toBeVisible()
  await expect(dialog.getByRole('cell', { name: '5 (Critical)' })).toBeVisible()
  await expect(dialog.getByRole('cell', { name: /≥ Rp 3.5 milyar/ })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Mitigation' }).click()
  await expect(dialog.getByRole('rowheader', { name: 'KEY PERSONNEL /LOSS OF PEOPLE' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await expect(dialog).toHaveCount(0)
})

test('marking a hazard not applicable clears it from the heat map', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1?tab=hazards&hazard=H06')
  await expect(page.getByRole('heading', { name: '6. Cuaca Ekstream' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Mark as not applicable' }).click()
  await expect(page.getByText('N/A · Not applicable').first()).toBeVisible()
  await expect(page.getByText('Not applicable', { exact: true }).first()).toBeVisible()
})

test('leaving a tab with unsaved ratings asks first', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1?tab=hazards&hazard=H01')
  await expect(page.getByRole('heading', { name: '1. Banjir/ Banjir Bandang' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Mark as not applicable' }).click()
  await page.getByRole('tab', { name: 'Sign-off' }).click()
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/tab=hazards/)
})

test('the heat maps place hazards and open them', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1?tab=summary')
  await expect(page.getByRole('heading', { name: 'Gross risk heat map' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Follow up high residual risks through CIM')).toBeVisible()
  const gross = page.getByRole('table', { name: /Gross risk heat map/ })
  // Probability 3 (third row), impact 4 (fifth column incl. the row header).
  const cell = gross.locator('tbody tr').nth(2).locator('td').nth(3)
  await expect(cell.getByRole('button', { name: 'Gempa Bumi' })).toBeVisible()
  await expect(cell.getByText('High')).toBeVisible()
  await cell.getByRole('button', { name: 'Gempa Bumi' }).click()
  await expect(page).toHaveURL(/tab=hazards&hazard=H03/)
  await expect(page.getByRole('heading', { name: '3. Gempa Bumi' })).toBeVisible()
})

test('a location with assessments cannot be deleted', async ({ page }) => {
  await mockRa(page, { locationInUse: true })
  await page.goto('/ra/locations')
  await expect(page.getByText('Griya CIMB Niaga 2')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Delete Griya CIMB Niaga 2' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete location' }).click()
  await expect(page.getByText(/has assessments, so it can't be deleted/)).toBeVisible()
})

test('deleting an assessment returns to the list', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1')
  await expect(page.getByText('Griya CIMB Niaga 2 · 2025').first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Delete assessment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete assessment' }).click()
  await expect(page).toHaveURL(/\/ra$/)
})

test('the occupants tab shows the workbook totals and both views', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/locations/1?tab=occupants')
  await expect(page.getByRole('heading', { name: 'Units in this building' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('1.725', { exact: true })).toBeVisible()
  await expect(page.getByText('Showing 39 of 39 units')).toBeVisible()
  const table = page.getByRole('table').filter({ visible: true })
  await expect(table.getByRole('columnheader', { name: 'Directorate' })).toBeVisible()

  await page.getByRole('tab', { name: 'Continuity strategy' }).click()
  await expect(table.getByRole('columnheader', { name: 'MTD' })).toBeVisible()
  await expect(table.getByRole('row', { name: /Application Access Management/ }).getByText('4 hours')).toBeVisible()

  await page.getByLabel('Search by unit, directorate or floor').fill('credit documentation')
  await expect(page.getByText('Showing 1 of 39 units')).toBeVisible()
})

test('adding a unit validates counts and saves the whole list', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/locations/1?tab=occupants')
  await expect(page.getByRole('heading', { name: 'Units in this building' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Add unit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add unit' })
  await dialog.getByRole('textbox', { name: /Unit name/ }).fill('Treasury Operations')
  await dialog.getByRole('spinbutton', { name: 'Employees', exact: true }).fill('12')
  await dialog.getByRole('spinbutton', { name: 'Pregnant employees' }).fill('20')
  await dialog.getByRole('button', { name: 'Add unit' }).click()
  await expect(dialog.getByText('Cannot be more than the number of employees.')).toBeVisible()

  await dialog.getByRole('spinbutton', { name: 'Pregnant employees' }).fill('1')
  await dialog.getByRole('button', { name: 'Add unit' }).click()
  await expect(page.getByText('Unit added').first()).toBeVisible()
  const sent = log.lists.occupants?.[0]?.occupants as { unit_name: string, employee_count: number }[]
  expect(sent).toHaveLength(40)
  expect(sent.at(-1)).toMatchObject({ unit_name: 'Treasury Operations', employee_count: 12 })
})

test('the recovery team needs a name on every filled row', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/locations/1?tab=team')
  await expect(page.getByRole('heading', { name: 'Damage Assessment Team (DAT)' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Add member to Core Support Team' }).click()
  await page.getByRole('textbox', { name: 'Role, Core Support Team row 8' }).fill('Legal')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Enter the name, or remove this row.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Name, Core Support Team row 8' }).fill('Dewi')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Recovery team saved').first()).toBeVisible()
  const members = log.lists['recovery-team']?.[0]?.members as { team: string, name: string }[]
  expect(members).toHaveLength(26)
  expect(members.at(-1)).toMatchObject({ team: 'core_support_team', role: 'Legal', name: 'Dewi' })
})

test('the call tree saves each contact with its level', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/locations/1?tab=calltree')
  await expect(page.getByRole('heading', { name: 'Level 3 call tree' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Remove Level 1 call tree row 1', exact: true }).click()
  await page.getByRole('button', { name: 'Save call tree' }).click()
  await expect(page.getByText('Call tree saved').first()).toBeVisible()
  const entries = log.lists['call-tree']?.[0]?.entries as { level: number, contact_name: string }[]
  expect(entries).toHaveLength(38)
  expect(entries[0]).toMatchObject({ level: 1, contact_name: 'D-1 Level TAJINDRA PAL SINGH' })
  expect(entries.filter((entry) => entry.level === 3)).toHaveLength(17)
})

test('adding a location opens its profile, starting with the emergency contacts', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/locations')
  await expect(page.getByRole('link', { name: 'Griya CIMB Niaga 2' }).first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('link', { name: 'Add location' }).click()
  await expect(page).toHaveURL(/\/ra\/locations\/new$/)
  await page.getByRole('button', { name: 'Add location' }).click()
  await expect(page.getByText('Enter the building name.')).toBeVisible()
  await page.getByRole('textbox', { name: /Building name/ }).fill('Menara CIMB Niaga')
  await expect(page.getByText('Enter the building name.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add location' }).click()
  await expect(page).toHaveURL(/\/ra\/locations\/3\?tab=contacts$/)

  await page.getByRole('button', { name: 'Add police station' }).click()
  await page.getByPlaceholder('Name').last().fill('Polsek Setiabudi')
  await page.getByRole('button', { name: 'Save contacts' }).click()
  await expect(page.getByText('Contacts saved').first()).toBeVisible()
  expect(log.lists.contacts?.[0]).toEqual({ contacts: [expect.objectContaining({ kind: 'police', name: 'Polsek Setiabudi' })] })
})

test('the location page lists its assessments and edits its details', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/locations/1')
  await expect(page.getByText('39 units · 1.725 employees · 1 assessment')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', '/ra/new?location_id=1')
  const request = page.waitForRequest((r) => r.url().endsWith('/api/ra/locations/1') && r.method() === 'PUT')
  await page.getByRole('textbox', { name: 'Address' }).fill('Jl. Wahid Hasyim, Bintaro')
  await page.getByRole('button', { name: 'Save location' }).click()
  expect((await request).postDataJSON()).toMatchObject({ address: 'Jl. Wahid Hasyim, Bintaro', is_active: true })
})

test('the assessment links to the location profile', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1')
  await expect(page.getByRole('link', { name: 'Open location profile' })).toHaveAttribute('href', '/ra/locations/1', { timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'Occupants' })).toHaveCount(0)
})

test('the list puts View locations and New assessment right above the table', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra')
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible({ timeout: 60_000 })
  const card = page.locator('main').filter({ has: page.getByRole('table') })
  const view = card.getByRole('link', { name: 'View locations' })
  const create = card.getByRole('link', { name: 'New assessment' })
  await expect(view).toHaveAttribute('href', '/ra/locations')
  await expect(create).toHaveAttribute('href', '/ra/new')
  await expect(page.getByRole('banner').getByRole('link', { name: 'New assessment' })).toHaveCount(0)
  const table = await page.getByRole('table').boundingBox()
  const button = await create.boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual(table!.y)
  expect(table!.y - (button!.y + button!.height)).toBeLessThan(40)
})

test('hazards are picked by group, then by hazard', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1?tab=hazards&hazard=H03')
  await expect(page.getByRole('heading', { name: '3. Gempa Bumi' })).toBeVisible({ timeout: 60_000 })
  const groups = page.getByRole('group', { name: 'Hazard groups' })
  await expect(groups.getByRole('button')).toHaveCount(6)
  await expect(groups.getByRole('button', { name: /Natural disasters/ })).toHaveAttribute('aria-pressed', 'true')
  const list = page.getByRole('navigation', { name: 'Hazards: Natural disasters' })
  await expect(list.getByRole('button')).toHaveCount(9)
  await expect(list.getByRole('button', { name: /Kebakaran/ })).toHaveCount(1) // only "Kebakaran dalam skala besar"

  await groups.getByRole('button', { name: /Security threats/ }).click()
  const security = page.getByRole('navigation', { name: 'Hazards: Security threats' })
  await expect(security.getByRole('button')).toHaveCount(8)
  await expect(page.getByRole('heading', { name: '14. Kebakaran' })).toBeVisible()
  await security.getByRole('button', { name: /Terorisme/ }).click()
  await expect(page.getByRole('heading', { name: '21. Terorisme' })).toBeVisible()
  // Next hazard crosses into the next group.
  await page.getByRole('button', { name: 'Next hazard' }).click()
  await expect(page.getByRole('heading', { name: '22. Gangguan pasokan listrik' })).toBeVisible()
  await expect(groups.getByRole('button', { name: /Infrastructure/ })).toHaveAttribute('aria-pressed', 'true')
})

test('the location incident team is required', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1')
  const lic = page.getByRole('textbox', { name: /Location incident coordinator/ })
  await expect(lic).toHaveValue('Legiran', { timeout: 60_000 })
  let saved = false
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().endsWith('/api/ra/assessments/1')) saved = true
  })
  await lic.fill('')
  await page.getByRole('button', { name: 'Save assessment' }).click()
  await expect(page.getByText('Enter the LIC name.')).toBeVisible()
  expect(saved).toBe(false)
})

test('a new assessment without an earlier cycle asks for the team', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/new?location_id=2')
  await expect(page.getByRole('heading', { name: 'Location incident team' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page.getByText('Enter the LIC name.')).toBeVisible()
  await expect(page.getByText('Enter the LICOM mobile number.')).toBeVisible()
  expect(log.created).toHaveLength(0)
})

test('signers are chosen per role; an incomplete assessment cannot be submitted', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/1?tab=signoff')
  await expect(page.getByText('Complete the hazards before submitting')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Submit for sign-off' })).toBeDisabled()
  await expect(page.getByText('4 roles still need a signer.')).toBeVisible()

  const step = page.getByRole('listitem').filter({ hasText: 'Step 1 of 4' })
  await step.getByRole('combobox').or(step.getByRole('button').first()).first().click()
  await page.getByRole('option', { name: /Rina Kartika/ }).click()
  await expect(step.getByRole('textbox', { name: 'Designation' })).toHaveValue('Head of Retail Operations')
  await page.getByRole('button', { name: 'Save signers' }).click()
  await expect(page.getByText('Signers saved').first()).toBeVisible()
  expect(log.signoff[0]?.[1]).toMatchObject({
    signoffs: expect.arrayContaining([{ role: 'prepared_by', signer_id: 2, designation: 'Head of Retail Operations' }]),
  })
  await expect(page.getByText('3 roles still need a signer.')).toBeVisible()
})

test('submitting, approving and returning an assessment', async ({ page }) => {
  const log = await mockRa(page, { ready: true })
  await page.goto('/ra/1?tab=signoff')
  await page.getByRole('button', { name: 'Submit for sign-off' }).click({ timeout: 60_000 })
  await expect(page.getByText('Waiting for Prepared by (Location Incident Coordinator (LIC))')).toBeVisible()
  await expect(page.getByText('In sign-off', { exact: true }).first()).toBeVisible()

  await page.getByRole('textbox', { name: 'Comment' }).fill('Checked with the floor wardens.')
  await page.getByRole('button', { name: /^Approve/ }).click()
  await expect(page.getByText('Approval recorded').first()).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['approve', { comment: 'Checked with the floor wardens.' }])
  await expect(page.getByText('Waiting for Acknowledged by (Unit critical business function)')).toBeVisible()
  await expect(page.getByText('Checked with the floor wardens.').first()).toBeVisible()

  await page.getByRole('button', { name: 'Return for changes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Return for changes?' })
  await dialog.getByRole('button', { name: 'Return to draft' }).click()
  await expect(dialog.getByText('Say what needs to change.')).toBeVisible()
  await dialog.getByRole('textbox', { name: /Comment/ }).fill('Floor wardens are out of date.')
  await expect(dialog.getByText('Say what needs to change.')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Return to draft' }).click()
  await expect(page.getByText(/Returned for changes by Test User/)).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['return', { comment: 'Floor wardens are out of date.' }])
  await expect(page.getByRole('button', { name: 'Submit for sign-off' })).toBeEnabled()
})

test('an assessment in sign-off is locked', async ({ page }) => {
  await mockRa(page, { status: 'in_signoff' })
  await page.goto('/ra/1')
  await expect(page.getByText(/In sign-off: waiting for Legiran/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('textbox', { name: /Location incident coordinator/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save assessment' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Hazards' }).click()
  await expect(page.getByRole('button', { name: 'Save ratings' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark as not applicable' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /Existing mitigation measures/ })).toBeDisabled()
})

test('the list filters by status and by what waits for me', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra')
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('cell', { name: 'Draft' })).toBeVisible()
  const request = page.waitForRequest((r) => r.url().includes('awaiting=me'))
  await page.getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'Waiting for my sign-off' }).click()
  await request
  await expect(page).toHaveURL(/status=awaiting/)
})

test('a location gets its map pin on the Map tab', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/locations/1?tab=map')
  const map = page.getByRole('region', { name: /Map of Griya CIMB Niaga 2/ })
  await expect(map).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('No pin yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save pin' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Find the address in Google Maps' })).toHaveAttribute('href', /google\.com\/maps\/search/)

  const coordinates = page.getByRole('textbox', { name: 'Coordinates' })
  await coordinates.fill('somewhere')
  await coordinates.press('Enter')
  await expect(page.getByText('Enter latitude and longitude, e.g. -6.271633, 106.719358.')).toBeVisible()
  await coordinates.fill('-6.271633, 106.719358')
  await coordinates.press('Enter')
  await expect(map.getByRole('button', { name: 'Location pin' })).toBeVisible()

  const request = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/api/ra/locations/1'))
  await page.getByRole('button', { name: 'Save pin' }).click()
  expect((await request).postDataJSON()).toEqual({ latitude: -6.271633, longitude: 106.719358 })
  await expect(page.getByText('Map pin saved').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the pin in Google Maps' })).toHaveAttribute('href', /query=-6\.271633%2C106\.719358/)

  // Clicking the map moves the pin; the coordinates follow.
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await expect(coordinates).not.toHaveValue('-6.271633, 106.719358')
  await expect(page.getByText('Unsaved changes')).toBeVisible()

  const cleared = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/api/ra/locations/1'))
  await page.getByRole('button', { name: 'Remove pin' }).click()
  await page.getByRole('button', { name: 'Save pin' }).click()
  expect((await cleared).postDataJSON()).toEqual({ latitude: null, longitude: null })
  expect(log.lists).toEqual({})
})

test('an assessment shows its location pin, or where to add one', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/1')
  await expect(page.getByRole('link', { name: 'Add it on the location\'s Map tab' })).toHaveAttribute('href', '/ra/locations/1?tab=map', { timeout: 60_000 })
})

test('the location register links to the location map instead of its own map', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/locations')
  await expect(page.getByRole('link', { name: 'Location map' }).last()).toHaveAttribute('href', '/ra/map', { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveCount(0)
})
