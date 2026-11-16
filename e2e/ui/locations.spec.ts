import { expect, test } from '@playwright/test'
import { BRANCH_ID, BRANCH_LOCATION, fillAddress, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

test('one register lists head office buildings and branches', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/admin/buildings')
  const table = page.getByRole('table')
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toBeVisible()
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toContainText('Head office')
  // The building ID in grey under the name.
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toContainText('HO-0001')
  await expect(table.getByRole('row', { name: /KCP Bogor Pajajaran/ })).toContainText('Branch')
  await expect(table.getByRole('link', { name: 'KCP Bogor Pajajaran', exact: true })).toHaveAttribute('href', `/admin/buildings/${BRANCH_ID}`)
  expect(new URLSearchParams(log.locationQueries.at(-1)).get('kind')).toBe('all')
  await expect(page.getByText('Showing 1–6 of 6')).toBeVisible()
  // Home › Administration › Master building
  await expect(page.getByRole('main').getByRole('navigation').first()).toContainText(/Home\s*Administration\s*Master building/)
})

test('the register filters by type, province, status and search, in the URL', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/admin/buildings')
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
  // Inactive means not in service: inactive, new and waiting for approval, or rejected.
  const inactive = new URLSearchParams(log.locationQueries.at(-1))
  expect(inactive.get('in_service')).toBe('false')
  expect(inactive.get('active')).toBeNull()

  // The province filter works for head office buildings too.
  await page.goto('/admin/buildings?type=head_office&province=DKI+Jakarta&q=graha')
  await expect(table.getByRole('link', { name: 'Graha CIMB Niaga', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Province', { exact: true })).toContainText('DKI Jakarta')
})

test('Building Data Entry picks the type from a dropdown, with its description', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/admin/buildings/new')
  await expect(page.getByRole('heading', { name: 'Building Data Entry' })).toBeVisible({ timeout: 60_000 })
  const type = page.getByRole('combobox', { name: 'Type of building' })
  await expect(type).toContainText('Head office building')
  await expect(page.getByTestId('building-type-hint')).toContainText('The building or work location that is assessed each RA cycle.')
  await expect(page.getByRole('textbox', { name: 'Region', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: /Building name/ }).fill('KC Bandung Asia Afrika')
  await type.click()
  await page.getByRole('option', { name: 'Branch' }).click()
  await expect(page.getByTestId('building-type-hint')).toContainText('The branch that is assessed each RA cycle.')
  // What was typed is kept when the type changes.
  await expect(page.getByRole('textbox', { name: /Branch name/ })).toHaveValue('KC Bandung Asia Afrika')
  // Without the region list a branch has no Region field: its Sub Directorate and Group (its
  // region and area) are picked in Organization.
  await expect(page.getByRole('textbox', { name: 'Region', exact: true })).toHaveCount(0)
  await expect(page.getByText('The branch\'s area.')).toBeVisible()
  await fillAddress(page)
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/admin\/buildings\/3\?tab=contacts$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch', name: 'KC Bandung Asia Afrika', zip_code: '12920', sub_directorate: null, org_group: null })
})

test('old RA links open the new pages', async ({ page }) => {
  await mockRa(page)
  await page.goto('/ra/locations?q=griya')
  await expect(page).toHaveURL(/\/admin\/buildings\?.*type=head_office/, { timeout: 60_000 })
  await expect(page).toHaveURL(/q=griya/)
  await page.goto('/ra-branch/locations')
  await expect(page).toHaveURL(/\/admin\/buildings\?type=branch$/)
  // The Buildings list is Master building now.
  await page.goto('/locations?type=branch')
  await expect(page).toHaveURL(/\/admin\/buildings\?type=branch$/)
  await page.goto('/locations/new?type=branch')
  await expect(page).toHaveURL(/\/admin\/buildings\/new\?type=branch$/)
  await page.goto(`/ra-branch/locations/${BRANCH_ID}?tab=occupants`)
  await expect(page).toHaveURL(new RegExp(`/admin/buildings/${BRANCH_ID}\\?tab=occupants$`))
  await expect(page.getByRole('tab', { name: 'Occupants', exact: true }).first()).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  // A building's page is in Master building: old /locations/{id} links open it there.
  await page.goto('/locations/1?tab=map')
  await expect(page).toHaveURL(/\/admin\/buildings\/1\?tab=map$/)
  await page.goto('/ra/map')
  await expect(page).toHaveURL(/\/locations\/map$/)
  await page.goto('/ra/crises/7')
  await expect(page).toHaveURL(/\/disasters\/7$/)
  await page.goto('/ra/guidebook')
  await expect(page).toHaveURL(/\/disasters\/guidebook$/)

  // Disasters moved from /crises to /disasters: old links (emails, bookmarks) keep working.
  await page.goto('/crises?status=open')
  await expect(page).toHaveURL(/\/disasters\?status=open$/)
  await page.goto('/crises/7')
  await expect(page).toHaveURL(/\/disasters\/7$/)
  await page.goto('/crises/7/report')
  await expect(page).toHaveURL(/\/disasters\/7\/report$/)
  await page.goto('/crises/guidebook')
  await expect(page).toHaveURL(/\/disasters\/guidebook$/)
})

test('a building someone else added is approved, like an RA configuration publish', async ({ page }) => {
  const log = await mockRa(page, { pendingLocation: true })
  await page.goto('/admin/buildings/1')
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
  await page.goto('/admin/buildings/1')
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

test('an RA of a building waiting for approval is signed by the building approver first', async ({ page }) => {
  await mockRa(page, { pendingLocation: true, ready: true })
  await page.goto('/ra/manage/1?tab=signoff')
  // The card: its heading names the step's signer, its text comes from RA configuration.
  const card = page.getByTestId('building-approver-card')
  await expect(card).toContainText('The building is waiting for approval', { timeout: 60_000 })
  await expect(card.getByRole('heading', { name: 'Must be signed by the Building Approver first' })).toBeVisible()
  await expect(card).toContainText('this assessment must be signed by the Building approver first, before the other signers.')
  await expect(card).toContainText('Building approved by')
  // The building approver is step 1, before the other four.
  const first = page.getByRole('listitem').filter({ hasText: 'Step 1 of 5' })
  await expect(first).toContainText('Building approved by')
  await expect(page.getByRole('listitem').filter({ hasText: 'Step 2 of 5' })).toContainText('Prepared by')
})

test('without a building approver step, an RA of a building waiting for approval can\'t be submitted yet', async ({ page }) => {
  await mockRa(page, { pendingLocation: true, ready: true, noPendingStep: true })
  await page.goto('/ra/manage/1?tab=signoff')
  await expect(page.getByText('This RA can\'t be submitted yet')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('The building is waiting for approval. Submit this RA once someone approves it.')).toBeVisible()
  await expect(page.getByText('Building approved by')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
})

test('Building map and Input building data sit in the top bar', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings')
  const add = page.getByRole('link', { name: 'Input building data' })
  await expect(add).toHaveAttribute('href', '/admin/buildings/new', { timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Building map' }).first()).toHaveAttribute('href', '/locations/map')
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Input building data' })).toHaveCount(0)
  const button = await add.boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual((await main.boundingBox())!.y)
})

test('a new building waiting for approval isn\'t active yet: Active stays unticked until it is approved', async ({ page }) => {
  await mockRa(page, { pendingLocation: true })
  await page.goto('/admin/buildings/1')
  const active = page.getByRole('checkbox', { name: 'Active' })
  await expect(active).not.toBeChecked({ timeout: 60_000 })
  await expect(active).toBeDisabled()
  await expect(page.getByText('A new building becomes active once it is approved: when the building approver signs its RA, or someone approves it on this page.')).toBeVisible()
  // Saving leaves it as it is: Active isn't sent.
  await page.getByRole('textbox', { name: 'Name' }).fill('Griya CIMB Niaga 2A')
  const saved = page.waitForRequest((request) => request.method() === 'PUT' && /\/api\/ra\/locations\/1$/.test(request.url()))
  await page.getByRole('button', { name: 'Save building' }).click()
  expect((await saved).postDataJSON()).not.toHaveProperty('is_active')
})

test('an approved building shows Active ticked', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings/1')
  const active = page.getByRole('checkbox', { name: 'Active' })
  await expect(active).toBeChecked({ timeout: 60_000 })
  await expect(active).toBeEnabled()
})

test('a building waiting for approval is approved on its page, not in the Buildings list', async ({ page }) => {
  await mockRa(page, { pendingLocation: true })
  await page.goto('/admin/buildings')
  const row = page.getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(row).toContainText('Waiting for approval', { timeout: 60_000 })
  // One status badge: Waiting for approval, without Active or Inactive beside it.
  await expect(row).not.toContainText(/\b(Active|Inactive)\b/)
  await expect(row.getByRole('button', { name: /Approve|Reject/ })).toHaveCount(0)
  await row.getByRole('link', { name: 'Edit Griya CIMB Niaga 2' }).click()
  await expect(page).toHaveURL(/\/admin\/buildings\/1$/)
  const banner = page.getByTestId('approval-banner')
  await expect(banner.getByRole('button', { name: 'Approve' })).toBeVisible()
  await expect(banner.getByRole('button', { name: 'Reject' })).toBeVisible()
})

test('the Buildings list shows the last update and sorts by a column, newest change first by default', async ({ page }) => {
  const log = await mockRa(page)
  // The register's own requests (the pickers and the province list send no page).
  const lastPage = () => log.locationQueries.filter((query) => query.includes('page=')).at(-1)
  await page.goto('/admin/buildings')
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

test('the Buildings list shows the latest Risk Assessment ID and its residual apart, and its status as Draft, In approval or Approved', async ({ page }) => {
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
    code: `BR-00${41 + index}`,
    latest_assessment: { ...latest, ...assessment, id: 51 + index, highest_residual_level: level },
  }))
  // Registered after mockRa, so it answers the register's paged request first.
  await page.route(/\/api\/ra\/locations\?.*page=/, (route) =>
    route.fulfill({ json: { items: rows, page: 1, per_page: 25, total: rows.length, pages: 1 } }),
  )
  await page.goto('/admin/buildings')
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Risk Assessment ID' })).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('columnheader', { name: 'Residual Risk' })).toBeVisible()

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
  await expect(table.getByRole('row', { name: /KCP Cilegon/ })).toContainText('Final')
})

test('the Location permission alone opens the Sites menu, not the building pages (Master building)', async ({ page }) => {
  await mockRa(page, { permissions: ['scca.access', 'location.access'] })
  await page.goto('/')
  const sidebar = page.getByRole('navigation', { name: 'Main' })
  await expect(sidebar.getByRole('link', { name: 'Building map', exact: true })).toBeVisible({ timeout: 60_000 })
  for (const name of ['Sites', 'Disaster', 'Incident']) {
    await expect(sidebar.getByRole('button', { name, exact: true })).toBeVisible()
  }
  // No Buildings list, and a building's page is only in Master building (location.master).
  await expect(sidebar.getByRole('link', { name: 'Buildings', exact: true })).toHaveCount(0)
  await expect(sidebar.locator('a[href="/ra/manage"]')).toHaveCount(0)
  await page.goto('/admin/buildings/1')
  await expect(page).toHaveURL(/\/forbidden\?from=/, { timeout: 60_000 })
})

test('the Buildings list has the columns of the BCM Tools building list', async ({ page }) => {
  await mockRa(page)
  const row = { ...BRANCH_LOCATION, id: 61, name: 'KCP Depok Margonda', city: 'Depok', district: 'Beji', onsite_employees: 80, onsite_capacity: 100 }
  await page.route(/\/api\/ra\/locations\?.*page=/, (route) =>
    route.fulfill({ json: { items: [row], page: 1, per_page: 25, total: 1, pages: 1 } }),
  )
  await page.goto('/admin/buildings')
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader').first()).toBeVisible({ timeout: 60_000 })
  const headers = (await table.getByRole('columnheader').allTextContents()).map((text) => text.trim()).filter(Boolean)
  expect(headers).toEqual([
    'Name', 'Type', 'Province', 'City', 'District', 'Address', 'Status Building', 'On-site Employees',
    'On-site Capacity', 'Residual Risk', 'Status Risk Assessment', 'Last updated', 'Risk Assessments', 'Risk Assessment ID',
  ])
  const cells = table.getByRole('row', { name: /KCP Depok Margonda/ })
  await expect(cells).toContainText('Depok')
  await expect(cells).toContainText('Beji')
  await expect(cells.getByRole('cell', { name: '80', exact: true })).toHaveCount(1)
  await expect(cells.getByRole('cell', { name: '100', exact: true })).toHaveCount(1)
})

test('Administration › Master building shows the Buildings register', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings')
  await expect(page.getByRole('heading', { name: 'Master building', level: 1 })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Administration')
  await expect(page.getByRole('table').getByRole('columnheader', { name: 'Risk Assessment ID' })).toBeVisible()
})

test('a building opened from Master building stays in Master building', async ({ page }) => {
  await mockRa(page)
  await page.goto('/admin/buildings')
  const row = page.getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(row).toContainText('HO-0001', { timeout: 60_000 })
  await expect(row.getByRole('link', { name: 'Edit Griya CIMB Niaga 2' })).toHaveAttribute('href', '/admin/buildings/1')
  await row.getByRole('link', { name: 'Griya CIMB Niaga 2', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/buildings\/1$/)
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumbs).toContainText('Master building')
  await expect(crumbs).not.toContainText('Buildings')
  await expect(page.getByRole('heading', { name: 'Griya CIMB Niaga 2', level: 1 })).toBeVisible()
  // Its tabs stay there too, and the crumb goes back to Master building.
  await page.getByRole('tab', { name: 'Map' }).click()
  await expect(page).toHaveURL(/\/admin\/buildings\/1\?tab=map$/)
  await crumbs.getByRole('link', { name: 'Master building' }).click()
  await expect(page).toHaveURL(/\/admin\/buildings$/)
  // Input building data opens Building Data Entry inside Master building.
  await page.getByRole('link', { name: 'Input building data' }).click()
  await expect(page).toHaveURL(/\/admin\/buildings\/new/)
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Master building')
})
