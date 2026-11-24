import { expect, test } from '@playwright/test'
import { ALL_PERMISSIONS, signIn } from '../fixtures/auth'

test('BIA organization edit preserves HR identity and saves mapping details', async ({ page }) => {
  test.setTimeout(60000)
  await signIn(page, { permissions: [...ALL_PERMISSIONS, 'masterdata.access', 'masterdata.organization.manage'] })
  let row = {
    id: null as number | null, directorate: 'Operations', sub_directorate: '', org_group: '', level: 'directorate',
    code: null as string | null, description: null as string | null, owner: null,
    source: 'hr', is_active: true, available: true,
  }
  await page.route('**/api/masterdata/organization/people*', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/masterdata/organization/changes*', (route) => route.fulfill({ json: { items: [], total: 0 } }))
  await page.route('**/api/masterdata/organization/detected*', (route) => route.fulfill({ json: { items: [] } }))
  await page.route(/\/api\/masterdata\/organization(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      expect(body.path.directorate).toBe('Operations')
      expect(body.unit.directorate).toBe('Operations')
      row = { ...row, id: 1, code: body.unit.code, description: body.unit.description }
      return route.fulfill({ json: row })
    }
    return route.fulfill({ json: { items: [row] } })
  })
  await page.goto('/masterdata/organization')
  await expect(page.getByRole('button', { name: 'Operations', exact: true })).toBeVisible({ timeout: 45000 })
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit directorate' })
  await expect(dialog.getByRole('textbox', { name: 'Directorate name' })).toBeDisabled()
  await expect(dialog.getByRole('switch', { name: 'Active' })).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Directorate code' }).fill('OPS')
  await dialog.getByRole('textbox', { name: 'Description' }).fill('BIA mapping')
  await dialog.getByRole('button', { name: 'Save unit' }).click()
  await expect(page.getByRole('cell', { name: 'BIA mapping' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', '/api/masterdata/organization/export.xlsx')
})

const PERMS = [...ALL_PERMISSIONS, 'masterdata.access', 'masterdata.organization.manage']
const unit = (level: string, directorate: string, sub = '', group = '', extra = {}) => ({
  id: null, level, directorate, sub_directorate: sub, org_group: group, code: null, description: null,
  owner: null, source: 'hr', is_active: true, available: true, employees: 3, waiting_hr: false, ...extra,
})

test('the structure reads as a tree, filters, and confirms a detected change into the history', async ({ page }) => {
  test.setTimeout(60000)
  await signIn(page, { permissions: PERMS })
  const units = [
    unit('directorate', 'Bank', '', '', { employees: 12 }),
    unit('sub_directorate', 'Bank', 'Ops'),
    unit('org_group', 'Bank', 'Ops', 'Net', { owner: { id: 5, name: 'Sari', email: 'sari@x.co.id' } }),
    unit('org_group', 'Bank', 'Ops', 'Pay'),
    unit('directorate', 'Finance'),
  ]
  const found = {
    id: 7, kind: 'move', level: 'org_group',
    previous: { directorate: 'Bank', sub_directorate: 'Ops', org_group: 'Net' },
    current: { directorate: 'Bank', sub_directorate: 'Infra', org_group: 'Net' },
    people_moved: 8, people_total: 10, import_file: 'hr.csv', detected_at: '2026-11-20T08:00:00', status: 'pending',
  }
  let confirmed: Record<string, unknown> | null = null
  await page.route(/\/api\/masterdata\/organization(?:\?.*)?$/, (route) => route.fulfill({ json: { items: units } }))
  await page.route('**/api/masterdata/organization/detected?*', (route) => route.fulfill({ json: { items: confirmed ? [] : [found] } }))
  await page.route('**/api/masterdata/organization/detected/7/confirm', (route) => {
    confirmed = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: {} })
  })
  await page.route('**/api/masterdata/organization/changes?*', (route) => route.fulfill({
    json: confirmed
      ? { total: 1, items: [{ ...found, id: 1, effective_date: '2026-11-20', reference: 'SK-9', note: null, source: 'hr_import', recorded_by: { id: 1, name: 'Test User' }, recorded_at: '2026-11-24T09:00:00' }] }
      : { total: 0, items: [] },
  }))

  await page.goto('/masterdata/organization')
  await expect(page.getByRole('button', { name: 'Expand Bank' })).toBeVisible({ timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Net', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Expand Bank' }).click()
  await page.getByRole('button', { name: 'Expand Ops' }).click()
  await expect(page.getByRole('button', { name: 'Net', exact: true })).toBeVisible()
  await expect(page.getByLabel('No assigned user: 4')).toBeVisible()

  // A filter opens the tree to its matches and keeps their parents.
  await page.getByRole('button', { name: 'Assigned user' }).click()
  await page.getByRole('option', { name: 'Has an assigned user' }).click()
  await expect(page).toHaveURL(/owner=set/)
  await expect(page.getByRole('button', { name: 'Net', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay', exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Finance', exact: true })).toBeHidden()

  await page.getByRole('tab', { name: /Detected changes/ }).click()
  await expect(page).toHaveURL(/tab=detected/)
  await expect(page.getByText('8 of 10 moved')).toBeVisible()
  await page.getByRole('button', { name: 'Act on the change of Bank › Ops › Net' }).click()
  await page.getByRole('menuitem', { name: 'Confirm…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm detected change' })
  await expect(dialog.getByRole('textbox', { name: 'Current sub directorate' })).toHaveValue('Infra')
  await expect(dialog.getByText('Moved', { exact: true })).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Reference' }).fill('SK-9')
  await dialog.getByRole('button', { name: 'Confirm change' }).click()
  await expect(dialog).toBeHidden()
  expect(confirmed).toMatchObject({ reference: 'SK-9', effective_date: '2026-11-20', current: { sub_directorate: 'Infra' } })

  await page.getByRole('tab', { name: 'Change history' }).click()
  await expect(page.getByText('1 change, latest effective date first.')).toBeVisible()
  await expect(page.getByRole('cell', { name: /Ops.*Infra/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Export to Excel' })).toHaveAttribute('href', /changes\/export\.xlsx/)
})
