import { expect, test, type Locator, type Page } from '@playwright/test'
import { ASSESSMENT, LOCATIONS, mockRa, SUMMARY } from '../fixtures/ra'
import PREVIEW from '../fixtures/ra/import-preview.json' with { type: 'json' }

test.setTimeout(90_000)

// The preview the API gives for the Griya CIMB Niaga 2 workbook BCM sent (the backend's
// tests/data/ra_ho_griya_niaga_2.xlsx), with Crispina Arumardi matched as the LICOM.
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const WORKBOOK = { name: 'Griya.xlsx', mimeType: MIME, buffer: Buffer.from('PK workbook') }
const REGISTERED = {
  id: 7, code: 'HO-0007', name: 'Griya CIMB Niaga 2', address: 'Jl. Wahid Hasyim Blok B4 No.3', province: 'Banten',
  city: 'Tangerang Selatan', district: 'Pondok Aren', zip_code: '15224', region: null, area: null, region_description: null,
  is_active: true, approval_status: 'approved', contacts: 3, occupants: 0, recovery_team: 0, call_tree: 1, has_period: false, has_final: false,
  open_assessment: null,
}

type Preview = typeof PREVIEW | Record<string, unknown>
type Sent = { file: string, options: Record<string, unknown> | null }

/** The file's name from a multipart body. */
function filename(body: string) {
  return body.match(/filename="([^"]+)"/)?.[1] ?? ''
}

async function mockImport(page: Page, preview: Preview = PREVIEW, failure?: Record<string, string>, regions = false) {
  await mockRa(page, { regions })
  const sent: Sent[] = []
  await page.route('**/api/ra/imports/preview', (route) => {
    const file = filename(route.request().postData() ?? '')
    return route.fulfill({ json: { ...preview, filename: file } })
  })
  await page.route('**/api/ra/imports', async (route) => {
    const body = route.request().postData() ?? ''
    const match = body.match(/name="options"\r\n\r\n([^\r]*)/)
    sent.push({ file: filename(body), options: match ? JSON.parse(match[1]!) : null })
    if (failure) return route.fulfill({ status: 422, json: { error: 'validation_failed', details: failure } })
    return route.fulfill({ status: 201, json: {
      location: { id: 41, code: 'HO-0041', name: 'Griya CIMB Niaga 2', kind: 'head_office', created: true },
      assessment: { id: 55, ref_no: 'RA-2026-0055', kind: 'head_office' },
      saved: { contacts: 8, occupants: 39, recovery_team: 25, call_tree: 39 },
      ratings: 33,
      warnings: [],
    } })
  })
  return sent
}

/** The renewal picker's list, with Griya's earlier RA final (so it can be renewed). */
async function griyaHasAFinalRa(page: Page) {
  await page.route(/\/api\/ra\/locations\?kind=head_office&assessable=true$/, (route) => route.fulfill({
    json: { items: LOCATIONS.map((row) => (row.id === 1 ? { ...row, final_assessment: { ...SUMMARY, status: 'approved' } } : row)) },
  }))
}

