import { expect, test } from '@playwright/test'
import { BRANCH_ID, BRANCH_LOCATION, fillAddress, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

test('one register lists head office buildings and branches', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toBeVisible()
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toContainText('Head office')
  // The building ID in grey under the name.
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toContainText('RA-HQ-0001')
  await expect(table.getByRole('row', { name: /KCP Bogor Pajajaran/ })).toContainText('Branch')
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toHaveAttribute('href', `/locations/${BRANCH_ID}`)
  expect(new URLSearchParams(log.locationQueries.at(-1)).get('kind')).toBe('all')
  await expect(page.getByText('Showing 1–6 of 6')).toBeVisible()
  // Home › Location › Buildings
  await expect(page.getByRole('main').getByRole('navigation').first()).toContainText(/Home\s*Location\s*Buildings/)
})

test('the register filters by type, province, status and search, in the URL', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toBeVisible({ timeout: 60_000 })
  // The province column instead of the region.
  await expect(table.getByRole('columnheader', { name: 'Province' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Region' })).toHaveCount(0)

  await page.getByLabel('Type', { exact: true }).click()
  await page.getByRole('option', { name: 'Branches', exact: true }).click()
  await expect(page).toHaveURL(/type=branch/)
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toHaveCount(0)
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toBeVisible()

  await page.getByLabel('Province', { exact: true }).click()
  await page.getByRole('option', { name: 'Jawa Barat', exact: true }).click()
  await expect(page).toHaveURL(/province=Jawa\+Barat|province=Jawa%20Barat/)
  const query = new URLSearchParams(log.locationQueries.at(-1))
  expect(query.get('kind')).toBe('branch')
  expect(query.get('province')).toBe('Jawa Barat')
  expect(query.get('page')).toBe('1')
  await expect(table.getByRole('link', { name: 'KC Bandung Asia Afrika', exact: true })).toBeVisible()
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toHaveCount(0)

  await page.getByLabel('Status', { exact: true }).click()
  await page.getByRole('option', { name: 'Inactive', exact: true }).click()
  await expect(page).toHaveURL(/status=inactive/)
  await expect(page.getByText('No buildings match these filters.')).toBeVisible()
  expect(new URLSearchParams(log.locationQueries.at(-1)).get('active')).toBe('false')

  // The province filter works for head office buildings too.
  await page.goto('/locations?type=head_office&province=DKI+Jakarta&q=graha')
  await expect(table.getByRole('link', { name: 'Graha CIMB Niaga', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Province', { exact: true })).toContainText('DKI Jakarta')
})

test('Building Data Entry picks the type from a dropdown, with its description', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/new')
  await expect(page.getByRole('heading', { name: 'Building Data Entry' })).toBeVisible({ timeout: 60_000 })
  const type = page.getByRole('combobox', { name: 'Type of building' })
  await expect(type).toContainText('Head office building')
  await expect(page.getByTestId('building-type-hint')).toContainText('The building or work location that is assessed each RA cycle.')
  await expect(page.getByRole('textbox', { name: /Region/ })).toHaveCount(0)
  await page.getByRole('textbox', { name: /Building name/ }).fill('KC Bandung Asia Afrika')
  await type.click()
  await page.getByRole('option', { name: 'Branch' }).click()
  await expect(page.getByTestId('building-type-hint')).toContainText('The branch that is assessed each RA cycle.')
  // What was typed is kept when the type changes.
  await expect(page.getByRole('textbox', { name: /Branch name/ })).toHaveValue('KC Bandung Asia Afrika')
  // A branch has no Region field any more.
  await expect(page.getByRole('textbox', { name: /Region/ })).toHaveCount(0)
  await fillAddress(page)
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/locations\/3\?tab=contacts$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch', name: 'KC Bandung Asia Afrika', zip_code: '12920' })
  expect(log.created[0]).not.toHaveProperty('region')
})

test('adding a building from New assessment returns to the new assessment', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/locations/new?type=branch&then=assessment')
  await page.getByRole('textbox', { name: /Branch name/ }).fill('KC Bandung Asia Afrika', { timeout: 60_000 })
  await fillAddress(page)
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/ra-branch\/manage\/new\?location_id=3$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch' })
})

test('old RA links open the new pages', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/locations?q=griya')
  await expect(page).toHaveURL(/\/locations\?.*type=head_office/, { timeout: 60_000 })
  await expect(page).toHaveURL(/q=griya/)
  await page.goto('/ra-branch/locations')
  await expect(page).toHaveURL(/\/locations\?type=branch$/)
  await page.goto(`/ra-branch/locations/${BRANCH_ID}?tab=occupants`)
  await expect(page).toHaveURL(new RegExp(`/locations/${BRANCH_ID}\\?tab=occupants$`))
  await expect(page.getByRole('tab', { name: 'Occupants', exact: true }).first()).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  await page.goto('/ra/map')
  await expect(page).toHaveURL(/\/locations\/map$/)
  await page.goto('/ra/crises/7')
  await expect(page).toHaveURL(/\/crises\/7$/)
  await page.goto('/ra/guidebook')
  await expect(page).toHaveURL(/\/crises\/guidebook$/)
})

test('a building someone else added is approved, like an RA configuration publish', async ({ page }) => {
  const log = await mockRa(page, { pendingLocation: true })
  await page.goto('/locations/1')
  const banner = page.getByTestId('approval-banner')
  await expect(banner).toContainText('Waiting for approval. Rina added this building', { timeout: 60_000 })
  await banner.getByRole('button', { name: 'Approve' }).click()
  const dialog = page.getByRole('dialog', { name: 'Approve this building?' })
  await dialog.getByLabel('Comment').fill('Address checked.')
  await dialog.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('This building is approved').first()).toBeVisible()
  expect(log.approvals).toEqual([['approve', { note: 'Address checked.' }]])
  await expect(banner).toHaveCount(0)
})

test('rejecting a building needs a reason', async ({ page }) => {
  const log = await mockRa(page, { pendingLocation: true })
  await page.goto('/locations/1')
  const banner = page.getByTestId('approval-banner')
  await banner.getByRole('button', { name: 'Reject' }).click({ timeout: 60_000 })
  const dialog = page.getByRole('dialog', { name: 'Reject this building?' })
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await expect(dialog.getByText('Enter the reason.')).toBeVisible()
  await dialog.getByLabel('Reason').fill('Add the full address.')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await expect(banner).toContainText('Rejected by Test User')
  await expect(banner).toContainText('Reason: Add the full address.')
  expect(log.approvals).toEqual([['reject', { note: 'Add the full address.' }]])
})

test('an RA of a building waiting for approval can\'t be submitted yet', async ({ page }) => {
  await mockRa(page, { pendingLocation: true, ready: true })
  await page.goto('/ra/manage/1?tab=signoff')
  await expect(page.getByText('The building isn\'t approved yet')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
})

test('Building map and Input building data sit in the top bar', async ({ page }) => {
  await mockRa(page)
  await page.goto('/locations')
  const add = page.getByRole('link', { name: 'Input building data' })
  await expect(add).toHaveAttribute('href', '/locations/new', { timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Building map' }).first()).toHaveAttribute('href', '/locations/map')
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Input building data' })).toHaveCount(0)
  const button = await add.boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual((await main.boundingBox())!.y)
})

test('a building waiting for approval is approved on its page, not in the Buildings list', async ({ page }) => {
  await mockRa(page, { pendingLocation: true })
  await page.goto('/locations')
  const row = page.getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(row).toContainText('Waiting for approval', { timeout: 60_000 })
  await expect(row.getByRole('button', { name: /Approve|Reject/ })).toHaveCount(0)
  await row.getByRole('link', { name: 'Edit Griya CIMB Niaga 2' }).click()
  await expect(page).toHaveURL(/\/locations\/1$/)
  const banner = page.getByTestId('approval-banner')
  await expect(banner.getByRole('button', { name: 'Approve' })).toBeVisible()
  await expect(banner.getByRole('button', { name: 'Reject' })).toBeVisible()
})

test('the Buildings list shows the last update and sorts by a column, newest change first by default', async ({ page }) => {
  const log = await mockRa(page)
  // The register's own requests (the pickers and the province list send no page).
  const lastPage = () => log.locationQueries.filter((query) => query.includes('page=')).at(-1)
  await page.goto('/locations')
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: /Last updated/ })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toContainText('1 Mar 2026')
  // Sorted by Last updated, newest first, until another column is picked.
  await expect(table.getByRole('button', { name: 'Last updated, sorted descending. Sort ascending' })).toBeVisible()
  expect(lastPage()).toContain('sort=updated_at&dir=desc')

  await table.getByRole('button', { name: 'Sort by Name' }).click()
  await expect(page).toHaveURL(/sort=name&dir=asc/)
  await expect(table.getByRole('button', { name: 'Name, sorted ascending. Sort descending' })).toBeVisible()
  await expect(table.getByRole('button', { name: 'Sort by Last updated' })).toBeVisible()
  await expect.poll(lastPage).toContain('sort=name&dir=asc')

  await table.getByRole('button', { name: 'Name, sorted ascending. Sort descending' }).click()
  await expect(page).toHaveURL(/sort=name&dir=desc/)
  await expect.poll(lastPage).toContain('sort=name&dir=desc')

  // Back to the default: the URL carries no sort.
  await table.getByRole('button', { name: 'Sort by Last updated' }).click()
  await expect(page).not.toHaveURL(/sort=/)
})

test('the Buildings list shows the latest assessment and its residual apart, and its status as Draft, In approval or Approved', async ({ page }) => {
  await mockRa(page)
  const latest = BRANCH_LOCATION.latest_assessment
  const rows = [
    { name: 'KCP Cibubur', ref_no: 'RAB-2026-0001', status: 'draft', is_returned: true, returned_comment: 'Fix H01', level: 'High' },
    { name: 'KCP Cikarang', ref_no: 'RAB-2026-0002', status: 'in_signoff', is_returned: false, returned_comment: null, level: 'Medium' },
    { name: 'KCP Cilegon', ref_no: 'RAB-2026-0003', status: 'approved', is_returned: false, returned_comment: null, level: 'Low' },
  ].map(({ name, level, ...assessment }, index) => ({
    ...BRANCH_LOCATION,
    id: 41 + index,
    name,
    code: `RA-BR-00${41 + index}`,
    latest_assessment: { ...latest, ...assessment, id: 51 + index, highest_residual_level: level },
  }))
  // Registered after mockRa, so it answers the register's paged request first.
  await page.route(/\/api\/ra\/locations\?.*page=/, (route) =>
    route.fulfill({ json: { items: rows, page: 1, per_page: 25, total: rows.length, pages: 1 } }),
  )
  await page.goto('/locations')
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Latest assessment' })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('columnheader', { name: 'Latest residual' })).toBeVisible()

  const returned = table.getByRole('row', { name: /KCP Cibubur/ })
  // The code and the residual level sit in their own cells.
  const codeCell = returned.getByRole('cell').filter({ has: page.getByRole('link', { name: 'RAB-2026-0001' }) })
  await expect(codeCell).toHaveCount(1)
  await expect(codeCell).not.toContainText('High')
  await expect(returned.getByRole('cell', { name: 'High', exact: true })).toHaveCount(1)
  // Returned for changes is a draft again here.
  await expect(returned).toContainText('Draft')
  await expect(returned).not.toContainText('Returned')

  const signing = table.getByRole('row', { name: /KCP Cikarang/ })
  await expect(signing.locator('[class*="warning"]', { hasText: 'In approval' })).toHaveCount(1)
  await expect(signing).not.toContainText('In sign-off')
  await expect(table.getByRole('row', { name: /KCP Cilegon/ })).toContainText('Approved')
})
