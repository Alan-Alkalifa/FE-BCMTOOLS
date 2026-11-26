import { test, expect } from '@playwright/test'
import { signIn, menuFor, ALL_PERMISSIONS } from '../fixtures/auth'
import type { BiancaConfigPayload, BiancaConfigVersion } from '../../app/composables/useBiancaConfigAdmin'

test.describe.configure({ timeout: 60000 })

const permissions = [...ALL_PERMISSIONS, 'bianca.access', 'bianca.create', 'bianca.config.view', 'bianca.config.manage', 'bianca.config.publish']
function payload(): BiancaConfigPayload {
  return {
    periods: ['4 hours', 'Day 1'], suggested_mtd: ['4 hours', '1 day'],
    expected_mtd: [{ value: '4 hours', category: 'Business Critical' }],
    dependency_mtd: ['4 hours', 'NA', 'SLA'], percentages: ['0%', '100%'],
    upstream_capacity: ['0%', '100%', 'NA', 'SLA'], yes_no: ['Yes', 'No'],
    downstream_capacity: ['0%', '100%', 'NA', 'SLA'], generic_values: ['0%', '100%', 'NA', 'SLA'], expected_support_capacity: ['0%', '100%', 'NA', 'SLA'],
    financial_bands: [{ code: 'very_high', label: 'Very High', description: 'IDR 4 Billion' }],
    impact_matrix: [{ score: 3, regulatory: 'Breach of laws', customer: '>20% affected' }],
    system_usage: ['Minimal Dependency', 'Full Dependency', 'Partial Dependency'],
    alt_site_strategies: ['Hyspace'], frequencies: ['Daily'], scores: [1, 2, 3],
    loss_alert_idr: 4000000000, score_alert: 3, hours_per_day: 24, days_per_week: 7,
    max_functions: 30, it_slots: 4, dependency_slots: 4,
    staff_grades: [
      { code: 'staff_senior', label: 'Senior Management', min_level: 1, max_level: 3, active: true, requires_note: false },
      { code: 'staff_middle', label: 'Middle Management', min_level: 4, max_level: 5, active: true, requires_note: false },
      { code: 'staff_manager', label: 'Executive–Manager', min_level: 6, max_level: 9, active: true, requires_note: false },
      { code: 'staff_non_staff', label: 'Non Staff–Staff', min_level: 10, max_level: 11, active: true, requires_note: false },
      { code: 'staff_others', label: 'Others', min_level: null, max_level: null, active: true, requires_note: true },
    ],
    signoff_steps: ['bcm_coordinator', 'group_head', 'head_of', 'bcm_head'].map((code, i) => ({ code, title: code, required: true, signer_mode: i === 0 ? 'creator' : 'chosen', user_id: null })),
    guides: { attestation: 'I confirm this BIA.', suggested_mtd: 'Follow the workbook guide.' },
  }
}
function version(): BiancaConfigVersion {
  return { id: 1, code: 'V1', name: 'BIA workbook baseline', notes: null, status: 'active', revision: 1, requested_by_id: null, requested_at: null, published_at: null, used_by: 0, payload: payload(), changes: [] }
}

test('Sign Off accepts WFH and generic or specified Hyspace without requiring a floor', async ({ page }) => {
  await signIn(page, { permissions })
  await page.route('**/api/users?*', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/bianca/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/lookups')) {
      const config = payload()
      return route.fulfill({ json: { ...config, personnel_grades: config.staff_grades, staff_grades: {}, config_version_id: 2, config_version: 'V2', organisation: {} } })
    }
    if (path.endsWith('/org-options')) return route.fulfill({ json: { directorates: [], sub_directorates: [], groups: [] } })
    if (path.endsWith('/calculate')) return route.fulfill({ json: { functions: [], total_staff: 0, loss_totals: [0, 0], loss_alerts: [false, false] } })
    if (path.endsWith('/locations')) return route.fulfill({ json: { items: [{ id: 1, label: 'Example Site (HO-01)', address: 'Example Office Address' }] } })
    return route.fulfill({ json: { items: [] } })
  })
  await page.goto('/bianca/manage/new')
  await page.getByRole('combobox', { name: 'Main location type' }).click()
  await page.getByRole('option', { name: 'Work From Home', exact: true }).click()
  await expect(page.getByText('Address and floor are not applicable.')).toBeVisible()
  // The floor takes whole numbers from 1: a spinbutton.
  await expect(page.getByRole('spinbutton', { name: /Main location floor/ })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Alternate location type' }).click()
  await page.getByRole('option', { name: 'Hyspace', exact: true }).click()
  await expect(page.getByText('Site not specified')).toBeVisible()
  await page.getByRole('button', { name: 'Alternate location site', exact: true }).click()
  await page.getByRole('option', { name: 'Example Site (HO-01)', exact: true }).click()
  await expect(page.getByText('Example Office Address')).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Alternate location floor', exact: true })).not.toHaveAttribute('required', '')
})

