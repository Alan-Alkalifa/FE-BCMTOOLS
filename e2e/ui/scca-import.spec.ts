import { expect, test } from '@playwright/test'
import { signIn } from '../fixtures/auth'
import { assessment, mockScca } from '../fixtures/scca'

test.setTimeout(90_000)

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const workbook = (name: string) => ({ name, mimeType: XLSX, buffer: Buffer.from('PK workbook') })

const PREVIEW = {
  file: { name: 'cc-omni.xlsx', size: 1000 },
  version: 'V4.2',
  application: { name: 'CC Omni Channel', code: null, matched: null },
  header: {},
  assessment_reason: null,
  due_date: null,
  ratings: { read: 17, total: 18, missing: ['P4'], unjustified: [] },
  result: null,
  interdependencies: [
    { direction: 'upstream', cell: 'B9', name: 'Core Banking', application: { id: 3, application_code: 'CBS', application_name: 'Core Banking' }, status: 'ready', reason: null },
    { direction: 'upstream', cell: 'B10', name: 'HR Portal', application: null, status: 'left_out', reason: 'HR has no final SCCA yet.' },
  ],
  recovery: [
    { kind: 'current_it', label: 'Current IT committed values', filled: 6 },
    { kind: 'business', label: 'Business requirements', filled: 5 },
    { kind: 'regulatory', label: 'Regulatory requirements', filled: 0 },
    { kind: 'final', label: 'Final system characteristics', filled: 6 },
  ],
  problems: [
    { level: 'warning', sheet: 'SCC_Rating', cell: null, message: '1 question not rated (P4): rate them in the form before you submit.' },
    { level: 'warning', sheet: 'A3 Interdependency', cell: 'B10', message: 'Upstream HR Portal is left out. HR has no final SCCA yet.' },
  ],
  errors: 0,
  warnings: 2,
  can_import: true,
}

