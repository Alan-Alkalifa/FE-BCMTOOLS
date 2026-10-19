import { expect, test, type Page } from '@playwright/test'
import { FORMULA, LIST, SAMPLE_RATINGS, assessment, draft, mockScca, signIn } from '../fixtures/scca'

test.setTimeout(90_000)

async function selectUser(page: Page, field: string, name: string) {
  await page.getByRole('button', { name: field }).click()
  // Options also show job title and email, so match the name at the start.
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click()
}

test('the list shows badges and keeps search and category in the URL', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca')
  await expect(page.getByRole('heading', { name: 'SCCA' })).toBeVisible({ timeout: 60_000 })

  await expect(page.getByRole('link', { name: 'CC Omni Channel' })).toBeVisible()
  await expect(page.getByText('Critical', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Draft').first()).toBeVisible()

  await expect(page.getByText('SCCA-2026-0001')).toBeVisible()
  await page.getByLabel('Search by name, code, or ref. no.').fill('omni')
  await expect(page).toHaveURL(/q=omni/)

  await page.getByLabel('Filter by category').click()
  await page.getByRole('option', { name: 'Critical' }).click()
  await expect(page).toHaveURL(/category=Critical/)
})

test('creating an assessment opens the rating tab', async ({ page }) => {
  const created = draft()
  await mockScca(page, created)
  await page.goto('/scca/new')
  await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('Application code').fill('NEWAPP')
  await page.getByRole('textbox', { name: /Application name/ }).fill('New app')
  await page.getByRole('spinbutton', { name: 'day', exact: true }).click()
  await page.keyboard.type('01032026')
  await expect(page.getByText('Enter the assessment date.')).toHaveCount(0)
  await selectUser(page, 'Application owner', 'Cards Owner')
  await selectUser(page, 'IT support', 'IT Support')
  await selectUser(page, 'Business stakeholder', 'Retail Lead')
  await page.getByLabel('Deployment model').click()
  await page.getByRole('option', { name: 'On Premises' }).click()
  await page.getByLabel('Customer facing').click()
  await page.getByRole('option', { name: 'Yes' }).click()
  await page.getByLabel('Business days').click()
  await page.getByRole('option', { name: 'Mon–Fri' }).click()
  await page.getByLabel('Business hours').click()
  await page.getByRole('option', { name: /08\.00–18\.00/ }).click()
  await page.getByRole('button', { name: 'Create assessment' }).click()
  await expect(page).toHaveURL(/\/scca\/1\?tab=rating/)
})

test('C1 only offers the ratings allowed by the formula', async ({ page }) => {
  await mockScca(page, draft())
  await page.goto('/scca/1?tab=rating')
  await expect(page.getByText('C1 · Customer Information').first()).toBeVisible({ timeout: 60_000 })
  const c1 = page.locator('div.space-y-3', { has: page.getByText('C1 · Customer Information') }).first()
  await expect(c1.getByRole('button', { name: 'Critical', exact: true })).toBeVisible()
  await expect(c1.getByRole('button', { name: 'Moderate', exact: true })).toBeVisible()
  await expect(c1.getByRole('button', { name: 'Insignificant', exact: true })).toBeVisible()
  await expect(c1.getByRole('button', { name: 'Major', exact: true })).toHaveCount(0)
  expect(FORMULA.questions[0].options.map((option) => option.rating)).toEqual([5, 3, 1])
})

test('the guidance panel shows the selected rating', async ({ page }) => {
  test.setTimeout(120_000)
  await mockScca(page)
  await page.goto('/scca/1?tab=rating')
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('84%').first()).toBeVisible()
  const guidance = page.getByRole('heading', { name: 'Guidance' }).locator('xpath=ancestor::*[self::div][1]/..')
  await expect(guidance.getByText('Guidance for C1 rating 5.')).toBeVisible()
  await expect(guidance.getByText('Guidance for C1 rating 3.')).toBeVisible()
  await expect(guidance.getByText('Guidance for C1 rating 1.')).toBeVisible()
  await expect(guidance.getByText('C1 · Customer Information')).toHaveCount(0)
  await page.getByRole('tab', { name: 'I', exact: true }).click()
  await expect(guidance.getByText('Guidance for I1 rating 5.')).toBeVisible()
})

