import { test, expect, type Page } from '@playwright/test'
import { ALL_PERMISSIONS } from '../fixtures/auth'
import { ELIGIBLE, bcpPlan, bcpSummary, mockBcp } from '../fixtures/bcp'

test.describe.configure({ timeout: 60000 })

test('lists groups waiting to start and drafts', async ({ page }) => {
  await mockBcp(page, { eligible: [ELIGIBLE], drafts: [bcpSummary()] })
  await page.goto('/bcp/manage')
  await expect(page.getByRole('heading', { name: 'Waiting to start' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Create BCP for Trade Operations' })).toBeVisible()
  await expect(page.getByText('BCP-2026-0001')).toBeVisible()
  await expect(page.getByRole('row', { name: /BCP-2026-0001/ }).getByText('Draft')).toBeVisible()
})

test('create from waiting to start opens the record', async ({ page }) => {
  const { calls } = await mockBcp(page, { eligible: [ELIGIBLE] })
  await page.goto('/bcp/manage')
  await page.getByRole('button', { name: 'Create BCP for Trade Operations' }).click({ timeout: 30000 })
  await expect(page).toHaveURL(/\/bcp\/manage\/7$/, { timeout: 30000 })
  expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ bia_id: 11 })
})

test('new BCP without eligible groups explains why', async ({ page }) => {
  await mockBcp(page, { eligible: [] })
  await page.goto('/bcp/manage/new')
  await expect(page.getByText('No final BIA with a business critical function for your Group yet.')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Create BCP' })).toBeDisabled()
})

test('New BCP is hidden without bcp.create', async ({ page }) => {
  await mockBcp(page, { permissions: [...ALL_PERMISSIONS, 'bcp.access'] })
  await page.goto('/bcp/manage')
  await expect(page.getByRole('heading', { name: 'Manage BCPs' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('link', { name: 'New BCP' })).toHaveCount(0)
})

test('summary saves the BCP name', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7')
  const name = page.getByRole('textbox', { name: 'BCP name' })
  await expect(name).toHaveValue('Trade Operations', { timeout: 30000 })
  await expect(page.getByText('BIA-2026-0001').first()).toBeVisible()
  await expect(page.getByText('RTO > MTD')).toBeVisible()
  await name.fill('BCP Trade Operations')
  await page.getByRole('button', { name: 'Save summary' }).click()
  await expect(page.getByText('Summary saved', { exact: true })).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT')).toMatchObject({ path: '/api/bcp/plans/7/summary', body: { revision: 3, name: 'BCP Trade Operations' } })
})

test('summary needs a BCP name', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7')
  const name = page.getByRole('textbox', { name: 'BCP name' })
  await expect(name).toHaveValue('Trade Operations', { timeout: 30000 })
  await name.fill('  ')
  await page.getByRole('button', { name: 'Save summary' }).click()
  await expect(page.getByText('Enter the BCP name.')).toBeVisible()
  expect(calls.some((call) => call.method === 'PUT')).toBe(false)
})

test('edits a procedure and saves the condition', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7?tab=k1_main_site')
  await page.getByRole('button', { name: 'Actions for Menggunakan lokasi kerja alternatif' }).click({ timeout: 30000 })
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('textbox', { name: 'Procedure', exact: true }).fill('- Pindah ke Griya Niaga 2')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Save condition 1' }).click()
  await expect(page.getByText('Condition saved', { exact: true })).toBeVisible()
  const put = calls.find((call) => call.method === 'PUT')
  expect(put?.path).toBe('/api/bcp/plans/7/conditions/k1_main_site')
  expect(put?.body).toMatchObject({ revision: 3, rows: [{ id: 101, procedure: '- Pindah ke Griya Niaga 2', functions: 'all' }] })
})

test('adds a manual procedure for selected functions', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7?tab=k1_main_site')
  await page.getByRole('button', { name: 'Add procedure' }).click({ timeout: 30000 })
  await page.getByRole('textbox', { name: 'Scenario', exact: true }).fill('Akses gedung dibatasi')
  await page.getByRole('radio', { name: 'Selected functions' }).check()
  await page.getByRole('checkbox', { name: 'Kliring' }).check()
  await page.getByRole('textbox', { name: 'Procedure', exact: true }).fill('- Kerja bergiliran')
  await page.getByRole('textbox', { name: 'PIC', exact: true }).fill('Ketua RTF')
  await page.getByRole('button', { name: 'Apply' }).click()
  await page.getByRole('button', { name: 'Save condition 1' }).click()
  await expect(page.getByText('Condition saved', { exact: true })).toBeVisible()
  const body = calls.find((call) => call.method === 'PUT')?.body as { rows: { scenario_name: string, functions: unknown, id: unknown }[] }
  expect(body.rows.at(-1)).toMatchObject({ id: null, scenario_name: 'Akses gedung dibatasi', functions: [21] })
})

test('fills the system fields of condition 2', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7?tab=k2_system_network')
  await page.getByRole('textbox', { name: 'Core System (A) of Kliring' }).fill('SIBS-ETP', { timeout: 30000 })
  await page.getByRole('button', { name: 'Save condition 2' }).click()
  await expect(page.getByText('Condition saved', { exact: true })).toBeVisible()
  const body = calls.find((call) => call.method === 'PUT')?.body as { fields: unknown[] }
  expect(body.fields).toContainEqual({ function_id: 21, values: { core_banking: 'SIBS-ETP', other_system: '' } })
})

