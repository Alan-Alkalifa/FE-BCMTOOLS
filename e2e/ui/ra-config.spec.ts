import { expect, test, type Page } from '@playwright/test'
import { USER, signIn } from '../fixtures/auth'
import { BRANCH_FORMULA, DIVISIONS, FORMULA, withTexts } from '../fixtures/ra'

test.setTimeout(90_000)

type Call = { method: string, path: string, body: unknown }

const NO_ACTIONS = { edit: false, request_publish: false, withdraw_request: false, publish: false, discard: false }

function version(formula: { kind: string, code: string, name: string }, code: string, status: string, extra: Record<string, unknown> = {}) {
  const texts = withTexts(formula)
  return {
    ...texts,
    id: code.length,
    code,
    status,
    notes: null,
    based_on: status === 'draft' ? formula.code : null,
    created_by: status === 'draft' ? 'Rina' : null,
    created_at: '2026-10-20T02:00:00Z',
    requested_by: null,
    requested_by_id: null,
    requested_at: null,
    published_by: null,
    published_at: null,
    used_by: status === 'active' ? 3 : 0,
    stored_texts: { type_description: null, hazard_intro: null, signoff_statement_en: null, risk_summary_note_en: null },
    default_texts: { hazard_intro: texts.hazard_intro, signoff_statement_en: texts.signoff_statement_en },
    default_roles: texts.signoff_role_labels,
    problems: [],
    can: status === 'draft' ? { edit: true, request_publish: true, withdraw_request: false, publish: false, discard: true } : NO_ACTIONS,
    ...extra,
  }
}

/** Administration > RA configuration: RA 2025-r4 active with a 2025-r5 draft; RA Branch active only. */
async function mockRaConfig(page: Page) {
  await signIn(page)
  const calls: Call[] = []
  const active = version(FORMULA, FORMULA.code, 'active')
  let draft = version(FORMULA, '2025-r5', 'draft')
  const branch = version(BRANCH_FORMULA, BRANCH_FORMULA.code, 'active')
  const divisions = DIVISIONS.map((row, index) => ({ ...row, used_by: index === 0 ? 4 : 0 }))
  let settings = {
    reminders_enabled: true, reminder_after_days: 3, reminder_every_days: 2, escalate_after_days: 7,
    extra_escalation_emails: [], renewal_notice_days: [90, 30, 7], overdue_repeat_days: 30,
    window_start_hour: 8, window_end_hour: 17, updated_at: null, updated_by: null,
  }
  await page.route(/\/api\/admin\/ra-config/, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method: request.method(), path, body })
    if (path.endsWith('/versions')) {
      return route.fulfill({ json: { items: [draft, active, branch], can_start_draft: { head_office: false, branch: true } } })
    }
    if (path.endsWith(`/versions/${FORMULA.code}`)) return route.fulfill({ json: active })
    if (path.endsWith(`/versions/${BRANCH_FORMULA.code}`)) return route.fulfill({ json: branch })
    if (path.endsWith('/diff')) {
      return route.fulfill({ json: { against: FORMULA.code, changes: [{ part: 'Hazards', item: 'H01', field: 'Type of hazard', from: 'Banjir/ Banjir Bandang', to: 'Banjir' }] } })
    }
    if (path.endsWith('/hazards')) {
      const sent = body as { categories: { hazards: { short_name: string }[] }[] }
      draft = { ...draft, categories: draft.categories.map((category, c) => ({ ...category, hazards: category.hazards.map((hazard, h) => ({ ...hazard, short_name: sent.categories[c]!.hazards[h]!.short_name })) })) }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith('/roles')) {
      draft = { ...draft, signoff_role_labels: (body as { roles: typeof draft.signoff_role_labels }).roles }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith('/texts')) {
      draft = { ...draft, stored_texts: { ...draft.stored_texts, ...(body as object) } }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith('/request-publish')) {
      draft = { ...draft, requested_by: 'Test User', requested_by_id: USER.id, requested_at: '2026-10-26T03:00:00Z', can: { ...draft.can, request_publish: false, withdraw_request: true } }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith('/versions/2025-r5')) return route.fulfill({ json: draft })
    if (path.endsWith('/divisions') && request.method() === 'POST') {
      const row = { id: 300, is_active: true, used_by: 0, ...(body as object) } as typeof divisions[number]
      divisions.push(row)
      return route.fulfill({ status: 201, json: row })
    }
    if (path.endsWith('/divisions')) return route.fulfill({ json: { items: divisions } })
    if (path.endsWith('/settings') && request.method() === 'PUT') {
      settings = { ...settings, ...(body as object), updated_by: 'Test User', updated_at: '2026-10-26T03:00:00Z' }
      return route.fulfill({ json: settings })
    }
    if (path.endsWith('/settings')) return route.fulfill({ json: settings })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  return calls
}

