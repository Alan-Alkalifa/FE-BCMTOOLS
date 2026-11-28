import { test, expect } from '@playwright/test'
import { BCP_PERMISSIONS, bcpVersion, mockBcpConfig } from '../fixtures/bcp-config'

test.describe.configure({ timeout: 60000 })

test('opens from the sidebar and shows versions', async ({ page }) => {
  await mockBcpConfig(page)
  await page.goto('/admin/bcp-config')
  await expect(page.getByRole('heading', { name: 'BCP configuration' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('tab', { name: 'Level of disruption' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start draft' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Publish/ })).toHaveCount(0)
  await expect(page.getByText('V1 is active, so it is read-only.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Document map' })).toBeVisible()
})

test('request publish is disabled with problems', async ({ page }) => {
  const problem = 'Scope and triggers: X is not a BIA category (Business Critical).'
  await mockBcpConfig(page, { draft: bcpVersion('V2', 'draft', { problems: [problem], can: { edit: true, request_publish: false, withdraw_request: false, publish: false, discard: true } }) })
  await page.goto('/admin/bcp-config')
  await expect(page.getByText('Fix these before requesting the publish')).toBeVisible()
  await expect(page.getByText(problem)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request publish' })).toBeDisabled()
})

test('edits a glossary term and saves the draft', async ({ page }) => {
  const { calls } = await mockBcpConfig(page, { draft: bcpVersion('V2', 'draft', { revision: 4 }) })
  await page.goto('/admin/bcp-config?tab=glossary')
  const definition = page.getByRole('textbox', { name: 'Definition of Maximum Tolerable Downtime (MTD)' })
  await definition.fill('Waktu maksimum baru.')
  await page.getByRole('button', { name: 'Save glossary' }).click()
  await expect(page.getByText('Glossary saved', { exact: true })).toBeVisible()
  const put = calls.find((call) => call.method === 'PUT' && call.path.endsWith('/parts/glossary'))
  expect(put?.body).toMatchObject({ revision: 4, value: [{ code: 'mtd', definition: 'Waktu maksimum baru.' }, { code: 'rto' }] })
})

test('adding a level adds a column to the criteria matrix', async ({ page }) => {
  await mockBcpConfig(page, { draft: bcpVersion('V2', 'draft') })
  await page.goto('/admin/bcp-config?tab=lod')
  await page.getByRole('button', { name: 'Add level' }).click()
  await page.getByRole('textbox', { name: 'Name of level 6' }).fill('Purple')
  await expect(page.getByRole('columnheader', { name: 'Purple' })).toHaveCount(2)
})

test('publish button follows permission', async ({ page }) => {
  const requested = bcpVersion('V2', 'draft', {
    requested_by: 'Test User', requested_by_id: 1, requested_at: '2026-11-28T03:00:00Z',
    can: { edit: true, request_publish: false, withdraw_request: true, publish: false, discard: false },
  })
  await mockBcpConfig(page, { draft: requested, permissions: BCP_PERMISSIONS.filter((code) => code !== 'bcp.config.publish') })
  await page.goto('/admin/bcp-config?tab=scope')
  await expect(page.getByRole('button', { name: 'Withdraw request' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish V2' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save scope' })).toBeVisible()
})

test('a level saved in the draft but never published can still be removed', async ({ page }) => {
  const draft = bcpVersion('V2', 'draft')
  draft.payload.lod.levels.push({ code: 'purple', label: 'Purple', color: 'neutral' })
  for (const row of draft.payload.lod.criteria) row.descriptions.purple = ''
  for (const row of draft.payload.lod.activation) row.by_level.purple = ''
  draft.locked = { levels: ['amber', 'black', 'green', 'red', 'yellow'], conditions: ['k1_main_site'], columns: {} }
  await mockBcpConfig(page, { draft })
  await page.goto('/admin/bcp-config?tab=lod')
  await expect(page.getByRole('button', { name: 'Remove Purple' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Remove Black' })).toHaveCount(0)
})

test('the workaround tab lists the scenarios of each condition', async ({ page }) => {
  await mockBcpConfig(page, { draft: bcpVersion('V2', 'draft') })
  await page.goto('/admin/bcp-config?tab=workaround')
  await expect(page.getByText('Menggunakan lokasi kerja alternatif')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('link', { name: 'Edit in Master data' })).toHaveAttribute('href', '/masterdata/bcp-scenarios?condition=k1_main_site')
})