async function openImport(page: Page, module: 'ra' | 'ra-branch' = 'ra') {
  await page.goto(`/${module}/manage/new`)
  await page.getByRole('button', { name: 'Import from Excel' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Import from Excel' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function pickReason(page: Page, dialog: Locator, label: string) {
  await dialog.getByRole('combobox', { name: 'Reason for assessment' }).click()
  await page.getByRole('option', { name: new RegExp(label) }).click()
}

const importButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Import', exact: true })

test('Import from Excel takes one workbook: the reason first, then the template and the file', async ({ page }) => {
  await mockImport(page)
  const dialog = await openImport(page)
  await expect(page).toHaveURL(/\/ra\/manage\/new\?import=1$/)
  // RA HO takes the HO workbook only: no type to pick.
  await expect(dialog.getByRole('radio')).toHaveCount(0)
  await expect(dialog.getByText('Create an RA from the HO workbook filled in Excel, one building per file.')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '1. What is assessed' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '2. Fill in the template' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '3. Choose the filled workbook' })).toBeVisible()
  await expect(dialog.getByText('Choose the reason for assessment.')).toBeVisible()
  await expect(importButton(dialog)).toBeDisabled()
  // One file only.
  await expect(dialog.getByLabel('Choose the RA workbook')).not.toHaveAttribute('multiple')
  await expect(dialog.getByText('Drop the Excel file here, or choose it')).toBeVisible()

  // A new building asks for its details straight away.
  await pickReason(page, dialog, 'New building')
  await expect(dialog.getByRole('group', { name: 'Building details' })).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: /Building name/ })).toHaveValue('')
  await expect(dialog.getByText('Choose the filled workbook.')).toBeVisible()

  // A non-.xlsx file is refused before it is sent.
  await dialog.getByLabel('Choose the RA workbook').setInputFiles({ name: 'old.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
  await expect(dialog.getByText('old.xls: use an .xlsx file. Save it as .xlsx in Excel first.')).toBeVisible()

  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByTestId('import-file')).toHaveText('Griya.xlsx')
  await expect(dialog.getByText('HO Risk Assessment Location – Version 2025 – r4')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Choose another file' })).toBeVisible()
  // The empty details are filled in from the workbook.
  await expect(dialog.getByRole('textbox', { name: /Building name/ })).toHaveValue('Griya CIMB Niaga 2')
  await expect(dialog.getByRole('textbox', { name: 'Zip code' })).toHaveValue('15224')
  // What the file holds, in words.
  for (const text of ['8 emergency contacts', '1.725 employees', '25 recovery team members', '39 call tree contacts', '33 of 33 hazards rated']) {
    await expect(dialog.getByText(text, { exact: true })).toBeVisible()
  }
  // What to check after import: four, then all.
  const notes = dialog.getByRole('list', { name: 'Check after import' })
  await expect(notes.getByRole('listitem')).toHaveCount(4)
  await dialog.getByRole('button', { name: `Show all ${PREVIEW.warnings.length}` }).click()
  await expect(notes.getByRole('listitem')).toHaveCount(PREVIEW.warnings.length)
  await expect(dialog.getByText('The file names Crispina Arumardi. Check this user.')).toBeVisible()
  await expect(dialog.getByText('The file names Legiran. You are the LIC.')).toBeVisible()
  await expect(importButton(dialog)).toBeEnabled()
  await expect(dialog.getByText(/SCCA/)).toHaveCount(0)

  // RA Branch › New assessment opens it on the Cabang workbook. Manage and Master building
  // have no import, and New assessment no Cancel (as SCCA's).
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('link', { name: 'Cancel' })).toHaveCount(0)
  await page.goto('/ra-branch/manage/new')
  await page.getByRole('button', { name: 'Import from Excel' }).click({ timeout: 60_000 })
  await expect(page.getByRole('dialog', { name: 'Import from Excel' }).getByText('Create an RA from the Cabang workbook filled in Excel, one building per file.')).toBeVisible()
  await page.goto('/ra-branch/manage')
  await expect(page.getByRole('link', { name: 'New assessment' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Import from Excel' })).toHaveCount(0)
  await page.goto('/admin/buildings')
  await expect(page.getByRole('link', { name: 'Input building data' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Import from Excel' })).toHaveCount(0)
})

test('a file dropped on the drop zone is read like a chosen one', async ({ page }) => {
  await mockImport(page)
  const dialog = await openImport(page)
  const zone = dialog.getByTestId('import-drop-zone')
  const dataTransfer = await page.evaluateHandle((type) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['PK workbook'], 'Griya.xlsx', { type }))
    return transfer
  }, MIME)
  await zone.dispatchEvent('dragenter', { dataTransfer })
  await expect(zone).toContainText('Drop to add the file')
  await zone.dispatchEvent('drop', { dataTransfer })
  await expect(dialog.getByTestId('import-file')).toHaveText('Griya.xlsx')
  await expect(dialog.getByText('33 of 33 hazards rated')).toBeVisible()
})

test('a new building is checked, then imported as a draft RA', async ({ page }) => {
  const sent = await mockImport(page)
  const dialog = await openImport(page)
  await pickReason(page, dialog, 'New building')
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByRole('textbox', { name: /Building name/ })).toHaveValue('Griya CIMB Niaga 2')
  await importButton(dialog).click()
  await expect(dialog.getByText('Enter the province.')).toBeVisible()
  expect(sent).toHaveLength(0)

  await dialog.getByRole('textbox', { name: 'Province' }).fill('Banten')
  await dialog.getByRole('textbox', { name: 'City' }).fill('Tangerang Selatan')
  await dialog.getByRole('textbox', { name: 'District' }).fill('Pondok Aren')
  // A head office building has no region description.
  await expect(dialog.getByRole('textbox', { name: 'Region Description' })).toHaveCount(0)
  // The LICOM's number from the file is filled in.
  await expect(dialog.getByRole('textbox', { name: 'LICOM mobile number' })).toHaveValue('081802331872')
  await importButton(dialog).click()
  await expect(dialog.getByText('RA-2026-0055 created for Griya CIMB Niaga 2')).toBeVisible()
  await expect(dialog.getByText('New building HO-0041. It waits for approval.')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Open RA' })).toHaveAttribute('href', '/ra/manage/55')
  await expect(dialog.getByRole('button', { name: 'Close' }).last()).toBeVisible()
  expect(sent[0]!.file).toBe('Griya.xlsx')
  const options = sent[0]!.options as { location: Record<string, string>, assessment: Record<string, unknown> }
  expect(options.location).toEqual({
    name: 'Griya CIMB Niaga 2',
    address: 'Jl. Wahid Hasyim Blok B4 No.3 Bintaro Jaya Sektor 7 Tangerang 15224',
    province: 'Banten', city: 'Tangerang Selatan', district: 'Pondok Aren', zip_code: '15224',
  })
  expect(options.assessment).toMatchObject({ licom_user_id: 12, licom_phone: '081802331872', reason: 'new_building' })
  expect(options.assessment.period_year).toBe(Number(String(options.assessment.assessment_date).slice(0, 4)))
})

test('a new building already registered without an RA gets its first one', async ({ page }) => {
  const sent = await mockImport(page, { ...PREVIEW, existing: REGISTERED })
  const dialog = await openImport(page)
  await pickReason(page, dialog, 'New building')
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByText('Griya CIMB Niaga 2 is already registered (HO-0007)')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Province' })).toHaveCount(0)
  await dialog.getByRole('switch', { name: 'Update its profile from this file' }).click()
  await importButton(dialog).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]!.options).toMatchObject({ location_id: 7, replace_profile: true, assessment: { reason: 'new_building' } })
  expect(sent[0]!.options).not.toHaveProperty('location')
})