test('the sidebar has RA configuration under Administration', async ({ page }) => {
  await mockRaConfig(page)
  await page.goto('/admin/ra-config')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'RA configuration' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'RA configuration' })).toBeVisible()
})

test('the draft opens first; editing a hazard and requesting the publish', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=hazards')
  await expect(page.getByLabel('Version', { exact: true })).toContainText('2025-r5', { timeout: 60_000 })
  const first = page.getByRole('textbox', { name: 'Type of Hazard 1', exact: true })
  await expect(first).toHaveValue('Banjir/ Banjir Bandang')
  await first.fill('Banjir')
  await page.getByRole('button', { name: 'Save hazards' }).click()
  await expect(page.getByText('Hazards saved').first()).toBeVisible()
  const sent = calls.find((call) => call.path.endsWith('/hazards'))!.body as { categories: { code: string, hazards: { code: string, short_name: string }[] }[] }
  expect(sent.categories[0]!.hazards[0]).toEqual(expect.objectContaining({ code: 'H01', short_name: 'Banjir' }))

  await page.getByRole('tab', { name: 'Changes' }).click()
  await expect(page.getByText('1 change against 2025-r4.')).toBeVisible()
  await page.getByRole('button', { name: 'Request publish' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Request publish' }).click()
  await expect(page.getByText(/Test User asked to publish 2025-r5/)).toBeVisible()
  // The requester can't approve their own request.
  await expect(page.getByRole('button', { name: 'Publish 2025-r5' })).toHaveCount(0)
})

test('the sign-off role titles and the statements are edited per version', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=roles')
  const title = page.getByRole('textbox', { name: 'Title of step 1' })
  await expect(title).toHaveValue('Location Incident Coordinator (LIC)', { timeout: 60_000 })
  await title.fill('Building Incident Coordinator (LIC)')
  await page.getByRole('button', { name: 'Save roles' }).click()
  await expect(page.getByText('Sign-off roles saved').first()).toBeVisible()
  expect((calls.find((call) => call.path.endsWith('/roles'))!.body as { roles: { title: string }[] }).roles[0]!.title).toBe('Building Incident Coordinator (LIC)')

  await page.getByRole('tab', { name: 'Statements and notes' }).click()
  const statement = page.getByRole('textbox', { name: 'Sign-off statement' })
  await expect(statement).toHaveAttribute('placeholder', /Default: I declare/)
  await statement.fill('I confirm this risk assessment is accurate.')
  await page.getByRole('button', { name: 'Save texts' }).click()
  await expect(page.getByText('Statements and notes saved').first()).toBeVisible()
  expect(calls.find((call) => call.path.endsWith('/texts'))!.body).toMatchObject({ signoff_statement_en: 'I confirm this risk assessment is accurate.', hazard_intro: null })
})

test('RA Branch has its own versions; a retired or active version is read-only', async ({ page }) => {
  await mockRaConfig(page)
  await page.goto('/admin/ra-config')
  await page.getByLabel('Module').click({ timeout: 60_000 })
  await page.getByRole('option', { name: 'RA Branch' }).click()
  await expect(page).toHaveURL(/kind=branch/)
  await expect(page.getByLabel('Version', { exact: true })).toContainText('branch-2025-r4')
  await expect(page.getByText('branch-2025-r4 is active, so it is read-only.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start draft' })).toBeVisible()
})

test('divisions are kept with their MTD and critical rating', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=divisions')
  const table = page.getByRole('table')
  await expect(table.getByRole('row', { name: /Cash & Payment Operations/ })).toContainText('0-4 hours', { timeout: 60_000 })
  await expect(table.getByRole('button', { name: 'Delete Cash & Payment Operations' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add division' }).first().click()
  await page.getByRole('textbox', { name: 'Division name' }).fill('Treasury')
  await page.getByRole('combobox', { name: 'Critical rating' }).click()
  await page.getByRole('option', { name: 'Very Important' }).click()
  await expect(page.getByRole('combobox', { name: 'MTD' })).toContainText('4-12 hours')
  await page.getByRole('button', { name: 'Add division' }).last().click()
  await expect(page.getByText('Division added').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'POST' && call.path.endsWith('/divisions'))!.body).toEqual({ name: 'Treasury', mtd: '4-12 hours', critical_rating: 'Very Important' })
})

test('the reminder rules are like SCCA\'s', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=reminders')
  await expect(page.getByText('Reminders on working days 3, 5, 7, 9, …; escalation on day 7.')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('textbox', { name: 'Notify before the renewal date' }).fill('60, 14')
  await page.getByRole('button', { name: 'Save reminder rules' }).click()
  await expect(page.getByText('Reminder rules saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/settings'))!.body).toMatchObject({ renewal_notice_days: [60, 14], window_start_hour: 8 })
})
