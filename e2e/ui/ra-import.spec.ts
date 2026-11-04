import { expect, test, type Page } from '@playwright/test'
import { mockRa } from '../fixtures/ra'
import PREVIEW from '../fixtures/ra/import-preview.json' with { type: 'json' }

test.setTimeout(90_000)

// The preview the API gives for the Griya CIMB Niaga 2 workbook BCM sent (the backend's
// tests/data/ra_ho_griya_niaga_2.xlsx), with Crispina Arumardi matched as the LICOM.
const WORKBOOK = { name: 'Griya.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK workbook') }

type Sent = { options: Record<string, unknown> | null }

async function mockImport(page: Page, preview: typeof PREVIEW | Record<string, unknown> = PREVIEW, failure?: Record<string, string>, regions = false) {
  await mockRa(page, { regions })
  const sent: Sent[] = []
  await page.route('**/api/ra/imports/preview', (route) => route.fulfill({ json: preview }))
  await page.route('**/api/ra/imports', async (route) => {
    const body = route.request().postData() ?? ''
    const match = body.match(/name="options"\r\n\r\n([^\r]*)/)
    sent.push({ options: match ? JSON.parse(match[1]!) : null })
    if (failure) return route.fulfill({ status: 422, json: { error: 'validation_failed', details: failure } })
    return route.fulfill({ status: 201, json: {
      location: { id: 41, code: 'RA-HQ-0041', name: 'Griya CIMB Niaga 2', kind: 'head_office', created: true },
      assessment: { id: 55, ref_no: 'RA-2026-0055', kind: 'head_office' },
      saved: { contacts: 8, occupants: 39, recovery_team: 25, call_tree: 39 },
      ratings: 33,
      warnings: [],
    } })
  })
  return sent
}

async function choose(page: Page) {
  await page.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(page.getByText(/HO Risk Assessment Location – Version 2025 – r4/).first()).toBeVisible()
}

