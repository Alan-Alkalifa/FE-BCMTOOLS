import { expect, test } from '@playwright/test'
import { signIn } from '../fixtures/auth'

test.setTimeout(90_000)

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const workbook = (name: string) => ({ name, mimeType: XLSX, buffer: Buffer.from('PK workbook') })

// What the API says of the signed Griya CIMB Niaga 2 workbook, a building new to BCM Tools.
const ITEM = {
  file: 'griya-2025.xlsx',
  state: 'ready',
  outcome: 'final',
  message: null,
  reasons: [],
  kind: 'head_office',
  kind_label: 'Head office building',
  template: 'HO Risk Assessment Location – Version 2025 – r4',
  building: { id: null, code: null, name: 'Griya CIMB Niaga 2', kind: 'head_office', new: true, province: 'Banten', city: 'Tangerang Selatan', district: 'Pondok Aren', zip_code: '15224' },
  assessment_date: '2025-03-10',
  approved_on: '2025-03-20',
  due_date: '2026-03-10',
  period_year: 2025,
  reason: 'new_building',
  lic: { name: 'Legiran', user: null },
  licom: { name: 'Crispina Arumardi', user: { id: 12, display_name: 'Crispina Arumardi', email: 'crispina@example.co.id' } },
  people: [
    { box: 1, heading: 'Prepared by', name: 'Legiran', designation: 'LIC', signed_on: null, user: null },
    { box: 4, heading: 'Acknowledge by', name: 'Bernard Budidharma', designation: 'BCM Head', signed_on: null, user: { id: 3, display_name: 'Bernard Budidharma', email: 'bernard@example.co.id' } },
  ],
  ratings: { total: 33, rated: 33, counts: { gross: {}, residual: { Medium: 5, Low: 10 } } },
  problems: [{ sheet: 'LCP-Call Tree', cell: 'F12', message: 'Mobile missing, kept as "-".' }],
}
const RUN = {
  id: 4,
  created_at: '2026-11-18T03:00:00Z',
  created_by: { id: 1, display_name: 'Test User', email: 'test@example.com' },
  imported: 2,
  skipped: 0,
  failed: 0,
  finished: true,
  undone_at: null,
  undone_by: null,
  can_undo: true,
  undo_until: '2026-11-25T03:00:00Z',
  items: [
    { file: 'griya-2025.xlsx', state: 'imported', outcome: 'final', id: 41, kind: 'head_office', ref_no: 'RA-2025-0001', location_id: 9, location_code: 'HO-0009', location_name: 'Griya CIMB Niaga 2', location_created: true, reasons: [] },
    { file: 'kcp-bogor.xlsx', state: 'imported', outcome: 'draft', id: 42, kind: 'branch', ref_no: 'RAB-2025-0001', location_id: 3, location_code: 'BR-0003', location_name: 'KCP Bogor', location_created: false, reasons: ['30 of 33 hazards not rated.'] },
  ],
}

