import { expect, test } from '@playwright/test'
import { BRANCH_ASSESSMENT_ID, BRANCH_ID, fillAddress, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

const ASSESSMENT = `/ra-branch/manage/${BRANCH_ASSESSMENT_ID}`

test('the home page links to RA Branch', async ({ page }) => {
  await mockRa(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'RA Branch', exact: true })).toBeVisible({ timeout: 60_000 })
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Branches' })).toHaveCount(0)
  await main.locator('a[href="/ra-branch/monitoring"]').click()
  await expect(page).toHaveURL(/\/ra-branch\/monitoring$/)
})

test('the branch drafts show their region', async ({ page }) => {
  await mockRa(page)
  const request = page.waitForRequest((r) => r.url().includes('/api/ra/assessments') && r.method() === 'GET')
  await page.goto('/ra-branch/manage')
  expect(new URL((await request).url()).searchParams.get('kind')).toBe('branch')
  await expect(page.getByRole('link', { name: 'RAB-2025-0001' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Region Jabar')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Branch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View branches' })).toHaveAttribute('href', '/locations?type=branch')
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', '/ra-branch/manage/new')
})

test('a branch hazard is one risk on the branch matrix', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto(`${ASSESSMENT}?tab=hazards&hazard=H14`)
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('14 - Kebakaran', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Gross impact' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'After mitigation', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Impact after mitigation' })).toBeVisible()
  // 1 x 3 is Low on the branch matrix (Medium on the HO one).
  await expect(page.getByRole('textbox', { name: 'Probability rating' })).toHaveValue('1')
  await expect(page.getByRole('textbox', { name: 'Impact rating' })).toHaveValue('3')
  const risk = page.getByRole('heading', { name: 'Risk rating' }).locator('..')
  await expect(risk.getByText('Low')).toBeVisible()

  await page.getByRole('combobox', { name: /Infrastructure impact/ }).click()
  await page.getByRole('option', { name: '5 - Critical' }).click()
  await expect(page.getByRole('textbox', { name: 'Impact rating' })).toHaveValue('5')
  await expect(risk.getByText('Medium')).toBeVisible()

  await page.getByRole('button', { name: 'Save ratings', exact: true }).click()
  await expect(page.getByText('1 hazard saved').first()).toBeVisible()
  const sent = log.ratings[0]![0] as Record<string, unknown>
  expect(sent).toMatchObject({ code: 'H14', residual_infrastructure: 5, historical: 1, probability: 1 })
  expect(Object.keys(sent)).not.toContain('monetary')
  expect(Object.keys(sent)).not.toContain('residual_probability')
})

