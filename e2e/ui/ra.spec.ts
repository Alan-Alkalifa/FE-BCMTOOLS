import { expect, test } from '@playwright/test'
import { LOCATION, LOCATIONS, SIGNOFF_STEPS, SUMMARY, fillAddress, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

test('the home page links to the RA module', async ({ page }) => {
  await mockRa(page)
  await page.goto('/')
  // RA (head office) is "RA HO", beside "RA Branch".
  await expect(page.getByRole('heading', { name: 'RA HO', exact: true })).toBeVisible({ timeout: 60_000 })
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Building map' })).toHaveAttribute('href', '/locations/map')
  await expect(main.locator('a[href="/ra/manage"]')).toHaveText('Manage')
  await expect(main.getByRole('link', { name: 'Approval', exact: true }).and(main.locator('a[href="/ra/approval"]'))).toHaveText('Approval')
  await main.locator('a[href="/ra/monitoring"]').click()
  await expect(page).toHaveURL(/\/ra\/monitoring$/)
})

test('Manage lists the drafts and keeps its filters in the URL', async ({ page }) => {
  await mockRa(page)
  const request = page.waitForRequest((r) => r.url().includes('/api/ra/assessments?') && r.method() === 'GET')
  await page.goto('/ra/manage')
  expect(new URL((await request).url()).searchParams.get('status')).toBe('draft')
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Griya CIMB Niaga 2')).toBeVisible()
  await expect(page.getByText('32 of 33')).toBeVisible()
  await expect(page.getByRole('cell', { name: /Draft/ })).toBeVisible()
  // The reason for assessment: a column and a filter.
  await expect(page.getByRole('cell', { name: 'New building' })).toBeVisible()
  const byReason = page.waitForRequest((r) => r.url().includes('reason=structural_change'))
  await page.getByLabel('Reason for assessment').click()
  await expect(page.getByRole('option', { name: 'After an incident' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Structural change' }).click()
  await byReason
  await expect(page).toHaveURL(/reason=structural_change/)
  // As SCCA's lists: search first, then building → reason → whose → period; Clear filters.
  const bar = page.getByRole('search')
  const labels = await bar.locator('[aria-label]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
  expect(labels).toEqual(['Search building, ID or ref. no.', 'Filter by building', 'Reason for assessment', 'Whose drafts', 'Filter by period'])
  await bar.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).not.toHaveURL(/reason=/)

  const mine = page.waitForRequest((r) => r.url().includes('mine=1'))
  await page.getByLabel('Whose drafts').click()
  await page.getByRole('option', { name: 'Created by me' }).click()
  await mine
  await expect(page).toHaveURL(/mine=1/)

  await page.getByRole('link', { name: 'RA-2025-0001' }).click()
  await expect(page).toHaveURL(/\/ra\/manage\/1$/)
})

test('Monitoring shows the portfolio, renewals, the register and waiting sign-offs', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/monitoring')
  await expect(page.getByRole('heading', { name: 'RA HO monitoring' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('RA HO')
  await expect(page.getByLabel('Overdue renewals: 1')).toBeVisible()
  await expect(page.getByLabel('No final RA yet: 1')).toBeVisible()
  await page.getByLabel('No final RA yet: 1').click()
  await expect(page).toHaveURL(/tab=register/)
  await expect(page).toHaveURL(/state=none/)
  await expect(page.getByText('Graha CIMB Niaga')).toBeVisible()
  expect(log.workflow.some((path) => path.startsWith('/api/ra/monitoring/register') && path.includes('state=none'))).toBe(true)
  // Who made the RA, as SCCA's Assessor (not the LIC).
  await expect(page.getByRole('columnheader', { name: 'Assessor' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'LIC' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Renewals' }).click()
  await expect(page.getByText('Griya CIMB Niaga 2').first()).toBeVisible()
  await expect(page.getByRole('table').filter({ visible: true }).getByText('Rina Kartika')).toBeVisible()
  await expect(page.getByText('Overdue', { exact: true }).first()).toBeVisible()

  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/ra/monitoring/renewals.xlsx?kind=head_office&state=none')

  await page.getByRole('tab', { name: 'Approval', exact: true }).click()
  await expect(page.getByText('Budi Hartono')).toBeVisible()
  await expect(page.getByText('6 working days').first()).toBeVisible()
  // Waiting past the reminder threshold, and the average wait of each step.
  await expect(page.getByText('Reminder due').first()).toBeVisible()
  await expect(page.getByText(/Slowest step: Unit Critical Business Function, 4[.,]5 working days on average, over 4 approvals\./)).toBeVisible()
  // The step is named by who signs it, like SCCA: the role title, not "Reviewed by".
  await expect(page.getByRole('table').getByText('Alternate Location Incident Commander')).toBeVisible()
  expect(log.workflow.some((path) => path.startsWith('/api/ra/monitoring/bottlenecks/step-averages'))).toBe(true)
})

test('Monitoring filters by the assessment date period', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/monitoring?tab=register')
  await expect(page.getByText('Graha CIMB Niaga')).toBeVisible({ timeout: 60_000 })
  const year = new Date().getFullYear()
  await page.getByLabel('Assessment date', { exact: true }).click()
  await page.getByRole('option', { name: 'This year' }).click()
  await expect(page).toHaveURL(new RegExp(`from=${year}-01-01`))
  await expect.poll(() => log.workflow.some((path) => path.startsWith('/api/ra/monitoring/register') && path.includes(`from=${year}-01-01`))).toBe(true)
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', `/api/ra/monitoring/register.xlsx?kind=head_office&from=${year}-01-01`)

  await page.getByLabel('Assessment date', { exact: true }).click()
  await page.getByRole('option', { name: 'Custom range' }).click()
  // A custom range starts as this year so far, with a calendar for each end.
  await expect(page).toHaveURL(new RegExp(`from=${year}-01-01&to=${year}-`))
  await expect(page.getByRole('button', { name: `1 Jan ${year}` })).toBeVisible()
})

test('a monitoring record is read-only and offers Approval to the signer', async ({ page }) => {
  await mockRa(page, { status: 'in_signoff' })
  await page.goto('/ra/monitoring/1')
  await expect(page.getByText(/read-only/i).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Open in Approval' })).toHaveAttribute('href', '/ra/approval/1')
  await expect(page.getByRole('button', { name: 'Delete assessment' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Sign-off' }).click()
  await expect(page.getByRole('button', { name: /^Approve/ })).toHaveCount(0)
})

test('Approval shows my inbox, what is coming, my history and the BCM board', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/approval')
  await expect(page.getByRole('heading', { name: 'Waiting for my sign-off' })).toBeVisible({ timeout: 60_000 })
  const inbox = page.getByRole('table').first()
  await expect(inbox.getByRole('link', { name: 'Griya CIMB Niaga 2' })).toHaveAttribute('href', '/ra/approval/1')
  await expect(inbox.getByText('2 working days')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible()

  await page.getByRole('tab', { name: 'My history' }).click()
  await expect(page.getByText('Checked with the floor wardens.')).toBeVisible()
  await page.getByLabel('Action').click()
  await page.getByRole('option', { name: 'Submitted' }).click()
  await expect(page).toHaveURL(/action=submitted/)
  await expect(page.getByText('Checked with the floor wardens.')).toHaveCount(0)
  // An approval BCM gave for me shows who gave it.
  await page.getByLabel('Action').click()
  await page.getByRole('option', { name: 'Approved on my behalf' }).click()
  await expect(page).toHaveURL(/action=on_behalf/)
  await expect(page.getByText('For Test User, by Dewi Lestari')).toBeVisible()

  await page.getByRole('tab', { name: 'BCM board' }).click()
  const board = page.getByRole('table').filter({ visible: true })
  await expect(board.getByText('Alternate Location Incident Commander')).toBeVisible()
  await expect(board.getByText('Reminder due')).toBeVisible()
  // Like SCCA's board: send the signer a reminder now.
  await page.getByRole('button', { name: /^Act on/ }).click()
  await expect(page.getByRole('menuitem', { name: 'Open sign-off' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Send a reminder now' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Send reminder' }).click()
  await expect(page.getByText('Reminder sent').first()).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['nudge', null])

  // Like SCCA's board: change the signer of the waiting step, with a reason.
  await page.getByRole('button', { name: /^Act on/ }).click()
  await page.getByRole('menuitem', { name: 'Change the signer' }).click()
  const change = page.getByRole('dialog', { name: 'Change the signer' })
  await change.getByRole('button', { name: 'Change signer' }).click()
  await expect(change.getByText('Pick the new signer.')).toBeVisible()
  await expect(change.getByText('Say why the step moves, e.g. the signer is on leave.')).toBeVisible()
  await change.getByLabel('New signer').click()
  await page.keyboard.type('Dewi')
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  await change.getByLabel('Reason').fill('Rina is on leave until 30 Oct.')
  await change.getByRole('button', { name: 'Change signer' }).click()
  await expect(page.getByText('Signer changed', { exact: true })).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['change-signer', { user_id: 4, reason: 'Rina is on leave until 30 Oct.' }])

  // ... or approve it on the signer's behalf, with the evidence.
  await page.getByRole('button', { name: /^Act on/ }).click()
  await page.getByRole('menuitem', { name: 'Approve on behalf' }).click()
  const behalf = page.getByRole('dialog', { name: 'Approve on behalf' })
  await behalf.getByRole('button', { name: 'Approve on behalf' }).click()
  await expect(behalf.getByText('Attach the evidence: the signer\'s email or memo.')).toBeVisible()
  await behalf.getByLabel('Reason').fill('Approved by email on 12 Oct 2026')
  await behalf.getByLabel('Evidence file').setInputFiles({ name: 'approval.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
  await expect(behalf.getByText('approval.pdf')).toBeVisible()
  await behalf.getByRole('button', { name: 'Approve on behalf' }).click()
  await expect(page.getByText(/^Approved on behalf of /)).toBeVisible()
  const [sent, body] = log.signoff.at(-1)!
  expect(sent).toBe('approve-on-behalf')
  expect(String(body)).toContain('Approved by email on 12 Oct 2026')
  expect(String(body)).toContain('filename="approval.pdf"')

  await page.getByLabel('Step').click()
  await page.getByRole('option', { name: 'Location Incident Coordinator (LIC)' }).click()
  await expect(page.getByText('No RA is in approval at this step.')).toBeVisible()
})

test('the BCM board only reminds on an RA I made, as SCCA\'s', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/approval?tab=board&q=own')
  const board = page.getByRole('table').filter({ visible: true })
  await expect(board.getByText('Your own RA: reminders only')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: /^Act on/ }).click()
  await expect(page.getByRole('menuitem', { name: 'Send a reminder now' })).toBeEnabled()
  await expect(page.getByRole('menuitem', { name: 'Change the signer' })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: 'Approve on behalf' })).toBeDisabled()
})

test('an approval record opens on the Sign-off tab', async ({ page }) => {
  await mockRa(page, { status: 'in_signoff' })
  await page.goto('/ra/approval/1')
  await expect(page.getByRole('button', { name: /^Approve/ })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'Sign-off' })).toHaveAttribute('aria-selected', 'true')
})

test('BCM acts for the signer from the Sign-off tab', async ({ page }) => {
  const log = await mockRa(page, { status: 'in_signoff', actForSigner: true })
  await page.goto('/ra/approval/1')
  const card = page.getByTestId('ra-act-for-signer')
  await expect(card.getByText('Legiran signs this step.', { exact: false })).toBeVisible({ timeout: 60_000 })
  // Approve is for the signer; BCM approves on their behalf, with the evidence.
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)

  await card.getByRole('button', { name: 'Change the signer' }).click()
  const change = page.getByRole('dialog', { name: 'Change the signer' })
  await expect(change.getByText('is with Legiran.')).toBeVisible()
  await change.getByLabel('New signer').click()
  await page.keyboard.type('Rina')
  await page.getByRole('option', { name: /Rina Kartika/ }).click()
  await change.getByLabel('Reason').fill('Legiran is on leave.')
  await change.getByRole('button', { name: 'Change signer' }).click()
  await expect(card.getByText('Rina Kartika signs this step.', { exact: false })).toBeVisible()
  await expect(page.getByText('Legiran → Rina Kartika')).toBeVisible()
  expect(log.signoff.at(-1)?.[0]).toBe('change-signer')

  await card.getByRole('button', { name: 'Approve on behalf' }).click()
  const behalf = page.getByRole('dialog', { name: 'Approve on behalf' })
  await behalf.getByLabel('Reason').fill('Approved by email on 12 Oct 2026')
  await behalf.getByLabel('Evidence file').setInputFiles({ name: 'approval.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
  await behalf.getByRole('button', { name: 'Approve on behalf' }).click()
  await expect(page.getByText('Approved on behalf of Rina Kartika', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Evidence: approval.pdf' })).toHaveAttribute('href', '/api/ra/assessments/1/attachments/1')
  await expect(page.getByText('for Rina Kartika')).toBeVisible()
})

test('old links land in the right section', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra')
  await expect(page).toHaveURL(/\/ra\/monitoring$/, { timeout: 60_000 })
  await page.goto('/ra/new?location_id=1')
  await expect(page).toHaveURL(/\/ra\/manage\/new\?location_id=1$/, { timeout: 60_000 })
  await page.goto('/ra/manage/1?tab=summary')
  await expect(page).toHaveURL(/\/ra\/manage\/1\?tab=summary$/, { timeout: 60_000 })
})

/** The building picker's list, with Griya's earlier RA final (so Annual review can renew it). */
async function griyaHasAFinalRa(page: import('@playwright/test').Page) {
  await page.route(/\/api\/ra\/locations\?kind=head_office&active=true$/, (route) => route.fulfill({
    json: { items: LOCATIONS.map((row) => (row.id === 1 ? { ...row, final_assessment: { ...SUMMARY, status: 'approved' } } : row)) },
  }))
}

test('creating an assessment can start from the previous cycle', async ({ page }) => {
  await mockRa(page)
  await griyaHasAFinalRa(page)
  await page.goto('/ra/manage/new')
  await expect(page.getByRole('heading', { name: 'Assessment', exact: true })).toBeVisible({ timeout: 60_000 })
  // As SCCA: nothing else can be filled in before the reason.
  await expect(page.getByText('Pick the reason first: the other fields open once it is chosen, and it decides the renewal due date.')).toBeVisible()
  const building = page.getByRole('button', { name: /^Building\*?$/ })
  await expect(building).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Assessment date' })).toBeDisabled()
  // As SCCA's: the person creating it is the assessor.
  await expect(page.getByLabel('Assessor', { exact: true })).toHaveValue('Test User')
  await expect(page.getByRole('link', { name: 'Add building' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByLabel('LIC: Location incident coordinator (LIC)')).toBeDisabled()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page.getByText('Choose the reason for this assessment.')).toBeVisible()
  await page.getByLabel('Reason for assessment').click()
  await expect(page.getByRole('option', { name: /New building/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /After an incident/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Annual review/ }).click()
  // The help under the reason follows the reason picked, across the whole row.
  await expect(page.getByText('Renews the last final RA. Renewal is due one year after the assessment date.')).toBeVisible()
  await expect(building).toBeEnabled()
  await building.click()
  await page.getByRole('option', { name: /Griya CIMB Niaga 2/ }).click()
  // As SCCA's note on a picked application: no checkbox; it starts from the last RA, and its
  // last RA is still a draft.
  const note = page.getByTestId('building-note')
  await expect(note).toContainText('This building already has an RA draft')
  await expect(note).toContainText('Copied the assessment details from its last RA (RA-2025-0001, 10 Mar 2025). Approvals start over. Check with its LIC before starting another one.')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  // The location incident team of the previous cycle fills the team: users from the directory.
  await expect(page.getByLabel('LIC: Location incident coordinator (LIC)')).toContainText('Legiran')
  await expect(page.getByLabel('LICOM: Location incident commander (LICOM) / alternate')).toContainText('Budi Hartono')
  // No RA period field: the period is the year of the assessment date.
  await expect(page.getByLabel('RA period')).toHaveCount(0)
  const year = new Date().getFullYear()
  await expect(page.getByText(`RA period ${year}, the year of this date.`)).toBeVisible()
  const request = page.waitForRequest((r) => r.url().endsWith('/api/ra/assessments') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Create assessment' }).click()
  expect((await request).postDataJSON()).toMatchObject({ location_id: 1, reason: 'annual_review', period_year: year, copy_from_id: 1, lic_user_id: 1, licom_user_id: 3, lic_phone: '081312262739' })
  await expect(page).toHaveURL(/\/ra\/manage\/1$/)
})

test('the hazards tab is a table; its pencil opens the hazard to rate', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards')
  await expect(page.getByTestId('hazard-intro')).toContainText('Identify all threats relevant to the location.', { timeout: 60_000 })
  const table = page.getByRole('table')
  for (const header of ['No', 'Hazard group', 'Type of Hazard', 'Historical of occurrence', 'Probability of occurrence', 'Probability rating', 'Monetary impact', 'Impact rating', 'Existing mitigation measures']) {
    await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
  // Gempa Bumi: historical 3, probability 2 → probability rating 3; impact rating 4.
  const row = table.getByRole('row', { name: /Gempa Bumi/ })
  await expect(row.getByRole('cell').nth(5)).toHaveText('3')
  await expect(row.getByRole('cell').nth(10)).toHaveText('4')
  await page.getByLabel('Hazard group').click()
  await page.getByRole('option', { name: 'Security threats' }).click()
  await expect(table.getByRole('row', { name: /Gempa Bumi/ })).toHaveCount(0)
  await expect(table.getByRole('row', { name: /Terorisme/ })).toBeVisible()
  await table.getByRole('button', { name: 'Rate Terorisme' }).click()
  await expect(page).toHaveURL(/tab=hazards&hazard=H21/)
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('21 - Terorisme')
  await page.getByRole('button', { name: 'Back to the hazards' }).click()
  await expect(page).not.toHaveURL(/hazard=/)
  await expect(page.getByRole('table')).toBeVisible()
})

test('rating a hazard fills in its ratings and saves only that hazard', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('3 - Gempa Bumi', { timeout: 60_000 })
  await expect(page.getByRole('textbox', { name: 'Probability rating' })).toHaveValue('3')
  await expect(page.getByRole('textbox', { name: 'Impact rating' })).toHaveValue('4')
  await expect(page.getByText('3 × 4', { exact: true })).toHaveCount(0)

  await page.getByRole('combobox', { name: /Monetary impact/ }).first().click()
  await page.getByRole('option', { name: '5 - Critical' }).click()
  await expect(page.getByRole('textbox', { name: 'Impact rating' })).toHaveValue('5')
  await expect(page.getByText('1 hazard has unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Save ratings', exact: true }).click()
  await expect(page.getByText('1 hazard saved').first()).toBeVisible()
  expect(log.ratings).toHaveLength(1)
  expect(log.ratings[0]).toEqual([expect.objectContaining({ code: 'H03', monetary: 5, historical: 3 })])
})

test('the action plan is optional, also for a high residual risk', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H28')
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('28 - Peretasan Sistem Komputer', { timeout: 60_000 })
  await expect(page.getByText('High', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText('Optional. A high residual risk is followed up through CIM.')).toBeVisible()
  await expect(page.getByText(/needs an action plan/)).toHaveCount(0)
  await expect(page.getByText('Still needed for this hazard')).toHaveCount(0)
})

test('the questionnaire guide opens the Lampiran tables', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards')
  await page.getByRole('button', { name: 'How to fill in the questionnaire' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'How to fill in the questionnaire' })
  await expect(dialog.getByRole('tab')).toHaveText(['Historical', 'Probability', 'Impact', 'Mitigation'])
  await expect(dialog.getByRole('tab', { name: 'Historical' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('cell', { name: 'Once in the past 10 years' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Probability' }).click()
  await expect(dialog.getByRole('cell', { name: '5 (Almost certain)' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Impact' }).click()
  await expect(dialog.getByRole('columnheader', { name: 'Infrastructure impact' })).toBeVisible()
  await expect(dialog.getByRole('cell', { name: '5 (Critical)' })).toBeVisible()
  await expect(dialog.getByRole('cell', { name: /Rp 3.5 billion or more/ })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Mitigation' }).click()
  await expect(dialog.getByRole('rowheader', { name: 'KEY PERSONNEL /LOSS OF PEOPLE' })).toBeVisible()
  await expect(dialog.getByText(/^Replacement staff are available/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await expect(dialog).toHaveCount(0)
})

test('marking a hazard not applicable rates it N/A', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H06')
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('6 - Cuaca Ekstream', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Mark as not applicable' }).click()
  await expect(page.getByText('N/A - Not applicable').first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Probability rating' })).toHaveValue('N/A')
  await expect(page.getByText('Not applicable', { exact: true }).first()).toBeVisible()
})

test('leaving a tab with unsaved ratings asks first', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H01')
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('1 - Banjir/ Banjir Bandang', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Mark as not applicable' }).click()
  // Back on the table the edit is kept, marked as unsaved.
  await page.getByRole('button', { name: 'Back to the hazards' }).click()
  await expect(page.getByText('1 hazard has unsaved changes')).toBeVisible()
  await page.getByRole('tab', { name: 'Sign-off' }).click()
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/tab=hazards/)
})

test('the Risk Summary counts hazards by level and shows gross and residual as tables', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=summary')
  await expect(page.getByRole('tab', { name: 'Risk Summary' })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Risk Summary' })).toBeVisible()
  const note = page.getByTestId('cim-note')
  // English only, titled Risk Summary (no colon).
  await expect(note).toContainText('Risk Summary')
  await expect(note).toContainText('All threats with a Residual Risk above "Medium"')
  await expect(note).not.toContainText('Semua Ancaman')
  await expect(note).not.toContainText('Risk Summary:')
  await expect(page.getByText('Follow up high residual risks through CIM')).toHaveCount(0)
  await expect(page.getByText(/\d × \d/)).toHaveCount(0)

  // High is open: its hazard opens on the Hazards tab.
  await expect(page.getByRole('button', { name: 'High: 1 hazard' })).toHaveAttribute('aria-expanded', 'true')
  // Each hazard shows its existing mitigation measures, not the CIM reference or action plan.
  await expect(page.getByRole('columnheader', { name: 'Existing mitigation measures' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'CIM ref. no.' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Action plan' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Peretasan Sistem Komputer' }).click()
  await expect(page).toHaveURL(/tab=hazards&hazard=H28/)
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('28 - Peretasan Sistem Komputer')

  await page.getByRole('tab', { name: 'Risk Summary' }).click()
  // The Risk Matrix: gross and residual side by side, as tables.
  await expect(page.getByRole('heading', { name: 'Risk Matrix' })).toBeVisible()
  await page.getByRole('button', { name: 'Show the gross risk table' }).click()
  const gross = page.getByRole('table', { name: 'Gross risk' })
  const quake = gross.getByRole('row', { name: /Gempa Bumi/ })
  await expect(quake.getByRole('cell').nth(2)).toHaveText('3')
  await expect(quake.getByRole('cell').nth(3)).toHaveText('4')
  await expect(quake.getByText('High')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show the residual risk table' })).toBeVisible()
})

test('buildings have no Delete button: a building is made inactive instead', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations')
  await expect(page.getByText('Griya CIMB Niaga 2')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  await page.goto('/locations/1')
  await expect(page.getByRole('heading', { name: 'Griya CIMB Niaga 2' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  expect(log.deletedLocations).toEqual([])
})

test('deleting an assessment returns to the list', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  await expect(page.getByText('Griya CIMB Niaga 2 · 2025').first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Delete assessment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete assessment' }).click()
  await expect(page).toHaveURL(/\/ra\/manage$/)
})

test('the occupants tab lists the divisions with their totals and both views', async ({ page }) => {
  await mockRa(page)
  await page.goto('/locations/1?tab=occupants')
  await expect(page.getByRole('heading', { name: 'Divisions in this building' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('1.725', { exact: true })).toBeVisible()
  await expect(page.getByText('Showing 39 of 39 divisions')).toBeVisible()
  const table = page.getByRole('table').filter({ visible: true })
  await expect(table.getByRole('columnheader', { name: 'Directorate' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Division' })).toBeVisible()

  await page.getByRole('tab', { name: 'Continuity strategy' }).click()
  await expect(table.getByRole('columnheader', { name: 'MTD' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Critical rating' })).toBeVisible()
  await expect(table.getByRole('row', { name: /Application Access Management/ }).getByText('4 hours')).toBeVisible()

  await page.getByLabel('Search by division, directorate or floor').fill('credit documentation')
  await expect(page.getByText('Showing 1 of 39 divisions')).toBeVisible()
})

test('adding a division takes its MTD and critical rating from the division list', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/1?tab=occupants')
  await expect(page.getByRole('heading', { name: 'Divisions in this building' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Add division' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add division' })
  await dialog.getByRole('button', { name: 'Division name' }).click()
  await page.getByRole('option', { name: 'Human Resources' }).click()
  // Read-only, from the division: set in RA configuration.
  await expect(dialog.getByRole('textbox', { name: 'MTD' })).toHaveValue('24-48 hours')
  await expect(dialog.getByRole('textbox', { name: 'MTD' })).toBeDisabled()
  await expect(dialog.getByRole('textbox', { name: 'Critical rating' })).toHaveValue('Necessary')
  // Radio buttons became dropdowns.
  await expect(dialog.getByRole('radio')).toHaveCount(0)
  await dialog.getByRole('combobox', { name: 'Has a BCP' }).click()
  await page.getByRole('option', { name: 'Yes' }).click()
  await dialog.getByRole('spinbutton', { name: 'Employees', exact: true }).fill('12')
  await dialog.getByRole('spinbutton', { name: 'Pregnant employees' }).fill('20')
  await dialog.getByRole('button', { name: 'Add division' }).click()
  await expect(dialog.getByText('Cannot be more than the number of employees.')).toBeVisible()

  await dialog.getByRole('spinbutton', { name: 'Pregnant employees' }).fill('1')
  await dialog.getByRole('button', { name: 'Add division' }).click()
  await expect(page.getByText('Division added').first()).toBeVisible()
  const sent = log.lists.occupants?.[0]?.occupants as Record<string, unknown>[]
  expect(sent).toHaveLength(40)
  expect(sent.at(-1)).toMatchObject({ division_id: 102, unit_name: 'Human Resources', mtd: '24-48 hours', employee_count: 12, has_bcp: true })
  expect(Object.keys(sent[0]!)).not.toContain('critical_rating')
})

test('a division that is not listed yet is added with its MTD and rating', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/1?tab=occupants')
  await page.getByRole('button', { name: 'Add division' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Add division' })
  await dialog.getByRole('button', { name: 'Division name' }).click()
  await page.keyboard.type('Treasury Operations')
  await page.getByRole('option', { name: /Treasury Operations/ }).click()
  await dialog.getByRole('button', { name: 'Add division' }).click()
  await expect(dialog.getByText('Choose its critical rating.')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Critical rating' }).click()
  await page.getByRole('option', { name: 'Important', exact: true }).click()
  // The MTD band of the rating is suggested.
  await expect(dialog.getByRole('combobox', { name: 'MTD' })).toContainText('12-24 hours')
  await dialog.getByRole('button', { name: 'Add division' }).click()
  await expect(page.getByText('Division added').first()).toBeVisible()
  expect(log.created.at(-1)).toEqual({ division: { name: 'Treasury Operations', mtd: '12-24 hours', critical_rating: 'Important' } })
  const sent = log.lists.occupants?.[0]?.occupants as Record<string, unknown>[]
  expect(sent.at(-1)).toMatchObject({ division_id: 202, unit_name: 'Treasury Operations', mtd: '12-24 hours' })
})

test('the recovery team needs every field but the home phone on a filled row', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/1?tab=team')
  await expect(page.getByRole('heading', { name: 'Damage Assessment Team (DAT)' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Add member to Core Support Team' }).click()
  await page.getByRole('textbox', { name: 'Role, Core Support Team row 8' }).fill('Legal')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Enter the name and mobile, or remove this row.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Name, Core Support Team row 8' }).fill('Dewi')
  await page.getByRole('textbox', { name: 'Mobile, Core Support Team row 8' }).fill('0812 3456 7890')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Recovery team saved').first()).toBeVisible()
  const members = log.lists['recovery-team']?.[0]?.members as { team: string, name: string }[]
  expect(members).toHaveLength(26)
  expect(members.at(-1)).toMatchObject({ team: 'core_support_team', role: 'Legal', name: 'Dewi', mobile: '0812 3456 7890', home_phone: null })
})

test('the call tree saves each contact with its level', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/1?tab=calltree')
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
  await page.goto('/locations')
  await expect(page.getByRole('link', { name: 'Griya CIMB Niaga 2' }).first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('link', { name: 'Input building data' }).click()
  await expect(page).toHaveURL(/\/locations\/new$/)
  await expect(page.getByRole('heading', { name: 'Building Data Entry' })).toBeVisible()
  await page.getByRole('button', { name: 'Add building' }).click()
  await expect(page.getByText('Enter the building name.')).toBeVisible()
  await page.getByRole('textbox', { name: /Building name/ }).fill('Menara CIMB Niaga')
  await expect(page.getByText('Enter the building name.')).toHaveCount(0)
  await fillAddress(page)
  await page.getByRole('button', { name: 'Add building' }).click()
  await expect(page).toHaveURL(/\/locations\/3\?tab=contacts$/)

  // A new building waits for approval.
  await expect(page.getByTestId('approval-banner')).toContainText('Waiting for approval. Test User added this building')
  await expect(page.getByText('Waiting for approval', { exact: true }).first()).toBeVisible()

  // Every contact field is required.
  await page.getByRole('button', { name: 'Add police station' }).click()
  await page.getByPlaceholder('Name').last().fill('Polsek Setiabudi')
  await page.getByRole('button', { name: 'Save contacts' }).click()
  await expect(page.getByText('Every contact needs all of its details.')).toBeVisible()
  await expect(page.getByText('Required.')).toHaveCount(2)
  expect(log.lists.contacts).toBeUndefined()
  await page.getByRole('textbox', { name: 'Phone' }).last().fill('(021) 520 0110')
  await page.getByRole('textbox', { name: 'Address' }).last().fill('Jl. Setiabudi Raya')
  await page.getByRole('button', { name: 'Save contacts' }).click()
  await expect(page.getByText('Contacts saved').first()).toBeVisible()
  expect(log.lists.contacts?.[0]).toEqual({ contacts: [expect.objectContaining({ kind: 'police', name: 'Polsek Setiabudi', phone: '(021) 520 0110', address: 'Jl. Setiabudi Raya' })] })
  expect(log.created[0]).toMatchObject({ kind: 'head_office', province: 'DKI Jakarta', city: 'Jakarta Selatan', district: 'Setiabudi', zip_code: '12920' })
})

test('the location page lists its assessments and edits its details', async ({ page }) => {
  await mockRa(page)
  await page.goto('/locations/1')
  await expect(page.getByText('39 divisions · 1.725 employees · 1 assessment')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', '/ra/manage/new?location_id=1')
  const request = page.waitForRequest((r) => r.url().endsWith('/api/ra/locations/1') && r.method() === 'PUT')
  await page.getByRole('textbox', { name: /^Address/ }).fill('Jl. Wahid Hasyim, Bintaro')
  await expect(page.getByRole('combobox', { name: 'Type of building' })).toBeDisabled()
  await page.getByRole('button', { name: 'Save building' }).click()
  expect((await request).postDataJSON()).toMatchObject({ address: 'Jl. Wahid Hasyim, Bintaro', is_active: true })
})

test('the assessment links to the location profile', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  await expect(page.getByRole('link', { name: 'Open building profile' })).toHaveAttribute('href', '/locations/1', { timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'Occupants' })).toHaveCount(0)
})

test('Manage shows a returned RA as a draft', async ({ page }) => {
  await mockRa(page)
  const returned = { ...SUMMARY, status: 'draft', is_returned: true, returned_comment: 'Rate H05 again.' }
  // Registered after mockRa, so it answers the list first.
  await page.route(/\/api\/ra\/assessments\?/, (route) =>
    route.fulfill({ json: { items: [returned], page: 1, per_page: 25, total: 1, pages: 1 } }),
  )
  await page.goto('/ra/manage')
  const row = page.getByRole('row', { name: /RA-2025-0001/ })
  await expect(row).toContainText('Draft', { timeout: 60_000 })
  await expect(row).not.toContainText('Returned')
})

test('Manage has View buildings and New assessment in the top bar', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage')
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'View buildings' })).toHaveAttribute('href', '/locations?type=head_office')
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', '/ra/manage/new')
  // In the top bar next to the bell, not in the table's toolbar.
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'View buildings' })).toHaveCount(0)
  await expect(main.getByRole('link', { name: 'New assessment' })).toHaveCount(0)
  const button = await page.getByRole('link', { name: 'New assessment' }).boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual((await main.boundingBox())!.y)
})

test('on the hazard page, the group and type of hazard are picked from dropdowns', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  const type = page.getByRole('button', { name: 'Type of Hazard' })
  await expect(type).toContainText('3 - Gempa Bumi', { timeout: 60_000 })
  const group = page.getByRole('combobox', { name: 'Hazard group name' })
  await expect(group).toContainText('Natural disasters')
  // The free text boxes take up to 3,000 characters, with a counter.
  for (const name of [/^Existing mitigation measures/, /^Action plan/]) {
    await expect(page.getByRole('textbox', { name })).toHaveAttribute('maxlength', '3000')
  }
  await expect(page.getByText(/^\d+\/3,?000$/).first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: /^CIM ref\. no\./ })).toHaveAttribute('maxlength', '64')

  await group.click()
  await page.getByRole('option', { name: 'Security threats' }).click()
  await expect(type).toContainText('14 - Kebakaran')
  await type.click()
  await page.getByRole('option', { name: '21 - Terorisme' }).click()
  await expect(page).toHaveURL(/hazard=H21/)
  // Next hazard crosses into the next group.
  await page.getByRole('button', { name: 'Next hazard' }).click()
  await expect(type).toContainText('22 - Gangguan pasokan listrik')
  await expect(group).toContainText('Infrastructure')
})

test('the location incident team is required', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  await expect(page.getByLabel('LIC: Location incident coordinator (LIC)')).toContainText('Legiran', { timeout: 60_000 })
  const phone = page.getByRole('textbox', { name: 'LIC mobile number' })
  await expect(phone).toHaveValue('081312262739')
  let saved = false
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().endsWith('/api/ra/assessments/1')) saved = true
  })
  await phone.fill('')
  await page.getByRole('button', { name: 'Save assessment' }).click()
  await expect(page.getByText('Enter the LIC mobile number.')).toBeVisible()
  expect(saved).toBe(false)
})

test('the assessment date is picked from a calendar; the renewal follows it', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  const date = page.getByRole('button', { name: 'Assessment date' })
  await expect(date).toContainText('10 Mar 2025', { timeout: 60_000 })
  // As SCCA's: who made the RA, read-only, under the assessment date.
  const assessor = page.getByLabel('Assessor', { exact: true })
  await expect(assessor).toHaveValue('Test User')
  await expect(assessor).toBeDisabled()
  const dateBox = (await date.boundingBox())!
  const assessorBox = (await assessor.boundingBox())!
  expect(assessorBox.y).toBeGreaterThan(dateBox.y + dateBox.height)
  expect(Math.abs(assessorBox.x - dateBox.x)).toBeLessThan(2)
  await date.click()
  await page.getByRole('gridcell', { name: /17/ }).first().click()
  await expect(date).toContainText('17 Mar 2025')
  // As SCCA: every reason but a structural change renews a year after the assessment.
  await expect(page.getByText('Renewal due 17 Mar 2026, one year after this assessment.')).toBeVisible()
  await expect(page.getByText('RA period 2025, the year of this date.')).toBeVisible()
  const request = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/api/ra/assessments/1'))
  await page.getByRole('button', { name: 'Save assessment' }).click()
  const body = (await request).postDataJSON()
  expect(body).toMatchObject({ assessment_date: '2025-03-17', period_year: 2025, reason: 'new_building' })
  expect(body).not.toHaveProperty('due_date')
})

test('picking the LICOM from the users makes them the Reviewed by signer', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/1')
  const licom = page.getByLabel('LICOM: Location incident commander (LICOM) / alternate')
  await expect(licom).toContainText('Budi Hartono', { timeout: 60_000 })
  await licom.click()
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  // Picking someone else puts in their mobile number from the directory.
  await expect(page.getByRole('textbox', { name: 'LICOM mobile number' })).toHaveValue('0811-5555-6666')
  const request = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/api/ra/assessments/1'))
  await page.getByRole('button', { name: 'Save assessment' }).click()
  expect((await request).postDataJSON()).toMatchObject({ licom_user_id: 4, licom_phone: '0811-5555-6666' })
  expect(log.signoff).toEqual([])

  await page.getByRole('tab', { name: 'Sign-off' }).click()
  const reviewed = page.getByRole('listitem').filter({ hasText: 'Step 3 of 4' })
  await expect(reviewed.getByRole('textbox', { name: 'Signer: Reviewed by' })).toHaveValue('Dewi Lestari')
  await expect(reviewed.getByRole('textbox', { name: 'Signer: Reviewed by' })).not.toBeEditable()
  await expect(reviewed.getByText('The LICOM: change them on the Details tab.')).toBeVisible()
  await expect(reviewed.getByRole('textbox', { name: 'Designation' })).toHaveValue('Head of BCM')
})

test('a new assessment without an earlier cycle asks for the team', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/new?location_id=2')
  await expect(page.getByRole('heading', { name: 'Location incident team' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('building-note')).toContainText('No RA yet for this building')
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page.getByText('Choose the LIC.')).toBeVisible()
  await expect(page.getByText('Enter the LICOM mobile number.')).toBeVisible()
  // As SCCA's banner: each field's message under the summary.
  expect(log.created).toHaveLength(0)
})

test('the reason decides which buildings can be picked, as SCCA\'s reason decides the application', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/new')
  const reason = page.getByLabel('Reason for assessment')
  const building = page.getByRole('button', { name: /^Building\*?$/ })
  await reason.click({ timeout: 60_000 })
  await page.getByRole('option', { name: /New building/ }).click()
  await expect(page.getByText('Only buildings without an RA yet. Not listed? Use Add building.')).toBeVisible()
  await building.click()
  // Griya already has an RA: not a new building.
  await expect(page.getByRole('option', { name: /Graha CIMB Niaga/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Griya CIMB Niaga 2/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await reason.click()
  await page.getByRole('option', { name: /Annual review/ }).click()
  await building.click()
  // Neither has a final RA to renew.
  await expect(page.getByRole('option', { name: /CIMB Niaga/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await reason.click()
  await page.getByRole('option', { name: /Structural change/ }).click()
  await building.click()
  await expect(page.getByRole('option', { name: /CIMB Niaga/ })).toHaveCount(2)
})

test('a reason the picked building doesn\'t fit asks first, then clears the building', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/new')
  const reason = page.getByLabel('Reason for assessment')
  const building = page.getByRole('button', { name: /^Building\*?$/ })
  await reason.click({ timeout: 60_000 })
  await page.getByRole('option', { name: /Structural change/ }).click()
  await building.click()
  await page.getByRole('option', { name: /Griya CIMB Niaga 2/ }).click()
  await expect(page.getByTestId('building-note')).toBeVisible()

  await reason.click()
  await page.getByRole('option', { name: /New building/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Change the reason?' })
  await expect(dialog).toContainText('Griya CIMB Niaga 2 already has an RA, so it isn\'t a new building. The building you picked is cleared.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  // Kept: the reason and the building.
  await expect(reason).toContainText('Structural change')
  await expect(building).toContainText('Griya CIMB Niaga 2')

  await reason.click()
  await page.getByRole('option', { name: /New building/ }).click()
  await page.getByRole('dialog', { name: 'Change the reason?' }).getByRole('button', { name: 'Change reason' }).click()
  await expect(reason).toContainText('New building')
  await expect(building).not.toContainText('Griya')
  await expect(page.getByTestId('building-note')).toHaveCount(0)
})

/** Building 1 with one RA in this year's period, as a draft or final. */
async function griyaHasAnRaThisYear(page: import('@playwright/test').Page, status: 'draft' | 'approved') {
  const year = new Date().getFullYear()
  await page.route('**/api/ra/locations/1', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ json: { ...LOCATION, id: 1, assessments: [{ ...SUMMARY, ref_no: `RA-${year}-0005`, period_year: year, status }] } })
    : route.fallback()))
  return year
}

test('a building that already has an RA for the period says so on the date, before saving', async ({ page }) => {
  const log = await mockRa(page)
  const year = await griyaHasAnRaThisYear(page, 'draft')
  await page.goto('/ra/manage/new?location_id=1')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  await page.getByRole('option', { name: /Structural change/ }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  // Even a structural change waits until the period's RA is final.
  await expect(page.getByText(`The RA for ${year} (RA-${year}-0005) isn't final yet. A structural change can start once it is final.`)).toBeVisible()
  expect(log.created).toHaveLength(0)
})

test('a structural change can follow a final RA in the same period', async ({ page }) => {
  await mockRa(page)
  const year = await griyaHasAnRaThisYear(page, 'approved')
  await page.goto('/ra/manage/new?location_id=1')
  const reason = page.getByLabel('Reason for assessment')
  // Its RA is final: renewing it is the usual reason, but not in the same year.
  await expect(reason).toContainText('Annual review', { timeout: 60_000 })
  await expect(page.getByTestId('building-note')).toContainText(`Copied the assessment details from its last RA (RA-${year}-0005, 10 Mar 2025). Approvals start over. Check each rating and change anything that is different now.`)
  await page.getByRole('button', { name: 'Create assessment' }).click()
  const taken = page.getByText(`This building already has an RA for ${year} (RA-${year}-0005). Pick a date in another year, or open that RA. Only a structural change can follow a final RA in the same year.`)
  await expect(taken).toBeVisible()
  await reason.click()
  await page.getByRole('option', { name: /Structural change/ }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(taken).toHaveCount(0)
  await expect(page.getByText(/isn't final yet/)).toHaveCount(0)
  // What's left is the structural change's own renewal date.
  await expect(page.getByText('Enter the renewal due date. It can be sooner than one year.')).toBeVisible()
})

test('on the Details tab a reason the building doesn\'t fit is offered disabled', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  // Its only RA is this one: no final RA to renew; it is the building's first RA.
  await expect(page.getByRole('option', { name: /Annual review/ })).toHaveAttribute('data-disabled', '')
  await expect(page.getByRole('option', { name: /Annual review/ })).toContainText('There is no final RA to renew.')
  await expect(page.getByRole('option', { name: /New building/ })).not.toHaveAttribute('data-disabled', '')
})

test('signers are chosen per role; an incomplete assessment cannot be submitted', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/1?tab=signoff')
  await expect(page.getByText('Complete the hazards before submitting')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
  // Prepared by and Reviewed by are the LIC and LICOM picked on the Details tab.
  await expect(page.getByText('2 steps still need a signer.')).toBeVisible()
  const prepared = page.getByRole('listitem').filter({ hasText: 'Step 1 of 4' })
  await expect(prepared.getByRole('textbox', { name: 'Signer: Prepared by' })).toHaveValue('Legiran')
  await expect(prepared.getByRole('textbox', { name: 'Signer: Prepared by' })).not.toBeEditable()

  const step = page.getByRole('listitem').filter({ hasText: 'Step 2 of 4' })
  await step.getByRole('combobox').or(step.getByRole('button').first()).first().click()
  await page.getByRole('option', { name: /Rina Kartika/ }).click()
  // The designation is the signer's job title from the user directory; it can't be typed.
  const designation = step.getByRole('textbox', { name: 'Designation' })
  await expect(designation).toHaveValue('Head of Retail Operations')
  await expect(designation).not.toBeEditable()
  await page.getByRole('button', { name: 'Save signers' }).click()
  await expect(page.getByText('Signers saved').first()).toBeVisible()
  // Only the roles picked here are sent; the team's roles follow the Details tab.
  expect(log.signoff[0]?.[1]).toEqual({
    signoffs: [
      { role: 'acknowledged_by_unit', signer_id: 2 },
      { role: 'acknowledged_by_bcm', signer_id: null },
    ],
  })
  await expect(page.getByText('1 step still needs a signer.')).toBeVisible()
})

test('the Sign-off tab follows the configured steps: fixed and optional steps', async ({ page }) => {
  const steps = SIGNOFF_STEPS.head_office.map((row) => ({ ...row }))
  // BCM sets a fixed signer for the BCM head; the unit's step is optional.
  Object.assign(steps[3]!, { signer_mode: 'fixed' })
  Object.assign(steps[1]!, { mandatory: false })
  const log = await mockRa(page, { steps })
  await page.goto('/ra/manage/1?tab=signoff')
  await expect(page.getByText('Complete the hazards before submitting')).toBeVisible({ timeout: 60_000 })
  // Nothing else to pick: the LIC and LICOM sign theirs, the fixed signer is put on at Submit.
  await expect(page.getByText(/still needs? a signer/)).toHaveCount(0)
  const fixed = page.getByRole('listitem').filter({ hasText: 'Step 4 of 4' })
  await expect(fixed.getByRole('textbox', { name: 'Signer: Acknowledged by' })).not.toBeEditable()
  await expect(fixed.getByText('The fixed signer BCM sets in RA configuration. Put on the step at Submit.')).toBeVisible()
  const optional = page.getByRole('listitem').filter({ hasText: 'Step 2 of 4' })
  await expect(optional.getByText('Optional', { exact: true })).toBeVisible()
  await expect(optional.getByText('Optional. The step is skipped when no one signs it.')).toBeVisible()
  await optional.getByRole('combobox').or(optional.getByRole('button').first()).first().click()
  await page.getByRole('option', { name: /Rina Kartika/ }).click()
  await page.getByRole('button', { name: 'Save signers' }).click()
  await expect(page.getByText('Signers saved').first()).toBeVisible()
  // Only the chosen step is sent: not the team's, not the fixed one.
  expect(log.signoff[0]?.[1]).toEqual({ signoffs: [{ role: 'acknowledged_by_unit', signer_id: 2 }] })
})

test('submitting, approving and returning an assessment', async ({ page }) => {
  const log = await mockRa(page, { ready: true })
  await page.goto('/ra/manage/1?tab=signoff')
  // The statement (English only), and the history right under it.
  await expect(page.getByTestId('signoff-statement-en')).toContainText('I declare that the Risk Assessment', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Submit for approval' }).click()
  await expect(page.getByText('Waiting for Prepared by (Location Incident Coordinator (LIC))')).toBeVisible()
  await expect(page.getByText('In approval', { exact: true }).first()).toBeVisible()

  await page.getByRole('textbox', { name: 'Comment' }).fill('Checked with the floor wardens.')
  await page.getByRole('button', { name: /^Approve/ }).click()
  await expect(page.getByText('Approval recorded').first()).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['approve', { comment: 'Checked with the floor wardens.' }])
  await expect(page.getByText('Waiting for Acknowledged by (Unit Critical Business Function)')).toBeVisible()
  const headings = (await page.getByRole('heading', { level: 2 }).allTextContents()).map((text) => text.trim())
  expect(headings.indexOf('Sign-off history')).toBe(headings.indexOf('Risk assessment sign-off') + 1)
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
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeEnabled()
})

test('an assessment in sign-off is locked', async ({ page }) => {
  await mockRa(page, { status: 'in_signoff' })
  await page.goto('/ra/manage/1')
  await expect(page.getByText(/In approval: waiting for Legiran/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('LIC: Location incident coordinator (LIC)')).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'LIC mobile number' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save assessment' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Hazards' }).click()
  await expect(page.getByRole('button', { name: 'Save ratings', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'View Banjir/ Banjir Bandang' }).click()
  await expect(page.getByRole('button', { name: 'Mark as not applicable' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /Existing mitigation measures/ })).toBeDisabled()
})

test('a location gets its map pin on the Map tab', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/1?tab=map')
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
  await page.goto('/ra/manage/1')
  await expect(page.getByRole('link', { name: 'Add it on the building\'s Map tab' })).toHaveAttribute('href', '/locations/1?tab=map', { timeout: 60_000 })
})

test('the location register links to the location map instead of its own map', async ({ page }) => {
  await mockRa(page)
  await page.goto('/locations')
  await expect(page.getByRole('link', { name: 'Building map' }).last()).toHaveAttribute('href', '/locations/map', { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveCount(0)
})

test('downloads are offered only once the RA is approved', async ({ page }) => {
  await mockRa(page, { status: 'in_signoff' })
  await page.goto('/ra/monitoring/1')
  await expect(page.getByText('Griya CIMB Niaga 2 · 2025').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0)
})

test('an approved assessment downloads as PDF or as the filled workbook', async ({ page }) => {
  await mockRa(page, { status: 'approved' })
  const requested: string[] = []
  await page.route(/\/api\/ra\/assessments\/1\/report\.(pdf|xlsx)$/, (route) => {
    const format = route.request().url().endsWith('.pdf') ? 'pdf' : 'xlsx'
    requested.push(format)
    return route.fulfill({
      body: Buffer.from('%PDF-1.4'),
      contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: { 'Content-Disposition': `attachment; filename=RA_RA-2025-0001_Griya-CIMB-Niaga-2.${format}` },
    })
  })
  await page.goto('/ra/monitoring/1')
  await page.getByRole('button', { name: 'Download' }).click({ timeout: 60_000 })
  const pdf = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /PDF report/ }).click()
  expect((await pdf).suggestedFilename()).toBe('RA_RA-2025-0001_Griya-CIMB-Niaga-2.pdf')
  await page.getByRole('button', { name: 'Download' }).click()
  const xlsx = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Excel workbook/ }).click()
  expect((await xlsx).suggestedFilename()).toBe('RA_RA-2025-0001_Griya-CIMB-Niaga-2.xlsx')
  expect(requested).toEqual(['pdf', 'xlsx'])
})

test('the List tab works like SCCA\'s Register', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/monitoring?tab=register')
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Last final RA' })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('columnheader', { name: 'Open RA' })).toBeVisible()
  const headers = (await table.getByRole('columnheader').allTextContents()).map((text) => text.trim())
  expect(headers.at(-1)).toBe('RA(s)')
  // The open RA's status and whose step it waits for are two columns; statuses are centred.
  expect(headers.indexOf('Waiting for')).toBe(headers.indexOf('Open RA') + 1)
  await expect(table.getByRole('columnheader', { name: 'Open RA' })).toHaveClass(/text-center/)
  // The name opens the last final RA; its code is text, not a link.
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2' })).toHaveAttribute('href', '/ra/monitoring/1')
  await expect(table.getByText('RA-2025-0001', { exact: true })).toBeVisible()
  await expect(table.getByRole('link', { name: 'RA-2025-0001' })).toHaveCount(0)
  // Open RA: the status of the RA being worked on, in SCCA's words (a returned RA is a draft).
  const row = table.getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(row.getByRole('link', { name: /: Draft$/ })).toHaveAttribute('href', '/ra/monitoring/99')
  await expect(row).not.toContainText('Returned')
  // The building's ID in grey under its name.
  await expect(row.getByText('RA-HQ-0001', { exact: true })).toBeVisible()
  // A building without an RA: plain name, not final yet.
  await expect(table.getByRole('row', { name: /Graha CIMB Niaga/ })).toContainText('Not final yet')
  // RAs: the count opens the building's RAs, newest first.
  await row.getByRole('button', { name: 'RA history of Griya CIMB Niaga 2' }).click()
  const history = page.getByRole('dialog')
  await expect(history.getByRole('link')).toHaveCount(2)
  await expect(history.getByRole('link').first()).toHaveAttribute('href', '/ra/monitoring/99')
  await expect(history.getByRole('link').first()).toContainText('Draft')
  // "Show in the table": every RA of the building, under its row.
  const assessments = page.waitForRequest((r) => r.url().includes('/api/ra/assessments?') && r.url().includes('location_id=1'))
  await history.getByRole('button', { name: 'Show in the table' }).click()
  await assessments
  await page.keyboard.press('Escape')
  const details = page.getByRole('region', { name: 'RAs of Griya CIMB Niaga 2' })
  await expect(details.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible()
  await expect(details.getByText('New building')).toBeVisible()
  await details.getByRole('button', { name: 'Hide' }).click()
  await expect(details).toHaveCount(0)
})

test('a structural change picks its renewal date, like SCCA\'s System change', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/new?location_id=1')
  // The reason is the first field of the form.
  const fields = page.locator('form label')
  await expect(fields.first()).toContainText('Reason for assessment', { timeout: 60_000 })
  await expect(page.getByText(/Renewal due .*, one year after this assessment\./)).toBeVisible()
  await page.getByLabel('Reason for assessment').click()
  await page.getByRole('option', { name: /Structural change/ }).click()
  await expect(page.getByText('The building changed, e.g. a renovation or new occupants. Pick the renewal due date below: it can be sooner than one year.')).toBeVisible()
  await expect(page.getByText('Standard renewal is one year after the assessment. A structural change can be sooner.')).toBeVisible()
  // As SCCA: the reason on its own row (half width), the building under it, the dates side by side.
  const reason = await page.getByLabel('Reason for assessment').boundingBox()
  const building = await page.getByRole('button', { name: /^Building\*?$/ }).boundingBox()
  const date = await page.getByRole('button', { name: 'Assessment date' }).boundingBox()
  const due = await page.getByRole('button', { name: 'Renewal due date' }).boundingBox()
  expect(reason!.y).toBeLessThan(building!.y)
  expect(building!.y).toBeLessThan(date!.y)
  expect(Math.abs(date!.y - due!.y)).toBeLessThan(2)
  expect(reason!.width).toBeLessThan(building!.width)
  // The help under the reason uses the whole row, not only the half the select takes.
  const help = await page.getByText(/^The building changed/).boundingBox()
  expect(help!.width).toBeGreaterThan(reason!.width)
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page.getByText('Enter the renewal due date. It can be sooner than one year.')).toBeVisible()
})

test('the List exports every RA of the ticked buildings to Excel', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/monitoring?tab=register')
  const table = page.getByRole('table')
  const exportLink = page.getByRole('link', { name: /Export .*to Excel/ })
  await expect(exportLink).toHaveAttribute('href', '/api/ra/monitoring/register.xlsx?kind=head_office', { timeout: 60_000 })
  await table.getByRole('checkbox', { name: 'Select Griya CIMB Niaga 2 for the Excel export' }).click()
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  await expect(exportLink).toHaveText('Export 1 selected to Excel')
  await expect(exportLink).toHaveAttribute('href', '/api/ra/monitoring/register.xlsx?kind=head_office&ids=1')
  // The header box ticks the whole page; Clear selection empties it.
  await table.getByRole('checkbox', { name: /Select every building on this page/ }).click()
  await expect(exportLink).toHaveAttribute('href', /ids=1%2C2|ids=2%2C1/)
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(exportLink).toHaveText('Export to Excel')
})

test('an assessment date whose period already has an RA says so on the date', async ({ page }) => {
  await mockRa(page)
  await page.route('**/api/ra/assessments', (route) => (route.request().method() === 'POST'
    ? route.fulfill({ status: 422, json: { error: 'validation_failed', details: { period_year: 'This location already has an assessment for 2026.' } } })
    : route.fallback()))
  await page.goto('/ra/manage/new?location_id=2')
  await expect(page.getByLabel('Reason for assessment')).toContainText('New building', { timeout: 60_000 })
  await page.getByLabel('LIC: Location incident coordinator (LIC)').click()
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  await page.getByLabel('LICOM: Location incident commander (LICOM) / alternate').click()
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  // There is no period field: the message replaces the date's help ("RA period …").
  await expect(page.getByText('This location already has an assessment for 2026.', { exact: true })).toBeVisible()
  await expect(page.getByText(/^RA period \d{4}, the year of this date\.$/)).toHaveCount(0)
  // As SCCA's banner: the summary, then each field's message.
  await expect(page.getByText(/^Some fields need attention/)).toContainText('• Assessment date: This location already has an assessment for 2026.')
})
