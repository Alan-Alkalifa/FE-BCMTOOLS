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
  await expect(page).toHaveURL(/\/forbidden/, { timeout: 15000 })
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
