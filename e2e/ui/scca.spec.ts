import { expect, test, type Page } from '@playwright/test'
import { EDITOR, FORMULA, LIST, SAMPLE_RATINGS, assessment, draft, mockScca, signIn } from '../fixtures/scca'
import { sccaConfig } from '../fixtures/scca-config'

test.setTimeout(90_000)

/** Pick the given day of the month the calendar opens on. Day buttons are named like "Thursday 15 October 2026". */
async function pickDate(page: Page, field: string, day: number) {
  // Under load the first click can land before the picker is ready: click until it opens.
  await expect(async () => {
    if (!(await page.getByRole('dialog').isVisible())) await page.getByRole('button', { name: field }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`\\b${day} [A-Z][a-z]+ \\d{4}$`) }).first().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function selectReason(page: Page, reason: string) {
  await page.getByLabel('Reason for assessment').click()
  await page.getByRole('option', { name: reason }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

async function pickApplication(page: Page, field: string, search: string, option: RegExp) {
  await page.getByRole('button', { name: field, exact: true }).click()
  await page.getByPlaceholder('Application code or name').fill(search)
  await page.getByRole('option', { name: option }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

async function selectUser(page: Page, field: string, name: string) {
  await page.getByRole('button', { name: field }).click()
  // Options also show job title and email, so match the name at the start.
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click()
  // Wait for the menu to close so the next picker's options are the only ones on the page.
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

test('the list shows badges and keeps search and category in the URL', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca')
  await expect(page).toHaveURL(/\/scca\/manage/)
  await expect(page.getByRole('heading', { name: 'Manage SCCAs' })).toBeVisible({ timeout: 60_000 })

  // Manage lists drafts only: CC Omni Channel is in approval, so it is in Monitoring instead.
  await expect(page.getByRole('link', { name: 'HR Portal' })).toHaveAttribute('href', '/scca/manage/2')
  await expect(page.getByRole('link', { name: 'CC Omni Channel' })).toHaveCount(0)
  await expect(page.getByText('Not rated yet')).toBeVisible()
  await expect(page.getByText('SCCA-2026-0002')).toBeVisible()
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
  // Nothing can be filled in before the reason.
  await expect(page.getByLabel('Application code')).toBeDisabled()
  await selectReason(page, 'New application')
  await page.getByLabel('Application code').fill('newapp')
  await expect(page.getByText('6/32')).toBeVisible()
  await page.getByLabel('Application name').fill('New app')
  await pickDate(page, 'Assessment date', 1)
  await expect(page.getByText('Enter the assessment date.')).toHaveCount(0)
  // The assessor is the application owner; the contributor is the IT support.
  await expect(page.getByRole('button', { name: 'Application owner' })).toHaveCount(0)
  await selectUser(page, 'Contributor (IT support)', 'IT Support')
  await selectUser(page, 'Business stakeholder', 'Retail Lead')
  await page.getByLabel('Country').fill('Indonesia')
  await page.getByLabel('Vendor').fill('In-house')
  await page.getByLabel('Deployment model').click()
  await page.getByRole('option', { name: 'On Premises' }).click()
  await page.getByLabel('Customer facing').click()
  await page.getByRole('option', { name: 'Yes' }).click()
  await page.getByLabel('Business days').click()
  await page.getByRole('option', { name: 'Mon–Fri' }).click()
  await page.getByLabel('Business hours').click()
  await page.getByRole('option', { name: /08\.00–18\.00/ }).click()
  const request = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/scca/assessments'))
  await page.getByRole('button', { name: 'Create assessment' }).click()
  expect((await request).postDataJSON()).toMatchObject({
    application_id: null,
    application_code: 'NEWAPP',
    application_name: 'New app',
    assessment_reason: 'new_application',
    contributor_id: 2,
    country: 'Indonesia',
    vendor_name: 'In-house',
  })
  await expect(page).toHaveURL(/\/scca\/manage\/1\?tab=rating/)
})

test('an annual review picks its application from the application list', async ({ page }) => {
  await mockScca(page, draft())
  await page.goto('/scca/new')
  await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible({ timeout: 60_000 })
  await selectReason(page, 'Annual review')
  await page.getByRole('button', { name: 'Application', exact: true }).click()
  await page.getByPlaceholder('Application code or name').fill('omni')
  await expect(page.getByRole('option', { name: /HR Portal/ })).toHaveCount(0)
  await page.getByRole('option', { name: /^CCOMNI/ }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)

  await expect(page.getByText('Existing application')).toBeVisible()
  await expect(page.getByText('Copied the application details from its last SCCA (SCCA-2024-0007, 16 Sep 2024).')).toBeVisible()
  await expect(page.getByLabel('Application code')).toHaveValue('CCOMNI')
  await expect(page.getByLabel('Application name')).toHaveValue('CC Omni Channel')
  await expect(page.getByText('Previous final characteristics')).toBeVisible()
  await expect(page.getByText('From SCCA-2024-0007, final 20 Sep 2024.')).toBeVisible()
  await expect(page.getByLabel('Vendor')).toHaveValue('KPSG')
  await expect(page.getByLabel('Deployment model')).toContainText('SaaS')

  await pickDate(page, 'Assessment date', 1)
  const request = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/scca/assessments'))
  await page.getByRole('button', { name: 'Create assessment' }).click()
  const body = (await request).postDataJSON()
  expect(body).toMatchObject({
    application_id: 1,
    application_code: 'CCOMNI',
    application_name: 'CC Omni Channel',
    assessment_reason: 'annual_review',
    application_owner: 'Cards Owner',
    vendor_name: 'KPSG',
    deployment_model: 'SaaS',
    customer_facing: true,
    business_days: 'Mon-Sun',
    business_hours: '00-24',
  })
})

test('the assessment date is picked from a calendar and shown with the month name', async ({ page }) => {
  await mockScca(page, draft())
  await page.goto('/scca/new')
  await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible({ timeout: 60_000 })
  await selectReason(page, 'New application')
  const field = page.getByRole('button', { name: 'Assessment date' })
  await expect(field).toHaveText('Pick a date')
  await field.click()
  const calendar = page.getByRole('dialog')
  const fieldBox = (await field.boundingBox())!
  const calendarBox = (await calendar.boundingBox())!
  expect(Math.abs(calendarBox.x - fieldBox.x)).toBeLessThan(2)
  // Under the field, or above it when there is no room below; never over it.
  expect(calendarBox.y >= fieldBox.y + fieldBox.height || calendarBox.y + calendarBox.height <= fieldBox.y).toBe(true)
  await calendar.getByRole('button', { name: /\b15 [A-Z][a-z]+ \d{4}$/ }).first().click()
  await expect(calendar).toHaveCount(0)
  await expect(field).toHaveText(/^15 \w{3} \d{4}$/)
  await expect(page.getByText(/Renewal due 15 \w+ \d{4}, 2 years after this assessment/)).toBeVisible()
  await expect(page.getByText('Enter the assessment date.')).toHaveCount(0)
})

test('picking an application with an open SCCA warns the assessor', async ({ page }) => {
  await mockScca(page, draft())
  await page.goto('/scca/new')
  await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible({ timeout: 60_000 })
  await selectReason(page, 'System change')
  await pickApplication(page, 'Application', 'hr', /^HR/)
  await expect(page.getByText('This application already has an SCCA in approval')).toBeVisible()

  // Switching to a new application asks first, then clears the application.
  await selectReason(page, 'New application')
  await page.getByRole('button', { name: 'Change reason' }).click()
  await expect(page.getByLabel('Application code')).toHaveValue('')
  await expect(page.getByLabel('Application code')).toBeEnabled()
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
  await page.route('**/api/scca/formula**', (route) => route.fulfill({ json: FORMULA }))
  await page.route('**/api/scca/recovery-standards**', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/scca/config**', (route) => route.fulfill({ json: sccaConfig() }))
  await page.route('**/api/scca/calculate**', (route) =>
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
  // Under the field, and listed in the error summary at the top.
  await expect(page.getByText('Rating 4 is not allowed; choose one of 1, 3, 5.', { exact: true })).toBeVisible()
  await expect(page.getByText('Rating C1: Rating 4 is not allowed; choose one of 1, 3, 5.')).toBeVisible()
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

test('the result tab shows earlier gaps, sign-off and blocks submit until ready', async ({ page }) => {
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
  await expect(page.getByText(/Gap check: \d+ gaps?/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('listitem').filter({
    hasText: 'IT committed RTO is outside the CIMBN standard for Critical ((0 - 2 jam)).',
  })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Core Banking (upstream):' })).toBeVisible()
  // What is still missing, by tab, before Submit.
  await expect(page.getByText(/things? to fill in before you submit/)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: /^Business requirements: / })).toBeVisible()
  await expect(page.getByLabel('Justification / Process Workaround / Remarks')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
})

test('interdependency rows are picked from the application list and filled from its final SCCA', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Upstream applications' })).toBeVisible()
  await page.getByRole('button', { name: 'Add application' }).first().click()
  await pickApplication(page, 'Application name 1', 'core', /^CBS/)
  await expect(page.getByText('Filled from final SCCA SCCA-2025-0009 (2 Nov 2025).')).toBeVisible()
  await expect(page.getByLabel('RTO (hours) 1')).toContainText('12')
  await expect(page.getByLabel('Automatic gaps 1')).toContainText('RTO 12 h is longer than the committed RTO of 6 h.')

  // Every field but workaround and gaps is required.
  await page.getByRole('button', { name: 'Save interdependencies' }).click()
  await expect(page.getByText('Upstream 1 (Core Banking): processing mode, dependency')).toBeVisible()
  await page.getByLabel('Processing mode 1').click()
  await page.getByRole('option', { name: 'Online' }).click()
  await page.getByLabel('Dependency 1').click()
  await page.getByRole('option', { name: 'No', exact: true }).click()
  await page.getByLabel('Gap notes 1').fill('Batch window overlaps.')
  await page.getByLabel('DR capacity (%) 1').fill('150')
  await expect(page.getByLabel('DR capacity (%) 1')).toHaveValue('100')
  await page.getByRole('button', { name: 'Save interdependencies' }).click()
  await expect(page.getByText('Interdependencies saved', { exact: true })).toBeVisible()
  await expect(current.interdependencies).toEqual([
    expect.objectContaining({
      direction: 'upstream',
      application_id: 3,
      system_name: 'Core Banking',
      criticality_category: 'Critical',
      rto: '12',
      gaps_note: 'Batch window overlaps.',
    }),
  ])
  await page.getByRole('button', { name: 'Remove Core Banking' }).click()
  await page.getByRole('button', { name: 'Save interdependencies' }).click()
  await expect.poll(() => current.interdependencies).toEqual([])
})

test('recovery values show a gap and can be saved', async ({ page }) => {
  test.setTimeout(120_000)
  const current = assessment()
  await mockScca(page, current)
  await page.goto('/scca/1?tab=recovery')
  await expect(page.getByRole('heading', { name: 'Recovery architecture standard (CIMB Niaga)' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible()
  await expect(page.getByText('Not applicable')).toHaveCount(0)
  const committedRto = page.getByRole('combobox', { name: 'Current IT committed values RTO (hours)' })
  await expect(committedRto).toBeVisible()
  await committedRto.click()
  await page.getByRole('option', { name: '6 Hours', exact: true }).click()
  await expect(page.getByText('IT committed RTO is outside the CIMBN standard for Critical ((0 - 2 jam)).')).toBeVisible()
  await committedRto.click()
  await page.getByRole('option', { name: '2 Hours', exact: true }).click()
  await page.getByRole('combobox', { name: 'Business requirements RTO (hours)' }).click()
  await page.getByRole('option', { name: '2 Hours', exact: true }).click()
  await page.getByRole('combobox', { name: 'Business requirements MTD (hours)' }).click()
  await page.getByRole('option', { name: '4 Hours', exact: true }).click()
  await page.getByRole('combobox', { name: 'Regulatory requirements RTO (hours)' }).click()
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
  await page.getByLabel('Current IT committed values Availability/SLA (%)').fill('150')
  await expect(page.getByLabel('Current IT committed values Availability/SLA (%)')).toHaveValue('100')
  await page.getByRole('combobox', { name: 'Business requirements RTO (hours)' }).click()
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

test('the matrix fills every cell with its colour and outlines the result in dark red', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1?tab=result')
  const result = page.locator('td[aria-current="true"]').filter({ visible: true })
  await expect(result).toHaveCount(1, { timeout: 60_000 })
  await expect(result).toHaveAttribute('aria-label', /^Result: /)
  await expect(result).toHaveCSS('box-shadow', /rgb\(192, 0, 0\)/)
  await expect(page.getByText('This system')).toHaveCount(0)
})

test('the report page renders the assessment', async ({ page }) => {
  await mockScca(page, assessment({ status: 'final', permissions: { ...EDITOR, can_edit: false, can_submit: false } }))
  await page.goto('/scca/1/report')
  // Old report links open the report in the SCCA's section: a final SCCA is in Monitoring.
  await expect(page).toHaveURL(/\/scca\/monitoring\/1\/report$/)
  await expect(page.getByRole('heading', { name: 'CC Omni Channel', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Ratings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', '/api/scca/assessments/1/report.pdf')
  await expect(page.getByRole('link', { name: 'Download Excel' })).toHaveAttribute('href', '/api/scca/assessments/1/report.xlsx')
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible()
  const crumbs = page.getByRole('navigation', { name: 'breadcrumb' })
  await expect(crumbs.getByRole('link', { name: 'Monitoring' })).toHaveAttribute('href', '/scca/monitoring')
  await expect(crumbs.getByRole('link', { name: 'CC Omni Channel' })).toHaveAttribute('href', '/scca/monitoring/1')
})

test('the report shows the assessment date and highlights every workaround', async ({ page }) => {
  await mockScca(page, assessment({
    status: 'final',
    justification: 'Manual call-back list while the CRM is down.',
    interdependencies: [
      { direction: 'upstream', seq: 1, system_name: 'Core Banking', criticality_category: 'Critical', rto: '2 hours', rpo: null, dr_capacity: null, processing_mode: 'Online', dependency: 'Partial', workaround: 'Agents log calls on paper forms', gaps: null },
      { direction: 'downstream', seq: 1, system_name: 'Data Warehouse', criticality_category: 'Necessary', rto: '24 hours', rpo: null, dr_capacity: null, processing_mode: 'Batch', dependency: 'No', workaround: null, gaps: null },
    ],
  }))
  await page.goto('/scca/1/report')
  await expect(page.getByRole('heading', { name: 'Application' })).toBeVisible({ timeout: 60_000 })
  const application = page.locator('dl').filter({ hasText: 'Assessment date' })
  await expect(application.getByText('1 Mar 2026')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Workaround' })).toBeVisible()
  await expect(page.getByText('Agents log calls on paper forms')).toBeVisible()
  const remarks = page.getByRole('region', { name: 'Justification / process workaround / remarks' })
  await expect(remarks.getByText('Manual call-back list while the CRM is down.')).toBeVisible()
})

test('assessments cannot be deleted', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1')
  await expect(page.getByText('View report')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0)
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
  await page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'Manage' }).click()
  await expect(page.getByText('Discard unsaved changes?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/scca\/manage\/1/)
  await page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'Manage' }).click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page).toHaveURL(/\/scca\/manage$/)
})

test('empty list explains the next step', async ({ page }) => {
  await mockScca(page)
  await page.route(/\/api\/scca\/assessments\/?(\?|$)/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { ...LIST, items: [], total: 0, pages: 0 } })
    }
    return route.continue()
  })
  await page.goto('/scca/manage')
  await expect(page.getByRole('heading', { name: 'Manage SCCAs' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('You have no drafts. Create an assessment, or start a renewal from a final SCCA in Monitoring.')).toBeVisible()
})

test('the PDF and Excel downloads show only once the SCCA is final', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1')
  await expect(page.getByText('View report')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Download Excel' })).toHaveCount(0)
  await page.goto('/scca/1/report')
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0)
})

test('a final SCCA offers the PDF and Excel downloads on its report only', async ({ page }) => {
  await mockScca(page, assessment({ status: 'final', permissions: { ...EDITOR, can_edit: false, can_submit: false } }))
  await page.goto('/scca/1')
  await expect(page.getByText('View report')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Download Excel' })).toHaveCount(0)
  await page.getByRole('link', { name: 'View report' }).click()
  await expect(page).toHaveURL(/\/scca\/monitoring\/1\/report$/)
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

test('a save error lists every field the server rejected, also from other tabs', async ({ page }) => {
  await mockScca(page)
  await page.route('**/api/scca/assessments/1', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    await route.fulfill({
      status: 422,
      json: { error: 'validation_failed', details: { 'recovery_values.1.rto': 'Must be NA, 1 to 24, 36, 48 or 72 hours.', 'it_support': 'Required.' } },
    })
  })
  await page.goto('/scca/1?tab=recovery')
  await expect(page.getByRole('button', { name: 'Save recovery' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Save recovery' }).click()
  await expect(page.getByText('Business requirements · RTO (hours): Must be NA, 1 to 24, 36, 48 or 72 hours.')).toBeVisible()
  await expect(page.getByText('IT support: Required.')).toBeVisible()
})

test('recovery saves only the fields each block shows, clearing stale hidden values', async ({ page }) => {
  const empty = { availability_sla: null, mtd: null, rto: null, rpo: null, ha: null, dr_capacity: null, instance_type: null, dr_type: null }
  await mockScca(page, assessment({
    recovery_values: [{ kind: 'cimbn_standard', ...empty, availability_sla: '100', mtd: '4', rto: '24', dr_type: 'Cold DR' }],
  }))
  await page.goto('/scca/1?tab=recovery')
  await expect(page.getByRole('button', { name: 'Save recovery' })).toBeVisible({ timeout: 60_000 })
  const request = page.waitForRequest((req) => req.method() === 'PUT')
  await page.getByRole('button', { name: 'Save recovery' }).click()
  const rows = (await request).postDataJSON().recovery_values as { kind: string, [key: string]: string | null }[]
  const standard = rows.find((row) => row.kind === 'cimbn_standard')!
  expect(standard).toMatchObject({ availability_sla: '100', rto: '24', dr_type: 'Cold DR', mtd: null, instance_type: null })
  expect(rows.find((row) => row.kind === 'regulatory')).toMatchObject({ availability_sla: null, ha: null })
})

test('in Manage, Save sits in the top bar beside View report and saves the open tab', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/manage/1')
  const save = page.getByRole('button', { name: 'Save application' })
  await expect(save).toBeVisible({ timeout: 60_000 })
  // One Save per page, in the bar with View report, none at the bottom of the form.
  await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(1)
  const actions = page.getByRole('link', { name: 'View report' }).locator('xpath=..')
  await expect(actions.getByRole('button', { name: 'Save application' })).toBeVisible()

  await page.getByRole('textbox', { name: /Application name/ }).fill('CC Omni Channel 2')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  const put = page.waitForRequest((req) => req.method() === 'PUT')
  await save.click()
  expect((await put).postDataJSON()).toMatchObject({ application_code: 'CCOMNI' })
  await expect(page.getByText('Assessment saved', { exact: true })).toBeVisible()
  await expect(page.getByText('Unsaved changes')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Rating' }).click()
  await expect(page.getByRole('button', { name: 'Save ratings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save application' })).toHaveCount(0)

  // A new assessment keeps its Create button with the form.
  await page.goto('/scca/manage/new')
  await expect(page.getByRole('button', { name: 'Create assessment' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(0)
})
