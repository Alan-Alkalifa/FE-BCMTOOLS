import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../fixtures/auth'

test.setTimeout(90_000)

type Module = 'scca' | 'ra' | 'ra_branch' | 'location'

const BASE = {
  detail: null, kind: null, assignee: null, requested_by: null, since: null, working_days_waiting: null, hours_waiting: null,
  due_date: null, days_left: null, reminders_sent: 0, escalated: false, level: 'ok', mine: false, url: '/',
}
const TASKS = [
  { ...BASE, key: 'scca_signoff-4', module: 'scca', type: 'signoff', id: 4, title: 'HR Portal', ref: 'SCCA-2026-0004', detail: 'Approved by IT Support', assignee: 'Test User', requested_by: 'Rina Kartika', working_days_waiting: 2, mine: true, url: '/scca/approval/4' },
  { ...BASE, key: 'scca_signoff-5', module: 'scca', type: 'signoff', id: 5, title: 'Core Banking', ref: 'SCCA-2026-0005', detail: 'Reviewed by BCM Reviewer', assignee: 'Dewi Lestari', working_days_waiting: 9, level: 'escalated', escalated: true, reminders_sent: 2, url: '/scca/5' },
  { ...BASE, key: 'ra_signoff-9', module: 'ra', type: 'signoff', id: 9, title: 'Griya CIMB Niaga 2', ref: 'RA-2026-0009', detail: 'Business Continuity Management Head', assignee: 'Test User', working_days_waiting: 8, level: 'escalated', escalated: true, mine: true, url: '/ra/manage/9?tab=signoff' },
  { ...BASE, key: 'ra_renewal-3', module: 'ra_branch', type: 'renewal', id: 3, title: 'KCP Bintaro', ref: 'RAB-2025-0003', detail: 'Renewal not started', assignee: 'Budi', due_date: '2026-10-01', days_left: -32, level: 'overdue', mine: true, url: '/locations/3' },
  { ...BASE, key: 'incident-7', module: 'location', type: 'incident', id: 7, title: 'Disaster CR-2026-0007 at Menara Sentraya', ref: 'CR-2026-0007', detail: 'Flood/ Flash Flood', assignee: 'Approvers', requested_by: 'Rina Kartika', hours_waiting: 5.2, reminders_sent: 3, level: 'escalated', escalated: true, mine: true, url: '/disasters/7' },
  { ...BASE, key: 'building-12', module: 'location', type: 'building', id: 12, title: 'New building: Menara Sentraya', ref: 'HO-0012', detail: 'New', kind: 'head_office', assignee: 'Approvers', requested_by: 'Rina Kartika', working_days_waiting: 1, mine: true, url: '/locations/12' },
]

/** BCM sees every module (with Location); an RA HO / Branch user only their sign-offs and renewals. */
async function mockTasks(page: Page, options: { bcm?: boolean } = {}) {
  const bcm = options.bcm !== false
  await signIn(page, bcm ? {} : { permissions: ['ra.access', 'ra_branch.access'] })
  const tabs: Module[] = bcm ? ['scca', 'ra', 'ra_branch', 'location'] : ['ra', 'ra_branch']
  const visible = TASKS.filter((row) => tabs.includes(row.module as Module) && (bcm || row.mine))
  const calls: string[] = []
  await page.route(/\/api\/tasks/, async (route) => {
    const url = new URL(route.request().url())
    calls.push(url.pathname + url.search)
    if (url.pathname === '/api/tasks/summary') {
      return route.fulfill({ json: { modules: bcm
        ? [
            { module: 'scca', oversees: true, mine: 1, in_approval: 2, stuck: 1, overdue_renewals: 0, due_renewals: 3 },
            { module: 'ra', oversees: true, mine: 1, in_approval: 1, stuck: 1, overdue_renewals: 0, due_renewals: 0 },
            { module: 'ra_branch', oversees: true, mine: 0, in_approval: 0, stuck: 0, overdue_renewals: 1, due_renewals: 0 },
            { module: 'location', oversees: true, building: 1, incident: 1 },
          ]
        : [
            { module: 'ra', oversees: false, mine: 1, in_approval: 1, stuck: 1, overdue_renewals: 0, due_renewals: 0 },
            { module: 'ra_branch', oversees: false, mine: 0, in_approval: 0, stuck: 0, overdue_renewals: 1, due_renewals: 2 },
          ] } })
    }
    const asked = url.searchParams.get('module') as Module | null
    const module = asked && tabs.includes(asked) ? asked : tabs[0]!
    const own = visible.filter((row) => row.module === module)
    const type = url.searchParams.get('type')
    const level = url.searchParams.get('level')
    const items = own
      .filter((row) => !type || row.type === type)
      .filter((row) => !level || (level === 'stuck' ? row.type === 'signoff' && row.level === 'escalated' : row.level === level))
    const of = (value: string) => own.filter((row) => row.type === value).length
    return route.fulfill({ json: {
      items, page: 1, per_page: 25, total: items.length, pages: 1, module, oversees: bcm,
      tabs: tabs.map((name) => ({ module: name, total: visible.filter((row) => row.module === name).length })),
      counts: { total: own.length, signoff: of('signoff'), renewal: of('renewal'), building: of('building'), incident: of('incident') },
    } })
  })
  return calls
}

