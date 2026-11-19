import { expect, test } from '@playwright/test'
import { ALL_PERMISSIONS, signIn } from '../fixtures/auth'
import { EDITOR, HISTORY, INBOX, RENEWALS, STEP_AVERAGES, UPCOMING, allSignoffs, assessment, mockScca, mockSccaWorkflow, signoff } from '../fixtures/scca'

test.setTimeout(90_000)

test('Monitoring shows the KPI cards, and a card opens the view it counts', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/monitoring')
  await expect(page.getByRole('heading', { name: 'SCCA monitoring' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Applications assessed: 12' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Applications by final category' })).toBeVisible()
  await expect(page.getByText('12 applications with a final SCCA; the most are Critical (4).')).toBeVisible()
  await expect(page.getByRole('img', { name: 'SCCAs finalised per month' })).toBeVisible()
  await expect(page.getByText('12 SCCAs finalised in 6 months; the busiest was Sep 2026 (4).')).toBeVisible()
  // Every chart has the same numbers as a table.
  await page.getByRole('switch', { name: 'View as table' }).last().click()
  await expect(page.getByRole('table', { name: 'SCCAs finalised per month' })).toBeVisible()
  await expect(page.getByRole('row', { name: 'Sep 2026 4' })).toBeVisible()

  await page.getByRole('link', { name: 'Overdue renewals: 1' }).click()
  await expect(page).toHaveURL(/tab=renewals/)
  const renewals = page.getByRole('table')
  await expect(renewals.getByRole('link', { name: 'CC Omni Channel' })).toHaveAttribute('href', '/scca/monitoring/7')
  await expect(renewals.getByText('34 days overdue')).toBeVisible()
  await expect(renewals.getByText('Not started')).toBeVisible()

  await page.getByLabel('Department', { exact: true }).click()
  await page.getByRole('option', { name: 'DBCC' }).click()
  await expect(page).toHaveURL(/department=DBCC/)
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/scca/monitoring/renewals.xlsx?department=DBCC')
})

