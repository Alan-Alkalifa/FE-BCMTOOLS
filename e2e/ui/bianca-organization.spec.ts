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
