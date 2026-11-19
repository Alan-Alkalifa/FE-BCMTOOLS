import { test, expect } from '@playwright/test'
import { signIn, ALL_PERMISSIONS } from '../fixtures/auth'
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
  await page.getByRole('spinbutton', { name: 'First U level (optional)', exact: true }).last().fill('12')
  await page.getByRole('spinbutton', { name: 'Last U level (optional)', exact: true }).last().fill('13')
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
    const category = page.getByRole('group', { name: 'Category 1: Senior Management', exact: true })
    await expect(category).toBeVisible({ timeout: 45000 })
    const remove = category.getByRole('button', { name: 'Remove category Senior Management', exact: true })
    const active = category.getByRole('switch', { name: 'Active', exact: true })
    const arrow = category.getByRole('button', { name: 'Move Senior Management down', exact: true })
    const code = category.getByRole('textbox', { name: /^Code/ })
    const boxes = await Promise.all([remove.boundingBox(), active.boundingBox(), arrow.boundingBox(), code.boundingBox()])
    expect(boxes.every(Boolean)).toBe(true)
    if (width > 1000) {
      expect(boxes[0]!.x).toBeGreaterThan(boxes[1]!.x + boxes[1]!.width)
      expect(boxes[2]!.x + boxes[2]!.width).toBeLessThan(boxes[3]!.x)
    }
    await category.screenshot({ path: test.info().outputPath(`personnel-${width}.png`) })
    await arrow.click()
    await expect(page.getByRole('group', { name: 'Category 2: Senior Management', exact: true })).toBeVisible()
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
  const config = payload()
  config.staff_grades.push({ code: 'specialists', label: 'Specialist Support', min_level: 12, max_level: 13, active: true, requires_note: false })
  await page.route('**/api/bianca/**', (route) => {
    if (route.request().url().includes('/lookups')) {
      return route.fulfill({ json: { ...config, personnel_grades: config.staff_grades, staff_grades: {}, config_version_id: 2, config_version: 'V2', organisation: { directorate: 'Dir', sub_directorate: 'Sub', org_group: 'Group' } } })
    }
    if (route.request().url().includes('/calculate')) return route.fulfill({ json: { functions: [], total_staff: 0, loss_totals: [0, 0], loss_alerts: [false, false] } })
    return route.fulfill({ json: { items: [] } })
  })
  await page.goto('/bianca/manage/new')
  await page.getByRole('tab', { name: 'RA questionnaire', exact: true }).click()
  const count = page.getByRole('spinbutton', { name: 'Specialist Support (U12–U13)', exact: true })
  await count.fill('7')
  await expect(page.getByText('(configured categories · V2)', { exact: true })).toBeVisible()
  await expect(page.getByText('7', { exact: true })).toBeVisible()
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

  await page.goto('/admin/bianca-config?version=2&tab=lists&list=suggested_mtd')
  const versionSelect = page.getByRole('combobox', { name: 'Configuration version' })
  const requestPublish = page.getByRole('button', { name: 'Request publish', exact: true })
  await expect(versionSelect).toHaveText(/V2/, { timeout: 45000 })
  await expect(requestPublish).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Discard draft', exact: true })).toBeEnabled()

  const lists = page.getByRole('navigation', { name: 'Lists', exact: true })
  await expect(lists.getByRole('button', { name: /^Suggested MTD/ })).toHaveAttribute('aria-current', 'page')
  const choices = page.getByRole('table', { name: 'Suggested MTD items' })
  await expect(choices.getByRole('textbox', { name: 'Code 2' })).toHaveValue('1 day')
  await choices.getByRole('switch', { name: 'Item 2 active' }).uncheck()
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await choices.getByRole('textbox', { name: 'Code 3' }).fill('2 days')
  await choices.getByRole('textbox', { name: 'Label 3' }).fill('Two days')
  await choices.getByRole('textbox', { name: 'Text 3' }).fill('Within two days')
  await choices.getByRole('button', { name: 'Move item 3 up' }).click()
  await choices.getByRole('button', { name: 'Move item 2 up' }).click()
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await choices.getByRole('button', { name: 'Remove item 4' }).click()
  await expect(requestPublish).toBeDisabled()
  await lists.getByRole('button', { name: /^Yes \/ No codes/ }).click()
  const fixed = page.getByRole('table', { name: 'Yes / No codes items' })
  await expect(fixed.getByRole('textbox', { name: 'Code 1' })).toBeDisabled()
  await expect(fixed.getByRole('switch', { name: 'Item 1 active' })).toBeDisabled()
  await expect(fixed.getByRole('textbox', { name: 'Label 1' })).toBeEditable()

  await page.getByRole('tab', { name: 'Impact and MTD', exact: true }).click()
  const impact = page.getByRole('navigation', { name: 'Impact and MTD', exact: true })
  await impact.getByRole('button', { name: 'Time conversion', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Hours per day' })).toBeVisible()
  await impact.getByRole('button', { name: 'Expected MTD', exact: true }).click()
  await page.getByRole('button', { name: 'Add MTD', exact: true }).click()
  await page.getByRole('textbox', { name: 'Expected MTD 2', exact: true }).fill('2 days')

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
  expect(saved?.suggested_mtd).toEqual(['2 days', '4 hours'])
  expect(listsSent?.suggested_mtd).toEqual([
    { code: '2 days', label: 'Two days', text: 'Within two days', active: true },
    { code: '4 hours', label: '4 hours', text: null, active: true },
    { code: '1 day', label: '1 day', text: null, active: false },
  ])
  expect(saved?.expected_mtd[1]).toEqual({ value: '2 days', category: 'Others' })
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
  await menu.getByRole('button', { name: /^Suggested MTD/ }).click()
  await expect(page.getByRole('table', { name: 'Suggested MTD items' }).getByRole('textbox', { name: 'Code 1' })).toBeDisabled()
  const tabs = page.getByRole('tablist')
  await expect.poll(() => tabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await expect.poll(() => main.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.getByRole('tab', { name: 'Changes', exact: true }).click()
  await expect(page.getByText('No saved parameter changes.')).toBeVisible()
})

test('workbook lists distinguish IDs, stored values, string choices and integer scores', async ({ page }) => {
  await signIn(page, { permissions })
  const draft: BiancaConfigVersion = { ...version(), id: 2, code: 'V2', status: 'draft', list_items: {
    yes_no: [{ id: '1', code: 'Yes', value: 'Yes', data_type: 'string', label: 'Yes', text: null, active: true },
      { id: '0', code: 'No', value: 'No', data_type: 'string', label: 'No', text: null, active: true }],
  } }
  await page.route('**/api/admin/bianca-config/versions', (route) => route.fulfill({ json: { items: [draft] } }))
  await page.goto('/admin/bianca-config?tab=lists&list=yes_no')
  const table = page.getByRole('table', { name: 'Yes / No codes items' })
  await expect(table).toBeVisible({ timeout: 45000 })
  for (const label of ['ID', 'Code', 'Value', 'Data type']) await expect(table.getByRole('columnheader', { name: label, exact: true })).toBeVisible()
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(3)).toHaveText('Yes')
  await expect(table.getByRole('cell', { name: '0', exact: true })).toBeVisible()
  await expect(table.getByText('string', { exact: true })).toHaveCount(2)
  const menu = page.getByRole('navigation', { name: 'Lists', exact: true })
  for (const label of ['Downstream capacity', 'Expected business support capacity', 'Generic percentages']) {
    await menu.getByRole('button', { name: new RegExp('^' + label) }).click()
    await expect(page.getByRole('table').getByRole('textbox', { name: 'Code 3' })).toHaveValue('NA')
  }
  await menu.getByRole('button', { name: /^Expected MTD reference/ }).click()
  await expect(page.getByRole('cell', { name: 'Reference only', exact: true })).toHaveCount(2)
  await menu.getByRole('button', { name: /^Impact scores/ }).click()
  await expect(page.getByRole('cell', { name: 'integer', exact: true })).toHaveCount(3)
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
  await page.getByRole('navigation', { name: 'Impact and MTD', exact: true }).getByRole('button', { name: 'Regulatory and customer matrix', exact: true }).click()
  await page.getByRole('textbox', { name: 'Regulatory score 3', exact: true }).fill('Breach of laws and regulations.')
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
  for (const name of ['Recovery', 'Attestation statement', 'Critical timing frequencies / Daily / Label', 'Personnel categories / staff_manager / Last U level', 'Expected MTD / 4 hours / Category', 'Regulatory and customer matrix / Score 3 / Regulatory impact', 'Financial loss matrix / high / Description', 'Sign-off steps / group_head / Order', 'Sign-off steps / head_of / Order']) {
    await expect(page.getByRole('rowheader', { name, exact: true })).toBeVisible()
  }
  const assigned = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Sign-off steps / bcm_head / Signer', exact: true }) })
  await expect(assigned.getByRole('cell', { name: 'Changed', exact: true })).toBeVisible()
  await expect(assigned.getByRole('cell', { name: 'Added', exact: true })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Removed', exact: true })).toHaveCount(1)
})