test('Expected MTD is read here: Master data › Master MTD changes it, for IT and non-IT', async ({ page }) => {
  await signIn(page, { permissions: [...permissions, 'masterdata.mtd.view', 'masterdata.mtd.manage'] })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, (route) => route.fulfill({ json: { items: [draft] } }))
  await page.goto('/admin/bianca-config?version=2&tab=impact&impact=expected-mtd')
  const headings = page.getByRole('heading', { name: 'Expected MTD', exact: true })
  await expect(headings).toBeVisible({ timeout: 45000 })
  // The choices are a copy of Master MTD, read only in a version (Master data › Master MTD).
  await expect(page.getByText('Managed in Master data › Master MTD')).toBeVisible()
  const choices = page.getByRole('table', { name: 'Expected MTD choices of this version' })
  await expect(choices.getByRole('textbox')).toHaveCount(0)
  await expect(choices.getByText('Part 2a (IT)', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add MTD', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit in Master MTD' })).toHaveAttribute('href', /\/masterdata\/mtd\?part=options/)
})

test('an administrator adds a personnel category and saves the typed payload with CSRF', async ({ page }) => {
  await signIn(page, { permissions })
  let versions = [version()]
  let saved: BiancaConfigPayload | undefined
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      versions = [{ ...version(), id: 2, code: 'V2', status: 'draft' }, ...versions]
      return route.fulfill({ status: 201, json: versions[0] })
    }
    if (request.method() === 'PUT') {
      expect(request.headers()['x-csrf-token']).toBe('csrf-test')
      const body = request.postDataJSON()
      saved = body.payload
      versions[0] = { ...versions[0]!, ...body, revision: 2 }
      return route.fulfill({ json: versions[0] })
    }
    return route.fulfill({ json: { items: versions } })
  })
  await page.goto('/admin/bianca-config')
  await page.getByRole('button', { name: 'Start draft version', exact: true }).click()
  await page.getByRole('button', { name: 'Add category', exact: true }).click()
  await page.getByRole('textbox', { name: /^Category name/ }).last().fill('Specialist Support')
  await page.getByRole('spinbutton', { name: 'First U level of Specialist Support', exact: true }).fill('12')
  await page.getByRole('spinbutton', { name: 'Last U level of Specialist Support', exact: true }).fill('13')
  await expect(page.getByText('Specialist Support (U12–U13)', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => saved?.staff_grades.length).toBe(6)
  expect(saved?.staff_grades.at(-1)).toMatchObject({ label: 'Specialist Support', min_level: 12, max_level: 13 })
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
})

test('personnel removal can be cancelled and saved without changing the active version', async ({ page }) => {
  await signIn(page, { permissions })
  const active = version()
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
  let saved: BiancaConfigPayload | undefined
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saved = body.payload
      Object.assign(draft, body, { revision: 2 })
      return route.fulfill({ json: draft })
    }
    return route.fulfill({ json: { items: [draft, active] } })
  })
  await page.goto('/admin/bianca-config?version=2&tab=personnel')
  const remove = page.getByRole('button', { name: 'Remove category Senior Management', exact: true })
  await expect(remove).toBeVisible({ timeout: 45000 })
  await remove.click()
  let dialog = page.getByRole('dialog', { name: 'Remove Senior Management?' })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(remove).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  await remove.click()
  dialog = page.getByRole('dialog', { name: 'Remove Senior Management?' })
  await dialog.getByRole('button', { name: 'Remove category', exact: true }).click()
  await expect(remove).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /^Category name/ })).toHaveCount(4)
  await expect(page.getByText('Senior Management (U1–U3)', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => saved?.staff_grades.length).toBe(4)
  expect(saved?.staff_grades.some((grade) => grade.code === 'staff_senior')).toBe(false)
  expect(active.payload.staff_grades).toHaveLength(5)
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('textbox', { name: /^Category name/ })).toHaveCount(4, { timeout: 45000 })
  await expect(remove).toHaveCount(0)
})