test('a viewer sees the BCP read-only', async ({ page }) => {
  await mockBcp(page, { plan: bcpPlan({ permissions: { can_edit: false, can_view: true } }) })
  await page.goto('/bcp/manage/7')
  await expect(page.getByRole('textbox', { name: 'BCP name' })).toBeDisabled({ timeout: 30000 })
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0)
})

test('unsaved changes ask before switching tab', async ({ page }) => {
  await mockBcp(page)
  await page.goto('/bcp/manage/7')
  await page.getByRole('textbox', { name: 'BCP name' }).fill('Berubah', { timeout: 30000 })
  await page.getByRole('tab', { name: /Kondisi 1/ }).click()
  await expect(page.getByText('Discard unsaved changes?')).toBeVisible()
})

async function pickUser(page: Page, field: string, name: string) {
  await page.getByRole('button', { name: field }).click()
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

test('uploads and removes the attachment', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7')
  await expect(page.getByRole('button', { name: 'Upload attachment' })).toBeVisible({ timeout: 30000 })
  await page.getByLabel('BCP attachment file').setInputFiles({ name: 'Lampiran BCP.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK') })
  await expect(page.getByRole('link', { name: 'Lampiran BCP.docx' })).toBeVisible()
  expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/attachment'))).toBe(true)
  await page.getByRole('button', { name: 'Remove the attachment' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Upload attachment' })).toBeVisible()
})

test('picks signers and saves the summary', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7')
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('Bernard Budidharma')).toBeVisible()
  await pickUser(page, 'Signer of Approval by: Head of terkait', 'Sari Signer')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Save summary' }).click()
  await expect(page.getByText('Summary saved', { exact: true })).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ signoff_users: { rtf_lead: 41, head_of: 43 } })
})

test('tabs show what is missing and submit lists it', async ({ page }) => {
  await mockBcp(page, { plan: bcpPlan({ missing: { summary: ['Choose the signer for Approval by: Head of terkait.'], k1_main_site: [], k2_system_network: ['Core System (A) of Kliring is required.', 'Other System (B) of Kliring is required.'] } }) })
  await page.goto('/bcp/manage/7')
  await expect(page.getByRole('tab', { name: /Kondisi 2\s*2/ })).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: 'Submit for approval' }).click()
  await expect(page.getByText('Not ready yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: /Notifications/ }).getByText('Kondisi 2: Core System (A) of Kliring is required.')).toBeVisible()
})

test('submit waits for unsaved changes', async ({ page }) => {
  await mockBcp(page)
  await page.goto('/bcp/manage/7')
  const name = page.getByRole('textbox', { name: 'BCP name' })
  await expect(name).toHaveValue('Trade Operations', { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeEnabled()
  await name.fill('BCP Trade Operations')
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
})

test('submits a complete BCP', async ({ page }) => {
  const { calls } = await mockBcp(page)
  await page.goto('/bcp/manage/7')
  await page.getByRole('button', { name: 'Submit for approval' }).click({ timeout: 30000 })
  await page.getByRole('dialog').getByRole('button', { name: 'Submit for approval' }).click()
  await expect(page.getByText('Submitted for approval', { exact: true })).toBeVisible()
  expect(calls.find((call) => call.path.endsWith('/submit'))?.body).toEqual({ revision: 3 })
  await expect(page.getByText('Submitted: waiting for Disiapkan oleh: Ketua RTF')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save summary' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toHaveCount(0)
})

test('workflow history lists the events', async ({ page }) => {
  await mockBcp(page)
  await page.goto('/bcp/manage/7?tab=history')
  await expect(page.getByRole('heading', { name: 'Workflow History' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('cell', { name: 'Saved Kondisi 1' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Created', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0)
})

test('an invalid BCP shows its reason read-only', async ({ page }) => {
  await mockBcp(page, { plan: bcpPlan({ status: 'invalid', can_submit: false, permissions: { can_edit: false, can_view: true }, invalid_reason: 'Organization change: Operations / Central Operations renamed on 28 Nov 2026' }) })
  await page.goto('/bcp/manage/7')
  await expect(page.getByText('Organization change: Operations / Central Operations renamed on 28 Nov 2026', { exact: false })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Save summary' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toHaveCount(0)
})

test('a BCP no longer required shows a warning', async ({ page }) => {
  await mockBcp(page, { plan: bcpPlan({ no_longer_required: { bia_ref_no: 'BIA-2026-0040', finalised_at: '2026-11-25T02:00:00Z' } }) })
  await page.goto('/bcp/manage/7')
  await expect(page.getByText('BIA-2026-0040 has no business critical function. This BCP stays for reference.')).toBeVisible({ timeout: 30000 })
})

test('a stale submit reloads the BCP so the retry works', async ({ page }) => {
  const { calls } = await mockBcp(page, { conflictOnSubmit: true })
  await page.goto('/bcp/manage/7')
  await page.getByRole('button', { name: 'Submit for approval' }).click({ timeout: 30000 })
  await page.getByRole('dialog').getByRole('button', { name: 'Submit for approval' }).click()
  await expect(page.getByText('This BCP changed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Submit for approval' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit for approval' }).click()
  await expect(page.getByText('Submitted for approval', { exact: true })).toBeVisible()
  const submits = calls.filter((call) => call.path.endsWith('/submit')).map((call) => call.body)
  expect(submits).toEqual([{ revision: 3 }, { revision: 4 }])
})