test('the administrator reviews signed RA workbooks, imports the ready ones and can undo the run', async ({ page }) => {
  await signIn(page)
  const calls: string[] = []
  let runs: unknown[] = []
  const base = '**/api/admin/ra-migration'
  await page.route(`${base}/runs`, (route) => route.fulfill({ json: { items: runs } }))
  await page.route(`${base}/preview`, (route) => {
    const body = route.request().postData() ?? ''
    const name = /filename="([^"]+)"/.exec(body)?.[1]
    const draft = body.includes('"draft":["kcp-bogor.xlsx"]')
    if (name === 'no-address.xlsx') {
      return route.fulfill({ json: { items: [{ ...ITEM, file: name, state: 'blocked', message: 'Griya Baru isn\'t in BCM Tools yet. A new building needs its province, city, district in the manifest (or give its Building ID).', building: { ...ITEM.building, name: 'Griya Baru' } }] } })
    }
    if (name === 'kcp-bogor.xlsx') {
      return route.fulfill({ json: { items: [{
        ...ITEM,
        file: name,
        kind: 'branch',
        kind_label: 'Branch',
        outcome: draft ? 'draft' : 'final',
        reasons: draft ? ['Imported as a draft, as chosen.'] : [],
        reason: 'annual_review',
        building: { id: 3, code: 'BR-0003', name: 'KCP Bogor', kind: 'branch', new: false },
      }] } })
    }
    return route.fulfill({ json: { items: [ITEM] } })
  })
  await page.route(`${base}/runs/start`, (route) => {
    calls.push('start')
    return route.fulfill({ status: 201, json: { ...RUN, finished: false, imported: 0, items: [] } })
  })
  await page.route(`${base}/runs/4/files`, (route) => {
    calls.push('add')
    return route.fulfill({ json: { items: [] } })
  })
  await page.route(`${base}/runs/4/finish`, (route) => {
    calls.push('finish')
    runs = [RUN]
    return route.fulfill({ json: RUN })
  })
  await page.route(`${base}/runs/4/undo`, (route) => {
    calls.push('undo')
    runs = [{ ...RUN, undone_at: '2026-11-19T03:00:00Z', can_undo: false }]
    return route.fulfill({ json: runs[0] })
  })

  await page.goto('/admin/ra-migration')
  await expect(page.getByRole('heading', { name: 'RA migration' })).toBeVisible({ timeout: 60_000 })
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'RA migration' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Empty manifest' })).toHaveAttribute('href', '/api/admin/ra-migration/manifest')
  await page.getByLabel('Choose the RA workbooks').setInputFiles([workbook('griya-2025.xlsx'), workbook('kcp-bogor.xlsx'), workbook('no-address.xlsx')])
  await expect(page.getByText('2 ready (2 approved, 0 draft) · 1 need a fix · 0 skipped · 0 can\'t be read')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'griya-2025.xlsx' }).getByText('New building · New building')).toBeVisible()
  await expect(page.getByText('BR-0003 · Annual review')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'kcp-bogor.xlsx' }).getByText('RA Branch', { exact: true })).toBeVisible()
  await expect(page.getByText(/A new building needs its province, city, district in the manifest/)).toBeVisible()
  await expect(page.getByText('Most fixes go in the manifest')).toBeVisible()
  await page.getByRole('button', { name: 'griya-2025.xlsx' }).click()
  await expect(page.getByText('(no BCM Tools user, kept as text)')).toBeVisible()
  await expect(page.getByText('Mobile missing, kept as "-".')).toBeVisible()

  // A ready one can come in as a draft instead: the review runs again with that choice.
  const kcp = page.getByRole('row').filter({ hasText: 'kcp-bogor.xlsx' })
  await kcp.getByRole('button', { name: 'Import as draft instead' }).click()
  await expect(page.getByText('2 ready (1 approved, 1 draft) · 1 need a fix · 0 skipped · 0 can\'t be read')).toBeVisible()
  await expect(kcp.getByText('Imported as a draft, as chosen.')).toBeVisible()

  await page.getByRole('button', { name: 'Import 2 RAs' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/1 new building will be added to Master building, approved/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('heading', { name: 'Run 4, 2 imported, 0 failed' })).toBeVisible()
  expect(calls).toEqual(['start', 'add', 'add', 'finish'])
  await expect(page.getByRole('link', { name: 'RA-2025-0001' })).toHaveAttribute('href', '/ra/monitoring/41')
  await expect(page.getByRole('link', { name: 'RAB-2025-0001' })).toHaveAttribute('href', '/ra-branch/manage/42')
  await expect(page.getByText('Griya CIMB Niaga 2 (HO-0009), new building')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Undo run' }).click()
  await expect(page.getByText(/^Undone /)).toBeVisible()
  expect(calls.at(-1)).toBe('undo')
})

test('RA migration needs its own permission', async ({ page }) => {
  await signIn(page, { permissions: ['ra.access', 'ra.edit', 'sites.access'] })
  await page.goto('/admin/ra-migration')
  await expect(page).toHaveURL(/\/forbidden\?from=/, { timeout: 60_000 })
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'RA migration' })).toHaveCount(0)
})