test('personnel removal keeps the last active category and is hidden on published versions', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
  draft.payload.staff_grades = [
    draft.payload.staff_grades[0]!,
    { ...draft.payload.staff_grades[1]!, active: false },
  ]
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft, version()] } }))
  await page.goto('/admin/bianca-config?version=2&tab=personnel')
  await expect(page.getByRole('button', { name: 'Remove category Senior Management', exact: true })).toBeDisabled({ timeout: 45000 })
  const remove = page.getByRole('button', { name: 'Remove category Middle Management', exact: true })
  await expect(remove).toBeEnabled()
  await remove.click()
  await page.getByRole('dialog', { name: 'Remove Middle Management?' }).getByRole('button', { name: 'Remove category', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Category name/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remove category Senior Management', exact: true })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Configuration version' }).click()
  await page.getByRole('option', { name: /V1/ }).click()
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByText('V1 is read-only', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Remove category/ })).toHaveCount(0)
})

test('approval steps can be added, renamed, reordered, removed and saved', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signIn(page, { permissions })
  const active = version()
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
  let saved: BiancaConfigPayload | undefined
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saved = body.payload
      Object.assign(draft, body, { revision: 2 })
      return route.fulfill({ json: draft })
    }
    return route.fulfill({ json: { items: [draft, active] } })
  })
  await page.goto('/admin/bianca-config?version=2&tab=steps')
  await expect(page.getByRole('button', { name: 'Add step', exact: true })).toBeVisible({ timeout: 45000 })
  const coordinator = page.getByRole('group', { name: 'Step 1: bcm_coordinator', exact: true })
  await expect(coordinator.getByRole('button', { name: /Remove step/ })).toHaveCount(0)
  await expect(coordinator.getByRole('button', { name: /Move.*down/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  const added = page.getByRole('group', { name: 'Step 4: New approval step', exact: true })
  await added.getByRole('textbox', { name: /^Step title/ }).fill('Business reviewer')
  let reviewer = page.getByRole('group', { name: 'Step 4: Business reviewer', exact: true })
  await reviewer.getByRole('textbox', { name: /^Code/ }).fill('business_reviewer')
  await reviewer.getByRole('button', { name: 'Move Business reviewer up', exact: true }).click()
  reviewer = page.getByRole('group', { name: 'Step 3: Business reviewer', exact: true })
  await expect(reviewer.getByRole('textbox', { name: /^Code/ })).toHaveValue('business_reviewer')
  await page.screenshot({ path: test.info().outputPath('approval-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Remove step group_head', exact: true }).click()
  await page.getByRole('dialog', { name: 'Remove group_head?' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Step 2: group_head', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove step group_head', exact: true }).click()
  await page.getByRole('dialog', { name: 'Remove group_head?' }).getByRole('button', { name: 'Remove step', exact: true }).click()
  await page.getByRole('tab', { name: 'Personnel levels', exact: true }).click()
  await page.getByRole('tab', { name: 'Approval template', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => saved?.signoff_steps.map((step) => step.code)).toEqual(['bcm_coordinator', 'business_reviewer', 'head_of', 'bcm_head'])
  expect(active.payload.signoff_steps.map((step) => step.code)).toEqual(['bcm_coordinator', 'group_head', 'head_of', 'bcm_head'])
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('group', { name: 'Step 2: Business reviewer', exact: true })).toBeVisible({ timeout: 45000 })
  await page.getByRole('combobox', { name: 'Configuration version' }).click()
  await page.getByRole('option', { name: /V1/ }).click()
  await expect(page.getByText('V1 is read-only', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add step', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Remove step/ })).toHaveCount(0)
})

test('removing the final approver promotes the remaining step to required', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
  draft.payload.signoff_steps = [draft.payload.signoff_steps[0]!, { ...draft.payload.signoff_steps[1]!, required: false }, draft.payload.signoff_steps.at(-1)!]
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft] } }))
  await page.goto('/admin/bianca-config?version=2&tab=steps')
  await page.getByRole('button', { name: 'Remove step bcm_head', exact: true }).click()
  await page.getByRole('dialog', { name: 'Remove bcm_head?' }).getByRole('button', { name: 'Remove step', exact: true }).click()
  const remaining = page.getByRole('group', { name: 'Step 2: group_head', exact: true })
  await expect(remaining.getByRole('switch', { name: 'Required', exact: true })).toBeChecked()
  await expect(remaining.getByRole('switch', { name: 'Required', exact: true })).toBeDisabled()
  await expect(remaining.getByRole('button', { name: 'Remove step group_head', exact: true })).toBeDisabled()
})

