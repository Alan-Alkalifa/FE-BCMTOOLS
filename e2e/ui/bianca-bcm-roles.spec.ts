import { test, expect } from '@playwright/test'
import { signIn } from '../fixtures/auth'
import type { BcmAssignment } from '../../app/utils/bianca-bcm-roles'

test('a master-data manager assigns an existing user and deactivates the assignment', async ({ page }) => {
  test.setTimeout(60000)
  await signIn(page, { permissions: ['masterdata.bcm_roles.manage'] })
  const user = { id: 64, username: 'directory64', employee_id: 'NIK64', display_name: 'Directory Staff', email: null, job_title: null, department: null, is_active: true }
  const rows: BcmAssignment[] = []
  await page.route('**/api/masterdata/bcm-roles/people*', (route) => route.fulfill({ json: { items: [user] } }))
  await page.route(/\/api\/masterdata\/bcm-roles(?:\/1)?(?:\?.*)?$/, (route) => {
    const request = route.request()
    if (request.method() === 'GET') return route.fulfill({ json: { items: rows } })
    const input = request.postDataJSON()
    expect(input.user_id).toBe(64)
    expect(input.role).toBe('bcm_admin')
    expect(input).not.toHaveProperty('employee_id')
    rows[0] = { id: 1, role: input.role, user, description: input.description, is_active: input.is_active }
    return route.fulfill({ json: rows[0] })
  })
  await page.goto('/masterdata/bcm-roles')
  await page.getByRole('tab', { name: 'BCM Admin' }).click()
  await page.getByRole('button', { name: 'Add assignment' }).click()
  const add = page.getByRole('dialog', { name: 'Add BCM Admin assignment' })
  await add.getByRole('button', { name: 'Directory user' }).click()
  await page.getByRole('option', { name: /Directory Staff/ }).click()
  await add.getByRole('textbox', { name: 'Description' }).fill('Continuity team')
  await add.getByRole('button', { name: 'Save assignment' }).click()
  const row = page.getByRole('row', { name: /NIK64/ })
  await row.getByRole('button', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit BCM Admin assignment' })
  await edit.getByRole('switch', { name: 'Active' }).click()
  await edit.getByRole('button', { name: 'Save assignment' }).click()
  await expect(row.getByText('Inactive', { exact: true })).toBeVisible()
})