test('a new assessment is created from the filled template', async ({ page }) => {
  await mockScca(page)
  const sent: string[] = []
  await page.route('**/api/scca/imports/preview', (route) => route.fulfill({ json: PREVIEW }))
  await page.route('**/api/scca/imports', async (route) => {
    sent.push(route.request().postData() ?? '')
    await route.fulfill({ status: 201, json: assessment({ id: 9, ref_no: 'SCCA-2026-0009' }) })
  })
  await page.goto('/scca/manage/new')
  await page.getByRole('button', { name: 'Upload Excel' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Upload Excel' })
  await expect(dialog.getByRole('link', { name: 'Download template' })).toHaveAttribute('href', '/api/scca/imports/template')

  await dialog.getByLabel('Choose the SCCA workbook').setInputFiles(workbook('cc-omni.xlsx'))
  await expect(dialog.getByText('17 of 18')).toBeVisible()
  await expect(dialog.getByText('1 left out')).toBeVisible()
  await expect(dialog.getByText('Upstream HR Portal is left out. HR has no final SCCA yet.')).toBeVisible()
  await expect(dialog.getByText('The workbook can be imported')).toBeVisible()
  // The form's choices still have to be made.
  await expect(dialog.getByText('Pick the reason for assessment.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create draft' })).toBeDisabled()

  await dialog.getByRole('combobox', { name: 'Reason for assessment' }).click()
  await page.getByRole('option', { name: 'New application' }).click()
  await dialog.getByLabel('Application code').fill('CCNEW')
  await dialog.getByLabel('Application name').fill('CC New')
  await dialog.getByRole('button', { name: 'Create draft' }).click()
  await expect(page).toHaveURL(/\/scca\/manage\/9\?tab=rating$/)
  expect(sent[0]).toContain('"application_code":"CCNEW"')
  expect(sent[0]).toContain('"assessment_reason":"new_application"')
})

test('a workbook with errors, or not the template, is not imported', async ({ page }) => {
  await mockScca(page)
  let call = 0
  await page.route('**/api/scca/imports/preview', (route) => {
    call += 1
    if (call === 1) {
      return route.fulfill({ status: 422, json: { error: 'validation_failed', details: { file: 'This isn\'t the BCM Tools SCCA template. Download the current template (New assessment > Upload Excel) and fill that in.' } } })
    }
    return route.fulfill({
      json: {
        ...PREVIEW,
        errors: 1,
        can_import: false,
        problems: [{ level: 'error', sheet: 'SCC_Rating', cell: 'E12', message: 'C1: "Very high" is not a rating. Pick one of: 5.Critical, 4.High.' }],
      },
    })
  })
  await page.goto('/scca/manage/new')
  await page.getByRole('button', { name: 'Upload Excel' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Upload Excel' })
  await dialog.getByLabel('Choose the SCCA workbook').setInputFiles(workbook('old.xlsx'))
  await expect(dialog.getByText('This isn\'t the BCM Tools SCCA template.', { exact: false })).toBeVisible()
  await dialog.getByLabel('Choose the SCCA workbook').setInputFiles(workbook('bad.xlsx'))
  await expect(dialog.getByText('1 thing to fix in the workbook')).toBeVisible()
  await expect(dialog.getByText('SCC_Rating · E12')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create draft' })).toBeDisabled()
})

test('an open draft is replaced from the template; a migrated SCCA says where it came from', async ({ page }) => {
  const current = assessment({
    migrated: { at: '2026-11-12T02:00:00Z', approved_outside_on: null, record_only: false, workbook: { id: 4, filename: 'cc-omni-2024.xlsx', size: 1000 } },
  })
  await mockScca(page, current)
  await page.route('**/api/scca/assessments/1/import/preview', (route) => route.fulfill({ json: PREVIEW }))
  let replaced = false
  await page.route('**/api/scca/assessments/1/import', (route) => {
    replaced = true
    return route.fulfill({ json: current })
  })
  await page.goto('/scca/manage/1')
  await expect(page.getByText('Brought in from a workbook as a draft')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Original workbook' })).toHaveAttribute('href', '/api/scca/assessments/1/attachments/4')
  await page.getByRole('button', { name: 'Upload Excel' }).click()
  const dialog = page.getByRole('dialog', { name: 'Replace this draft from Excel' })
  await dialog.getByLabel('Choose the SCCA workbook').setInputFiles(workbook('cc-omni.xlsx'))
  await dialog.getByRole('button', { name: 'Replace draft' }).click()
  await expect.poll(() => replaced).toBe(true)
})

const ITEM = {
  file: 'cc-omni-2024.xlsx',
  state: 'ready',
  outcome: 'final',
  message: null,
  reasons: [],
  application: { id: null, application_code: 'CCOMNI', application_name: 'CC Omni Channel', new: true },
  assessment_date: '2024-03-04',
  approved_on: '2024-03-20',
  due_date: null,
  assessment_reason: null,
  assessor: { name: 'Desy Marina', user: null },
  people: [{ box: 1, name: 'Kurniawati', designation: 'CCBD Head', user: null }],
  category: 'Critical',
  ratings: { read: 18, total: 18, missing: [], unjustified: [] },
  interdependencies: [],
  problems: [{ level: 'info', sheet: 'SCC_Result', cell: 'O35', message: 'The CIMBN recovery architecture standard block comes from the configuration, not from the workbook.' }],
}
const RUN = {
  id: 7,
  created_at: '2026-11-12T02:00:00Z',
  created_by: { id: 1, display_name: 'Test User', email: 'test@example.com' },
  imported: 1,
  skipped: 0,
  failed: 0,
  finished: true,
  undone_at: null,
  undone_by: null,
  can_undo: true,
  undo_until: '2026-11-19T02:00:00Z',
  items: [{ file: 'cc-omni-2024.xlsx', state: 'imported', outcome: 'final', id: 31, ref_no: 'SCCA-2024-0001', application_code: 'CCOMNI', links: { saved: 2, left_out: [], without_final: ['HR Portal'] } }],
}

test('the administrator reviews the signed workbooks, imports the ready ones and can undo the run', async ({ page }) => {
  await signIn(page)
  const calls: string[] = []
  let runs: unknown[] = []
  const base = '**/api/admin/scca-migration'
  await page.route(`${base}/runs`, (route) => route.fulfill({ json: { items: runs } }))
  await page.route(`${base}/preview`, (route) => {
    const name = /filename="([^"]+)"/.exec(route.request().postData() ?? '')?.[1]
    if (name === 'no-code.xlsx') {
      return route.fulfill({ json: { items: [{ ...ITEM, file: name, state: 'blocked', outcome: 'final', application: null, message: 'No application: give its application code in the manifest.' }] } })
    }
    return route.fulfill({ json: { items: [ITEM] } })
  })
  await page.route(`${base}/runs/start`, (route) => {
    calls.push('start')
    return route.fulfill({ status: 201, json: { ...RUN, finished: false, imported: 0, items: [] } })
  })
  await page.route(`${base}/runs/7/files`, (route) => {
    calls.push('add')
    return route.fulfill({ json: { items: RUN.items } })
  })
  await page.route(`${base}/runs/7/finish`, (route) => {
    calls.push('finish')
    runs = [RUN]
    return route.fulfill({ json: RUN })
  })
  await page.route(`${base}/runs/7/undo`, (route) => {
    calls.push('undo')
    runs = [{ ...RUN, undone_at: '2026-11-12T03:00:00Z', can_undo: false }]
    return route.fulfill({ json: runs[0] })
  })

  await page.goto('/admin/scca-migration')
  await expect(page.getByRole('heading', { name: 'SCCA migration' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Empty manifest' })).toHaveAttribute('href', '/api/admin/scca-migration/manifest')
  await page.getByLabel('Choose the SCCA workbooks').setInputFiles([workbook('cc-omni-2024.xlsx'), workbook('no-code.xlsx')])
  await expect(page.getByText('1 ready (1 final, 0 draft, 0 record) · 1 need a fix · 0 skipped · 0 can\'t be read')).toBeVisible()
  await expect(page.getByText('CCOMNI · new application')).toBeVisible()
  await expect(page.getByText('No application: give its application code in the manifest.')).toBeVisible()
  await page.getByRole('button', { name: 'cc-omni-2024.xlsx' }).click()
  await expect(page.getByText('(no BCM Tools user: kept as text)')).toBeVisible()

  await page.getByRole('button', { name: 'Import 1 SCCA' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('heading', { name: 'Run 7: 1 imported, 0 failed' })).toBeVisible()
  expect(calls).toEqual(['start', 'add', 'finish'])
  await expect(page.getByRole('link', { name: 'SCCA-2024-0001' })).toHaveAttribute('href', '/scca/monitoring/31')
  await expect(page.getByText('Kept with the workbook\'s values (no final SCCA): HR Portal.')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Undo run' }).click()
  await expect(page.getByText(/^Undone /)).toBeVisible()
  expect(calls.at(-1)).toBe('undo')
})