for (const width of [1440, 390]) {
  test(`personnel and approval cards follow the SCCA layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await signIn(page, { permissions })
    const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
    await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft] } }))
    await page.goto('/admin/bianca-config?version=2&tab=personnel')
    const category = page.locator('tr').filter({ has: page.getByRole('button', { name: 'Remove category Senior Management', exact: true }) })
    await expect(category).toBeVisible({ timeout: 45000 })
    const remove = category.getByRole('button', { name: 'Remove category Senior Management', exact: true })
    const active = category.getByRole('switch', { name: 'Senior Management active', exact: true })
    const arrow = category.getByRole('button', { name: 'Move Senior Management down', exact: true })
    const name = category.getByRole('textbox', { name: 'Category name 1' })
    // A saved category keeps its code: it is shown, not typed.
    await expect(category.getByText('Code staff_senior · fixed once saved')).toBeVisible()
    const boxes = await Promise.all([remove.boundingBox(), active.boundingBox(), arrow.boundingBox(), name.boundingBox()])
    expect(boxes.every(Boolean)).toBe(true)
    if (width > 1000) {
      expect(boxes[0]!.x).toBeGreaterThan(boxes[1]!.x + boxes[1]!.width)
      expect(boxes[2]!.x + boxes[2]!.width).toBeLessThan(boxes[3]!.x)
    }
    await category.screenshot({ path: test.info().outputPath(`personnel-${width}.png`) })
    await arrow.click()
    await expect(page.getByRole('textbox', { name: 'Category name 2' })).toHaveValue('Senior Management')
    await page.getByRole('tab', { name: 'Approval template', exact: true }).click()
    const step = page.getByRole('group', { name: 'Step 2: group_head', exact: true })
    await step.screenshot({ path: test.info().outputPath(`approval-${width}.png`) })
    const main = await page.getByRole('main').boundingBox()
    const card = await step.boundingBox()
    expect(card!.x).toBeGreaterThanOrEqual(main!.x)
    expect(card!.x + card!.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('the requester cannot approve their own publication', async ({ page }) => {
  await signIn(page, { permissions })
  const pending = { ...version(), id: 2, status: 'draft', requested_by_id: 1, requested_at: '2026-11-17T01:00:00Z' }
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [pending, version()] } }))
  await page.goto('/admin/bianca-config')
  await expect(page.getByRole('button', { name: 'Approve publication', exact: true })).toBeDisabled({ timeout: 15000 })
  await expect(page.getByText('You requested publication. Another person must approve it.', { exact: true })).toBeVisible()
})

test('a user without configuration permission is sent to forbidden', async ({ page }) => {
  await signIn(page, { permissions: ['bianca.access'] })
  await page.goto('/admin/bianca-config')
  await expect(page).toHaveURL(/\/forbidden/, { timeout: 45000 })
})

test('new BIA questionnaire renders a configured sixth category', async ({ page }) => {
  await signIn(page, { permissions })
  await page.route('**/api/users?*', (route) => route.fulfill({ json: { items: [] } }))
  const config = payload()
  config.staff_grades.push({ code: 'specialists', label: 'Specialist Support', min_level: 12, max_level: 13, active: true, requires_note: false })
  await page.route('**/api/bianca/**', (route) => {
    if (route.request().url().includes('/lookups')) {
      return route.fulfill({ json: { ...config, personnel_grades: config.staff_grades, staff_grades: {}, config_version_id: 2, config_version: 'V2', organisation: { directorate: 'Dir', sub_directorate: 'Sub', org_group: 'Group' } } })
    }
    if (route.request().url().includes('/calculate')) return route.fulfill({ json: { functions: [], total_staff: 0, loss_totals: [0, 0], loss_alerts: [false, false] } })
    if (route.request().url().includes('/org-options')) return route.fulfill({ json: { directorates: ['Dir'], sub_directorates: ['Sub'], groups: ['Group'] } })
    if (route.request().url().includes('/people')) {
      return route.fulfill({ json: { items: [
        { id: 2, name: 'Test Coordinator', label: 'Test Coordinator', phone: '081234567890' },
        { id: 3, name: 'Test Alternate', label: 'Test Alternate', phone: '081234567891' },
      ] } })
    }
    return route.fulfill({ json: { items: [] } })
  })
  await page.goto('/bianca/manage/new')
  await page.getByPlaceholder('What the Group does').fill('Supports the business.')
  await page.getByPlaceholder('How the Group recovers, at a high level').fill('Resume work remotely.')
  await page.getByRole('combobox', { name: 'Main location type' }).click()
  await page.getByRole('option', { name: 'Work From Home', exact: true }).click()
  await page.getByRole('combobox', { name: 'Alternate location type' }).click()
  await page.getByRole('option', { name: 'Hyspace', exact: true }).click()
  await page.getByRole('button', { name: 'BCM Coordinator', exact: true }).click()
  await page.getByRole('option', { name: 'Test Coordinator' }).click()
  await page.getByRole('button', { name: 'Alternate BCM Coordinator', exact: true }).click()
  await page.getByRole('option', { name: 'Test Alternate' }).click()
  // The risk assessment questions are on the RA questionnaire (MoM 23 Nov), not the Sign off page.
  await expect(page.locator('#bianca-sign').getByText('Have you considered business continuity')).toHaveCount(0)

  await page.getByRole('tab', { name: 'RA questionnaire', exact: true }).click()
  // Leaving the Sign off page asks to check what was filled in.
  const review = page.getByRole('dialog', { name: 'Is this correct?' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Yes, continue', exact: true }).click()
  await expect(page.locator('#bianca-ra').getByText('4.1 Have you considered business continuity')).toBeVisible()
  const count = page.getByRole('spinbutton', { name: 'Number of personnel, Specialist Support', exact: true })
  await count.fill('7')
  await expect(page.locator('#bianca-ra tfoot').getByRole('cell', { name: '7', exact: true })).toBeVisible()
})

test('configuration sections keep draft edits across tabs and compare saved values', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = {
    ...version(), id: 2, code: 'V2', status: 'draft',
    previous_version: 'V1', current_version: 'V2',
    changes: [{ part: 'loss_alert_idr', before: 4000000000, after: 5000000000, previous_version: 'V1', previous_value: 4000000000, current_version: 'V2', current_value: 5000000000 }],
  }
  let saved: BiancaConfigPayload | undefined
  let listsSent: BiancaConfigVersion['list_items']
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saved = body.payload
      listsSent = body.list_items
      Object.assign(draft, body, { revision: 2 })
      return route.fulfill({ json: draft })
    }
    return route.fulfill({ json: { items: [draft, version()] } })
  })

  await page.goto('/admin/bianca-config?version=2&tab=lists&list=alt_site_strategies')
  const versionSelect = page.getByRole('combobox', { name: 'Configuration version' })
  const requestPublish = page.getByRole('button', { name: 'Request publish', exact: true })
  await expect(versionSelect).toHaveText(/V2/, { timeout: 45000 })
  await expect(requestPublish).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Discard draft', exact: true })).toBeEnabled()

  const lists = page.getByRole('navigation', { name: 'Lists', exact: true })
  await expect(lists.getByRole('button', { name: /^Alternate site strategies/ })).toHaveAttribute('aria-current', 'page')
  const choices = page.getByRole('table', { name: 'Alternate site strategies items' })
  await expect(choices.getByRole('textbox', { name: 'Code 1' })).toHaveValue('Hyspace')
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await choices.getByRole('textbox', { name: 'Code 2' }).fill('Dedicated BCP Site')
  await choices.getByRole('textbox', { name: 'Name 2' }).fill('Dedicated site')
  await choices.getByRole('textbox', { name: 'Description 2' }).fill('A BCP site of its own')
  await choices.getByRole('button', { name: 'Move item 2 up' }).click()
  await choices.getByRole('switch', { name: 'Item 2 active' }).uncheck()
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await choices.getByRole('button', { name: 'Remove item 3' }).click()
  await expect(requestPublish).toBeDisabled()
  await lists.getByRole('button', { name: /^Yes \/ No answers/ }).click()
  const fixed = page.getByRole('table', { name: 'Yes / No answers items' })
  await expect(fixed.getByRole('textbox', { name: 'Code 1' })).toHaveCount(0)
  await expect(page.getByText('Fixed: used by BIA rules', { exact: true })).toBeVisible()
  await expect(fixed.getByRole('switch', { name: 'Item 1 active' })).toBeDisabled()
  await expect(fixed.getByRole('textbox', { name: 'Name 1' })).toBeEditable()

  await page.getByRole('tab', { name: 'Impact and MTD', exact: true }).click()
  const impact = page.getByRole('navigation', { name: 'Impact and MTD', exact: true })
  await impact.getByRole('button', { name: 'Time conversion', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Hours per day' })).toBeVisible()
  await impact.getByRole('button', { name: 'Expected MTD', exact: true }).click()
  await expect(page.getByText('Managed in Master data › Master MTD')).toBeVisible()

  await page.getByRole('tab', { name: 'Guides and statements', exact: true }).click()
  await page.getByRole('textbox', { name: 'Attestation statement' }).fill('I confirm the assessment.')
  await page.getByRole('tab', { name: 'Approval template', exact: true }).click()
  const headOf = page.getByRole('group', { name: /Step 3: head_of/ })
  await headOf.getByRole('switch', { name: 'Required' }).uncheck()
  await headOf.getByRole('button', { name: 'Move head_of down' }).click()
  await expect(page.getByRole('group', { name: /Step 4: head_of/ }).getByRole('switch', { name: 'Required' })).toBeChecked()

  await page.getByRole('tab', { name: 'Changes', exact: true }).click()
  const diff = page.getByRole('table', { name: 'Changes to Impact and MTD' })
  for (const name of ['Previous version', 'Previous value', 'Current version', 'Current value']) {
    await expect(diff.getByRole('columnheader', { name, exact: true })).toBeVisible()
  }
  await expect(diff.getByRole('cell', { name: 'V1', exact: true })).toBeVisible()
  await expect(diff.getByRole('cell', { name: 'V2', exact: true })).toBeVisible()
  await expect(diff.getByRole('rowheader', { name: 'Financial loss alert (IDR)' })).toBeVisible()
  await expect(diff.getByRole('cell', { name: 'Changed', exact: true })).toBeVisible()
  await expect(diff.getByRole('cell', { name: '4.000.000.000', exact: true })).toBeVisible()
  await expect(diff.getByRole('cell', { name: '5.000.000.000', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(requestPublish).toBeEnabled()
  expect(saved?.alt_site_strategies).toEqual(['Dedicated BCP Site'])
  expect(listsSent?.alt_site_strategies).toEqual([
    { code: 'Dedicated BCP Site', label: 'Dedicated site', text: 'A BCP site of its own', active: true },
    { code: 'Hyspace', label: 'Hyspace', text: null, active: false },
  ])
  expect(saved?.guides.attestation).toBe('I confirm the assessment.')
  expect(saved?.signoff_steps.at(-1)).toMatchObject({ code: 'head_of', required: true })
})

test('the configuration tabs and section menu fit on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, { permissions })
  const published = { ...version(), requested_by_id: 1, published_at: '2026-11-17T02:00:00Z' }
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [published] } }))
  await page.goto('/admin/bianca-config?tab=lists')

  const main = page.getByRole('main')
  const menu = page.getByRole('navigation', { name: 'Lists', exact: true })
  await expect(menu).toBeVisible({ timeout: 45000 })
  await expect(page.getByText('V1 is read-only', { exact: true })).toBeVisible()
  await menu.getByRole('button', { name: /^Alternate site strategies/ }).click()
  await expect(page.getByRole('table', { name: 'Alternate site strategies items' }).getByRole('textbox', { name: 'Code 1' })).toBeDisabled()
  const tabs = page.getByRole('tablist')
  await expect.poll(() => tabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await expect.poll(() => main.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.getByRole('tab', { name: 'Changes', exact: true }).click()
  await expect(page.getByText('No saved parameter changes.')).toBeVisible()
})

test('workbook lists show IDs, stored values and data types, and planned capacity as one table', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft', list_items: {
    yes_no: [{ id: '1', code: 'Yes', value: 'Yes', data_type: 'string', label: 'Yes', text: null, active: true },
      { id: '0', code: 'No', value: 'No', data_type: 'string', label: 'No', text: null, active: true }],
  } }
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft] } }))
  await page.goto('/admin/bianca-config?tab=lists&list=yes_no')
  const table = page.getByRole('table', { name: 'Yes / No answers items' })
  await expect(table).toBeVisible({ timeout: 45000 })
  for (const label of ['Code', 'Name', 'Description (optional)', 'Active']) await expect(table.getByRole('columnheader', { name: label, exact: true })).toBeVisible()
  // D15: each option's ID, stored value and data type, under its code.
  await expect(table.getByText('ID 1 · value Yes · string', { exact: true })).toBeVisible()
  await expect(table.getByText('ID 0 · value No · string', { exact: true })).toBeVisible()
  const menu = page.getByRole('navigation', { name: 'Lists', exact: true })
  for (const gone of [/^Downstream capacity/, /^Expected MTD reference/, /^Impact scores/]) await expect(menu.getByRole('button', { name: gone })).toHaveCount(0)
  await menu.getByRole('button', { name: /^Planned capacity/ }).click()
  const capacity = page.getByRole('table', { name: 'Planned capacity values and where each is used' })
  await expect(capacity.getByRole('textbox', { name: 'Value 3' })).toHaveValue('NA')
  // NA is never a function's capacity; it is an upstream choice.
  await expect(capacity.getByRole('checkbox', { name: 'NA for Business function' })).toBeDisabled()
  await expect(capacity.getByRole('checkbox', { name: 'NA for Upstream' })).toBeChecked()
  await expect(capacity.getByRole('checkbox', { name: '100% for Business function' })).toBeChecked()
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
})

test('guide preview preserves paragraphs and personnel export requires saved edits', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft', reference_guides: { attestation: '1. Workbook confirmation.\n\n2. Review changes.' } }
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') Object.assign(draft, route.request().postDataJSON(), { revision: 2 })
    return route.fulfill({ json: route.request().method() === 'PUT' ? draft : { items: [draft] } })
  })
  await page.goto('/admin/bianca-config?tab=personnel')
  const download = page.getByRole('link', { name: 'Export to Excel', exact: true })
  await expect(download).toHaveAttribute('href', '/api/admin/bianca-config/versions/2/personnel.xlsx', { timeout: 45000 })
  await expect(download).not.toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('tab', { name: 'Guides and statements', exact: true }).click()
  await page.getByRole('textbox', { name: 'Attestation statement', exact: true }).fill('First paragraph.\n\nSecond paragraph.')
  const preview = page.getByRole('region', { name: 'Reading preview' })
  await expect(preview.getByText('First paragraph.', { exact: true })).toBeVisible()
  await expect(preview.getByText('Second paragraph.', { exact: true })).toBeVisible()
  await page.getByText('Workbook reference', { exact: true }).click()
  await page.getByRole('button', { name: 'Use workbook text', exact: true }).click()
  await expect(preview.getByText('2. Review changes.', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Personnel levels', exact: true }).click()
  await expect(download).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(download).not.toHaveAttribute('aria-disabled', 'true')
})

test('financial and non-financial matrices save their typed configuration', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft' }
  let saved: BiancaConfigPayload | undefined
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saved = body.payload
      Object.assign(draft, body, { revision: 2 })
      return route.fulfill({ json: draft })
    }
    return route.fulfill({ json: { items: [draft] } })
  })
  await page.goto('/admin/bianca-config?tab=impact&impact=financial-bands')
  await page.getByRole('textbox', { name: 'very_high description', exact: true }).fill('Review loss above IDR 4 billion.')
  const impact = page.getByRole('navigation', { name: 'Impact and MTD', exact: true })
  await impact.getByRole('button', { name: 'Regulatory impact matrix', exact: true }).click()
  await page.getByRole('textbox', { name: 'Regulatory score 3', exact: true }).fill('Breach of laws and regulations.')
  await impact.getByRole('button', { name: 'Customer impact matrix', exact: true }).click()
  await expect(page.getByText(/Exactly 20% is not defined/)).toBeVisible()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => saved?.financial_bands[0]?.description).toBe('Review loss above IDR 4 billion.')
  expect(saved?.impact_matrix[0]?.regulatory).toBe('Breach of laws and regulations.')
})

test('Changes shows only Recovery when only the recovery guide changes', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = {
    ...version(), id: 2, code: 'V2', status: 'draft', previous_version: 'V1',
    changes: [{ part: 'guides', path: ['guides', 'recovery'], change: 'changed', before: 'Original recovery guide.', after: 'Original recovery guide. tes tes', previous_version: 'V1', current_version: 'V2' }],
  }
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft] } }))
  await page.goto('/admin/bianca-config?tab=changes')
  const table = page.getByRole('table', { name: 'Changes to Guides and statements' })
  await expect(table.getByRole('row')).toHaveCount(2, { timeout: 45000 })
  await expect(table.getByRole('rowheader', { name: 'Recovery', exact: true })).toBeVisible()
  await expect(table.getByRole('cell', { name: 'Original recovery guide.', exact: true })).toBeVisible()
  await expect(table.getByRole('cell', { name: 'Original recovery guide. tes tes', exact: true })).toBeVisible()
  await expect(table.getByText(/Attestation|Customer|Suggested MTD/)).toHaveCount(0)
})

test('Changes separates fields in every nested configuration section', async ({ page }) => {
  await signIn(page, { permissions })
  const changes: BiancaConfigVersion['changes'] = [
    { part: 'guides', path: ['guides', 'recovery'], change: 'changed', before: 'Recovery old', after: 'Recovery new' },
    { part: 'guides', path: ['guides', 'attestation'], change: 'changed', before: 'Statement old', after: 'Statement new' },
    { part: 'frequencies', path: ['frequencies', 'Daily', 'label'], change: 'changed', before: 'Daily', after: 'Every day' },
    { part: 'staff_grades', path: ['staff_grades', 'staff_manager', 'max_level'], change: 'changed', before: 9, after: 10 },
    { part: 'expected_mtd', path: ['expected_mtd', '4 hours', 'category'], change: 'changed', before: 'Important', after: 'Business Critical' },
    { part: 'impact_matrix', path: ['impact_matrix', '3', 'regulatory'], change: 'changed', before: 'Old regulatory text', after: 'New regulatory text' },
    { part: 'financial_bands', path: ['financial_bands', 'high', 'description'], change: 'changed', before: 'Old band', after: 'New band' },
    { part: 'signoff_steps', path: ['signoff_steps', 'bcm_head', 'user_id'], change: 'changed', before: null, after: 8 },
    { part: 'signoff_steps', path: ['signoff_steps', 'group_head', '@order'], change: 'changed', before: 2, after: 3 },
    { part: 'signoff_steps', path: ['signoff_steps', 'head_of', '@order'], change: 'changed', before: 3, after: 2 },
    { part: 'scores', path: ['scores', '2'], change: 'removed', before: 2, after: null },
  ]
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft', previous_version: 'V1', changes }
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft] } }))
  await page.goto('/admin/bianca-config?tab=changes')
  await expect(page.getByRole('rowheader')).toHaveCount(changes.length, { timeout: 45000 })
  for (const name of ['Recovery', 'Attestation statement', 'Critical timing frequencies / Daily / Name', 'Personnel categories / staff_manager / Last U level', 'Expected MTD / 4 hours / Category', 'Regulatory and customer matrix / Score 3 / Regulatory impact', 'Financial loss matrix / high / Description', 'Sign-off steps / group_head / Order', 'Sign-off steps / head_of / Order']) {
    await expect(page.getByRole('rowheader', { name, exact: true })).toBeVisible()
  }
  const assigned = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Sign-off steps / bcm_head / Signer', exact: true }) })
  await expect(assigned.getByRole('cell', { name: 'Changed', exact: true })).toBeVisible()
  await expect(assigned.getByRole('cell', { name: 'Added', exact: true })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Removed', exact: true })).toHaveCount(1)
})

test('each section is a submenu: the sidebar opens it, keeps the draft, and sets the tab order', async ({ page }) => {
  await signIn(page, { permissions })
  // Administration > Menus moved Changes to the top and renamed Lists: the tabs follow.
  await page.route('**/api/me/menu', (route) => {
    const items = menuFor(permissions)
    const admin = items.find((item) => item.code === 'admin')!
    const group = admin.children.find((item) => item.code === 'admin.bianca-config')!
    const changes = group.children.find((item) => item.code === 'bianca_config.changes')!
    group.children = [changes, ...group.children.filter((item) => item !== changes)]
    group.children.find((item) => item.code === 'bianca_config.lists')!.label = 'Dropdown lists'
    return route.fulfill({ json: { items } })
  })
  const draft = { ...version(), id: 2, code: 'V2', status: 'draft' as const }
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, (route) => route.fulfill({ json: { items: [draft] } }))

  await page.goto('/admin/bianca-config')
  await expect(page).toHaveURL(/tab=versions/)
  const tabs = page.getByRole('tablist').first().getByRole('tab')
  await expect(tabs.first()).toHaveText('Changes')
  await expect(page.getByRole('tab', { name: 'Dropdown lists' })).toBeVisible()

  const sidebar = page.getByRole('navigation').first()
  await sidebar.getByRole('link', { name: 'Personnel levels' }).click()
  await expect(page).toHaveURL(/tab=personnel/)
  await expect(page.getByRole('tab', { name: 'Personnel levels' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('textbox', { name: /^Category name/ }).first().fill('Senior Leaders')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()

  // Another section from the sidebar: same page, the edit is still there, nothing asks.
  await sidebar.getByRole('link', { name: 'Dropdown lists' }).click()
  await expect(page).toHaveURL(/tab=lists/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Personnel levels' }).click()
  await expect(page.getByRole('textbox', { name: /^Category name/ }).first()).toHaveValue('Senior Leaders')
})

test('the old reminders address opens the Reminders and escalation section', async ({ page }) => {
  await signIn(page, { permissions: [...permissions, 'bianca.approval.manage'] })
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, (route) => route.fulfill({ json: { items: [version()] } }))
  await page.route('**/api/bianca/settings*', (route) => route.fulfill({ json: {} }))
  await page.goto('/admin/bia-reminders')
  await expect(page).toHaveURL(/\/admin\/bianca-config\?tab=reminders/)
  await expect(page.getByRole('tab', { name: 'Reminders and escalation' })).toHaveAttribute('aria-selected', 'true')
})
