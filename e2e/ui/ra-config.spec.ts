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
    default_steps: texts.signoff_steps,
    problems: [],
    can: status === 'draft' ? { edit: true, request_publish: true, withdraw_request: false, publish: false, discard: true } : NO_ACTIONS,
    ...extra,
  }
}

/** Administration > RA configuration: RA 2025-r4 active with a 2025-r5 draft; RA Branch active only. */
async function mockRaConfig(page: Page) {
  await signIn(page)
  await page.route('**/api/users**', (route) => route.fulfill({ json: { items: [{ id: 9, display_name: 'Dewi Lestari', email: 'dewi@example.co.id', job_title: 'BCM Head', department: 'BCM' }] } }))
  const calls: Call[] = []
  const active = version(FORMULA, FORMULA.code, 'active')
  let draft = version(FORMULA, '2025-r5', 'draft')
  const branch = version(BRANCH_FORMULA, BRANCH_FORMULA.code, 'active')
  const divisions = DIVISIONS.map((row, index) => ({ ...row, used_by: index === 0 ? 4 : 0 }))
  const signers: Record<string, { id: number, display_name: string, email: string, job_title: string, department: string } | null> = {}
  // RA configuration > Access scope: the default rule, as migration e4b9c2a7f1d3 seeds it.
  const accessRules = [{
    id: 1, name: 'Directorate heads', levels: ['D-1', 'D-2'], directorates: [] as string[], kinds: [] as string[],
    reasons: ['annual_review', 'structural_change'], renewal_statuses: [] as string[], can_generate: true,
    user_ids: [] as number[], users: [] as { id: number, name: string }[], valid_from: null as string | null,
    valid_until: null as string | null, is_active: true, sort_order: 0, updated_by: null as string | null, updated_at: null as string | null,
  }]
  // RA configuration > Team diagrams: the workbook's pictures until one is uploaded.
  const diagramDefaults = {
    recovery_team: { label: 'Recovery team structure', width: 1070, height: 739, size: 102422 },
    call_tree: { label: 'Location call tree', width: 1470, height: 1042, size: 109506 },
  }
  const diagrams = new Map<string, Record<string, unknown>>()
  const diagramOf = (kind: string, diagram: keyof typeof diagramDefaults) => diagrams.get(`${kind}/${diagram}`) ?? {
    diagram, kind, custom: false, filename: null, content_type: 'image/png', version: `wb-${diagram}`,
    updated_at: null, updated_by: null, ...diagramDefaults[diagram],
  }
  await page.route(/\/api\/ra\/diagrams\//, (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }))
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
    if (path.endsWith('/steps')) {
      const sent = (body as { steps: typeof draft.signoff_steps }).steps
      draft = { ...draft, signoff_steps: sent.map((row) => ({ ...row, role: row.code })) }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith('/signers') && request.method() === 'GET') {
      const items = draft.signoff_steps
        .filter((row) => row.signer_mode === 'default' || row.signer_mode === 'fixed')
        .map((row) => ({ ...row, versions: [{ code: draft.code, status: 'draft' }], signer: signers[row.code] ?? null, problem: null, updated_by: null, updated_at: null }))
      return route.fulfill({ json: { items } })
    }
    if (path.includes('/signers/')) {
      const code = path.split('/').pop()!
      const userId = (body as { user_id: number | null }).user_id
      signers[code] = userId ? { id: userId, display_name: 'Dewi Lestari', email: 'dewi@example.co.id', job_title: 'BCM Head', department: 'BCM' } : null
      const row = draft.signoff_steps.find((item) => item.code === code)!
      return route.fulfill({ json: { ...row, versions: [{ code: draft.code, status: 'draft' }], signer: signers[code], problem: null, updated_by: 'Test User', updated_at: '2026-10-29T03:00:00Z' } })
    }
    if (path.endsWith('/texts')) {
      draft = { ...draft, stored_texts: { ...draft.stored_texts, ...(body as object) } }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith('/request-publish')) {
      draft = { ...draft, requested_by: 'Test User', requested_by_id: USER.id, requested_at: '2026-10-26T03:00:00Z', can: { ...draft.can, request_publish: false, withdraw_request: true } }
      return route.fulfill({ json: draft })
    }
    if (path.endsWith(`/versions/${draft.code}`)) {
      if (request.method() === 'PATCH') draft = { ...draft, ...(body as object) }
      return route.fulfill({ json: draft })
    }
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
    if (path.includes('/diagrams')) {
      const kind = new URL(request.url()).searchParams.get('kind') ?? 'head_office'
      const diagram = path.split('/').pop() as keyof typeof diagramDefaults
      if (request.method() === 'PUT') {
        calls[calls.length - 1]!.body = request.headers()['content-type']
        diagrams.set(`${kind}/${diagram}`, {
          ...diagramOf(kind, diagram), custom: true, filename: 'new-chart.png', width: 1, height: 1, size: 70,
          version: 'uploaded', updated_by: 'Test User', updated_at: '2026-11-03T03:00:00Z',
        })
        return route.fulfill({ json: diagramOf(kind, diagram) })
      }
      if (request.method() === 'DELETE') {
        diagrams.delete(`${kind}/${diagram}`)
        return route.fulfill({ json: diagramOf(kind, diagram) })
      }
      return route.fulfill({ json: { items: [diagramOf(kind, 'recovery_team'), diagramOf(kind, 'call_tree')] } })
    }
    if (path.endsWith('/access-rules/check')) {
      return route.fulfill({ json: { user: { id: 9, name: 'Dewi Lestari', directorate: 'OPS', org_level: 'D-2' }, rules: [{ id: 1, name: 'Directorate heads' }], can_generate: true, reasons: ['annual_review', 'structural_change'], locations: { annual_review: 4, structural_change: 4 } } })
    }
    if (path.endsWith('/access-rules') && request.method() === 'POST') {
      const row = { id: 2, users: [], sort_order: 2, updated_by: 'Test User', updated_at: '2026-11-02T03:00:00Z', ...(body as object) } as typeof accessRules[number]
      accessRules.push(row)
      return route.fulfill({ status: 201, json: row })
    }
    if (path.endsWith('/access-rules')) {
      return route.fulfill({ json: {
        items: accessRules,
        options: {
          levels: ['D-1', 'D-2', 'D-3'],
          directorates: ['FIN', 'OPS'],
          kinds: [{ code: 'head_office', label: 'Head office buildings' }, { code: 'branch', label: 'Branches' }],
          reasons: [{ code: 'annual_review', label: 'Annual review' }, { code: 'structural_change', label: 'Structural change' }],
          renewal_statuses: [{ code: 'overdue', label: 'Overdue' }, { code: 'due_30', label: 'Due in 30 days' }, { code: 'due_90', label: 'Due in 31–90 days' }, { code: 'active', label: 'Active' }],
        },
      } })
    }
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

test('the sign-off steps are configured like SCCA, and the statements are edited per version', async ({ page }) => {
  const calls = await mockRaConfig(page)
  // ?tab=roles, the tab's older name, opens Sign-off steps.
  await page.goto('/admin/ra-config?tab=roles')
  await expect(page.getByRole('tab', { name: 'Sign-off steps' })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  const title = page.getByRole('textbox', { name: 'Title of step 1' })
  await expect(title).toHaveValue('Location Incident Coordinator (LIC)')
  await expect(page.getByLabel('Signer of step 1', { exact: true })).toContainText('The LIC')
  await expect(page.getByLabel('Report box of step 1', { exact: true })).toContainText('Box 1')
  await title.fill('Building Incident Coordinator (LIC)')
  // The last step is always required; a new step goes before it.
  await expect(page.getByRole('switch', { name: 'Required' }).last()).toBeDisabled()
  await page.getByRole('button', { name: 'Add step' }).click()
  await page.getByRole('textbox', { name: 'Code of step 4' }).fill('checked_by_risk')
  await page.getByRole('textbox', { name: 'Label of step 4' }).fill('Checked by')
  await page.getByRole('textbox', { name: 'Title of step 4' }).fill('Operational Risk')
  await page.getByRole('switch', { name: 'Required' }).nth(3).click()
  await page.getByRole('button', { name: 'Move step 4 up' }).click()
  // The BCM head step gets a fixed signer.
  await page.getByLabel('Signer of step 5', { exact: true }).click()
  await page.getByRole('option', { name: /^Fixed/ }).click()
  await expect(page.getByText('Save the steps, then pick the fixed signer here.')).toBeVisible()
  await page.getByRole('button', { name: 'Save steps' }).click()
  await expect(page.getByText('Sign-off steps saved').first()).toBeVisible()
  const sent = (calls.find((call) => call.path.endsWith('/steps'))!.body as { steps: { code: string, title: string, mandatory: boolean, signer_mode: string }[] }).steps
  expect(sent.map((row) => row.code)).toEqual(['prepared_by', 'acknowledged_by_unit', 'checked_by_risk', 'reviewed_by', 'acknowledged_by_bcm'])
  expect(sent[0]!.title).toBe('Building Incident Coordinator (LIC)')
  expect(sent[2]).toMatchObject({ mandatory: false, signer_mode: 'chosen' })
  expect(sent[4]).toMatchObject({ mandatory: true, signer_mode: 'fixed' })
  await expect(page.getByText('Fixed signer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Acknowledged by (Business Continuity Management Head) signer' }).click()
  await page.getByRole('option', { name: /^Dewi Lestari/ }).click()
  await expect(page.getByText('Acknowledged by (Business Continuity Management Head): Dewi Lestari', { exact: true })).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.includes('/signers/'))).toMatchObject({ path: '/api/admin/ra-config/signers/acknowledged_by_bcm', body: { user_id: 9 } })

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
  await page.getByLabel('Critical rating', { exact: true }).click()
  await page.getByRole('option', { name: 'Very Important' }).click()
  await expect(page.getByLabel('MTD', { exact: true })).toContainText('4-12 hours')
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

test('team diagrams start as the workbook pictures and are replaced per kind', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=diagrams')
  const structure = page.getByRole('region', { name: 'Recovery team structure' })
  await expect(structure.getByText('Workbook picture')).toBeVisible({ timeout: 60_000 })
  await expect(structure.getByText('1070 × 739 px · PNG · 100 KB')).toBeVisible()
  await expect(structure.getByRole('img')).toHaveAttribute('src', '/api/ra/diagrams/recovery_team?kind=head_office&v=wb-recovery_team')
  await expect(structure.getByRole('button', { name: 'Use the workbook picture' })).toHaveCount(0)
  // Not part of a version: no version picker or draft actions.
  await expect(page.getByRole('combobox', { name: 'Version' })).toHaveCount(0)

  // A GIF is refused before it is sent.
  const input = structure.getByLabel('Choose an image for the recovery team structure')
  await input.setInputFiles({ name: 'chart.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(structure.getByRole('alert')).toHaveText('Use a PNG or JPEG image.')
  expect(calls.some((call) => call.method === 'PUT')).toBe(false)

  await input.setInputFiles({ name: 'new-chart.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') })
  await expect(page.getByText('Recovery team structure replaced').first()).toBeVisible()
  await expect(structure.getByText('Uploaded', { exact: true })).toBeVisible()
  await expect(structure.getByText(/new-chart\.png, uploaded by Test User on/)).toBeVisible()
  await expect(structure.getByRole('img')).toHaveAttribute('src', '/api/ra/diagrams/recovery_team?kind=head_office&v=uploaded')
  const put = calls.find((call) => call.method === 'PUT')!
  expect(put.path).toBe('/api/admin/ra-config/diagrams/recovery_team')
  expect(String(put.body)).toContain('multipart/form-data')

  await structure.getByRole('button', { name: 'Use the workbook picture' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Use the workbook picture' }).click()
  await expect(structure.getByText('Workbook picture')).toBeVisible()
  expect(calls.some((call) => call.method === 'DELETE' && call.path.endsWith('/diagrams/recovery_team'))).toBe(true)

  // RA Branch has its own.
  await page.getByRole('combobox', { name: 'Module' }).click()
  await page.getByRole('option', { name: 'RA Branch' }).click()
  await expect(page.getByRole('region', { name: 'Location call tree' }).getByRole('img')).toHaveAttribute('src', '/api/ra/diagrams/call_tree?kind=branch&v=wb-call_tree')
})

test('the draft\'s code is changed on the Versions tab', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=versions')
  const code = page.getByRole('textbox', { name: 'Version code' })
  await expect(code).toHaveValue('2025-r5', { timeout: 60_000 })
  await code.fill('V.05')
  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByText('Version saved').first()).toBeVisible()
  const patch = calls.find((call) => call.method === 'PATCH')!
  expect(patch.path).toMatch(/\/versions\/2025-r5$/)
  expect(patch.body).toMatchObject({ code: 'V.05' })
  await expect(page).toHaveURL(/version=V\.05/)
})

test('the access scope says who works on which locations, as SCCA\'s', async ({ page }) => {
  const calls = await mockRaConfig(page)
  await page.goto('/admin/ra-config?tab=access')
  const table = page.getByRole('table')
  await expect(table.getByText('Directorate heads')).toBeVisible({ timeout: 60_000 })
  await expect(table.getByText('D-1, D-2')).toBeVisible()
  await expect(table.getByText('Own directorate')).toBeVisible()
  await expect(table.getByText('Buildings and branches')).toBeVisible()
  await expect(table.getByText('Annual review, Structural change')).toBeVisible()
  // The only active rule can't be deleted.
  await page.getByRole('button', { name: 'Actions for Directorate heads' }).click()
  await expect(page.getByRole('menuitem', { name: 'Delete (the only active rule)' })).toBeDisabled()
  await page.keyboard.press('Escape')

  // A new rule: D-3 of FIN, branches only, Annual review.
  await page.getByRole('button', { name: 'New rule' }).click()
  const dialog = page.getByRole('dialog', { name: 'New access rule' })
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Branch D-3 of FIN')
  await dialog.getByRole('button', { name: 'Organization levels', exact: true }).click()
  await page.getByRole('option', { name: 'D-3' }).click()
  await page.keyboard.press('Escape')
  await dialog.getByRole('switch', { name: 'The user\'s own directorate' }).click()
  await dialog.getByRole('button', { name: 'Directorates', exact: true }).click()
  await page.getByRole('option', { name: 'FIN' }).click()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Locations', exact: true }).click()
  await page.getByRole('option', { name: 'Branches' }).click()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByText('Rule added').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'POST' && call.path.endsWith('/access-rules'))!.body).toMatchObject({
    name: 'Branch D-3 of FIN', levels: ['D-3'], directorates: ['FIN'], kinds: ['branch'], reasons: ['annual_review', 'structural_change'], user_ids: [],
  })

  // Check a user.
  await page.getByLabel('User to check', { exact: true }).click()
  await page.keyboard.type('Dewi')
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  await expect(page.getByText('OPS · D-2')).toBeVisible()
  await expect(page.getByText('Annual review: 4 · Structural change: 4')).toBeVisible()
})