test('a building with a final RA or one in progress can\'t be a new building', async ({ page }) => {
  const open = { id: 31, kind: 'head_office', ref_no: 'RA-2026-0031', period_year: 2026, status: 'draft', revision_state: null }
  await mockImport(page, { ...PREVIEW, existing: { ...REGISTERED, has_final: true, open_assessment: open } })
  const dialog = await openImport(page)
  await pickReason(page, dialog, 'New building')
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  const message = 'Griya CIMB Niaga 2 (HO-0007) already has an RA in progress (RA-2026-0031). It must be final before a new RA can be made.'
  await expect(dialog.getByText(message).first()).toBeVisible()
  await expect(importButton(dialog)).toBeDisabled()
})

test('an annual review renews a registered building picked from the list', async ({ page }) => {
  const sent = await mockImport(page, { ...PREVIEW, existing: { ...REGISTERED, id: 1, code: 'HO-0001', has_final: true } })
  await griyaHasAFinalRa(page)
  const dialog = await openImport(page)
  await pickReason(page, dialog, 'Annual review')
  // No building details to type: only buildings with a final RA to renew.
  await expect(dialog.getByRole('group', { name: 'Building details' })).toHaveCount(0)
  await expect(dialog.getByText('Choose the building.')).toBeVisible()
  const picker = dialog.getByRole('button', { name: 'Building', exact: true })
  await picker.click()
  await expect(page.getByRole('option', { name: /Griya CIMB Niaga 2/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Graha CIMB Niaga/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  // The workbook's building is picked once the file is read.
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(picker).toContainText('Griya CIMB Niaga 2')
  await dialog.getByRole('switch', { name: 'Update its profile from this file' }).click()
  await expect(dialog.getByText('Renewal date')).toHaveCount(0)
  await importButton(dialog).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]!.options).toMatchObject({ location_id: 1, replace_profile: true, assessment: { reason: 'annual_review', licom_user_id: 12 } })
})

test('a structural change picks its renewal date, and the API\'s answer lands on its field', async ({ page }) => {
  const sent = await mockImport(page, { ...PREVIEW, location: { ...PREVIEW.location, name: 'Menara Lain' } }, { 'assessment.licom_user_id': 'Choose a user with RA access.' })
  await griyaHasAFinalRa(page)
  const dialog = await openImport(page)
  await pickReason(page, dialog, 'Structural change')
  await dialog.getByRole('button', { name: 'Building', exact: true }).click()
  await page.getByRole('option', { name: /Griya CIMB Niaga 2/ }).click()
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  // The workbook names another building.
  await expect(dialog.getByText('The workbook names Menara Lain')).toBeVisible()
  await expect(dialog.getByText('Renewal date')).toBeVisible()
  await importButton(dialog).click()
  await expect(dialog.getByText('Enter the renewal date. It can be sooner than one year.')).toBeVisible()
  expect(sent).toHaveLength(0)
  await dialog.getByRole('button', { name: /Renewal date|Pick a date/ }).last().click()
  // The last day this month that can be picked (not before the assessment date, today).
  await page.locator('[role="gridcell"]:not([data-disabled]):not([data-outside-view])').last().click()
  await importButton(dialog).click()
  await expect(dialog.getByText('Choose a user with RA access.').first()).toBeVisible()
  expect(sent[0]!.options).toMatchObject({ location_id: 1, replace_profile: false, assessment: { reason: 'structural_change' } })
  expect((sent[0]!.options as { assessment: { due_date?: string } }).assessment.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('an HO workbook can\'t be imported in RA Branch', async ({ page }) => {
  const sent = await mockImport(page)
  const dialog = await openImport(page, 'ra-branch')
  await pickReason(page, dialog, 'New building')
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByText('This is an RA HO workbook')).toBeVisible()
  await expect(dialog.getByText('Import it from RA HO › New assessment, or choose another file.')).toBeVisible()
  await expect(importButton(dialog)).toBeDisabled()
  expect(sent).toHaveLength(0)
})

test('a new branch keeps the workbook\'s region as its Region Description and picks region and area from the directory', async ({ page }) => {
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
  const dialog = await openImport(page, 'ra-branch')
  await pickReason(page, dialog, 'New building')
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByText(/Cabang rev4/)).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Region Description' })).toHaveValue(JABAR)
  await expect(dialog.getByRole('button', { name: 'Region', exact: true })).toContainText(JABAR)
  // A branch has no occupants or teams in its workbook.
  await expect(dialog.getByText('employees')).toHaveCount(0)
  for (const [name, value] of [['Province', 'Jawa Barat'], ['City', 'Bandung'], ['District', 'Sumur Bandung']] as const) {
    await dialog.getByRole('textbox', { name }).fill(value)
  }
  await importButton(dialog).click()
  // The region has areas: one is picked first.
  await expect(dialog.getByText('Choose the area.')).toBeVisible()
  expect(sent).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Area', exact: true }).click()
  await page.getByRole('option', { name: /Jabar Area I(?!I)/ }).click()
  await importButton(dialog).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]!.options).toMatchObject({ location: {
    name: 'KC Bandung Asia Afrika', region: JABAR, area: `${JABAR} - Jabar Area I`, region_description: JABAR, zip_code: '40261',
  } })
})

