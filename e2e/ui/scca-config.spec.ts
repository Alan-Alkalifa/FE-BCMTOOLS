import { expect, test, type Page } from '@playwright/test'
import { USER, signIn } from '../fixtures/auth'
import { EDITOR, allSignoffs, assessment, mockScca } from '../fixtures/scca'
import { sccaConfig } from '../fixtures/scca-config'

test.setTimeout(90_000)

type Call = { method: string, path: string, body: unknown }

function version(code: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    ...sccaConfig({ code, status, name: `SCCA Tools ${code} for CIMB Niaga` }),
    based_on: status === 'draft' ? 'V4.2' : null,
    created_by: status === 'draft' ? 'Rina' : null,
    created_at: '2026-10-20T02:00:00Z',
    requested_by: null,
    requested_by_id: null,
    requested_at: null,
    published_by: null,
    published_at: null,
    used_by: status === 'active' ? 12 : 0,
    problems: [],
    can: { edit: status === 'draft', request_publish: status === 'draft', withdraw_request: false, publish: false, discard: status === 'draft' },
    ...extra,
  }
}

/** Administration > SCCA configuration with a V4.2 active and a V4.3 draft. */
async function mockConfigAdmin(page: Page, draft = version('V4.3', 'draft')) {
  await signIn(page)
  const calls: Call[] = []
  const versions = { active: version('V4.2', 'active', { can: { edit: false, request_publish: false, withdraw_request: false, publish: false, discard: false } }), draft }
  await page.route('**/api/scca/config**', (route) => route.fulfill({ json: sccaConfig() }))
  await page.route('**/api/users**', (route) => route.fulfill({ json: { items: [{ id: 7, display_name: 'Bernard Budidharma', email: 'bernard@example.com', job_title: 'BCM Head', department: 'BCM' }] } }))
  await page.route(/\/api\/admin\/(scca-config|settings\/scca\/(signers|step-comments))/, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method: request.method(), path, body })
    const meta = (row: typeof draft) => ({ ...row })
    if (path.endsWith('/versions')) return route.fulfill({ json: { items: [meta(versions.draft), meta(versions.active)], can_start_draft: false } })
    if (path.endsWith('/versions/V4.2')) return route.fulfill({ json: versions.active })
    if (path.endsWith('/diff')) {
      return route.fulfill({ json: { compared_with: 'V4.2', changes: [{ section: 'Deployment model', item: 'Hybrid', change: 'added', before: null, after: { code: 'Hybrid', label: 'Hybrid cloud' } }] } })
    }
    if (path.endsWith('/lists/deployment_model') && request.method() === 'PUT') {
      versions.draft = { ...versions.draft, lists: { ...versions.draft.lists, deployment_model: (body as { items: never[] }).items } }
      return route.fulfill({ json: versions.draft })
    }
    if (path.endsWith('/versions/V4.3/dr') && request.method() === 'PUT') {
      versions.draft = { ...versions.draft, dr: body as typeof versions.draft.dr }
      return route.fulfill({ json: versions.draft })
    }
    if (path.endsWith('/request-publish')) {
      versions.draft = { ...versions.draft, requested_by: 'Test User', requested_by_id: USER.id, requested_at: '2026-10-20T03:00:00Z', can: { ...versions.draft.can, request_publish: false, withdraw_request: true } }
      return route.fulfill({ json: versions.draft })
    }
    if (path.endsWith('/settings/scca/signers')) {
      return route.fulfill({ json: { items: [{ code: 'bcm_acknowledgement', title: 'Acknowledged by BCM', signer_mode: 'fixed', signer_roles: ['bcm_admin'], versions: [{ code: 'V4.3', status: 'draft' }], signer: null, problem: null, updated_by: null, updated_at: null }] } })
    }
    if (path.includes('/settings/scca/signers/')) {
      return route.fulfill({ json: { code: 'bcm_acknowledgement', title: 'Acknowledged by BCM', signer_mode: 'fixed', signer_roles: ['bcm_admin'], versions: [{ code: 'V4.3', status: 'draft' }], signer: { id: 7, display_name: 'Bernard Budidharma', email: 'bernard@example.com', job_title: 'BCM Head', department: 'BCM' }, problem: null, updated_by: 'Test User', updated_at: '2026-10-20T03:00:00Z' } })
    }
    if (path.endsWith('/settings/scca/step-comments')) {
      return route.fulfill({ json: { items: [{ code: 'system_user_lead', title: 'Assessment by System User / User Lead', versions: ['V4.2', 'V4.3'], comments_all_tabs: false }] } })
    }
    if (path.includes('/settings/scca/step-comments/')) {
      return route.fulfill({ json: { code: 'system_user_lead', title: 'Assessment by System User / User Lead', versions: ['V4.2', 'V4.3'], comments_all_tabs: (body as { comments_all_tabs: boolean }).comments_all_tabs } })
    }
    if (path.endsWith('/versions/V4.3')) return route.fulfill({ json: versions.draft })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  return calls
}

