import { expect, test, type Page } from '@playwright/test'
import { mockRa } from '../fixtures/ra'
import PREVIEW from '../fixtures/ra/import-preview.json' with { type: 'json' }

test.setTimeout(90_000)

// The preview the API gives for the Griya CIMB Niaga 2 workbook BCM sent (the backend's
// tests/data/ra_ho_griya_niaga_2.xlsx), with Crispina Arumardi matched as the LICOM.
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const WORKBOOK = { name: 'Griya.xlsx', mimeType: MIME, buffer: Buffer.from('PK workbook') }
const workbook = (name: string) => ({ name, mimeType: MIME, buffer: Buffer.from(`PK ${name}`) })
const REGISTERED = {
  id: 7, code: 'RA-HQ-0007', name: 'Griya CIMB Niaga 2', address: 'Jl. Wahid Hasyim Blok B4 No.3', province: 'Banten',
  city: 'Tangerang Selatan', district: 'Pondok Aren', zip_code: '15224', region: null, area: null, region_description: null,
  is_active: true, approval_status: 'approved', contacts: 3, occupants: 0, recovery_team: 0, call_tree: 1, has_period: false, has_final: true,
}

type Preview = typeof PREVIEW | Record<string, unknown>
type Sent = { file: string, options: Record<string, unknown> | null }

/** The file's name from a multipart body. */
function filename(body: string) {
  return body.match(/filename="([^"]+)"/)?.[1] ?? ''
}

async function mockImport(page: Page, preview: Preview | ((file: string) => Preview) = PREVIEW, failure?: Record<string, string>, regions = false) {
  await mockRa(page, { regions })
  const sent: Sent[] = []
  await page.route('**/api/ra/imports/preview', (route) => {
    const file = filename(route.request().postData() ?? '')
    return route.fulfill({ json: { ...(typeof preview === 'function' ? preview(file) : preview), filename: file } })
  })
  await page.route('**/api/ra/imports', async (route) => {
    const body = route.request().postData() ?? ''
    const match = body.match(/name="options"\r\n\r\n([^\r]*)/)
    sent.push({ file: filename(body), options: match ? JSON.parse(match[1]!) : null })
    if (failure) return route.fulfill({ status: 422, json: { error: 'validation_failed', details: failure } })
    const id = 55 + sent.length - 1
    return route.fulfill({ status: 201, json: {
      location: { id: 41, code: 'RA-HQ-0041', name: 'Griya CIMB Niaga 2', kind: 'head_office', created: true },
      assessment: { id, ref_no: `RA-2026-00${id}`, kind: 'head_office' },
      saved: { contacts: 8, occupants: 39, recovery_team: 25, call_tree: 39 },
      ratings: 33,
      warnings: [],
    } })
  })
  return sent
}

