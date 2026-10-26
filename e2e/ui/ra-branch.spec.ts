import { expect, test } from '@playwright/test'
import { BRANCH_ASSESSMENT_ID, BRANCH_ID, mockRa } from '../fixtures/ra'

test.setTimeout(90_000)

const ASSESSMENT = `/ra-branch/manage/${BRANCH_ASSESSMENT_ID}`

test('the home page links to RA Branch', async ({ page }) => {
  await mockRa(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'RA Branch' })).toBeVisible({ timeout: 60_000 })
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
  await expect(page.getByRole('button', { name: 'Type of Hazard' })).toContainText('14. Kebakaran', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Gross impact' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'After mitigation', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Impact after mitigation' })).toBeVisible()
  // 1 x 3 is Low on the branch matrix (Medium on the HO one).
  await expect(page.getByRole('textbox', { name: 'Probability rating' })).toHaveValue('1')
  await expect(page.getByRole('textbox', { name: 'Impact rating' })).toHaveValue('3')
  const risk = page.getByRole('heading', { name: 'Risk rating' }).locator('..')
  await expect(risk.getByText('Low')).toBeVisible()

  await page.getByRole('combobox', { name: /Infrastructure impact/ }).click()
  await page.getByRole('option', { name: '5 · Critical' }).click()
  await expect(page.getByRole('textbox', { name: 'Impact rating' })).toHaveValue('5')
  await expect(risk.getByText('Medium')).toBeVisible()

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('1 hazard saved').first()).toBeVisible()
  const sent = log.ratings[0]![0] as Record<string, unknown>
  expect(sent).toMatchObject({ code: 'H14', residual_infrastructure: 5, historical: 1, probability: 1 })
  expect(Object.keys(sent)).not.toContain('monetary')
  expect(Object.keys(sent)).not.toContain('residual_probability')
})

test('the branch Risk Summary has only the residual table', async ({ page }) => {
  await mockRa(page)
  await page.goto(`${ASSESSMENT}?tab=summary`)
  await expect(page.getByRole('heading', { name: 'Heat Map Matrix' })).toBeVisible({ timeout: 60_000 })
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

test('a branch has a region, occupants, a recovery team and a call tree', async ({ page }) => {
  await mockRa(page)
  await page.goto(`/locations/${BRANCH_ID}`)
  await expect(page.getByRole('textbox', { name: /Region/ })).toHaveValue('Region Jabar', { timeout: 60_000 })
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

test('adding a branch needs a region and sends the branch kind', async ({ page }) => {
  const log = await mockRa(page)
  // The old RA Branch link lands on Building Data Entry with the type fixed to branch.
  await page.goto('/ra-branch/locations/new')
  await expect(page).toHaveURL(/\/locations\/new\?type=branch$/, { timeout: 60_000 })
  await expect(page.getByRole('combobox', { name: 'Type of building' })).toBeDisabled({ timeout: 60_000 })
  await expect(page.getByTestId('building-type-hint')).toContainText('The branch that is assessed each RA cycle.')
  await page.getByRole('textbox', { name: /Branch name/ }).fill('KC Bandung Asia Afrika', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page.getByText('Enter the region.')).toBeVisible()
  expect(log.created).toHaveLength(0)
  await page.getByRole('textbox', { name: /Region/ }).fill('Region Jabar')
  await expect(page.getByText('Enter the region.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add branch' }).click()
  await expect(page).toHaveURL(/\/locations\/3\?tab=contacts$/)
  expect(log.created[0]).toMatchObject({ kind: 'branch', name: 'KC Bandung Asia Afrika', region: 'Region Jabar' })
})

test('a branch assessment opened under RA moves to RA Branch', async ({ page }) => {
  await mockRa(page)
  await page.goto(`/ra/${BRANCH_ASSESSMENT_ID}?tab=summary`)
  await expect(page).toHaveURL(new RegExp(`/ra-branch/manage/${BRANCH_ASSESSMENT_ID}\\?tab=summary$`), { timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'RA Branch' })).toBeVisible()
})