test('the draft opens first; its lists change and the publish is requested for someone else to approve', async ({ page }) => {
  const calls = await mockConfigAdmin(page)
  await page.goto('/admin/scca-config?tab=lists&list=deployment_model')
  await expect(page.getByRole('heading', { name: 'Deployment model' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Code 1')).toHaveValue('On-premise')
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByLabel('Code 5').fill('Hybrid')
  await page.getByLabel('Label 5').fill('Hybrid cloud')
  await page.getByRole('button', { name: 'Save list' }).click()
  await expect(page.getByText('Deployment model saved', { exact: true })).toBeVisible()
  const put = calls.find((call) => call.method === 'PUT')!
  expect((put.body as { items: { code: string, report_text: string | null }[] }).items.at(-1)).toMatchObject({ code: 'Hybrid', report_text: null })

  await page.getByRole('tab', { name: 'Changes' }).click()
  await expect(page.getByRole('heading', { name: 'Deployment model' })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Hybrid' })).toBeVisible()

  await page.getByRole('button', { name: 'Request publish' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Request publish' }).click()
  await expect(page.getByText('Test User asked to publish V4.3', { exact: false })).toBeVisible()
  // The requester can't approve their own request.
  await expect(page.getByRole('button', { name: 'Publish V4.3' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Withdraw request' })).toBeVisible()
})

test('the DR decision tab edits the parameters, the DR type catalogue and the characteristics', async ({ page }) => {
  const calls = await mockConfigAdmin(page)
  await page.goto('/admin/scca-config?tab=dr')
  await expect(page.getByRole('heading', { name: 'DR type catalogue (Lampiran 10)' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'System characteristics (Lampiran 8)' })).toBeVisible()
  await expect(page.getByLabel('MTD threshold')).toHaveValue('24')
  await expect(page.getByLabel('Suggested DR 2')).toHaveValue('Gold')
  await expect(page.getByRole('button', { name: 'Save DR decision' })).toBeDisabled()
  await page.getByLabel('MTD threshold').fill('36')
  await page.getByLabel('RTO gap threshold').fill('60')
  await page.getByLabel('Backup interval Other').fill('On request')
  await page.getByRole('button', { name: 'Add band' }).click()
  await expect(page.getByLabel('Suggested DR 6')).toBeVisible()
  await page.getByRole('button', { name: 'Remove band 6' }).click()
  await page.getByRole('button', { name: 'Save DR decision' }).click()
  await expect(page.getByText('DR decision saved', { exact: true })).toBeVisible()
  const put = calls.find((call) => call.method === 'PUT')!
  expect(put.path).toBe('/api/admin/scca-config/versions/V4.3/dr')
  const body = put.body as { settings: { mtd_threshold_h: number, rto_gap_pct: number }, catalogue: unknown[], characteristics: Record<string, { backup_interval: string }> }
  expect(body.settings).toMatchObject({ mtd_threshold_h: 36, rto_gap_pct: 60 })
  expect(body.catalogue).toHaveLength(5)
  expect(body.characteristics.Other!.backup_interval).toBe('On request')
})

test('the CIMBN standard table scrolls sideways to its RPO, HA, DR capacity and DR type', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockConfigAdmin(page)
  await page.goto('/admin/scca-config?tab=formula')
  const table = page.locator('table').filter({ has: page.getByText('Recovery standard per category') })
  await expect(table).toBeVisible({ timeout: 60_000 })
  // The table is wider than the card: its box scrolls, the page doesn't.
  const box = table.locator('xpath=..')
  const size = await box.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
  expect(size.scroll).toBeGreaterThan(size.client)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const drType = page.getByRole('combobox', { name: 'Critical DR type' })
  await drType.scrollIntoViewIfNeeded()
  await expect(drType).toBeInViewport()
  await page.getByRole('combobox', { name: 'Critical RPO' }).click()
  await expect(page.getByRole('option', { name: /^Not set$/ })).toBeVisible()
})

test('a retired or active version is read-only', async ({ page }) => {
  await mockConfigAdmin(page)
  await page.goto('/admin/scca-config?version=V4.2&tab=steps')
  await expect(page.getByText('V4.2 is active, so it is read-only.')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Save steps' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toBeDisabled()
})

test('the fixed signer is picked on the sign-off step', async ({ page }) => {
  const draft = version('V4.3', 'draft')
  const steps = draft.steps as { code: string, signer_mode: string, signer_roles: string[] }[]
  Object.assign(steps.find((step) => step.code === 'bcm_acknowledgement')!, { signer_mode: 'fixed', signer_roles: ['bcm_admin'] })
  const calls = await mockConfigAdmin(page, draft)
  await page.goto('/admin/scca-config?tab=steps')
  await expect(page.getByText('Fixed signer', { exact: true })).toBeVisible({ timeout: 60_000 })
  // Chosen steps have no signer field; a step switched to default asks to save first.
  await expect(page.getByRole('button', { name: /signer$/ })).toHaveCount(1)
  await page.getByRole('button', { name: 'Acknowledged by BCM signer' }).click()
  await page.getByRole('option', { name: /^Bernard Budidharma/ }).click()
  await expect(page.getByText('Acknowledged by BCM: Bernard Budidharma', { exact: true })).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT')).toMatchObject({ path: '/api/admin/settings/scca/signers/bcm_acknowledgement', body: { user_id: 7 } })
})

test('the reminder and escalation rules are a tab after Rating notes', async ({ page }) => {
  await mockConfigAdmin(page)
  const saved: unknown[] = []
  await page.route(/\/api\/admin\/settings\/scca$/, (route) => {
    if (route.request().method() === 'PUT') saved.push(route.request().postDataJSON())
    return route.fulfill({ json: { reminders_enabled: true, reminder_after_days: 3, reminder_every_days: 2, escalate_after_days: 7, extra_escalation_emails: [], renewal_notice_days: [90, 30, 7], overdue_repeat_days: 30, window_start_hour: 8, window_end_hour: 17 } })
  })
  // The old SCCA settings address opens the tab.
  await page.goto('/admin/settings/scca')
  await expect(page).toHaveURL(/\/admin\/scca-config\?tab=reminders$/, { timeout: 60_000 })
  await expect.poll(async () => {
    const tabs = (await page.getByRole('tab').allInnerTexts()).map((text) => text.trim())
    return tabs.indexOf('Reminders and escalation') - tabs.indexOf('Rating notes')
  }).toBe(1)
  await expect(page.getByText('Reminders on working days 3, 5, 7, 9, …; escalation on day 7.')).toBeVisible()
  await page.getByLabel('Also send escalations to').fill('bcm.team@cimbniaga.co.id')
  await page.getByLabel('Notify before the renewal date').fill('60, 14')
  await page.getByRole('button', { name: 'Save reminder rules' }).click()
  await expect(page.getByText('Reminder rules saved', { exact: true })).toBeVisible()
  expect(saved[0]).toMatchObject({ extra_escalation_emails: ['bcm.team@cimbniaga.co.id'], renewal_notice_days: [60, 14], reminder_after_days: 3 })

  await page.getByLabel('Notify before the renewal date').fill('soon')
  await page.getByRole('button', { name: 'Save reminder rules' }).click()
  await expect(page.getByText('Whole numbers of days from 0 to 365, separated by commas.')).toBeVisible()
})

test('the reminders tab is hidden without the settings permission', async ({ page }) => {
  await mockConfigAdmin(page)
  await signIn(page, { permissions: USER.permissions.filter((code) => code !== 'scca.settings.manage') })
  await page.goto('/admin/scca-config?tab=reminders')
  await expect(page.getByRole('tab', { name: 'Versions' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'Reminders and escalation' })).toHaveCount(0)
})

// --- the SCCA forms read the SCCA's version -----------------------------------------------

function v43() {
  const config = sccaConfig({ code: 'V4.3', renewal_months: 12 })
  const lists = config.lists as Record<string, { code: string, label: string, report_text: string | null, active: boolean, attrs: Record<string, unknown> }[]>
  lists.deployment_model!.push({ code: 'Hybrid', label: 'Hybrid cloud', report_text: 'Hybrid', active: true, attrs: {} })
  lists.deployment_model![1]!.active = false // SaaS retired
  const steps = config.steps as { code: string, mandatory: boolean, signer_mode: string, signer: unknown }[]
  steps.find((step) => step.code === 'enterprise_architecture')!.mandatory = false
  const fixed = steps.find((step) => step.code === 'bcm_acknowledgement')!
  fixed.signer_mode = 'fixed'
  fixed.signer = { id: 7, display_name: 'Bernard Budidharma', email: 'bernard@example.com', job_title: 'BCM Head', department: 'BCM' }
  return config
}

test('the forms use the lists, renewal period and sign-off steps of the SCCA\'s version', async ({ page }) => {
  const signoffs = allSignoffs().filter((row: { role: string }) => row.role !== 'enterprise_architecture')
  await mockScca(page, assessment({ formula_version: 'V4.3', signoffs, deployment_model: 'SaaS' }), v43())
  await page.goto('/scca/1')
  await expect(page.getByText('12 months after this assessment', { exact: false }).or(page.getByText('1 year after this assessment', { exact: false })).first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('combobox', { name: 'Deployment model' }).click()
  await expect(page.getByRole('option', { name: 'Hybrid cloud' })).toBeVisible()
  // SaaS is retired in V4.3, but this SCCA already stores it, so it stays (marked).
  await expect(page.getByRole('option', { name: 'SaaS (retired)' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/scca/1?tab=result')
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: /4\. Reviewed by Enterprise Architecture\s*Optional/ })).toBeVisible()
  await expect(page.getByText('Fixed signer, set by BCM in the SCCA configuration. It is applied at Submit.')).toBeVisible()
  const request = page.waitForRequest((req) => req.method() === 'PUT')
  await page.getByRole('button', { name: 'Save result' }).click()
  const sent = (await request).postDataJSON().signoffs as { role: string }[]
  expect(sent.map((row) => row.role)).not.toContain('bcm_acknowledgement')
  expect(sent).toHaveLength(8)
})

test('a draft on an older version moves to the active one', async ({ page }) => {
  const current = assessment({ formula_version: 'V4.2', latest_version: 'V4.3', can_move_version: true, permissions: EDITOR })
  await mockScca(page, current)
  await page.route('**/api/scca/assessments/1/move-version', (route) =>
    route.fulfill({ json: { ...current, formula_version: 'V4.3', latest_version: 'V4.3', can_move_version: false, cleared: ['Rating C1'] } }))
  await page.goto('/scca/1')
  await expect(page.getByText('This draft uses V4.2. V4.3 is the active version.')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Move to V4.3' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to V4.3' }).click()
  await expect(page.getByText('Now on V4.3', { exact: true })).toBeVisible()
  await expect(page.getByText('Redo: Rating C1.').first()).toBeVisible()
  await expect(page.getByText('This draft uses V4.2.', { exact: false })).toHaveCount(0)
})

test('comments on every tab is a live switch per step, saved at once', async ({ page }) => {
  const calls = await mockConfigAdmin(page)
  await page.goto('/admin/scca-config?tab=steps')
  const toggle = page.getByRole('switch', { name: 'Comments on every tab' })
  await expect(toggle).toHaveCount(1, { timeout: 60_000 })
  await toggle.click()
  await expect(page.getByText('Assessment by System User / User Lead: comments on every tab', { exact: true })).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT')).toMatchObject({ path: '/api/admin/settings/scca/step-comments/system_user_lead', body: { comments_all_tabs: true } })
})