async function openImport(page: Page) {
  await page.goto('/locations')
  await page.getByRole('button', { name: 'Import from Excel' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Import from Excel' })
  await expect(dialog).toBeVisible()
  return dialog
}

function card(page: Page, name = 'Griya.xlsx') {
  return page.locator(`[data-file="${name}"]`)
}

test('Import from Excel is a dialog: pick the type, choose files, check each file\'s card', async ({ page }) => {
  await mockImport(page)
  const dialog = await openImport(page)
  await expect(page).toHaveURL(/import=head_office/)
  await expect(dialog.getByRole('radio', { name: /RA HO/ })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: /RA Branch/ })).toBeVisible()
  await expect(dialog.getByText('No files yet.')).toBeVisible()

  // A non-.xlsx file is refused before it is sent.
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles({ name: 'old.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
  await expect(dialog.getByText('old.xls: use an .xlsx file. Save it as .xlsx in Excel first.')).toBeVisible()

  await dialog.getByLabel('Choose the RA workbooks').setInputFiles(WORKBOOK)
  const griya = card(page)
  // The file and its template, then the building from the file (new: editable).
  await expect(griya.getByText('Griya.xlsx')).toBeVisible()
  await expect(griya.getByText('HO Risk Assessment Location – Version 2025 – r4')).toBeVisible()
  await expect(griya.getByText('Ready')).toBeVisible()
  await expect(griya.getByText('Not registered yet. Check the details from the file. It will wait for approval.')).toBeVisible()
  await expect(griya.getByRole('textbox', { name: /Building name/ })).toHaveValue('Griya CIMB Niaga 2')
  await expect(griya.getByRole('textbox', { name: /Building name/ })).toBeEnabled()
  await expect(griya.getByRole('textbox', { name: 'Zip code' })).toHaveValue('15224')
  // What the file holds, in words.
  for (const text of ['8 emergency contacts', '1.725 employees', '25 recovery team members', '39 call tree contacts', '33 of 33 hazards rated']) {
    await expect(griya.getByText(text, { exact: true })).toBeVisible()
  }
  // What to check after import: four, then all.
  const notes = griya.getByRole('list', { name: 'Check after import' })
  await expect(notes.getByRole('listitem')).toHaveCount(4)
  await griya.getByRole('button', { name: `Show all ${PREVIEW.warnings.length}` }).click()
  await expect(notes.getByRole('listitem')).toHaveCount(PREVIEW.warnings.length)
  // "Not in the workbook" is in the PRD, not on the screen.
  await expect(dialog.getByRole('heading', { name: 'Not in the workbook' })).toHaveCount(0)
  await expect(griya.getByText('The file names Crispina Arumardi. Check this user.')).toBeVisible()

  // RA Manage opens the same dialog on its own type.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await page.goto('/ra-branch/manage')
  await page.getByRole('button', { name: 'Import from Excel' }).click({ timeout: 60_000 })
  await expect(page.getByRole('dialog', { name: 'Import from Excel' }).getByRole('radio', { name: /RA Branch/ })).toBeChecked()
})

test('a new building asks for the address parts, then shows the new RA', async ({ page }) => {
  const sent = await mockImport(page)
  const dialog = await openImport(page)
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles(WORKBOOK)
  const griya = card(page)
  await expect(griya.getByText('Ready')).toBeVisible()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(griya.getByText('Enter the province.')).toBeVisible()
  expect(sent).toHaveLength(0)

  await griya.getByRole('textbox', { name: 'Province' }).fill('Banten')
  await griya.getByRole('textbox', { name: 'City' }).fill('Tangerang Selatan')
  await griya.getByRole('textbox', { name: 'District' }).fill('Pondok Aren')
  // A head office building has no region description.
  await expect(griya.getByRole('textbox', { name: 'Region Description' })).toHaveCount(0)
  // The LICOM's number from the file is filled in.
  await expect(griya.getByRole('textbox', { name: 'LICOM mobile number' })).toHaveValue('081802331872')
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(griya.getByText('RA-2026-0055 created for Griya CIMB Niaga 2')).toBeVisible()
  await expect(griya.getByRole('link', { name: 'Open RA' })).toHaveAttribute('href', '/ra/manage/55')
  await expect(page.getByText('1 file imported').first()).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close' }).last()).toBeVisible()
  const options = sent[0]!.options as { location: Record<string, string>, assessment: Record<string, unknown> }
  expect(options.location).toEqual({
    name: 'Griya CIMB Niaga 2',
    address: 'Jl. Wahid Hasyim Blok B4 No.3 Bintaro Jaya Sektor 7 Tangerang 15224',
    province: 'Banten', city: 'Tangerang Selatan', district: 'Pondok Aren', zip_code: '15224',
  })
  expect(options.assessment).toMatchObject({ licom_user_id: 12, licom_phone: '081802331872', reason: 'new_building' })
  expect(options.assessment.period_year).toBe(Number(String(options.assessment.assessment_date).slice(0, 4)))
})

test('a registered building shows its own details locked; a Structural change picks its renewal date', async ({ page }) => {
  const sent = await mockImport(page, { ...PREVIEW, existing: REGISTERED }, { 'assessment.licom_user_id': 'Choose a user with RA access.' })
  const dialog = await openImport(page)
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles(WORKBOOK)
  const griya = card(page)
  await expect(griya.getByText('Registered · RA-HQ-0007')).toBeVisible()
  await expect(griya.getByText('Already registered. Its details can\'t be changed here.')).toBeVisible()
  await expect(griya.getByRole('textbox', { name: 'Province' })).toHaveValue('Banten')
  await expect(griya.getByRole('textbox', { name: 'Province' })).toBeDisabled()
  await expect(griya.getByRole('textbox', { name: /Building name/ })).toBeDisabled()
  await griya.getByRole('switch', { name: 'Update the profile' }).click()
  // A building with a final RA: Annual review or Structural change.
  const reason = griya.getByRole('combobox', { name: 'Reason for assessment' })
  await expect(reason).toContainText('Annual review')
  await expect(griya.getByText('Renewal date')).toHaveCount(0)
  await reason.click()
  await page.getByRole('option', { name: /Structural change/ }).click()
  await expect(griya.getByText('Renewal date')).toBeVisible()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(griya.getByText('Enter the renewal date. It can be sooner than one year.')).toBeVisible()
  expect(sent).toHaveLength(0)
  await griya.getByRole('button', { name: /Renewal date|Pick a date/ }).last().click()
  await page.getByRole('gridcell').filter({ hasText: /^20$/ }).first().click()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  // The API's answer lands on its field; nothing is imported.
  await expect(griya.getByText('Choose a user with RA access.')).toBeVisible()
  await expect(griya.getByText('Check details')).toBeVisible()
  expect(sent[0]!.options).toMatchObject({ location_id: 7, replace_profile: true, assessment: { reason: 'structural_change' } })
  expect((sent[0]!.options as { assessment: { due_date?: string } }).assessment.due_date).toMatch(/^\d{4}-\d{2}-20$/)
})

test('a registered building with an RA in that period says so before importing', async ({ page }) => {
  const sent = await mockImport(page, { ...PREVIEW, existing: { ...REGISTERED, has_period: true, has_final: false } })
  const dialog = await openImport(page)
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles(WORKBOOK)
  const griya = card(page)
  await expect(griya.getByText('Registered · RA-HQ-0007')).toBeVisible()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(griya.getByText(/Griya CIMB Niaga 2 already has an RA for \d{4}\./)).toBeVisible()
  expect(sent).toHaveLength(0)
})

test('several files import together; a second file for the same building and period is held back', async ({ page }) => {
  const names: Record<string, string> = { 'Griya.xlsx': 'Griya CIMB Niaga 2', 'Menara.xlsx': 'Menara CIMB Niaga', 'Griya copy.xlsx': 'Griya CIMB Niaga 2' }
  const sent = await mockImport(page, (file) => ({ ...PREVIEW, location: { ...PREVIEW.location, name: names[file] ?? file } }))
  const dialog = await openImport(page)
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles([workbook('Griya.xlsx'), workbook('Menara.xlsx'), workbook('Griya copy.xlsx')])
  await expect(card(page, 'Menara.xlsx').getByRole('textbox', { name: /Building name/ })).toHaveValue('Menara CIMB Niaga')
  const copy = card(page, 'Griya copy.xlsx')
  await expect(copy.getByText('Duplicate')).toBeVisible()
  await expect(copy.getByText(/Another file in this list is for the same building and period \(Griya\.xlsx\)/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Import 2 files' })).toBeVisible()
  await copy.getByRole('button', { name: 'Remove Griya copy.xlsx' }).click()
  for (const name of ['Griya.xlsx', 'Menara.xlsx']) {
    const one = card(page, name)
    await one.getByRole('textbox', { name: 'Province' }).fill('Banten')
    await one.getByRole('textbox', { name: 'City' }).fill('Tangerang Selatan')
    await one.getByRole('textbox', { name: 'District' }).fill('Pondok Aren')
  }
  await dialog.getByRole('button', { name: 'Import 2 files' }).click()
  await expect(page.getByText('2 files imported').first()).toBeVisible()
  expect(sent.map((item) => item.file)).toEqual(['Griya.xlsx', 'Menara.xlsx'])
  await expect(dialog.getByText('2 of 2 imported.')).toBeVisible()
})

test('a workbook of the other type can\'t be imported under this one', async ({ page }) => {
  const sent = await mockImport(page)
  const dialog = await openImport(page)
  await dialog.getByRole('radio', { name: /RA Branch/ }).click()
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles(WORKBOOK)
  const griya = card(page)
  await expect(griya.getByText('This is an RA HO workbook')).toBeVisible()
  await expect(griya.getByText('Choose RA HO above, or remove this file.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
  // Switching the type makes it ready.
  await dialog.getByRole('radio', { name: /RA HO/ }).click()
  await expect(griya.getByText('Ready')).toBeVisible()
  expect(sent).toHaveLength(0)
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
  const dialog = await openImport(page)
  await dialog.getByRole('radio', { name: /RA Branch/ }).click()
  await dialog.getByLabel('Choose the RA workbooks').setInputFiles(WORKBOOK)
  const one = card(page)
  await expect(one.getByText(/Cabang rev4/)).toBeVisible()
  await expect(one.getByRole('textbox', { name: 'Region Description' })).toHaveValue(JABAR)
  await expect(one.getByRole('button', { name: 'Region', exact: true })).toContainText(JABAR)
  // A branch has no occupants or teams in its workbook.
  await expect(one.getByText('employees')).toHaveCount(0)
  for (const [name, value] of [['Province', 'Jawa Barat'], ['City', 'Bandung'], ['District', 'Sumur Bandung']] as const) {
    await one.getByRole('textbox', { name }).fill(value)
  }
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  // The region has areas: one is picked first.
  await expect(one.getByText('Choose the area.')).toBeVisible()
  expect(sent).toHaveLength(0)
  await one.getByRole('button', { name: 'Area', exact: true }).click()
  await page.getByRole('option', { name: /Jabar Area I(?!I)/ }).click()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]!.options).toMatchObject({ location: {
    region: JABAR, area: `${JABAR} - Jabar Area I`, region_description: JABAR, zip_code: '40261',
  } })
})

test('the empty template of the chosen type downloads; the old link opens the dialog', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/locations\?import=head_office$/, { timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Import from Excel' })
  const ho = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download empty template' }).click()
  expect((await ho).suggestedFilename()).toBe('RA_Import-template_HO_V.04.xlsx')
  await dialog.getByRole('radio', { name: /RA Branch/ }).click()
  const cabang = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download empty template' }).click()
  expect((await cabang).suggestedFilename()).toBe('RAB_Import-template_Cabang_V.04.xlsx')
  expect(asked).toEqual(['head_office', 'branch'])
})
