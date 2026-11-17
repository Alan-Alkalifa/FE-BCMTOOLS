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
    changes: [{ part: 'loss_alert_idr', before: 4000000000, after: 5000000000 }],
  }
  let saved: BiancaConfigPayload | undefined
  await page.route(/\/api\/admin\/bianca-config\/versions(?:\/.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saved = body.payload
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
  await page.getByRole('textbox', { name: 'Suggested MTD', exact: true }).fill('4 hours\n2 days')
  await expect(requestPublish).toBeDisabled()
  await lists.getByRole('button', { name: /^Yes \/ No codes/ }).click()
  await expect(page.getByRole('textbox', { name: 'Yes / No codes', exact: true })).toBeDisabled()

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
  await expect(diff.getByRole('columnheader', { name: 'Source version' })).toBeVisible()
  await expect(diff.getByRole('rowheader', { name: 'Financial loss alert (IDR)' })).toBeVisible()
  await expect(diff.getByRole('cell', { name: 'Changed', exact: true })).toBeVisible()
  await expect(diff.getByRole('cell', { name: '4.000.000.000', exact: true })).toBeVisible()
  await expect(diff.getByRole('cell', { name: '5.000.000.000', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(requestPublish).toBeEnabled()
  expect(saved?.suggested_mtd).toEqual(['4 hours', '2 days'])
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
  await expect(page.getByRole('textbox', { name: 'Suggested MTD', exact: true })).toBeDisabled()
  const tabs = page.getByRole('tablist')
  await expect.poll(() => tabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await expect.poll(() => main.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.getByRole('tab', { name: 'Changes', exact: true }).click()
  await expect(page.getByText('No saved parameter changes.')).toBeVisible()
})