test('a 422 from the server appears under the field', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/scca/formula', (route) => route.fulfill({ json: FORMULA }))
  await page.route('**/api/scca/recovery-standards', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/scca/calculate', (route) =>
    route.fulfill({ json: { result: null, missing: Object.keys(SAMPLE_RATINGS) } }),
  )
  await page.route(/\/api\/scca\/assessments\b/, (route) => {
    if (route.request().method() === 'PUT' && route.request().url().includes('/answers')) {
      return route.fulfill({
        status: 422,
        json: { error: 'validation_failed', details: { 'answers.C1': 'Rating 4 is not allowed; choose one of 1, 3, 5.' } },
      })
    }
    return route.fulfill({ json: draft() })
  })
  await page.goto('/scca/1?tab=rating')
  await expect(page.getByRole('button', { name: 'Save ratings' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Critical', exact: true }).first().click()
  await page.getByRole('button', { name: 'Save ratings' }).click()
  await expect(page.getByText('Rating 4 is not allowed; choose one of 1, 3, 5.')).toBeVisible()
})

test('a downgrade without a CIM reference is blocked', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1?tab=result')
  await expect(page.getByRole('radio', { name: 'Downgrade' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('radio', { name: 'Downgrade' }).click()
  await page.getByLabel('New category').click()
  await page.getByRole('option', { name: 'Very important' }).click()
  await page.locator('textarea[name="justification"]').fill('Compensating controls')
  await page.getByRole('button', { name: 'Save result' }).click()
  await expect(page.getByText('Required for an upgrade or downgrade.', { exact: true })).toBeVisible()
})

test('the result tab shows earlier gaps, sign-off and a future approval button', async ({ page }) => {
  await mockScca(page, assessment({
    recovery_values: [{
      kind: 'current_it',
      availability_sla: '90',
      mtd: null,
      rto: '6',
      rpo: 'LST',
      ha: null,
      dr_capacity: '100',
      instance_type: null,
      dr_type: null,
    }],
  }))
  await page.goto('/scca/1?tab=result')
  await expect(page.getByText('Gaps from earlier tabs')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('listitem').filter({
    hasText: 'IT committed RTO is outside the CIMBN standard for Critical ((0 - 2 jam)).',
  })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Core Banking (upstream):' })).toBeVisible()
  await expect(page.getByLabel('Justification / Process Workaround / Remarks')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
})

test('interdependency rows can be added, removed and saved', async ({ page }) => {
  const current = assessment({
    interdependencies: [],
    recovery_values: [{
      kind: 'current_it',
      availability_sla: null,
      mtd: null,
      rto: '6',
      rpo: null,
      ha: null,
      dr_capacity: null,
      instance_type: null,
      dr_type: null,
    }],
  })
  await mockScca(page, current)
  await page.goto('/scca/1?tab=interdependencies')
  await expect(page.getByRole('heading', { name: 'A3 Interdependency' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Full: no workaround when the other system is down.')).toBeVisible()
  await page.getByRole('button', { name: 'Add system' }).first().click()
  await page.getByLabel('System name 1').fill('Core Banking')
  await expect(page.getByLabel('Gaps 1')).toHaveText('Category, RTO, RPO or DR capacity is missing.')
  await page.getByLabel('RTO 1').click()
  await page.getByRole('option', { name: '12 Hours', exact: true }).click()
  await page.getByLabel('DR capacity 1').fill('150')
  await expect(page.getByLabel('DR capacity 1')).toHaveValue('100')
  await expect(page.getByLabel('Gaps 1')).toContainText('RTO 12 h is longer than the committed RTO of 6 h.')
  await page.getByRole('button', { name: 'Save interdependencies' }).click()
  await expect(page.getByText('Interdependencies saved', { exact: true })).toBeVisible()
  await expect(current.interdependencies).toEqual([
    expect.objectContaining({
      direction: 'upstream',
      system_name: 'Core Banking',
      rto: '12',
      gaps: expect.stringContaining('RTO 12 h is longer than the committed RTO of 6 h.'),
    }),
  ])
  await page.getByRole('button', { name: 'Remove Core Banking' }).click()
  await page.getByRole('button', { name: 'Save interdependencies' }).click()
  await expect(current.interdependencies).toEqual([])
})

test('recovery values show a gap and can be saved', async ({ page }) => {
  test.setTimeout(120_000)
  const current = assessment()
  await mockScca(page, current)
  await page.goto('/scca/1?tab=recovery')
  await expect(page.getByRole('heading', { name: 'Recovery architecture standard (CIMB Niaga)' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Not applicable')).toHaveCount(0)
  const committedRto = page.getByRole('combobox', { name: 'Current IT committed values RTO (hrs)' })
  await expect(committedRto).toBeVisible()
  await committedRto.click()
  await page.getByRole('option', { name: '6 Hours', exact: true }).click()
  await expect(page.getByText('IT committed RTO is outside the CIMBN standard for Critical ((0 - 2 jam)).')).toBeVisible()
  await committedRto.click()
  await page.getByRole('option', { name: '2 Hours', exact: true }).click()
  await page.getByRole('combobox', { name: 'Business requirements RTO (hrs)' }).click()
  await page.getByRole('option', { name: '2 Hours', exact: true }).click()
  await page.getByRole('combobox', { name: 'Business requirements MTD' }).click()
  await page.getByRole('option', { name: '4 Hours', exact: true }).click()
  await page.getByRole('combobox', { name: 'Regulatory requirements RTO' }).click()
  await page.getByRole('option', { name: 'NA', exact: true }).click()
  await page.getByRole('combobox', { name: 'Current IT committed values RPO' }).click()
  await page.getByRole('option', { name: 'LST', exact: true }).click()
  await page.getByRole('combobox', { name: 'Current IT committed values HA (Prod / DR)' }).click()
  await page.getByRole('option', { name: 'Yes (Prod)', exact: true }).click()
  await page.getByRole('combobox', { name: 'Current IT committed values Instance (Shared / Different)' }).click()
  await page.getByRole('option', { name: 'Different', exact: true }).click()
  await page.getByRole('combobox', { name: 'CIMBN recovery architecture standard DR type' }).click()
  await page.getByRole('option', { name: 'Warm DR', exact: true }).click()
  await page.getByRole('combobox', { name: 'Final system characteristics HA (Prod / DR)' }).click()
  await page.getByRole('option', { name: 'Active - Active', exact: true }).click()
  await page.getByRole('combobox', { name: 'Final system characteristics DR capacity (%)' }).click()
  await page.getByRole('option', { name: '50% - 50%', exact: true }).click()
  await page.getByLabel('Current IT committed values Availability / SLA (%)').fill('150')
  await expect(page.getByLabel('Current IT committed values Availability / SLA (%)')).toHaveValue('100')
  await page.getByRole('combobox', { name: 'Business requirements RTO (hrs)' }).click()
  await page.getByRole('option', { name: '1 Hour', exact: true }).click()
  await expect(page.getByText('IT committed RTO is longer than the business RTO.')).toBeVisible()
  await page.getByRole('button', { name: 'Save recovery' }).click()
  await expect(page.getByText('Recovery saved', { exact: true })).toBeVisible()
  await expect(current.recovery_values).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'current_it',
      rto: '2',
      rpo: 'LST',
      ha: 'Yes (Prod)',
      instance_type: 'Different',
    }),
    expect.objectContaining({ kind: 'business', rto: '1', mtd: '4' }),
    expect.objectContaining({ kind: 'regulatory', rto: 'NA' }),
    expect.objectContaining({ kind: 'cimbn_standard', dr_type: 'Warm DR' }),
    expect.objectContaining({ kind: 'final', ha: 'Active - Active', dr_capacity: '50% - 50%' }),
  ]))
})

test('the matrix highlights this system\'s cell', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1?tab=result')
  await expect(page.getByText('This system').filter({ visible: true })).toBeVisible({ timeout: 60_000 })
})

test('the report page renders the assessment', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1/report')
  await expect(page.getByRole('heading', { name: 'CC Omni Channel', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Ratings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', '/api/scca/assessments/1/report.pdf')
  await expect(page.getByRole('link', { name: 'Download Excel' })).toHaveAttribute('href', '/api/scca/assessments/1/report.xlsx')
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'SCCA' })).toBeVisible()
})

test('the delete button is hidden when the user cannot delete', async ({ page }) => {
  await mockScca(page, assessment({ can_delete: false }))
  await page.goto('/scca/1')
  await expect(page.getByText('View report')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Delete assessment' })).toHaveCount(0)
  await expect(page.getByText('View report')).toBeVisible()
})

test('leaving with unsaved changes asks for confirmation', async ({ page }) => {
  test.setTimeout(120_000)
  await mockScca(page)
  await page.goto('/scca/1')
  await expect(page.getByRole('textbox', { name: /Application name/ })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Application details' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How SCCA works' })).toBeVisible()
  await expect(page.getByText('The application owner and IT support review the SCCA every 2 years.')).toBeVisible()
  await page.getByRole('textbox', { name: /Application name/ }).fill('Changed name')
  await page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'SCCA' }).click()
  await expect(page.getByText('Discard unsaved changes?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/scca\/1/)
  await page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'SCCA' }).click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page).toHaveURL(/\/scca$/)
})

test('empty list explains the next step', async ({ page }) => {
  await mockScca(page)
  await page.route(/\/api\/scca\/assessments\/?(\?|$)/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { ...LIST, items: [], total: 0, pages: 0 } })
    }
    return route.continue()
  })
  await page.goto('/scca')
  await expect(page.getByRole('heading', { name: 'SCCA' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('No assessments yet. Create the first assessment.')).toBeVisible()
})

test('the assessment page offers the PDF and Excel downloads', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1')
  await expect(page.getByText('View report')).toBeVisible({ timeout: 60_000 })
  const pdf = page.getByRole('link', { name: 'Download PDF' })
  await expect(pdf).toHaveAttribute('href', '/api/scca/assessments/1/report.pdf')
  await expect(pdf).toHaveAttribute('download', '')
  await expect(page.getByRole('link', { name: 'Download Excel' })).toHaveAttribute('href', '/api/scca/assessments/1/report.xlsx')
})

test('the rating tab shows the workbook notes and the C, I, A scores', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1?tab=rating')
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Confidentiality', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('· 5-CIA').first()).toBeVisible()
})