test('the register lists one row per application with its history, and bottlenecks rank the waits', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/monitoring?tab=register')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'HR Portal' })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByText('Not final yet')).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Directorate owner' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Owner sub-directorate' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Current approval step' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Latest final SCCA date' })).toBeVisible()
  await table.getByRole('button', { name: 'SCCA history of CC Omni Channel' }).click()
  const history = page.getByRole('dialog', { name: 'SCCAs of CC Omni Channel' })
  await expect(history.getByRole('link', { name: 'SCCA-2024-0007' })).toHaveAttribute('href', '/scca/monitoring/7')
  await expect(history.getByRole('row', { name: /SCCA-2024-0007 Current/ })).toBeVisible()
  await expect(history.getByRole('row', { name: /SCCA-2022-0004 Replaced/ })).toBeVisible()
  await expect(history.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/scca/monitoring/application-sccas.xlsx?key=CCOMNI')
  await page.keyboard.press('Escape')

  await page.goto('/scca/monitoring?tab=bottlenecks')
  await expect(page.getByRole('img', { name: 'Average working days per sign-off step' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Slowest step: BCM Reviewer, 4,2 working days on average, over 36 approvals.')).toBeVisible()
  const waits = page.getByRole('table')
    .filter({ has: page.getByRole('columnheader', { name: 'Approver' }) })
    .locator('tbody')
    .getByRole('row')
  await expect(waits.first()).toContainText('CC Omni Channel')
  await expect(waits.first()).toContainText('Escalated')
  await expect(waits.first()).toContainText('8 working days')
  await expect(waits.first()).toContainText('SCCA-2026-0001')
  await expect(waits.nth(1)).toContainText('Teller System')
})

test('with no approvals yet, the step chart says so instead of drawing zeros', async ({ page }) => {
  await mockScca(page)
  await page.route(/\/api\/scca\/monitoring\/bottlenecks/, (route) => route.fulfill({
    json: { items: [], page: 1, per_page: 50, total: 0, pages: 0, step_averages: STEP_AVERAGES.map((row) => ({ ...row, approvals: 0, average_working_days: null })) },
  }))
  await page.goto('/scca/monitoring?tab=bottlenecks')
  await expect(page.getByText('No sign-off step was approved in this period, so there are no averages yet.', { exact: false })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('img', { name: 'Average working days per sign-off step' })).toHaveCount(0)
})

test('without scca.monitor, Monitoring is in the menu and shows only your own SCCAs', async ({ page }) => {
  await mockScca(page)
  await signIn(page, { permissions: ['scca.access', 'scca.create'] })
  await page.goto('/scca/monitoring?tab=bottlenecks')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Monitoring' })).toBeVisible({ timeout: 60_000 })
  await expect(nav.getByRole('link', { name: 'Manage', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Approval' })).toBeVisible()
  await expect(page.getByText('The SCCAs you assess, contribute to or sign, and the renewals your access scope opens: where each one is, renewals due and approvals waiting.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Act on them in the BCM board' })).toHaveCount(0)
})

test('Manage lists only my drafts, with my role and the next step', async ({ page }) => {
  await mockScca(page)
  const list = page.waitForRequest((req) => req.url().includes('/api/scca/assessments?'))
  await page.goto('/scca/manage')
  const url = new URL((await list).url())
  expect(url.searchParams.get('mine')).toBe('1')
  expect(url.searchParams.get('status')).toBe('draft')
  await expect(page.getByRole('heading', { name: 'Manage SCCAs' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Contributor')).toBeVisible()
  await expect(page.getByText('Rate all 18 questions')).toBeVisible()
  await expect(page.getByLabel('Show')).toHaveCount(0)

  await page.getByRole('button', { name: 'Actions for HR Portal' }).click()
  await expect(page.getByRole('menuitem', { name: 'Open' })).toHaveAttribute('href', '/scca/manage/2')
  await expect(page.getByRole('menuitem', { name: 'Start renewal' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'New assessment' }).first().click()
  await expect(page).toHaveURL(/\/scca\/manage\/new$/)
})

test('a submitted SCCA opened in Manage moves to Monitoring, read-only for its assessor', async ({ page }) => {
  await mockScca(page, assessment({
    status: 'in_approval',
    pending_role: 'it_support_pic',
    signoffs: allSignoffs({ status: 'pending' }),
    permissions: { ...EDITOR, can_edit: false, can_submit: false, can_set_contributor: false },
    comments: [{ id: 1, tab: 'result', body: 'Check the RTO', author: 'Bima Reviewer', author_role: 'it_support_pic', created_at: '2026-10-19T03:00:00Z' }],
  }))
  await page.goto('/scca/manage/1?tab=result')
  await expect(page).toHaveURL(/\/scca\/monitoring\/1\?tab=result$/, { timeout: 60_000 })
  await expect(page.getByText('Submitted: waiting for Assessment by IT Support PIC')).toBeVisible()
  await expect(page.getByText('Check the RTO')).toBeVisible()
  await expect(page.getByText(/you can read the approvers' comments but not add any/)).toBeVisible()
  await expect(page.getByLabel('Comment on Result and sign-off')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save result' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recall/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('region', { name: 'SCCA' }).getByRole('link', { name: 'Monitoring' })).toHaveAttribute('aria-current', 'page')
})

test('the approver opens an SCCA in Approval: read-only tabs, the decision on top', async ({ page }) => {
  await mockScca(page, assessment({
    status: 'in_approval',
    pending_role: 'it_support_pic',
    my_role: null,
    signoffs: allSignoffs({ status: 'pending' }),
    permissions: { ...EDITOR, can_edit: false, can_submit: false, can_set_contributor: false, can_decide: true, comment_tabs: ['result'] },
  }))
  // Emails link to /scca/{id}: it opens in the reader's section.
  await page.goto('/scca/1')
  await expect(page).toHaveURL(/\/scca\/approval\/1$/, { timeout: 60_000 })
  await expect(page.getByText('Your turn: Assessment by IT Support PIC')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve as IT Support PIC' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save application' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /Application name/ })).toBeDisabled()
  await page.getByRole('tab', { name: 'Result and sign-off' }).click()
  await expect(page.getByLabel('Comment on Result and sign-off')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'Approval' })).toHaveAttribute('href', '/scca/approval')

  // From Monitoring the same SCCA stays read-only and offers Approval.
  await page.goto('/scca/monitoring/1')
  await expect(page.getByText('It is your turn to approve this SCCA.')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Approve as IT Support PIC' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Open in Approval' })).toHaveAttribute('href', '/scca/approval/1?tab=result')
})

test('a final SCCA is in Monitoring, where Start renewal opens the new draft in Manage', async ({ page }) => {
  const approved = { ...signoff('system_user_lead', 1), status: 'approved', decided_at: '2026-10-05T04:00:00Z', decision_note: 'By email', on_behalf_by: 'Rina Analyst', attachment: { id: 3, filename: 'approval-email.pdf', content_type: 'application/pdf', size: 2048, url: '/api/scca/assessments/1/attachments/3' } }
  await mockScca(page, assessment({ status: 'final', can_renew: true, signoffs: [approved], renewal_of: { id: 7, ref_no: 'SCCA-2024-0007', status: 'final' }, permissions: { ...EDITOR, can_edit: false, can_submit: false } }))
  await page.goto('/scca/1?tab=result')
  await expect(page).toHaveURL(/\/scca\/monitoring\/1\?tab=result$/, { timeout: 60_000 })
  await expect(page.getByText('This SCCA replaced SCCA-2024-0007.')).toBeVisible()
  await expect(page.getByText(/on behalf, by Rina Analyst/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Evidence: approval-email.pdf' })).toHaveAttribute('href', '/api/scca/assessments/1/attachments/3')
  await expect(page.getByRole('button', { name: 'Save result' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start renewal' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start renewal' }).click()
  await expect(page).toHaveURL(/\/scca\/manage\/9$/)
})

test('Approval: my inbox, coming up and my history', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/approval')
  await expect(page.getByRole('heading', { name: 'Waiting for my approval' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('table').getByText('Escalated')).toBeVisible()
  const inbox = page.getByRole('table').first()
  for (const name of ['Application name', 'SCCA ref. no.', 'Submitted date', 'Submitted by', 'Status', 'Working days', 'Reminders sent']) {
    await expect(inbox.getByRole('columnheader', { name })).toBeVisible()
  }
  await expect(inbox.getByRole('cell', { name: '3', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible()
  await expect(page.getByText('7 steps away')).toBeVisible()

  await page.getByRole('tab', { name: 'My history' }).click()
  await expect(page.getByText('Approved on my behalf')).toBeVisible()
  await expect(page.getByText('by Rina Analyst')).toBeVisible()
  await page.getByLabel('Decision').click()
  await page.getByRole('option', { name: 'Rejected' }).click()
  await expect(page.getByText('Approved on my behalf')).toHaveCount(0)
  await expect(page.getByText('“RTO is wrong”')).toBeVisible()
})

test('the BCM board nudges, reassigns and approves on behalf', async ({ page }) => {
  const { calls } = await mockScca(page)
  await page.goto('/scca/approval?tab=board')
  const board = page.getByRole('table')
  await expect(board.getByText('Bima Reviewer')).toBeVisible({ timeout: 60_000 })
  await expect(board.getByText('Your own SCCA: reminders only')).toBeVisible()

  await page.getByRole('button', { name: 'Act on SCCA-2026-0001' }).click()
  await page.getByRole('menuitem', { name: 'Send a reminder now' }).click()
  await page.getByRole('button', { name: 'Send reminder' }).click()
  await expect(page.getByText('Reminder sent', { exact: true })).toBeVisible()
  expect(calls.some((call) => call.url === '/api/scca/assessments/1/nudge')).toBe(true)

  await page.getByRole('button', { name: 'Act on SCCA-2026-0001' }).click()
  await page.getByRole('menuitem', { name: 'Reassign the step' }).click()
  const reassign = page.getByRole('dialog', { name: 'Reassign the step' })
  await reassign.getByRole('button', { name: 'Reassign' }).click()
  await expect(reassign.getByText('Pick the new approver.')).toBeVisible()
  await reassign.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Act on SCCA-2026-0001' }).click()
  await page.getByRole('menuitem', { name: 'Approve on behalf' }).click()
  const dialog = page.getByRole('dialog', { name: 'Approve on behalf' })
  await dialog.getByRole('button', { name: 'Approve on behalf' }).click()
  await expect(dialog.getByText('Attach the evidence: the approver\'s email or memo.')).toBeVisible()
  await dialog.getByLabel('Reason').fill('Approved by email on 12 Oct 2026')
  await dialog.getByLabel('Evidence file').setInputFiles({ name: 'approval.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
  await expect(dialog.getByText('approval.pdf')).toBeVisible()
  await dialog.getByRole('button', { name: 'Approve on behalf' }).click()
  await expect(page.getByText('Approved on behalf of Bima Reviewer', { exact: true })).toBeVisible()
  const sent = calls.find((call) => call.url === '/api/scca/assessments/1/approve-on-behalf')!
  expect(String(sent.body)).toContain('Approved by email on 12 Oct 2026')
  expect(String(sent.body)).toContain('filename="approval.pdf"')

  await page.getByRole('button', { name: 'Act on SCCA-2026-0003' }).click()
  await expect(page.getByRole('menuitem', { name: 'Approve on behalf' })).toBeDisabled()
})

test('the BCM board is hidden without its permission', async ({ page }) => {
  await mockScca(page)
  await signIn(page, { permissions: ALL_PERMISSIONS.filter((code) => code !== 'scca.approval.manage') })
  await page.goto('/scca/approval?tab=board')
  await expect(page.getByRole('heading', { name: 'Waiting for my approval' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'BCM board' })).toHaveCount(0)
})

// --- server pagination ------------------------------------------------------------------------

const many = <T extends Record<string, unknown>>(row: T, count: number) =>
  Array.from({ length: count }, (_, index) => ({ ...row, id: 100 + index, ref_no: `SCCA-2026-${String(100 + index).padStart(4, '0')}`, application_name: `App ${index + 1}` }))

test('My inbox and Coming up are paged by the server, 20 and 10 a page, with the page in the URL', async ({ page }) => {
  await mockScca(page)
  await mockSccaWorkflow(page, { inbox: many(INBOX[0]!, 30), upcoming: many(UPCOMING[0]!, 12) })
  const first = page.waitForRequest((req) => req.url().includes('/api/scca/approvals/inbox'))
  await page.goto('/scca/approval')
  const query = new URL((await first).url()).searchParams
  expect([query.get('page'), query.get('per_page')]).toEqual(['1', '20'])
  const inbox = page.getByRole('navigation', { name: 'My inbox pages' })
  await expect(inbox.getByText('Showing 1–20 of 30')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('tab', { name: /My inbox/ })).toContainText('30')

  const second = page.waitForRequest((req) => req.url().includes('/api/scca/approvals/inbox') && req.url().includes('page=2'))
  await inbox.getByRole('link', { name: 'Page 2' }).click()
  await second
  await expect(page).toHaveURL(/\/scca\/approval\?page=2$/)
  await expect(inbox.getByText('Showing 21–30 of 30')).toBeVisible()
  await expect(page.getByRole('link', { name: 'App 26' })).toBeVisible()

  // Rows per page: 50 shows all 30 and is kept in the URL.
  await inbox.getByRole('combobox', { name: 'My inbox: rows per page' }).click()
  await page.getByRole('option', { name: '50' }).click()
  await expect(page).toHaveURL(/per_page=50/)
  await expect(inbox.getByText('Showing 1–30 of 30')).toBeVisible()

  const coming = page.getByRole('navigation', { name: 'Coming up pages' })
  await expect(coming.getByText('Showing 1–10 of 12')).toBeVisible()
  await coming.getByRole('link', { name: 'Page 2' }).click()
  await expect(page).toHaveURL(/coming=2/)
  await expect(coming.getByText('Showing 11–12 of 12')).toBeVisible()
})

test('My history is paged by the server; a new filter starts again at page 1', async ({ page }) => {
  await mockScca(page)
  await mockSccaWorkflow(page, { history: Array.from({ length: 30 }, (_, index) => ({ ...HISTORY[1]!, id: 200 + index, application_name: `App ${index + 1}` })) })
  await page.goto('/scca/approval?tab=history&page=2')
  const pager = page.getByRole('navigation', { name: 'My history pages' })
  await expect(pager.getByText('Showing 21–30 of 30')).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('Decision').click()
  await page.getByRole('option', { name: 'Approved on my behalf' }).click()
  await expect(page).toHaveURL(/decision=approved_on_behalf/)
  await expect(page).not.toHaveURL(/page=2/)
  await expect(pager.getByText('Showing 1–20 of 30')).toBeVisible()
})

test('Renewals, Register and Bottlenecks are paged by the server, 20 a page', async ({ page }) => {
  await mockScca(page)
  await mockSccaWorkflow(page, { renewals: many(RENEWALS[1]!, 27) })
  const request = page.waitForRequest((req) => req.url().includes('/api/scca/monitoring/renewals'))
  await page.goto('/scca/monitoring?tab=renewals&page=2')
  const query = new URL((await request).url()).searchParams
  expect([query.get('page'), query.get('per_page')]).toEqual(['2', '20'])
  await expect(page.getByRole('navigation', { name: 'Renewals pages' }).getByText('Showing 21–27 of 27')).toBeVisible({ timeout: 60_000 })

  await page.goto('/scca/monitoring?tab=register')
  await expect(page.getByRole('navigation', { name: 'Register pages' }).getByText('Showing 1–2 of 2')).toBeVisible({ timeout: 60_000 })
  await page.goto('/scca/monitoring?tab=bottlenecks')
  await expect(page.getByRole('navigation', { name: 'Bottlenecks pages' }).getByText('Showing 1–2 of 2')).toBeVisible({ timeout: 60_000 })
})

test('table columns sort on the server and keep the sort in the URL', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/monitoring?tab=register')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'HR Portal' })).toBeVisible({ timeout: 60_000 })
  const request = page.waitForRequest((req) => req.url().includes('/api/scca/monitoring/register') && req.url().includes('sort=application_name'))
  await table.getByRole('button', { name: 'Sort by Application name' }).click()
  await request
  await expect(page).toHaveURL(/sort=application_name&dir=asc/)
  await table.getByRole('button', { name: /Application name, sorted ascending/ }).click()
  await expect(page).toHaveURL(/dir=desc/)
})

test('Renewals: the Act menu and Generate annual review for the selected rows', async ({ page }) => {
  const { calls } = await mockScca(page)
  await page.goto('/scca/monitoring?tab=renewals')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Payment Gateway' })).toBeVisible({ timeout: 60_000 })
  for (const name of ['Application code', 'Latest final SCCA ref. no.', 'Latest final SCCA date', 'Directorate owner', 'Owner sub-directorate', 'Owner department', 'Assessor', 'Contributor', 'Renewal status', 'Renewal SCCA ref. no.', 'Current renewal step']) {
    await expect(table.getByRole('columnheader', { name })).toBeVisible()
  }
  // CC Omni Channel already has a renewal in approval: it can't be picked.
  await expect(table.getByRole('checkbox', { name: 'Select CC Omni Channel' })).toBeDisabled()
  await table.getByRole('button', { name: 'Act on CC Omni Channel' }).click()
  await expect(page.getByRole('menuitem', { name: 'Open renewal' })).toHaveAttribute('href', '/scca/monitoring/1')
  await expect(page.getByRole('menuitem', { name: 'Generate annual review' })).toBeDisabled()
  await page.keyboard.press('Escape')

  await table.getByRole('checkbox', { name: 'Select Payment Gateway' }).click()
  await page.getByRole('button', { name: 'Generate annual review (1)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Generate annual review' })
  await expect(dialog.getByText('You are the assessor')).toBeVisible()
  // The last final's contributor is suggested.
  await expect(dialog.getByRole('button', { name: 'Contributor' })).toContainText('Dewi Head')
  await dialog.getByRole('button', { name: 'Generate' }).click()
  await expect(page.getByText('Created 1, skipped 0', { exact: true })).toBeVisible()
  const sent = calls.find((call) => call.url === '/api/scca/monitoring/renewals/generate')!
  expect(sent.body).toEqual({ assessment_ids: [5], contributor_id: 6 })
  await page.getByRole('button', { name: 'Open in Manage' }).click()
  await expect(page).toHaveURL(/\/scca\/manage\/90$/)
})

test('Generate annual review does not need a contributor', async ({ page }) => {
  const { calls } = await mockScca(page)
  await page.goto('/scca/monitoring?tab=renewals')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Payment Gateway' })).toBeVisible({ timeout: 60_000 })
  await table.getByRole('checkbox', { name: 'Select Payment Gateway' }).click()
  await page.getByRole('button', { name: 'Generate annual review (1)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Generate annual review' })
  await expect(dialog.getByText('Contributor (optional)')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Contributor' })).toContainText('Dewi Head')
  // The suggestion is cleared: the drafts are generated without a contributor.
  await dialog.locator('[data-slot="trailingClear"]').click()
  await expect(dialog.getByRole('button', { name: 'Contributor' })).not.toContainText('Dewi Head')
  await dialog.getByRole('button', { name: 'Generate' }).click()
  await expect(page.getByText('Created 1, skipped 0', { exact: true })).toBeVisible()
  await expect(page.getByText('Pick the contributor.')).toHaveCount(0)
  const sent = calls.find((call) => call.url === '/api/scca/monitoring/renewals/generate')!
  expect(sent.body).toEqual({ assessment_ids: [5], contributor_id: null })
})

test('the BCM board sends a reminder to the selected SCCAs and says what was skipped', async ({ page }) => {
  const { calls } = await mockScca(page)
  await page.goto('/scca/approval?tab=board')
  const board = page.getByRole('table')
  await expect(board.getByText('Bima Reviewer')).toBeVisible({ timeout: 60_000 })
  await expect(board.getByRole('columnheader', { name: 'Escalated on' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reminder (0)' })).toBeDisabled()
  await board.getByRole('checkbox', { name: 'Select every SCCA on this page' }).click()
  await page.getByRole('button', { name: 'Send reminder (2)' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Send reminder (2)' }).click()
  await expect(page.getByText('Sent 1 · skipped 1 · failed 0', { exact: true })).toBeVisible()
  const sent = calls.find((call) => call.url === '/api/scca/approvals/nudge')!
  expect(sent.body).toEqual({ assessment_ids: [1, 3] })
})
