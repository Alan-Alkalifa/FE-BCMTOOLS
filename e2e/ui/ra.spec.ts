import { expect, test } from '@playwright/test'
import { LOCATION, LOCATIONS, SIGNOFF_STEPS, SUMMARY, fillAddress, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

test('the home page links to the RA module', async ({ page }) => {
  await mockRa(page)
  await page.goto('/')
  // RA (head office) is "RA HO", beside "RA Branch".
  await expect(page.getByRole('heading', { name: 'RA HO', exact: true })).toBeVisible({ timeout: 60_000 })
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Building map' })).toHaveAttribute('href', '/sites/map')
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
  await expect(page.getByRole('option', { name: 'After a disaster' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Structural change' }).click()
  await byReason
  await expect(page).toHaveURL(/reason=structural_change/)
  // As SCCA's lists. Search first, then building, reason and period, and Clear filters.
  // Manage lists only the user's drafts (mine=1), so there is no Whose filter.
  const bar = page.getByRole('search')
  const labels = await bar.locator('[aria-label]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
  expect(labels).toEqual(['Search building, ID or ref. no.', 'Filter by building', 'Reason for assessment', 'Filter by period'])
  await bar.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).not.toHaveURL(/reason=/)
  expect(new URL((await request).url()).searchParams.get('mine')).toBe('1')
  // SCCA's columns. Renews, My role, Assessor and Next step.
  for (const header of ['Renews', 'My role', 'Assessor', 'Next step']) {
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('cell', { name: 'Rate all 33 hazards' })).toBeVisible()

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
  await expect(page.getByRole('columnheader', { name: 'LIC', exact: true })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Renewals' }).click()
  await expect(page.getByText('Griya CIMB Niaga 2').first()).toBeVisible()
  await expect(page.getByRole('table').filter({ visible: true }).getByText('Rina Kartika')).toBeVisible()
  await expect(page.getByText('Overdue', { exact: true }).first()).toBeVisible()

  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/ra/monitoring/renewals.xlsx?kind=head_office&state=none')

  await page.getByRole('tab', { name: 'Approval', exact: true }).click()
  const approval = page.getByRole('table').filter({ visible: true })
  await expect(approval.getByText('Budi Hartono')).toBeVisible()
  for (const header of ['Current approval step', 'Approver', 'Status', 'Waiting since', 'Working days', 'Reminders sent', 'Escalated on', 'Working days in approval']) {
    await expect(approval.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
  await expect(page.getByText('6 working days').first()).toBeVisible()
  // Waiting past the reminder threshold, and the average wait of each step.
  await expect(page.getByText('Reminder due').first()).toBeVisible()
  await expect(page.getByText(/Slowest step: Unit Critical Business Function, 4[.,]5 working days on average, over 4 approvals\./)).toBeVisible()
  // The step is named by its configured title.
  await expect(page.getByRole('table').getByRole('cell', { name: 'Reviewed by Alternate Location Incident Commander (LICOM)', exact: true })).toBeVisible()
  expect(log.workflow.some((path) => path.startsWith('/api/ra/monitoring/bottlenecks/step-averages'))).toBe(true)
})

test('Monitoring Renewals generates annual reviews from the ticked rows, as SCCA', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/monitoring?tab=renewals')
  const table = page.getByRole('table').filter({ visible: true })
  await expect(table.getByText('Menara Sentraya')).toBeVisible({ timeout: 60_000 })
  for (const header of ['Building ID', 'Last final RA date', 'Assessor', 'LICOM', 'Renewal']) {
    await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
  // Griya's renewal is already a draft: it can't be generated.
  await expect(table.getByRole('checkbox', { name: 'Select Griya CIMB Niaga 2' })).toBeDisabled()
  await page.getByRole('button', { name: 'Act on Griya CIMB Niaga 2' }).click()
  await expect(page.getByRole('menuitem', { name: 'Generate annual review' })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: 'Open renewal' })).toBeVisible()
  await page.keyboard.press('Escape')

  const generate = page.getByRole('button', { name: /^Generate annual review \(/ })
  await expect(generate).toHaveText('Generate annual review (0)')
  await expect(generate).toBeDisabled()
  await table.getByRole('checkbox', { name: 'Select Menara Sentraya' }).click()
  await generate.click()
  // As SCCA's contributor, the LICOM is picked. The last final's LICOM is suggested.
  const dialog = page.getByRole('dialog', { name: 'Generate annual review' })
  await expect(dialog.getByText('You are the assessor and LIC.', { exact: false })).toBeVisible()
  await expect(dialog.getByText('Suggested is the last final\'s LICOM.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Generate' }).click()
  await expect(page.getByText('Created 1, skipped 0').first()).toBeVisible()
  expect(log.generated).toEqual([{ assessment_ids: [3], licom_user_id: 7 }])
})

test('Monitoring List: org filters, SCCA\'s columns, RA(s) history; the export checkboxes stay', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/monitoring?tab=register')
  const table = page.getByRole('table').filter({ visible: true })
  await expect(table.getByText('Griya CIMB Niaga 2')).toBeVisible({ timeout: 60_000 })
  for (const header of ['Building ID', 'Directorate', 'Sub directorate', 'Group / Area', 'Last final RA date', 'Assessor', 'LICOM', 'RA(s)']) {
    await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
  // Sub directorate sits between Directorate and Group / Area.
  const headers = await table.getByRole('columnheader').allTextContents()
  const at = (name: string) => headers.findIndex((text) => text.trim() === name)
  expect(at('Sub directorate')).toBe(at('Directorate') + 1)
  expect(at('Group / Area')).toBe(at('Sub directorate') + 1)
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ }).getByText('Ops Support')).toBeVisible()
  await expect(table.getByText('Building Management')).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Department', exact: true })).toHaveCount(0)
  await expect(table.getByRole('checkbox', { name: 'Select Griya CIMB Niaga 2 for the Excel export' })).toBeVisible()

  // The location's organization filters, as SCCA's.
  await page.getByLabel('Directorate', { exact: true }).click()
  await page.getByRole('option', { name: 'OPS' }).click()
  await expect(page).toHaveURL(/directorate=OPS/)
  await expect.poll(() => log.workflow.some((path) => path.startsWith('/api/ra/monitoring/register') && path.includes('directorate=OPS'))).toBe(true)
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', /directorate=OPS/)
  // Group / Area takes Department's place.
  await page.getByLabel('Group / Area', { exact: true }).click()
  await page.getByRole('option', { name: 'Building Management' }).click()
  await expect(page).toHaveURL(/org_group=Building(\+|%20)Management/)
  await expect.poll(() => log.workflow.some((path) => path.startsWith('/api/ra/monitoring/register') && path.includes('org_group=Building'))).toBe(true)

  // RA(s): every RA of the building, the current one marked.
  await table.getByRole('button', { name: 'RA history of Griya CIMB Niaga 2' }).click()
  const dialog = page.getByRole('dialog', { name: 'RAs of Griya CIMB Niaga 2' })
  await expect(dialog.getByText('Current')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/ra/monitoring/location-ras.xlsx?kind=head_office&location_id=1')

  // The Approval tab reads as SCCA's.
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Approval', exact: true }).click()
  const approval = page.getByRole('table').filter({ visible: true })
  for (const header of ['RA ref. no.', 'Current approval step', 'Approver', 'Status', 'Waiting since', 'Working days', 'Reminders sent', 'Escalated on', 'Working days in approval']) {
    await expect(approval.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
})

test('New assessment offers only the buildings the access scope opens for an Annual review', async ({ page }) => {
  await mockRa(page, { scopeIds: [2] })
  await griyaHasAFinalRa(page)
  await page.goto('/ra/manage/new')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  await page.getByRole('option', { name: /Annual review/ }).click()
  await expect(page.getByText('Only buildings with a final RA to renew, while no other RA of it is open. Only the buildings your access scope opens.')).toBeVisible()
  await page.getByRole('button', { name: /^Building\*?$/ }).click()
  // Griya has a final RA but is outside the scope.
  await expect(page.getByRole('option', { name: /Griya CIMB Niaga 2/ })).toHaveCount(0)
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
  await expect(board.getByText('Reviewed by Alternate Location Incident Commander (LICOM)')).toBeVisible()
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
  await page.getByRole('option', { name: 'LIC', exact: true }).click()
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

test('in Manage, each tab shows in red what is still needed before Submit, as SCCA', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  const tabs = page.getByRole('main').getByRole('tablist').first()
  // One hazard is not finished (H09); two steps still need a signer (the LIC and LICOM sign theirs).
  await expect(tabs.getByRole('tab', { name: 'Hazards 1' })).toBeVisible({ timeout: 60_000 })
  await expect(tabs.getByRole('tab', { name: 'Sign-off 2' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Details', exact: true })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Risk Summary', exact: true })).toBeVisible()
})

test('Monitoring shows no counts on the tabs', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/monitoring/1')
  const tabs = page.getByRole('main').getByRole('tablist')
  await expect(tabs.getByRole('tab', { name: 'Hazards', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(tabs.getByRole('tab', { name: 'Sign-off', exact: true })).toBeVisible()
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
  await page.route(/\/api\/ra\/locations\?kind=head_office&assessable=true$/, (route) => route.fulfill({
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
  // The LIC is always the assessor: the signed-in user, looked up, not picked.
  const lic = page.getByLabel('LIC: Location incident coordinator (LIC)')
  await expect(lic).toBeDisabled()
  await expect(lic).toHaveValue('Test User')
  await expect(page.getByText(/Signs as/)).toHaveCount(0)
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
  // The LICOM of the previous cycle comes along; the LIC stays the person making the RA.
  await expect(lic).toHaveValue('Test User')
  await expect(page.getByLabel('LICOM: Location incident commander (LICOM) / alternate')).toContainText('Budi Hartono')
  // No RA period field: the period is the year of the assessment date.
  await expect(page.getByLabel('RA period')).toHaveCount(0)
  const year = new Date().getFullYear()
  await expect(page.getByText(`RA period ${year}, the year of this date.`)).toBeVisible()
  const request = page.waitForRequest((r) => r.url().endsWith('/api/ra/assessments') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Create assessment' }).click()
  const sent = (await request).postDataJSON()
  expect(sent).toMatchObject({ location_id: 1, reason: 'annual_review', period_year: year, copy_from_id: 1, licom_user_id: 3, lic_phone: '081312262739' })
  expect(sent).not.toHaveProperty('lic_user_id')
  await expect(page).toHaveURL(/\/ra\/manage\/1$/)
})

test('the hazards tab is a table; its pencil opens the hazard to rate', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards')
  await expect(page.getByTestId('hazard-intro')).toContainText('Identify all threats relevant to the location.', { timeout: 60_000 })
  const table = page.getByRole('table')
  for (const header of ['No', 'Hazard group', 'Type of hazard', 'Historical of occurrence', 'Probability of occurrence', 'Probability rating', 'Monetary impact', 'Impact rating', 'Existing mitigation measures']) {
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
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('21 - Terorisme')
  await page.getByRole('button', { name: 'Back to the hazards' }).click()
  await expect(page).not.toHaveURL(/hazard=/)
  await expect(page.getByRole('table')).toBeVisible()
})

test('rating a hazard fills in its ratings and saves only that hazard', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('3 - Gempa Bumi', { timeout: 60_000 })
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

test('each hazard reviews past disasters over its own years, saved with its rating', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H01')
  const hint = page.getByTestId('past-disasters')
  // Without years: the last 10.
  await expect(hint).toContainText('BNPB recorded it 12 times in Kota Adm. Jakarta Selatan from 2017 to 2026.', { timeout: 60_000 })
  await expect(hint.getByRole('button', { name: /^Use/ })).toHaveCount(0)
  await expect(hint).not.toContainText('Suggested')

  await page.getByRole('button', { name: 'Review past occurrences from' }).click()
  await page.getByRole('listbox', { name: 'Review past occurrences from' }).getByRole('option', { name: '2022', exact: true }).click()
  await page.getByRole('button', { name: 'Review past occurrences to' }).click()
  await page.getByRole('listbox', { name: 'Review past occurrences to' }).getByRole('option', { name: '2023', exact: true }).click()
  await expect(hint).toContainText('BNPB recorded it 3 times in Kota Adm. Jakarta Selatan from 2022 to 2023.')
  await page.getByRole('button', { name: 'Save ratings', exact: true }).click()
  await expect(page.getByText('1 hazard saved').first()).toBeVisible()
  expect(log.ratings[0]).toEqual([expect.objectContaining({ code: 'H01', review_from_year: 2022, review_to_year: 2023 })])

  // None recorded for another hazard: it says so.
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  await expect(page.getByTestId('past-disasters')).toContainText('BNPB recorded none in Kota Adm. Jakarta Selatan from 2017 to 2026.', { timeout: 60_000 })
})

test('WHO\'s outbreak news and OpenAQ\'s air quality show on their hazards over the review years', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H11')
  const who = page.getByTestId('outbreak-news')
  await expect(who).toContainText('WHO reported outbreaks in Indonesia 3 times from 2017 to 2026.', { timeout: 60_000 })
  await expect(who.getByRole('link', { name: 'Poliomyelitis - Indonesia' })).toHaveAttribute('href', 'https://www.who.int/emergencies/disease-outbreak-news/item/2024-DON500')
  // DIBI counts nothing for it, so its "none" stays out.
  await expect(page.getByTestId('past-disasters')).not.toContainText('BNPB recorded none')
  await expect(page.getByTestId('past-disasters').getByRole('button', { name: /^Use/ })).toHaveCount(0)

  await page.goto('/ra/manage/1?tab=hazards&hazard=H10')
  const air = page.getByTestId('air-quality')
  await expect(air).toContainText('PM2.5 was above 55,4 µg/m³ on 501 days at US Embassy Jakarta South, 2,5 km away, from 2017 to 2026.', { timeout: 60_000 })
  await expect(air).toContainText('worst 140,3 µg/m³ on 15 Nov 2026')
  await expect(air).toContainText('days kept from 1 Jan 2024')
  await expect(page.getByTestId('outbreak-news')).toHaveCount(0)
})

test('GDELT\'s Indonesian news in the building\'s city shows on each hazard it has read', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H01')
  const news = page.getByTestId('gdelt-news')
  await expect(news).toContainText('Indonesian news reported it in Jakarta Selatan in 46 articles, on 9 days, from 2017 to 2026.', { timeout: 60_000 })
  await expect(news.getByRole('link', { name: 'Banjir rendam Kemang' })).toHaveAttribute('href', 'https://news.example.id/banjir-kemang')
  await expect(news).toContainText('banjir, banjir bandang, flood · counted from 23 Nov 2025 · Source: GDELT')
  // DIBI still speaks for floods.
  await expect(page.getByTestId('past-disasters')).toContainText('BNPB recorded it 12 times')
  // A hazard GDELT hasn't read yet says nothing.
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  await expect(page.getByTestId('past-disasters')).toContainText('BNPB recorded none', { timeout: 60_000 })
  await expect(page.getByTestId('gdelt-news')).toHaveCount(0)
})

test('Media Cloud\'s incident headlines since 2016 show on each incident hazard it has read', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H16')
  const archive = page.getByTestId('mediacloud-news')
  await expect(archive).toContainText('Indonesian headlines named it in Jakarta Selatan in 23 stories, on 19 days, from 2017 to 2026.', { timeout: 60_000 })
  await expect(archive.getByRole('link', { name: 'Perampokan toko emas di Jakarta Selatan' })).toHaveAttribute('href', 'https://news.example.id/perampokan-kemang')
  await expect(archive).toContainText('perampokan, rampok and the city in the headline · Source: Media Cloud')
  // A hazard whose history across Indonesia is still coming in says how far it is read.
  await page.goto('/ra/manage/1?tab=hazards&hazard=H17')
  await expect(page.getByTestId('mediacloud-news')).toContainText('in 2 stories, on 2 days', { timeout: 60_000 })
  await expect(page.getByTestId('mediacloud-news')).toContainText('sandera and the city in the headline · read up to 31 Mar 2019 so far · Source: Media Cloud')
  // A hazard Media Cloud hasn't read yet says nothing.
  await page.goto('/ra/manage/1?tab=hazards&hazard=H18')
  await expect(page.getByTestId('past-disasters')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('mediacloud-news')).toHaveCount(0)
})

test('NASA FIRMS\'s fire hotspots near the building show on its fire hazard', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H09')
  const fires = page.getByTestId('firms-hotspots')
  await expect(fires).toContainText('NASA FIRMS saw 7 fire hotspots within 5 km of the building, on 3 days, from 2017 to 2026.', { timeout: 60_000 })
  await expect(fires).toContainText('14 Sep 2026 · 4 hotspots · strongest 48,2 MW')
  await expect(fires).toContainText('Counted from 23 Nov 2025 · Source: NASA FIRMS (VIIRS)')
  await expect(page.getByTestId('gdacs-alerts')).toHaveCount(0)
})

test('GDACS\'s alerts near the building show on the hazard their type counts for', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H01')
  const alerts = page.getByTestId('gdacs-alerts')
  await expect(alerts).toContainText('GDACS alerted 2 times within 100 km of the building from 2017 to 2026, Orange at most.', { timeout: 60_000 })
  await expect(alerts.getByRole('link', { name: 'Flood in Indonesia' })).toHaveAttribute('href', /eventid=1102345/)
  await expect(alerts).toContainText('Alerts kept from 23 Nov 2025 · Source: GDACS')
  await page.goto('/ra/manage/1?tab=hazards&hazard=H05')
  await expect(page.getByTestId('gdacs-alerts')).toContainText('GDACS alerted none within 100 km of the building', { timeout: 60_000 })
})

test('BMKG\'s weather warnings over the building show on the weather hazard', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H06')
  const warned = page.getByTestId('weather-warnings')
  await expect(warned).toContainText('BMKG warned of severe weather over the building 3 times, on 2 days, from 2017 to 2026.', { timeout: 60_000 })
  await expect(warned).toContainText('Hujan Lebat disertai Petir di DKI Jakarta · 18 Nov 2026, 10:45 WIB')
  await expect(warned).toContainText('Warnings kept from 18 Nov 2026')
  await expect(page.getByTestId('past-disasters')).not.toContainText('BNPB recorded none')
  // Not on another hazard.
  await page.goto('/ra/manage/1?tab=hazards&hazard=H01')
  await expect(page.getByTestId('past-disasters')).toContainText('BNPB recorded it 12 times', { timeout: 60_000 })
  await expect(page.getByTestId('weather-warnings')).toHaveCount(0)
})

test('a hazard without its existing mitigation doesn\'t count as rated yet', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('3 - Gempa Bumi', { timeout: 60_000 })
  const counter = page.getByRole('tabpanel', { name: 'Hazards' }).getByText(/^\d+ of 33 hazards rated/)
  const rated = async () => Number((await counter.textContent())!.match(/^(\d+)/)![1])
  const before = await rated()
  const mitigation = page.getByRole('textbox', { name: /Existing mitigation measures/ })
  await mitigation.fill('')
  await expect.poll(rated).toBe(before - 1)
  await mitigation.fill('Gedung tahan gempa; jalur evakuasi.')
  await expect.poll(rated).toBe(before)
})

test('the action plan is optional, also for a high residual risk', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H28')
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('28 - Peretasan Sistem Komputer', { timeout: 60_000 })
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
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('6 - Cuaca Ekstream', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Mark as not applicable' }).click()
  await expect(page.getByText('N/A - Not applicable').first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Probability rating' })).toHaveValue('N/A')
  await expect(page.getByText('Not applicable', { exact: true }).first()).toBeVisible()
})

test('leaving a tab with unsaved ratings asks first', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H01')
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('1 - Banjir/ Banjir Bandang', { timeout: 60_000 })
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
  await expect(page.getByRole('button', { name: 'Type of hazard' })).toContainText('28 - Peretasan Sistem Komputer')

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
  await page.goto('/admin/buildings')
  await expect(page.getByText('Griya CIMB Niaga 2')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  await page.goto('/admin/buildings/1')
  await expect(page.getByRole('heading', { name: 'Griya CIMB Niaga 2' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  expect(log.deletedLocations).toEqual([])
})

test('as SCCA, Save is in the top bar for the open tab, beside View report; no Delete', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  await expect(page.locator('p', { hasText: 'Griya CIMB Niaga 2 · 2025' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute('href', '/ra/manage/1/report')
  // One Save per tab, in the top bar: enabled once something changed.
  const save = page.getByRole('button', { name: 'Save assessment' })
  await expect(save).toBeDisabled()
  await page.getByRole('textbox', { name: 'LIC mobile number' }).fill('0812-0000-1111')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  const sent = page.waitForRequest((request) => request.method() === 'PUT' && /\/api\/ra\/assessments\/1$/.test(request.url()))
  await save.click()
  expect((await sent).postDataJSON()).toMatchObject({ lic_phone: '0812-0000-1111' })
  await expect(page.getByText('Assessment saved').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Hazards' }).click()
  await expect(page.getByRole('button', { name: 'Save ratings', exact: true })).toBeDisabled()
  await page.getByRole('tab', { name: 'Risk Summary' }).click()
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Sign-off' }).click()
  await expect(page.getByRole('button', { name: 'Save signers' })).toBeDisabled()
})

test('changed signers are saved before the RA can be submitted', async ({ page }) => {
  const log = await mockRa(page, { ready: true })
  await page.goto('/ra/manage/1?tab=signoff')
  const submit = page.getByRole('button', { name: 'Submit for approval' })
  await expect(submit).toBeEnabled({ timeout: 60_000 })
  const step = page.getByRole('listitem').filter({ hasText: 'Step 2 of 4' })
  await step.getByRole('combobox').or(step.getByRole('button').first()).first().click()
  await page.getByRole('option', { name: /Budi Hartono/ }).click()
  await expect(submit).toBeDisabled()
  await expect(page.getByTestId('ra-save-signers-first')).toHaveText('Save the signers before you submit.')
  await page.getByRole('button', { name: 'Save signers' }).click()
  await expect(page.getByText('Signers saved').first()).toBeVisible()
  await expect(page.getByTestId('ra-save-signers-first')).toHaveCount(0)
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByText('Submitted for sign-off').first()).toBeVisible()
  expect(log.signoff.map((row) => row[0])).toEqual(['signers', 'submit'])
})

test('View report shows the RA like SCCA\'s report, and prints it', async ({ page }) => {
  await mockRa(page)
  await page.addInitScript(() => {
    const counter = window as unknown as { printed?: number }
    window.print = () => {
      counter.printed = (counter.printed ?? 0) + 1
    }
  })
  await page.goto('/ra/monitoring/1')
  await page.getByRole('link', { name: 'View report' }).click({ timeout: 60_000 })
  await expect(page).toHaveURL(/\/ra\/monitoring\/1\/report$/)
  for (const name of ['Details', 'Hazards', 'Risk Summary', 'Sign-off']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByTestId('ra-report-hazards')).toContainText('Banjir/ Banjir Bandang')
  // No column heading runs into the next one, on screen or printed (the table scrolls instead),
  // and the report prints in landscape only.
  const overlaps = () => page.getByTestId('ra-report-hazards').locator('thead th').evaluateAll((cells) =>
    cells.filter((cell) => {
      const range = document.createRange()
      range.selectNodeContents(cell)
      return range.getBoundingClientRect().right > cell.getBoundingClientRect().right + 0.5
    }).map((cell) => cell.textContent?.trim()))
  expect(await overlaps()).toEqual([])
  await expect(page.locator('[data-print-landscape]')).toHaveCount(1)
  await page.emulateMedia({ media: 'print' })
  expect(await overlaps()).toEqual([])
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('page'))).toBe('landscape')
  await page.emulateMedia({ media: 'screen' })
  // As the Hazards tab: a Hazard group column, and a group filter for the screen.
  const hazards = page.getByTestId('ra-report-hazards')
  await expect(hazards.getByRole('columnheader', { name: 'Hazard group' })).toBeVisible()
  const visibleRows = () => hazards.locator('tbody tr').filter({ visible: true })
  await expect(visibleRows()).toHaveCount(33)
  await page.getByRole('combobox', { name: 'Hazard group' }).click()
  await page.getByRole('option', { name: 'Natural disasters' }).click()
  await expect(page.getByText('Showing 9 of 33 hazards')).toBeVisible()
  await expect(visibleRows()).toHaveCount(9)
  // Printed: every hazard, ten to a page.
  await page.emulateMedia({ media: 'print' })
  await expect(visibleRows()).toHaveCount(33)
  const breaks = await hazards.locator('tbody tr').evaluateAll((rows) =>
    rows.flatMap((row, index) => (getComputedStyle(row).breakAfter === 'page' ? [index + 1] : [])))
  expect(breaks).toEqual([10, 20, 30])
  await page.emulateMedia({ media: 'screen' })
  await expect(page.getByTestId('ra-report-signoff')).toContainText('Prepared by')
  await expect(page.getByTestId('ra-report-signoff')).toContainText('Legiran')
  // A draft has no downloads yet; Print is the page's main action.
  await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Print' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed?: number }).printed)).toBe(1)
  // The crumbs lead back to the RA.
  await page.getByRole('link', { name: 'RA-2025-0001' }).click()
  await expect(page).toHaveURL(/\/ra\/monitoring\/1$/)
})

test('the occupants tab lists the divisions with their totals and both views', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings/1?tab=occupants')
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
  await page.goto('/admin/buildings/1?tab=occupants')
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
  await dialog.getByLabel('Has a BCP', { exact: true }).click()
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
  await page.goto('/admin/buildings/1?tab=occupants')
  await page.getByRole('button', { name: 'Add division' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Add division' })
  await dialog.getByRole('button', { name: 'Division name' }).click()
  await page.keyboard.type('Treasury Operations')
  await page.getByRole('option', { name: /Treasury Operations/ }).click()
  await dialog.getByRole('button', { name: 'Add division' }).click()
  await expect(dialog.getByText('Choose its critical rating.')).toBeVisible()
  await dialog.getByLabel('Critical rating', { exact: true }).click()
  await page.getByRole('option', { name: 'Important', exact: true }).click()
  // The MTD band of the rating is suggested.
  await expect(dialog.getByLabel('MTD', { exact: true })).toContainText('12-24 hours')
  await dialog.getByRole('button', { name: 'Add division' }).click()
  await expect(page.getByText('Division added').first()).toBeVisible()
  expect(log.created.at(-1)).toEqual({ division: { name: 'Treasury Operations', mtd: '12-24 hours', critical_rating: 'Important' } })
  const sent = log.lists.occupants?.[0]?.occupants as Record<string, unknown>[]
  expect(sent.at(-1)).toMatchObject({ division_id: 202, unit_name: 'Treasury Operations', mtd: '12-24 hours' })
})

test('the recovery team writes a role once for its people, takes notes and needs the role, name and mobile', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/admin/buildings/1?tab=team')
  await expect(page.getByRole('heading', { name: 'Damage Assessment Team (DAT)' })).toBeVisible({ timeout: 60_000 })
  // As in the workbook: SPAPM is written once, above its two people.
  const spapm = page.getByRole('region', { name: 'Role 1, Damage Assessment Team (DAT)' })
  await expect(spapm.getByRole('textbox', { name: 'Role 1, Damage Assessment Team (DAT)' })).toHaveValue('SPAPM')
  await expect(spapm.getByRole('textbox', { name: /^Name,/ })).toHaveCount(2)
  // Security has a note instead of a person.
  const security = page.getByRole('region', { name: 'Role 6, Emergency Response Team (ERT)' })
  await expect(security.getByRole('textbox', { name: /^Name,/ })).toHaveValue('(Sesuai Shift)')

  await page.getByRole('button', { name: 'Add role to Core Support Team' }).click()
  await page.getByRole('textbox', { name: 'Name, Core Support Team role 4 row 1' }).fill('Dewi')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Enter the role, or remove it.')).toBeVisible()
  expect(log.lists['recovery-team']).toBeUndefined()

  await expect(page.getByText('Enter the mobile, or remove this row.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Role 4, Core Support Team' }).fill('Legal')
  // The mobile can be a note too.
  await page.getByRole('textbox', { name: 'Mobile, Core Support Team role 4 row 1' }).fill('Sesuai dokumen BCP masing-masing')
  await page.getByRole('button', { name: 'Add member for role 4, Core Support Team' }).click()
  await page.getByRole('textbox', { name: 'Mobile, Core Support Team role 4 row 2' }).fill('Ext. 2101')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Enter the name, or remove this row.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Name, Core Support Team role 4 row 2' }).fill('(Sesuai jadwal piket)')
  await page.getByRole('button', { name: 'Save recovery team' }).click()
  await expect(page.getByText('Recovery team saved').first()).toBeVisible()
  const members = log.lists['recovery-team']?.[0]?.members as Record<string, unknown>[]
  expect(members).toHaveLength(27)
  expect(members.slice(-2)).toEqual([
    { team: 'core_support_team', role: 'Legal', name: 'Dewi', mobile: 'Sesuai dokumen BCP masing-masing', home_phone: null },
    { team: 'core_support_team', role: 'Legal', name: '(Sesuai jadwal piket)', mobile: 'Ext. 2101', home_phone: null },
  ])
  expect(members.filter((member) => member.role === 'SPAPM' && member.team === 'damage_assessment_team')).toHaveLength(2)
})

test('the call tree writes a caller once for everyone they call and takes notes', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/admin/buildings/1?tab=calltree')
  await expect(page.getByRole('heading', { name: 'Level 3 call tree' })).toBeVisible({ timeout: 60_000 })
  // Level 1 has one caller for its ten contacts, written once.
  const first = page.getByRole('region', { name: 'Caller 1, Level 1 call tree' })
  await expect(first.getByRole('textbox', { name: 'Caller 1, Level 1 call tree' })).toHaveValue('Albert Suhandinata / Crispina Arumardi (Alt.)')
  await expect(first.getByRole('textbox', { name: /^Contact,/ })).toHaveCount(10)
  await expect(page.getByRole('region', { name: /, Level 1 call tree$/ })).toHaveCount(1)
  await page.getByRole('button', { name: 'Remove Level 1 call tree caller 1 row 1', exact: true }).click()

  // A note as the contact and the mobile, under the Core Support Team caller of level 3.
  await page.getByRole('button', { name: 'Add contact for caller 3, Level 3 call tree' }).click()
  await page.getByRole('textbox', { name: 'Contact, Level 3 call tree caller 3 row 7' }).fill('Pihak Internal (diluar gedung)')
  await page.getByRole('textbox', { name: 'Division or role, Level 3 call tree caller 3 row 7' }).fill('(Jika ada)')
  await page.getByRole('button', { name: 'Save call tree' }).click()
  await expect(page.getByText('Enter the mobile, or remove this row.')).toBeVisible()
  expect(log.lists['call-tree']).toBeUndefined()
  await page.getByRole('textbox', { name: 'Mobile, Level 3 call tree caller 3 row 7' }).fill('(Jika ada)')
  // A caller with no one to call is refused.
  await page.getByRole('button', { name: 'Add caller to Level 2 call tree' }).click()
  await page.getByRole('textbox', { name: 'Caller 5, Level 2 call tree' }).fill('BCM')
  await page.getByRole('button', { name: 'Remove Level 2 call tree caller 5 row 1' }).click()
  await page.getByRole('button', { name: 'Save call tree' }).click()
  await expect(page.getByText('Add a contact for this caller, or remove it.')).toBeVisible()
  await page.getByRole('button', { name: 'Remove caller 5, Level 2 call tree' }).click()

  await page.getByRole('button', { name: 'Save call tree' }).click()
  await expect(page.getByText('Call tree saved').first()).toBeVisible()
  const entries = log.lists['call-tree']?.[0]?.entries as Record<string, unknown>[]
  expect(entries).toHaveLength(39)
  expect(entries[0]).toMatchObject({ level: 1, caller: 'Albert Suhandinata / Crispina Arumardi (Alt.)', contact_name: 'D-1 Level TAJINDRA PAL SINGH' })
  const levelThree = entries.filter((entry) => entry.level === 3)
  expect(levelThree).toHaveLength(18)
  expect(levelThree.filter((entry) => entry.caller === 'Core Support Team').at(-1)).toEqual({
    level: 3, caller: 'Core Support Team', contact_name: 'Pihak Internal (diluar gedung)', division: '(Jika ada)', mobile: '(Jika ada)', home_phone: null,
  })
})

test('the recovery team and call tree tabs open their charts, also without edit rights', async ({ page }) => {
  await mockRa(page, { permissions: ['sites.access', 'sites.master', 'ra.access'] })
  await page.goto('/admin/buildings/1?tab=team')
  await expect(page.getByRole('heading', { name: 'Damage Assessment Team (DAT)' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Save recovery team' })).toBeDisabled()
  await page.getByRole('button', { name: 'View structure chart' }).click()
  const dialog = page.getByRole('dialog', { name: 'Recovery team structure (RA HO)' })
  const chart = dialog.getByRole('img', { name: /^Recovery team structure:/ })
  await expect(chart).toBeVisible()
  await expect(chart).toHaveAttribute('src', '/api/ra/diagrams/recovery_team?kind=head_office')
  await expect(dialog.getByRole('link', { name: 'Open full size' })).toHaveAttribute('href', '/api/ra/diagrams/recovery_team?kind=head_office')
  await expect(dialog.getByText('Set by BCM in Administration > RA configuration > Team diagrams.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await page.getByRole('tab', { name: 'Call tree' }).click()
  await page.getByRole('button', { name: 'View call tree chart' }).click()
  await expect(page.getByRole('dialog', { name: 'Location call tree (RA HO)' }).getByRole('img', { name: /^Location call tree:/ }))
    .toHaveAttribute('src', '/api/ra/diagrams/call_tree?kind=head_office')
})

test('adding a location opens its profile, starting with the emergency contacts', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/admin/buildings')
  await expect(page.getByRole('link', { name: 'Griya CIMB Niaga 2' }).first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('link', { name: 'Input building data' }).click()
  await expect(page).toHaveURL(/\/masterdata\/masterbuilding\/new$/)
  await expect(page.getByRole('heading', { name: 'Building Data Entry' })).toBeVisible()
  await page.getByRole('button', { name: 'Add building' }).click()
  await expect(page.getByText('Enter the building name.')).toBeVisible()
  await page.getByRole('textbox', { name: /Building name/ }).fill('Menara CIMB Niaga')
  // Region Description is a branch field.
  await expect(page.getByRole('textbox', { name: 'Region Description' })).toHaveCount(0)
  await expect(page.getByText('Enter the building name.')).toHaveCount(0)
  await fillAddress(page)
  // Its organization, as SCCA's application owner: picked from the user master's values.
  await expect(page.getByRole('heading', { name: 'Organization' })).toBeVisible()
  await page.getByLabel('Directorate', { exact: true }).click()
  await page.getByRole('option', { name: 'OPS' }).click()
  await page.getByLabel('Group', { exact: true }).click()
  await page.getByRole('option', { name: 'Building Management' }).click()
  await page.getByLabel('Organization level', { exact: true }).click()
  await page.getByRole('option', { name: 'D-2' }).click()
  // Division and Department are no longer asked.
  await expect(page.getByLabel('Department', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Division', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add building' }).click()
  await expect(page).toHaveURL(/\/masterdata\/masterbuilding\/3\?tab=contacts$/)

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
  expect(log.created[0]).toMatchObject({ kind: 'head_office', province: 'DKI Jakarta', city: 'Jakarta Selatan', district: 'Setiabudi', zip_code: '12920', directorate: 'OPS', org_group: 'Building Management', org_level: 'D-2' })
  expect(log.created[0]).not.toHaveProperty('department')
})

test('the location page lists its assessments and edits its details', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings/1')
  await expect(page.getByText('39 divisions · 1.725 employees · 1 assessment')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', '/ra/manage/new?location_id=1')
  const request = page.waitForRequest((r) => r.url().endsWith('/api/ra/locations/1') && r.method() === 'PUT')
  await page.getByRole('textbox', { name: /^Address/ }).fill('Jl. Wahid Hasyim, Bintaro')
  await expect(page.getByLabel('Type of building', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Save building' }).click()
  expect((await request).postDataJSON()).toMatchObject({ address: 'Jl. Wahid Hasyim, Bintaro', is_active: true })
})

test('Building details asks whether a Hyspace is available, then its floor and capacity', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings/1')
  const hyspace = page.getByRole('combobox', { name: 'Hyspace Available?' })
  await expect(hyspace).toContainText('No', { timeout: 60_000 })
  await expect(page.getByRole('textbox', { name: /Hyspace Floor/ })).toHaveCount(0)
  await hyspace.click()
  await page.getByRole('option', { name: 'Yes', exact: true }).click()
  await page.getByRole('button', { name: 'Save building' }).click()
  await expect(page.getByText('Enter the Hyspace floor.')).toBeVisible()
  await expect(page.getByText('Enter the Hyspace capacity, 1 or more.')).toBeVisible()
  await page.getByRole('textbox', { name: /Hyspace Floor/ }).fill('Lantai 12')
  await page.getByRole('spinbutton', { name: /Hyspace Capacity/ }).fill('40')
  await page.getByRole('spinbutton', { name: /Hyspace Capacity/ }).blur()
  const saved = page.waitForRequest((r) => r.url().endsWith('/api/ra/locations/1') && r.method() === 'PUT')
  await page.getByRole('button', { name: 'Save building' }).click()
  expect((await saved).postDataJSON()).toMatchObject({ hyspace_available: true, hyspace_floor: 'Lantai 12', hyspace_capacity: 40 })
  // No: the floor and capacity go, and are cleared.
  await hyspace.click()
  await page.getByRole('option', { name: 'No', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /Hyspace Floor/ })).toHaveCount(0)
  const cleared = page.waitForRequest((r) => r.url().endsWith('/api/ra/locations/1') && r.method() === 'PUT')
  await page.getByRole('button', { name: 'Save building' }).click()
  expect((await cleared).postDataJSON()).toMatchObject({ hyspace_available: false, hyspace_floor: null, hyspace_capacity: null })
})

test('the Details tab shows the building and edits it, as on its page', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  const section = page.getByRole('region', { name: 'Building', exact: true })
  await expect(section.getByRole('textbox', { name: /Building name/ })).toHaveValue('Griya CIMB Niaga 2', { timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Open building profile' })).toHaveCount(0)
  for (const name of ['Details', 'Map', 'Emergency contacts', 'Occupants', 'Recovery team', 'Call tree']) {
    await expect(section.getByRole('tab', { name, exact: true })).toBeVisible()
  }
  // Saved on its own: the RA's top-bar Save stays the RA's.
  await section.getByRole('textbox', { name: /Address/ }).fill('Jl. Wahid Hasyim, Bintaro')
  await expect(page.getByText('Unsaved changes')).toHaveCount(0)
  const request = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/api/ra/locations/1'))
  await section.getByRole('button', { name: 'Save building' }).click()
  expect((await request).postDataJSON()).toMatchObject({ address: 'Jl. Wahid Hasyim, Bintaro' })
  await section.getByRole('tab', { name: 'Emergency contacts' }).click()
  await expect(section.getByRole('button', { name: 'Save contacts' })).toBeVisible()
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

test('Manage shows a generated annual review of the directorate read-only, with what it renews', async ({ page }) => {
  await mockRa(page)
  const generated = {
    ...SUMMARY,
    reason: 'annual_review',
    my_role: 'directorate',
    next_step: 'Rate all 33 hazards',
    renewal_of: { id: 3, ref_no: 'RA-2025-0003', status: 'approved', can_open: false },
  }
  await page.route(/\/api\/ra\/assessments\?/, (route) =>
    route.fulfill({ json: { items: [generated], page: 1, per_page: 25, total: 1, pages: 1 } }),
  )
  await page.goto('/ra/manage')
  const row = page.getByRole('row', { name: /RA-2025-0001/ })
  await expect(row.getByText('Directorate (view)')).toBeVisible({ timeout: 60_000 })
  // The final RA it renews isn't the user's to open, so it isn't a link.
  await expect(row.getByText('RA-2025-0003')).toBeVisible()
  await expect(row.getByRole('link', { name: 'RA-2025-0003' })).toHaveCount(0)
})

test('Manage has New assessment in the top bar', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage')
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'View buildings' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', '/ra/manage/new')
  // In the top bar next to the bell, not in the table's toolbar.
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'New assessment' })).toHaveCount(0)
  const button = await page.getByRole('link', { name: 'New assessment' }).boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual((await main.boundingBox())!.y)
})

test('on the hazard page, the group and type of hazard are picked from dropdowns', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1?tab=hazards&hazard=H03')
  const type = page.getByRole('button', { name: 'Type of hazard' })
  await expect(type).toContainText('3 - Gempa Bumi', { timeout: 60_000 })
  const group = page.getByLabel('Hazard group name', { exact: true })
  await expect(group).toContainText('Natural disasters')
  // The free text boxes take up to 3,000 characters, with a counter.
  for (const name of [/^Existing mitigation measures/, /^Action plan/]) {
    await expect(page.getByRole('textbox', { name })).toHaveAttribute('maxlength', '3000')
  }
  await expect(page.getByText(/^\d+\/3,?000$/).first()).toBeVisible()
  // No CIM ref. no. on a hazard.
  await expect(page.getByRole('textbox', { name: /^CIM ref\. no\./ })).toHaveCount(0)

  await group.click()
  await page.getByRole('option', { name: 'Security threats' }).click()
  await expect(type).toContainText('14 - Kebakaran')
  await type.click()
  await page.getByRole('option', { name: '21 - Terorisme' }).click()
  await expect(page).toHaveURL(/hazard=H21/)
  // Next hazard crosses into the next group, and opens it at the top of the page.
  const next = page.getByRole('button', { name: 'Next hazard' })
  await next.scrollIntoViewIfNeeded()
  await expect(type).not.toBeInViewport()
  await next.click()
  await expect(type).toContainText('22 - Gangguan pasokan listrik')
  await expect(group).toContainText('Infrastructure')
  await expect(type).toBeInViewport()
  // So does Previous hazard.
  const previous = page.getByRole('button', { name: 'Previous hazard' })
  await previous.scrollIntoViewIfNeeded()
  await previous.click()
  await expect(type).toContainText('21 - Terorisme')
  await expect(type).toBeInViewport()
})

test('the location incident team is required', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/manage/1')
  await expect(page.getByLabel('LIC: Location incident coordinator (LIC)')).toHaveValue('Legiran', { timeout: 60_000 })
  await expect(page.getByText(/Signs as/)).toHaveCount(0)
  const phone = page.getByRole('textbox', { name: 'LIC mobile number' })
  await expect(phone).toHaveValue('081312262739')
  let saved = false
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().endsWith('/api/ra/assessments/1')) saved = true
  })
  await phone.fill('')
  await page.getByRole('button', { name: 'Save assessment' }).click()
  await expect(page.getByText('Enter the LIC mobile number.')).toBeVisible()
  // A mobile number is a phone number, never text (unlike the call tree's).
  await phone.fill('Sesuai dokumen BCP')
  await expect(page.getByText('Use digits only, e.g. 0813 1226 2739. Spaces, + ( ) and - are allowed.')).toBeVisible()
  await phone.fill('0812')
  await expect(page.getByText('A phone number has 8 to 15 digits, e.g. 0813 1226 2739.')).toBeVisible()
  await page.getByRole('button', { name: 'Save assessment' }).click()
  expect(saved).toBe(false)
  await phone.fill('+62 812-0000-1111')
  await expect(page.getByText('A phone number has 8 to 15 digits')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save assessment' }).click()
  await expect.poll(() => saved).toBe(true)
})

test('the assessment date is picked from a calendar; the renewal follows it', async ({ page }) => {
  // The sample is a 2025 New building: picked in 2025, when it may still move within the year.
  await page.clock.setFixedTime(new Date('2025-12-31T05:00:00Z'))
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

test('a new building can be back-dated this year, not to an earlier year, as SCCA\'s new application', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T05:00:00Z'))
  await mockRa(page)
  // On the Details tab: the 2025 New building moved to another 2025 date is refused.
  await page.goto('/ra/manage/1')
  const date = page.getByRole('button', { name: 'Assessment date' })
  await expect(date).toContainText('10 Mar 2025', { timeout: 60_000 })
  await date.click()
  await page.getByRole('gridcell', { name: /17/ }).first().click()
  let saved = false
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().endsWith('/api/ra/assessments/1')) saved = true
  })
  await page.getByRole('button', { name: 'Save assessment' }).click()
  await expect(page.getByText('A new building\'s assessment date can be earlier this year, but not before 1 Jan 2026.')).toBeVisible()
  expect(saved).toBe(false)

  // On New assessment: the help says it, and the calendar starts on 1 January.
  await page.goto('/ra/manage/new')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  await page.getByRole('option', { name: /New building/ }).click()
  await expect(page.getByText('A new building can be dated earlier this year, not in an earlier year.')).toBeVisible()
})

test('a draft on an older configuration version moves to the active one, as SCCA\'s', async ({ page }) => {
  const log = await mockRa(page, { oldVersion: true })
  await page.goto('/ra/manage/1')
  const note = page.getByTestId('move-version')
  await expect(note).toContainText('This draft uses 2025-r4. 2025-r5 is the active version.', { timeout: 60_000 })
  await note.getByRole('button', { name: 'Move to 2025-r5' }).click()
  const dialog = page.getByRole('dialog', { name: 'Move this draft to 2025-r5?' })
  await expect(dialog).toContainText('hazards and their descriptions')
  await dialog.getByRole('button', { name: 'Move to 2025-r5' }).click()
  await expect(page.getByText('Now on 2025-r5').first()).toBeVisible()
  await expect(page.getByText('Redo: Ratings of H33 (Kebakaran Besar).').first()).toBeVisible()
  await expect(note).toHaveCount(0)
  expect(log.workflow).toContain('move-version')

  // Monitoring only reads: no move there.
  await mockRa(page, { oldVersion: true })
  await page.goto('/ra/monitoring/1')
  await expect(page.getByText('Monitoring is read-only')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('move-version')).toHaveCount(0)
})

test('Monitoring splits returned RAs into Need revision and In revision', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/monitoring')
  const need = page.getByRole('link', { name: /Need revision/ }).first()
  await expect(need).toContainText('Returned, not accepted yet', { timeout: 60_000 })
  await expect(need).toContainText('0')
  const card = page.getByRole('link', { name: /In revision/ }).first()
  await expect(card).toContainText('Accepted, being changed')
  await expect(card).toContainText('1')
  await card.click()
  await expect(page).toHaveURL(/tab=register/)
  await expect(page).toHaveURL(/state=in_revision/)
  const row = page.getByRole('table').getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(row.getByRole('link', { name: /: In revision$/ })).toBeVisible()
  // Both are in the State filter.
  await page.getByLabel('State', { exact: true }).click()
  await expect(page.getByRole('option', { name: 'Need revision' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'In revision' })).toBeVisible()
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

test('a new assessment without an earlier cycle asks for the LICOM; the LIC is the assessor', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/new?location_id=2')
  await expect(page.getByRole('heading', { name: 'Location incident team' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('building-note')).toContainText('Pick the LICOM below.')
  // The LIC is the person making it, with the mobile number from their profile.
  await expect(page.getByLabel('LIC: Location incident coordinator (LIC)')).toHaveValue('Test User')
  await expect(page.getByRole('textbox', { name: 'LIC mobile number' })).toHaveValue('081312262739')
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page.getByText('Choose the LICOM.')).toBeVisible()
  await expect(page.getByText('Enter the LICOM mobile number.')).toBeVisible()
  await expect(page.getByText('Choose the LIC.')).toHaveCount(0)
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
  // A new building is entered on this page, not picked.
  await expect(page.getByRole('heading', { name: 'New building' })).toBeVisible()
  await expect(building).toHaveCount(0)
  await reason.click()
  await page.getByRole('option', { name: /Annual review/ }).click()
  await building.click()
  // Neither has a final RA to renew.
  await expect(page.getByRole('option', { name: /CIMB Niaga/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await reason.click()
  await page.getByRole('option', { name: /Structural change/ }).click()
  await building.click()
  // As SCCA's System change, a Structural change follows a final RA too.
  await expect(page.getByRole('option', { name: /CIMB Niaga/ })).toHaveCount(0)
})

test('as SCCA, a building with another RA open, or overdue for a Structural change, shows greyed out with why', async ({ page }) => {
  const open = 'RA-2026-0007 is already open for Griya CIMB Niaga 2.'
  const overdue = 'Griya CIMB Niaga 2\'s renewal is overdue: start an Annual review instead of a Structural change.'
  await mockRa(page, { scopeProblems: { annual_review: { 1: open }, structural_change: { 1: overdue } } })
  await griyaHasAFinalRa(page)
  await page.goto('/ra/manage/new')
  const reason = page.getByLabel('Reason for assessment')
  await reason.click({ timeout: 60_000 })
  await page.getByRole('option', { name: /Annual review/ }).click()
  await expect(page.getByText('Only buildings with a final RA to renew, while no other RA of it is open.')).toBeVisible()
  await page.getByRole('button', { name: /^Building\*?$/ }).click()
  const griya = page.getByRole('option', { name: /Griya CIMB Niaga 2/ })
  await expect(griya).toHaveAttribute('data-disabled', '')
  await expect(griya).toContainText(open)
  await page.keyboard.press('Escape')
  await reason.click()
  await page.getByRole('option', { name: /Structural change/ }).click()
  await page.getByRole('button', { name: /^Building\*?$/ }).click()
  await expect(griya).toHaveAttribute('data-disabled', '')
  await expect(griya).toContainText(overdue)
})

test('a building picked from its page that the rule refuses says why before saving', async ({ page }) => {
  const open = 'RA-2026-0007 is already open for Griya CIMB Niaga 2.'
  await mockRa(page, { scopeProblems: { annual_review: { 1: open } } })
  await griyaHasAFinalRa(page)
  await page.goto('/ra/manage/new?location_id=1')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  await page.getByRole('option', { name: /Annual review/ }).click()
  const note = page.getByTestId('building-note')
  await expect(note).toContainText('Annual review isn\'t possible for this building')
  await expect(note).toContainText(`${open} Pick another building or reason.`)
})

test('a reason the picked building doesn\'t fit asks first, then clears the building', async ({ page }) => {
  await mockRa(page)
  await griyaHasAFinalRa(page)
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
  await expect(building).toHaveCount(0)
  await expect(page.getByTestId('building-note')).toHaveCount(0)
})

test('a new building is entered in full with its RA, and saved with it in one go', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra/manage/new')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  await page.getByRole('option', { name: /New building/ }).click()
  const tabs = page.getByRole('main').getByRole('tablist')
  for (const name of ['Details', 'Map', 'Emergency contacts', 'Occupants', 'Recovery team', 'Call tree']) {
    await expect(tabs.getByRole('tab', { name })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Add building' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save contacts' })).toHaveCount(0)

  // Nothing is sent while the building's details are missing: the Details tab shows why.
  await page.getByRole('tab', { name: 'Map' }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(tabs.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Enter the building name.')).toBeVisible()
  expect(log.created).toHaveLength(0)

  await page.getByRole('textbox', { name: /Building name/ }).fill('Menara Sentraya')
  await fillAddress(page)
  await page.getByRole('tab', { name: 'Map' }).click()
  await page.getByPlaceholder('-6.271633, 106.719358').fill('-6.2, 106.8')
  await page.getByRole('button', { name: 'Show on map' }).click()
  await page.getByRole('tab', { name: 'Emergency contacts' }).click()
  await page.getByRole('button', { name: 'Add police station' }).click()
  await page.getByPlaceholder('Name').fill('Polsek Menteng')
  await page.getByRole('tab', { name: 'Recovery team' }).click()

  // An incomplete contact stops it too, on its own tab.
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(tabs.getByRole('tab', { name: 'Emergency contacts' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Required.').first()).toBeVisible()
  await page.getByRole('textbox', { name: /^Phone/ }).fill('110')
  await page.getByRole('textbox', { name: /^Address/ }).last().fill('Jl. Menteng')

  await page.getByLabel('LICOM: Location incident commander (LICOM) / alternate').click()
  await page.getByRole('option', { name: /Budi/ }).first().click()
  await page.getByRole('textbox', { name: 'LICOM mobile number' }).fill('081234567890')
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page).toHaveURL(/\/ra\/manage\/\d+$/)
  expect(log.created).toHaveLength(1)
  const body = log.created[0] as Record<string, unknown>
  expect(body.location).toMatchObject({ kind: 'head_office', name: 'Menara Sentraya', latitude: -6.2, longitude: 106.8 })
  expect(body.contacts).toEqual([expect.objectContaining({ kind: 'police', name: 'Polsek Menteng', phone: '110', address: 'Jl. Menteng' })])
  expect(body).toMatchObject({ occupants: [], recovery_team: [], call_tree: [], licom_phone: '081234567890' })
  expect(body).not.toHaveProperty('location_id')
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
  await page.getByRole('option', { name: /Annual review/ }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page.getByText(`This building already has an RA for ${year} (RA-${year}-0005). Pick a date in another year, or open that RA.`, { exact: false }).first()).toBeVisible()
  expect(log.created).toHaveLength(0)
})

test('a structural change can follow a final RA in the same period', async ({ page }) => {
  await mockRa(page)
  await griyaHasAFinalRa(page)
  const year = await griyaHasAnRaThisYear(page, 'approved')
  await page.goto('/ra/manage/new?location_id=1')
  const reason = page.getByLabel('Reason for assessment')
  // Its RA is final: renewing it is the usual reason, but not in the same year.
  await expect(reason).toContainText('Annual review', { timeout: 60_000 })
  await expect(page.getByTestId('building-note')).toContainText(`Copied the assessment details from its last RA (RA-${year}-0005, 10 Mar 2025). Approvals start over. An annual review rates every hazard from scratch.`)
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
  const none = 'Griya CIMB Niaga 2 has no final RA yet.'
  await mockRa(page, { scopeProblems: { annual_review: { 1: none }, structural_change: { 1: none } } })
  await page.goto('/ra/manage/1')
  await page.getByLabel('Reason for assessment').click({ timeout: 60_000 })
  // Its only RA is this one: no final RA for an Annual review or a Structural change (the API's
  // reasons, as SCCA's); it is the building's first RA.
  for (const name of [/Annual review/, /Structural change/]) {
    await expect(page.getByRole('option', { name })).toHaveAttribute('data-disabled', '')
    await expect(page.getByRole('option', { name })).toContainText(none)
  }
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
  await expect(page.getByText('Waiting for Prepared by Location Incident Coordinator (LIC)')).toBeVisible()
  await expect(page.getByText('In approval', { exact: true }).first()).toBeVisible()

  await page.getByRole('textbox', { name: 'Comment' }).fill('Checked with the floor wardens.')
  await page.getByRole('button', { name: /^Approve/ }).click()
  await expect(page.getByText('Approval recorded').first()).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['approve', { comment: 'Checked with the floor wardens.' }])
  await expect(page.getByText('Waiting for Acknowledged by Unit Critical Business Function')).toBeVisible()
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
  expect(log.signoff.at(-1)).toEqual(['return', { comment: 'Floor wardens are out of date.' }])
  // Need revision: locked until the assessor accepts the return.
  const banner = page.getByTestId('revision-banner')
  await expect(banner).toContainText('Need revision: returned by Test User')
  await expect(banner).toContainText('Floor wardens are out of date.')
  await expect(banner).toContainText('Accept the revision to make changes.')
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toHaveCount(0)
  await banner.getByRole('button', { name: 'Accept revision' }).click()
  await expect(page.getByText('Revision accepted').first()).toBeVisible()
  expect(log.signoff.at(-1)).toEqual(['accept-revision', null])
  await expect(banner).toContainText('In revision: returned by Test User')
  await expect(banner).toContainText('Accepted by Test User')
  await expect(page.getByText('Accepted the revision').first()).toBeVisible()
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
  await page.goto('/admin/buildings/1?tab=map')
  const map = page.getByRole('region', { name: /Map of Griya CIMB Niaga 2/ })
  await expect(map).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('No pin yet.')).toBeVisible()
  // Coordinates are required: a location without a pin is not on the Building map (said on
  // the page and on the Map tab).
  await expect(page.getByText('Map coordinates required')).toHaveCount(2)
  const tabNote = page.getByText('Place a pin and save it for this location to appear on the Building map.')
  await expect(tabNote).toBeVisible()
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
  await expect(tabNote).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Open the pin in Google Maps' })).toHaveAttribute('href', /query=-6\.271633%2C106\.719358/)

  // Clicking the map moves the pin; the coordinates follow.
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await expect(coordinates).not.toHaveValue('-6.271633, 106.719358')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  // A pin can be moved but not removed.
  await expect(page.getByRole('button', { name: 'Remove pin' })).toHaveCount(0)
  const moved = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/api/ra/locations/1'))
  await page.getByRole('button', { name: 'Save pin' }).click()
  expect((await moved).postDataJSON()).not.toEqual({ latitude: -6.271633, longitude: 106.719358 })
  expect(log.lists).toEqual({})
})

test('the location register links to the location map instead of its own map', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings')
  await expect(page.getByRole('link', { name: 'Building map' }).last()).toHaveAttribute('href', '/sites/map', { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveCount(0)
})

test('downloads are offered only once the RA is approved, on its report', async ({ page }) => {
  await mockRa(page, { status: 'in_signoff' })
  await page.goto('/ra/monitoring/1/report')
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0)
  // As SCCA's: the record itself has no downloads.
  await page.goto('/ra/monitoring/1')
  await expect(page.locator('p', { hasText: 'Griya CIMB Niaga 2 · 2025' })).toBeVisible({ timeout: 60_000 })
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
  await page.goto('/ra/monitoring/1/report')
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
  await expect(table.getByRole('columnheader', { name: 'Last final RA', exact: true })).toBeVisible({ timeout: 60_000 })
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
  // Open RA: the status of the RA being worked on, in SCCA's words; a returned one the assessor
  // accepted is In revision.
  const row = table.getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(row.getByRole('link', { name: /: In revision$/ })).toHaveAttribute('href', '/ra/monitoring/99')
  await expect(row).not.toContainText('Returned')
  // The building's ID in its own column, as SCCA's Application code.
  await expect(row.getByText('HO-0001', { exact: true })).toBeVisible()
  // A building without an RA: plain name, not final yet.
  await expect(table.getByRole('row', { name: /Graha CIMB Niaga/ })).toContainText('Not final yet')
  // RA(s): the count opens every RA of the building, newest first, as SCCA's SCCA(s).
  await row.getByRole('button', { name: 'RA history of Griya CIMB Niaga 2' }).click()
  const history = page.getByRole('dialog', { name: 'RAs of Griya CIMB Niaga 2' })
  await expect(history.getByRole('link', { name: 'RA-2026-0002' })).toHaveAttribute('href', '/ra/monitoring/99')
  await expect(history.getByRole('link', { name: 'RA-2025-0001' })).toHaveAttribute('href', '/ra/monitoring/1')
  await expect(history.getByText('Current', { exact: true })).toBeVisible()
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
  await page.getByLabel('LICOM: Location incident commander (LICOM) / alternate').click()
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  // There is no period field: the message replaces the date's help ("RA period …").
  await expect(page.getByText('This location already has an assessment for 2026.', { exact: true })).toBeVisible()
  await expect(page.getByText(/^RA period \d{4}, the year of this date\.$/)).toHaveCount(0)
  // As SCCA's banner: the summary, then each field's message.
  await expect(page.getByText(/^Some fields need attention/)).toContainText('• Assessment date: This location already has an assessment for 2026.')
})