test('the branch Risk Summary has only the residual table', async ({ page }) => {
  await mockRa(page)
  await page.goto(`${ASSESSMENT}?tab=summary`)
  await expect(page.getByRole('heading', { name: 'Risk Matrix' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Show the gross risk table' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Gross risk' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show the residual risk table' }).click()
  const quake = page.getByRole('table', { name: 'Residual risk' }).getByRole('row', { name: /Gempabumi/ })
  await expect(quake.getByRole('cell').nth(2)).toHaveText('3')
  await expect(quake.getByRole('cell').nth(3)).toHaveText('3')
  // 3 x 3 is Medium on the branch matrix.
  await expect(quake.getByText('Medium')).toBeVisible()
})

test('the branch sign-off has the three branch roles, in order', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto(`${ASSESSMENT}?tab=signoff`)
  await expect(page.getByRole('heading', { name: 'Approved by' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Branch Manager (BM)')).toBeVisible()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Acknowledged by/ })).toHaveCount(0)

  const step = page.getByRole('listitem').filter({ hasText: 'Step 2 of 3' })
  await step.getByRole('combobox').or(step.getByRole('button').first()).first().click()
  await page.getByRole('option', { name: /Dewi Lestari/ }).click()
  await page.getByRole('button', { name: 'Save signers' }).click()
  await expect(page.getByText('Signers saved').first()).toBeVisible()
  // The BOSM (LIC) prepares and the NRSOH (LICOM) reviews: only the branch manager is sent.
  const roles = (log.signoff[0]![1] as { signoffs: { role: string }[] }).signoffs.map((row) => row.role)
  expect(roles).toEqual(['approved_by'])
  await expect(page.getByRole('textbox', { name: 'Signer: Prepared by' })).toHaveValue('Legiran')
})

test('a branch has occupants, a recovery team and a call tree; without the region list its Sub Directorate and Group are picked', async ({ page }) => {
  await mockRa(page)
  await page.goto(`/locations/${BRANCH_ID}`)
  await expect(page.getByRole('textbox', { name: /Branch name/ })).toHaveValue('KCP Bogor Pajajaran', { timeout: 60_000 })
  // No region directory loaded (it comes from LDAP in production): no Region field; the
  // branch's Sub Directorate (its region) and Group (its area) are picked in Organization.
  await expect(page.getByRole('textbox', { name: /Region/ })).toHaveCount(0)
  await expect(page.getByLabel('Area')).toHaveCount(0)
  await expect(page.getByText('The branch\'s region.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Group', exact: true })).toBeEnabled()
  for (const name of ['Emergency contacts', 'Occupants', 'Recovery team', 'Call tree']) {
    await expect(page.getByRole('tab', { name })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'New assessment' })).toHaveAttribute('href', `/ra-branch/manage/new?location_id=${BRANCH_ID}`)
  await page.getByRole('tab', { name: 'Occupants' }).click()
  await expect(page.getByRole('button', { name: /Add/ }).first()).toBeVisible()
})

test('RA Branch has its own Monitoring, Manage and Approval', async ({ page }) => {
  const log = await mockRa(page)
  await page.goto('/ra-branch/monitoring')
  await expect(page.getByRole('heading', { name: 'RA Branch monitoring' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Region')).toBeVisible()
  expect(log.workflow.some((path) => path.startsWith('/api/ra/monitoring/overview') && path.includes('kind=branch'))).toBe(true)
  await page.goto('/ra-branch/approval')
  await expect(page.getByRole('link', { name: 'KCP Bogor Pajajaran' }).first()).toHaveAttribute('href', `/ra-branch/approval/${BRANCH_ASSESSMENT_ID}`, { timeout: 60_000 })
})

test('adding a branch needs every field and sends the branch kind', async ({ page }) => {
  const log = await mockRa(page)
  // The old RA Branch link lands on Building Data Entry with the type fixed to branch.
  await page.goto('/ra-branch/locations/new')
  await expect(page).toHaveURL(/\/locations\/new\?type=branch$/, { timeout: 60_000 })
  await expect(page.getByRole('combobox', { name: 'Type of building' })).toBeDisabled({ timeout: 60_000 })
  await expect(page.getByTestId('building-type-hint')).toContainText('The branch that is assessed each RA cycle.')
  await page.getByRole('textbox', { name: /Branch name/ }).fill('KC Bandung Asia Afrika', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Add branch' }).click()
  for (const message of ['Enter the address.', 'Enter the province.', 'Enter the city.', 'Enter the district.', 'Enter the zip code.']) {
    await expect(page.getByText(message)).toBeVisible()
  }
  expect(log.created).toHaveLength(0)
  await fillAddress(page)
  await expect(page.getByText('Enter the address.')).toHaveCount(0)
  // Without the region directory there is no Region field: the branch's Sub Directorate (its
  // region) and Group (its area) are picked in Organization.
  await expect(page.getByRole('textbox', { name: 'Region' })).toHaveCount(0)
  await expect(page.getByText('The region list comes from LDAP.')).toHaveCount(0)
  await page.getByLabel('Group', { exact: true }).click()
  await page.getByRole('option', { name: 'Building Management' }).click()
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/locations\/3\?tab=contacts$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch', name: 'KC Bandung Asia Afrika', address: 'Jl. Jend. Sudirman Kav. 25', province: 'DKI Jakarta', org_group: 'Building Management' })
  expect(log.created[0]).not.toHaveProperty('region')
})

test('a branch\'s region and area are picked from the region directory, with their heads', async ({ page }) => {
  const log = await mockRa(page, { regions: true })
  await page.goto('/locations/new?type=branch')
  await page.getByRole('textbox', { name: /Branch name/ }).fill('KC Bandung Dago', { timeout: 60_000 })
  await fillAddress(page)
  const area = page.getByRole('button', { name: 'Area', exact: true })
  await expect(area).toBeDisabled()
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page.getByText('Choose the region.')).toBeVisible()
  expect(log.created).toHaveLength(0)

  await page.getByRole('button', { name: 'Region', exact: true }).click()
  await page.getByRole('option', { name: /Network - Jabar & Jateng Region/ }).click()
  const organisation = page.getByTestId('branch-organisation')
  await expect(organisation).toContainText('Network & Digital Banking')
  await expect(organisation).toContainText('Region Head Jabar (KC - Bandung - Asia Afrika - BAA, Bandung)')
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page.getByText('Choose the area.')).toBeVisible()
  await area.click()
  // Only the areas of the region picked.
  await expect(page.getByRole('option', { name: /Jakarta Region Area I/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Jabar Area II/ }).click()
  await expect(organisation).toContainText('Area Head Jabar II (KC - Bandung - Dago - DGO, Bandung)')
  // Another region drops an area that isn't its own.
  await page.getByRole('button', { name: 'Region', exact: true }).click()
  await page.getByRole('option', { name: /Network - Jakarta Region/ }).click()
  await expect(area).not.toContainText('Jabar')
  await area.click()
  await page.getByRole('option', { name: /Jakarta Region Area I/ }).click()
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/locations\/3\?tab=contacts$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch', region: 'Network - Jakarta Region', area: 'Jakarta Region Area I' })
})

test('a branch assessment opened under RA moves to RA Branch', async ({ page }) => {
  await mockRa(page)
  await page.goto(`/ra/${BRANCH_ASSESSMENT_ID}?tab=summary`)
  await expect(page).toHaveURL(new RegExp(`/ra-branch/manage/${BRANCH_ASSESSMENT_ID}\\?tab=summary$`), { timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'RA Branch' })).toBeVisible()
})

test('an RA Branch user works on branches only', async ({ page }) => {
  // RA (head office) and RA Branch are granted separately (ra.* and ra_branch.*); the Location
  // module has its own permission, which the default RA Branch User role holds.
  await mockRa(page, { permissions: ['location.access', 'ra_branch.access', 'ra_branch.edit'] })
  await page.goto('/locations')
  await expect(page.getByRole('link', { name: 'Input building data' })).toHaveAttribute('href', '/locations/new?type=branch', { timeout: 60_000 })
  // The Location module shows every building and branch: the Type filter is there.
  await expect(page.getByLabel('Type', { exact: true })).toBeVisible()
  const sidebar = page.getByRole('navigation', { name: 'Main' })
  await expect(sidebar.getByRole('link', { name: 'Buildings' })).toBeVisible()
  await expect(sidebar.locator('a[href="/ra-branch/manage"]')).toHaveCount(1)
  await expect(sidebar.locator('a[href="/ra/manage"]')).toHaveCount(0)
  await page.goto('/ra/manage')
  await expect(page).toHaveURL(/\/forbidden\?from=/, { timeout: 60_000 })
})

test('without the Location permission, RA Branch access opens only its branches and no Location menu', async ({ page }) => {
  await mockRa(page, { permissions: ['ra_branch.access', 'ra_branch.edit'] })
  await page.goto('/locations')
  await expect(page.getByRole('link', { name: 'Input building data' })).toHaveAttribute('href', '/locations/new?type=branch', { timeout: 60_000 })
  // Only one side: no Type filter, and no Location menu in the sidebar.
  await expect(page.getByLabel('Type', { exact: true })).toHaveCount(0)
  const sidebar = page.getByRole('navigation', { name: 'Main' })
  await expect(sidebar.getByRole('link', { name: 'Buildings' })).toHaveCount(0)
})
