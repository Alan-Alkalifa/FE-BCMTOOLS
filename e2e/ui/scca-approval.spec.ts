import { expect, test, type Page } from '@playwright/test'
import { EDITOR, allSignoffs, assessment, mockScca, COMPLETE_INTERDEPENDENCY, completeRecovery } from '../fixtures/scca'

test.setTimeout(90_000)

async function pickUser(page: Page, field: string, name: string) {
  await page.getByRole('button', { name: field }).click()
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click()
  // Wait for the menu to close so the next picker's options are the only ones on the page.
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

test('the assessor picks a contributor on the Application tab', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1')
  await expect(page.getByText(/The application's IT support, who edits this SCCA with you/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('textbox', { name: 'Assessor (application owner)' })).toHaveValue('BCM - Test User')
  await pickUser(page, 'Contributor', 'Retail Lead')
  const request = page.waitForRequest((req) => req.method() === 'PUT' && req.url().endsWith('/api/scca/assessments/1'))
  await page.getByRole('button', { name: 'Save application' }).click()
  expect((await request).postDataJSON().contributor_id).toBe(3)
})

test('the contributor picker is read-only for the contributor', async ({ page }) => {
  await mockScca(page, assessment({
    contributor_id: 3,
    contributor: { id: 3, display_name: 'Retail Lead', email: 'retail@example.com', job_title: 'Lead', department: 'Retail' },
    permissions: { ...EDITOR, can_set_contributor: false },
  }))
  await page.goto('/scca/1')
  await expect(page.getByText(/^Set by the assessor\./)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Contributor' })).toBeDisabled()
})

test('sign-off steps are picked from the user directory', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca/1?tab=result')
  await expect(page.getByRole('heading', { name: 'Sign-off' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: '3. Reviewed by BCM Reviewer' })).toBeVisible()
  await pickUser(page, 'Reviewed by BCM Reviewer user', 'Bima Reviewer')
  await expect(page.locator('p', { hasText: 'BCM Analyst · BCM' })).toBeVisible()
  const request = page.waitForRequest((req) => req.method() === 'PUT')
  await page.getByRole('button', { name: 'Save result' }).click()
  const signoffs = (await request).postDataJSON().signoffs as { role: string, user_id: number | null }[]
  expect(signoffs).toHaveLength(9)
  expect(signoffs.find((row) => row.role === 'bcm_reviewer')).toEqual({ role: 'bcm_reviewer', user_id: 4 })
})

test('submitting locks the assessment', async ({ page }) => {
  await mockScca(page, assessment({
    signoffs: allSignoffs(),
    recovery_values: completeRecovery(),
    interdependencies: [COMPLETE_INTERDEPENDENCY],
  }))
  await page.goto('/scca/1?tab=result')
  await expect(page.getByRole('heading', { name: 'Approval' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/to fill in before you submit/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit for approval' }).click()
  // With gaps the confirm says how many ("Submit with 2 gaps"); they don't block.
  await page.getByRole('dialog').getByRole('button', { name: /^Submit (for approval|with \d+ gaps?)$/ }).click()
  await expect(page.getByText('Submitted for approval').first()).toBeVisible()
  // Submitted: it leaves Manage for Monitoring, read-only, with no Save, recall or comment box.
  await expect(page).toHaveURL(/\/scca\/monitoring\/1\?tab=result$/)
  await expect(page.getByText('Submitted: waiting for Assessment by System User/ User Lead')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save result' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recall/ })).toHaveCount(0)
  await expect(page.getByLabel('Comment on Result and sign-off')).toHaveCount(0)
})

test('the current approver approves or must give a reason to reject', async ({ page }) => {
  await mockScca(page, assessment({
    status: 'in_approval',
    pending_role: 'it_support_pic',
    signoffs: allSignoffs({ status: 'pending' }),
    permissions: { ...EDITOR, can_edit: false, can_submit: false, can_set_contributor: false, can_decide: true, comment_tabs: ['result'] },
  }))
  await page.goto('/scca/1?tab=result')
  await expect(page.getByRole('button', { name: 'Approve as IT Support PIC' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByText('Give a reason for the rejection.')).toBeVisible()

  const request = page.waitForRequest((req) => req.url().endsWith('/approve'))
  await page.getByLabel('Approval note').fill('Looks good')
  await page.getByRole('button', { name: 'Approve as IT Support PIC' }).click()
  expect((await request).postDataJSON()).toEqual({ note: 'Looks good' })
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible()
})

test('the BCM reviewer can comment on the Recovery tab', async ({ page }) => {
  const reviewer = assessment({
    status: 'in_approval',
    pending_role: 'bcm_reviewer',
    signoffs: allSignoffs({ status: 'pending' }),
    permissions: { ...EDITOR, can_edit: false, can_submit: false, can_decide: true, comment_tabs: ['details', 'rating', 'interdependencies', 'recovery', 'result'] },
  })
  await mockScca(page, reviewer)
  await page.goto('/scca/1?tab=recovery')
  await expect(page.getByRole('heading', { name: 'Review comments · Recovery' })).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('Comment on Recovery').fill('Business RTO should be 2 hours')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByText('Business RTO should be 2 hours')).toBeVisible()
})

test('other approvers comment on Result and sign-off only, and read the reviewer comments elsewhere', async ({ page }) => {
  await mockScca(page, assessment({
    status: 'in_approval',
    pending_role: 'enterprise_architecture',
    signoffs: allSignoffs({ status: 'pending' }),
    comments: [{ id: 1, tab: 'recovery', body: 'Check the DR capacity', author: 'Bima Reviewer', author_role: 'bcm_reviewer', created_at: '2026-03-02T09:00:00Z' }],
    permissions: { ...EDITOR, can_edit: false, can_submit: false, comment_tabs: ['result'] },
  }))
  await page.goto('/scca/1?tab=recovery')
  await expect(page.getByText('Check the DR capacity')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Comment on Recovery')).toHaveCount(0)
  await page.goto('/scca/1?tab=rating')
  await expect(page.getByRole('tab', { name: 'Rating' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Comment on Rating')).toHaveCount(0)
  await page.goto('/scca/1?tab=result')
  await expect(page.getByLabel('Comment on Result and sign-off')).toBeVisible({ timeout: 60_000 })
})

test('old "waiting for my approval" links open the Approval inbox', async ({ page }) => {
  await mockScca(page)
  await page.goto('/scca?view=waiting')
  await expect(page).toHaveURL(/\/scca\/approval$/)
  await expect(page.getByRole('heading', { name: 'Waiting for my approval' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'CC Omni Channel' })).toHaveAttribute('href', '/scca/approval/1?tab=result')
})

test('a signer who may comment on Result only is told so on the other tabs', async ({ page }) => {
  await mockScca(page, assessment({
    status: 'in_approval',
    pending_role: 'it_support_pic',
    my_role: null,
    signoffs: allSignoffs(),
    permissions: { ...EDITOR, can_edit: false, can_submit: false, can_decide: true, comment_tabs: ['result'] },
  }))
  await page.goto('/scca/approval/1?tab=rating')
  await expect(page.getByText(/At your step you comment on Result and sign-off\./).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 })
})

for (const section of ['approval', 'monitoring']) {
  test(`in ${section} the C, I, A and PO-LOS tabs open while the ratings stay locked`, async ({ page }) => {
    await mockScca(page, assessment({
      status: 'in_approval',
      pending_role: 'it_support_pic',
      my_role: null,
      signoffs: allSignoffs(),
      permissions: { ...EDITOR, can_edit: false, can_submit: false, can_decide: section === 'approval', comment_tabs: ['result'] },
    }))
    await page.goto(`/scca/${section}/1?tab=rating`)
    const tabs = page.getByRole('tablist').filter({ has: page.getByRole('tab', { name: 'PO-LOS' }) })
    await expect(tabs.getByRole('tab', { name: 'C', exact: true })).toBeEnabled({ timeout: 60_000 })
    for (const name of ['I', 'A', 'PO-LOS']) {
      await tabs.getByRole('tab', { name, exact: true }).click()
      await expect(tabs.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
    }
    await expect(page.getByText('P1 ·', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Critical' }).first()).toBeDisabled()
    await expect(page.getByLabel('Justification').first()).toBeDisabled()
  })
}