test('Home shows each module at a glance, by role, each card opening its Task Management tab', async ({ page }) => {
  await mockTasks(page)
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Overview' })
  for (const title of ['SCCA at a glance', 'RA HO at a glance', 'RA Branch at a glance', 'Location at a glance']) {
    await expect(overview.getByRole('heading', { name: title })).toBeVisible({ timeout: 60_000 })
  }
  const scca = overview.getByRole('region', { name: 'SCCA at a glance' })
  await expect(scca.getByRole('link', { name: 'Waiting for me: 1' })).toHaveAttribute('href', '/tasks?module=scca&type=signoff')
  await expect(scca.getByRole('link', { name: 'In approval: 2' })).toBeVisible()
  await expect(scca.getByRole('link', { name: 'Stuck sign-offs: 1' })).toHaveAttribute('href', '/tasks?module=scca&type=signoff&level=stuck')
  await expect(scca.getByRole('link', { name: 'Overdue renewals: 0' })).toBeVisible()
  const location = overview.getByRole('region', { name: 'Location at a glance' })
  await expect(location.getByRole('link', { name: 'Buildings waiting: 1' })).toHaveAttribute('href', '/tasks?module=location&type=building')
  await expect(location.getByRole('link', { name: 'Disasters waiting: 1' })).toBeVisible()

  await scca.getByRole('link', { name: 'Stuck sign-offs: 1' }).click()
  await expect(page).toHaveURL(/\/tasks\?module=scca&type=signoff&level=stuck/)
  await expect(page.getByRole('tab', { name: /SCCA/ })).toHaveAttribute('aria-selected', 'true')
  const table = page.getByRole('table')
  await expect(table.getByRole('row', { name: /Core Banking/ })).toBeVisible()
  await expect(table.getByRole('row', { name: /HR Portal/ })).toHaveCount(0)
})

test('without BCM rights Home and Task Management show only the user\'s modules and own tasks', async ({ page }) => {
  await mockTasks(page, { bcm: false })
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Overview' })
  await expect(overview.getByRole('heading', { name: 'RA HO at a glance' })).toBeVisible({ timeout: 60_000 })
  await expect(overview.getByRole('heading', { name: 'SCCA at a glance' })).toHaveCount(0)
  await expect(overview.getByRole('heading', { name: 'Location at a glance' })).toHaveCount(0)
  const branch = overview.getByRole('region', { name: 'RA Branch at a glance' })
  await expect(branch.getByRole('link', { name: 'My overdue renewals: 1' })).toHaveAttribute('href', '/tasks?module=ra_branch&type=renewal&level=overdue')
  await expect(branch.getByText('2 more due within 90 days.')).toBeVisible()
  await expect(overview.getByRole('link', { name: /In approval/ })).toHaveCount(0)

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Task Management' }).click()
  await expect(page.getByRole('heading', { name: 'Task Management' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText([/RA HO/, /RA Branch/])
  await expect(page.getByRole('tab', { name: /RA HO/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('table').getByRole('row', { name: /Griya CIMB Niaga 2/ })).toBeVisible()
})

test('Task Management has one tab per module, no My tasks / Everything, and nothing to remind', async ({ page }) => {
  const calls = await mockTasks(page)
  await page.goto('/tasks')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Task Management' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 })
  await expect(page.getByRole('tab')).toHaveText([/SCCA/, /RA HO/, /RA Branch/, /Location/])
  await expect(page.getByRole('tab', { name: 'My tasks' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Everything' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Filter by module' })).toHaveCount(0)

  // SCCA: its sign-offs and renewals.
  const table = page.getByRole('table')
  await expect(page.getByRole('link', { name: 'Sign-offs: 2' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Buildings: / })).toHaveCount(0)
  await expect(table.getByRole('row', { name: /HR Portal/ }).getByRole('link', { name: 'Review: HR Portal' })).toHaveAttribute('href', '/scca/approval/4')
  await expect(table.getByRole('button', { name: /Remind/ })).toHaveCount(0)

  // RA Branch: an overdue renewal.
  await page.getByRole('tab', { name: /RA Branch/ }).click()
  await expect(page).toHaveURL(/module=ra_branch/)
  const renewal = table.getByRole('row', { name: /KCP Bintaro/ })
  await expect(renewal.getByText('32 days overdue')).toBeVisible()
  await expect(renewal.getByRole('link', { name: 'Renew: KCP Bintaro' })).toHaveAttribute('href', '/locations/3')

  // Location: buildings and disasters waiting for approval, never reminded from here.
  await page.getByRole('tab', { name: /Location/ }).click()
  await expect(page).toHaveURL(/module=location/)
  await expect(page.getByRole('link', { name: 'Buildings: 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Disasters: 1' })).toBeVisible()
  const incident = table.getByRole('row', { name: /CR-2026-0007/ })
  await expect(incident.getByText('5 hours')).toBeVisible()
  await expect(incident.getByRole('link', { name: 'Review: Disaster CR-2026-0007 at Menara Sentraya' })).toHaveAttribute('href', '/disasters/7')
  await expect(table.getByRole('row', { name: /New building: Menara Sentraya/ }).getByText('HO-0012 · New · Head office')).toBeVisible()
  await expect(page.getByRole('button', { name: /Remind/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Disasters: 1' }).click()
  await expect(page).toHaveURL(/module=location.*type=incident|type=incident.*module=location/)
  await expect(table.getByRole('row', { name: /New building/ })).toHaveCount(0)
  expect(calls.some((call) => call.includes('/remind'))).toBe(false)
})