test('each module downloads its own empty template, and the old link opens the dialog', async ({ page }) => {
  await mockImport(page)
  const asked: string[] = []
  await page.route('**/api/ra/imports/template**', (route) => {
    const kind = new URL(route.request().url()).searchParams.get('kind') ?? ''
    asked.push(kind)
    const name = kind === 'branch' ? 'RAB_Import-template_Cabang_V.04.xlsx' : 'RA_Import-template_HO_V.04.xlsx'
    return route.fulfill({
      body: Buffer.from('PK template'),
      headers: { 'content-type': MIME, 'content-disposition': `attachment; filename=${name}` },
    })
  })
  await page.goto('/locations/import')
  await expect(page).toHaveURL(/\/ra\/manage\/new\?import=1$/, { timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Import from Excel' })
  const ho = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download template' }).click()
  expect((await ho).suggestedFilename()).toBe('RA_Import-template_HO_V.04.xlsx')
  // An old Master building link opens RA Branch › New assessment for a branch, and so does an
  // old Manage link.
  await page.goto('/admin/buildings?import=branch')
  await expect(page).toHaveURL(/\/ra-branch\/manage\/new\?import=1$/, { timeout: 60_000 })
  const cabang = page.waitForEvent('download')
  await page.getByRole('dialog', { name: 'Import from Excel' }).getByRole('button', { name: 'Download template' }).click()
  expect((await cabang).suggestedFilename()).toBe('RAB_Import-template_Cabang_V.04.xlsx')
  expect(asked).toEqual(['head_office', 'branch'])
  await page.goto('/ra/manage?import=1')
  await expect(page).toHaveURL(/\/ra\/manage\/new\?import=1$/, { timeout: 60_000 })
  await expect(page.getByRole('dialog', { name: 'Import from Excel' })).toBeVisible()
})

test('a workbook with a missing required input is listed to fix and not imported, as SCCA\'s', async ({ page }) => {
  const errors = [
    { sheet: 'LRP (front)', cell: 'F10', message: 'Building name: required.', level: 'error' },
    { sheet: 'LRP (front)', cell: 'M13', message: 'LICOM phone: required.', level: 'error' },
  ]
  await mockImport(page, { ...PREVIEW, warnings: [...errors, ...PREVIEW.warnings], errors: 2, can_import: false })
  const dialog = await openImport(page)
  await pickReason(page, dialog, 'New building')
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByText('2 things to fix in the workbook')).toBeVisible()
  const fix = dialog.getByRole('list', { name: 'To fix in the workbook' })
  await expect(fix.getByRole('listitem')).toHaveCount(2)
  await expect(fix.getByText('Building name: required.')).toBeVisible()
  await expect(fix.getByText('LRP (front) · M13')).toBeVisible()
  // The warnings stay under Check after import.
  await expect(dialog.getByRole('list', { name: 'Check after import' }).getByText('Building name: required.')).toHaveCount(0)
  await expect(dialog.getByText('Fix the workbook and choose it again.')).toBeVisible()
  await expect(importButton(dialog)).toBeDisabled()
})

test('Upload Excel on a draft replaces its ratings from the workbook, the status beside it', async ({ page }) => {
  await mockRa(page)
  const sent: { url: string, replaceProfile: boolean }[] = []
  await page.route(/\/api\/ra\/assessments\/1\/import\/preview$/, (route) => route.fulfill({ json: { ...PREVIEW, draft: { id: 1, ref_no: 'RA-2025-0001' } } }))
  await page.route(/\/api\/ra\/assessments\/1\/import$/, async (route) => {
    const body = route.request().postData() ?? ''
    sent.push({ url: route.request().url(), replaceProfile: /name="replace_profile"\r\n\r\ntrue/.test(body) })
    return route.fulfill({ json: ASSESSMENT })
  })
  await page.goto('/ra/manage/1')
  await expect(page.getByRole('button', { name: 'Upload Excel' })).toBeVisible({ timeout: 60_000 })
  // The status, completion, highest residual and hazards rated moved to the top bar: once on the
  // page, before Upload Excel.
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Incomplete', { exact: true })).toHaveCount(1)
  await expect(page.getByTitle(/^Highest residual risk:/)).toHaveCount(1)
  await expect(page.getByTitle(/ hazards rated$/)).toHaveCount(1)
  const order = await page.evaluate(() => {
    const at = (text: string) => [...document.querySelectorAll('span, button')].find((item) => item.textContent?.trim() === text)
    const rated = [...document.querySelectorAll('span')].find((item) => /^\d+\/33 rated$/.test(item.textContent?.trim() ?? ''))
    const upload = at('Upload Excel')
    return Boolean(rated && upload && (rated.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING))
  })
  expect(order).toBe(true)
  await page.getByRole('button', { name: 'Upload Excel' }).click()
  const dialog = page.getByRole('dialog', { name: 'Replace this draft from Excel' })
  await expect(dialog.getByRole('button', { name: 'Replace draft' })).toBeDisabled()
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByTestId('draft-file')).toHaveText('Griya.xlsx')
  await expect(dialog.getByText('33 of 33 hazards rated')).toBeVisible()
  await dialog.getByRole('switch', { name: /Update the building's profile from this file/ }).click()
  await dialog.getByRole('button', { name: 'Replace draft' }).click()
  await expect(page.getByText('Draft replaced from the workbook').first()).toBeVisible()
  expect(sent).toEqual([expect.objectContaining({ replaceProfile: true })])
})

test('a workbook with an error can\'t replace the draft', async ({ page }) => {
  await mockRa(page)
  await page.route(/\/api\/ra\/assessments\/1\/import\/preview$/, (route) => route.fulfill({ json: {
    ...PREVIEW, warnings: [{ sheet: 'LRP (front)', cell: 'F10', message: 'Building name: required.', level: 'error' }, ...PREVIEW.warnings], errors: 1, can_import: false,
  } }))
  await page.goto('/ra/manage/1')
  await page.getByRole('button', { name: 'Upload Excel' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Replace this draft from Excel' })
  await dialog.getByLabel('Choose the RA workbook').setInputFiles(WORKBOOK)
  await expect(dialog.getByText('1 thing to fix in the workbook')).toBeVisible()
  await expect(dialog.getByText('Fix the workbook and choose it again.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Replace draft' })).toBeDisabled()
})