test('Buildings and RA Manage open Import from Excel; the review says what the workbook holds and lacks', async ({ page }) => {
  await mockImport(page)
  await page.goto('/locations')
  await page.getByRole('link', { name: 'Import from Excel' }).click({ timeout: 60_000 })
  await expect(page).toHaveURL(/\/locations\/import$/)
  await expect(page.getByRole('heading', { name: 'Import from Excel' })).toBeVisible()

  // A non-.xlsx file is refused before it is sent.
  await page.getByLabel('Choose the RA workbook').setInputFiles({ name: 'old.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
  await expect(page.getByText('Use the .xlsx workbook (an .xls file can\'t be read). Save it as .xlsx in Excel first.')).toBeVisible()

  await choose(page)
  const holds = page.getByRole('heading', { name: 'In the workbook', exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]')
  await expect(holds.getByText('Emergency contacts')).toBeVisible()
  await expect(holds.getByText('39 rows, 1.725 employees')).toBeVisible()
  await expect(holds.getByText('Hazards: 33 of 33 fully rated')).toBeVisible()
  await expect(page.getByText('Province, city, district and postal code')).toBeVisible()
  await expect(page.getByText('The workbook has one address cell. BCM Tools keeps the parts separately.')).toBeVisible()
  const warnings = page.getByRole('list', { name: 'Rows left out or changed' })
  await expect(warnings.getByRole('listitem')).toHaveCount(PREVIEW.warnings.length)
  await expect(warnings.getByText('LRP (front) · F41')).toBeVisible()
  // The workbook's name and address are kept; the LICOM is the matched user.
  await expect(page.getByRole('textbox', { name: /Building name/ })).toHaveValue('Griya CIMB Niaga 2')
  await expect(page.getByText('The workbook names Crispina Arumardi: matched to this user. Check it.')).toBeVisible()

  await page.goto('/ra/manage')
  await expect(page.getByRole('link', { name: 'Import from Excel' })).toHaveAttribute('href', '/locations/import', { timeout: 60_000 })
})

test('importing a new building asks for the address parts, then opens the new RA', async ({ page }) => {
  const sent = await mockImport(page)
  await page.goto('/locations/import')
  await choose(page)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText('Enter the province.')).toBeVisible()
  expect(sent).toHaveLength(0)

  await page.getByRole('textbox', { name: 'Province' }).fill('Banten')
  await page.getByRole('textbox', { name: 'City' }).fill('Tangerang Selatan')
  await page.getByRole('textbox', { name: 'District' }).fill('Pondok Aren')
  // The zip code at the end of the workbook's address is filled in.
  await expect(page.getByRole('textbox', { name: 'Zip code' })).toHaveValue('15224')
  // A head office building has no region description.
  await expect(page.getByRole('textbox', { name: 'Region Description' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'LICOM mobile number' }).fill('081802331872')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/ra\/manage\/55/)
  await expect(page.getByText('Imported: RA-2026-0055 for Griya CIMB Niaga 2').first()).toBeVisible()
  const options = sent[0]!.options as { location: Record<string, string>, assessment: Record<string, unknown> }
  expect(options.location).toEqual({
    name: 'Griya CIMB Niaga 2',
    address: 'Jl. Wahid Hasyim Blok B4 No.3 Bintaro Jaya Sektor 7 Tangerang 15224',
    province: 'Banten', city: 'Tangerang Selatan', district: 'Pondok Aren', zip_code: '15224',
  })
  expect(options.assessment).toMatchObject({ licom_user_id: 12, licom_phone: '081802331872', reason: 'new_building' })
  expect(options.assessment.period_year).toBe(Number(String(options.assessment.assessment_date).slice(0, 4)))
})

test('a registered building is used by default; its profile is kept unless replaced, and API errors land on their field', async ({ page }) => {
  const existing = { ...PREVIEW, existing: { id: 7, code: 'RA-HQ-0007', name: 'Griya CIMB Niaga 2', is_active: true, approval_status: 'approved', contacts: 3, occupants: 0, recovery_team: 0, call_tree: 1, has_period: false, has_final: true } }
  const sent = await mockImport(page, existing, { 'assessment.licom_user_id': 'Choose a user with RA access.' })
  await page.goto('/locations/import')
  await choose(page)
  await expect(page.getByRole('radio', { name: /Use the registered building/ })).toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Province' })).toHaveCount(0)
  await expect(page.getByText('8 rows · now 3, kept')).toBeVisible()
  await page.getByRole('switch', { name: 'Replace its profile with the workbook\'s' }).click()
  await expect(page.getByText('8 rows · now 3, replaced')).toBeVisible()
  // A building with a final RA: Annual review or Structural change.
  await expect(page.getByRole('combobox', { name: 'Reason for assessment' })).toContainText('Annual review')
  await page.getByRole('textbox', { name: 'LICOM mobile number' }).fill('0818')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText('Choose a user with RA access.')).toBeVisible()
  expect(sent[0]!.options).toMatchObject({ location_id: 7, replace_profile: true, assessment: { reason: 'annual_review' } })
  await expect(page).toHaveURL(/\/locations\/import$/)
})

test('a branch keeps the workbook\'s region as its Region Description and picks region and area from the directory', async ({ page }) => {
  const JABAR = 'Network - Jabar & Jateng Region'
  const branch = {
    ...PREVIEW,
    kind: 'branch',
    kind_label: 'Branch',
    template: 'Risk Assessment Location – Version 2025-2026 – Cabang rev4',
    location: { name: 'KC Bandung Asia Afrika', address: 'Jl. Asia Afrika No. 122, Bandung 40261', region: JABAR, zip_code: '40261', region_match: JABAR },
    occupants: [],
    recovery_team: [],
    call_tree: [],
  }
  const sent = await mockImport(page, branch, undefined, true)
  await page.goto('/locations/import')
  await page.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(page.getByText(/Cabang rev4/).first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Region Description' })).toHaveValue(JABAR)
  await expect(page.getByRole('button', { name: 'Region', exact: true })).toContainText(JABAR)
  await expect(page.getByRole('textbox', { name: 'Zip code' })).toHaveValue('40261')
  for (const [name, value] of [['Province', 'Jawa Barat'], ['City', 'Bandung'], ['District', 'Sumur Bandung']] as const) {
    await page.getByRole('textbox', { name }).fill(value)
  }
  await page.getByRole('textbox', { name: 'LICOM mobile number' }).fill('0818')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  // The region has areas: one is picked first.
  await expect(page.getByText('Choose the area.')).toBeVisible()
  expect(sent).toHaveLength(0)
  await page.getByRole('button', { name: 'Area', exact: true }).click()
  await page.getByRole('option', { name: /Jabar Area I(?!I)/ }).click()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]!.options).toMatchObject({ location: {
    region: JABAR, area: `${JABAR} - Jabar Area I`, region_description: JABAR, zip_code: '40261',
  } })
})

test('the empty HO and Cabang templates download from step 1', async ({ page }) => {
  await mockImport(page)
  const asked: string[] = []
  await page.route('**/api/ra/imports/template**', (route) => {
    const kind = new URL(route.request().url()).searchParams.get('kind') ?? ''
    asked.push(kind)
    const name = kind === 'branch' ? 'RAB_Import-template_Cabang_V.04.xlsx' : 'RA_Import-template_HO_V.04.xlsx'
    return route.fulfill({
      body: Buffer.from('PK template'),
      headers: { 'content-type': WORKBOOK.mimeType, 'content-disposition': `attachment; filename=${name}` },
    })
  })
  await page.goto('/locations/import')
  const workbooks = page.getByRole('list', { name: 'Workbooks BCM Tools reads' })
  await expect(workbooks.getByRole('listitem')).toHaveCount(3)
  const ho = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download the HO template' }).click()
  expect((await ho).suggestedFilename()).toBe('RA_Import-template_HO_V.04.xlsx')
  const cabang = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download the Cabang template' }).click()
  expect((await cabang).suggestedFilename()).toBe('RAB_Import-template_Cabang_V.04.xlsx')
  expect(asked).toEqual(['head_office', 'branch'])
})
