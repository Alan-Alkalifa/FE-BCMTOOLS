import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../fixtures/auth'

test.setTimeout(90_000)

const BASE = {
  detail: null, kind: null, assignee: null, requested_by: null, since: null, working_days_waiting: null, hours_waiting: null,
  due_date: null, days_left: null, reminders_sent: 0, escalated: false, level: 'ok', mine: false, url: '/', can_remind: false, remind: null,
}
const MINE = [
  { ...BASE, key: 'scca_signoff-4', module: 'scca', type: 'signoff', id: 4, title: 'HR Portal', ref: 'SCCA-2026-0004', detail: 'Approved by IT Support', assignee: 'Test User', requested_by: 'Rina Kartika', working_days_waiting: 2, level: 'ok', mine: true, url: '/scca/approval/4', remind: 'scca_signoff' },
  { ...BASE, key: 'ra_signoff-9', module: 'ra', type: 'signoff', id: 9, title: 'Griya CIMB Niaga 2', ref: 'RA-2026-0009', detail: 'Business Continuity Management Head', assignee: 'Test User', working_days_waiting: 8, level: 'escalated', escalated: true, mine: true, url: '/ra/manage/9?tab=signoff', remind: 'ra_signoff' },
  { ...BASE, key: 'ra_renewal-3', module: 'ra_branch', type: 'renewal', id: 3, title: 'KCP Bintaro', ref: 'RAB-2025-0003', detail: 'Renewal not started', assignee: 'Budi', due_date: '2026-10-01', days_left: -32, level: 'overdue', mine: true, url: '/locations/3' },
]
const ALL = [
  ...MINE,
  { ...BASE, key: 'incident-7', module: 'location', type: 'incident', id: 7, title: 'Incident CR-2026-0007 at Menara Sentraya', ref: 'CR-2026-0007', detail: 'Flood/ Flash Flood', assignee: 'Approvers', requested_by: 'Rina Kartika', hours_waiting: 5.2, reminders_sent: 3, level: 'escalated', escalated: true, url: '/crises/7', can_remind: true, remind: 'incident' },
  { ...BASE, key: 'scca_signoff-5', module: 'scca', type: 'signoff', id: 5, title: 'Core Banking', ref: 'SCCA-2026-0005', detail: 'Reviewed by BCM Reviewer', assignee: 'Dewi Lestari', working_days_waiting: 9, level: 'escalated', escalated: true, url: '/scca/5', can_remind: true, remind: 'scca_signoff' },
]

function counts(items: typeof ALL) {
  const of = (key: string, value: string) => items.filter((row) => (row as Record<string, unknown>)[key] === value).length
  return { total: items.length, signoff: of('type', 'signoff'), renewal: of('type', 'renewal'), building: of('type', 'building'), incident: of('type', 'incident'), scca: of('module', 'scca'), ra: of('module', 'ra'), ra_branch: of('module', 'ra_branch'), location: of('module', 'location') }
}

async function mockTasks(page: Page, options: { bcm?: boolean } = {}) {
  await signIn(page, options.bcm === false ? { permissions: ['scca.access', 'ra.access', 'ra_branch.access'] } : {})
  const calls: { url: string, method: string }[] = []
  await page.route(/\/api\/tasks/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    calls.push({ url: url.pathname + url.search, method: request.method() })
    if (url.pathname === '/api/tasks/summary') {
      return route.fulfill({ json: {
        mine: { total: 3, signoff: 2, renewal: 1, building: 0, incident: 0, overdue_renewals: 1 },
        all: options.bcm === false ? null : { total: 5, in_approval: 3, stuck: 2, overdue_renewals: 1, due_renewals: 4, building: 0, incident: 1 },
        modules: options.bcm === false ? [] : ['scca', 'ra', 'ra_branch', 'location'],
      } })
    }
    if (request.method() === 'POST') return route.fulfill({ json: { sent: true } })
    const all = url.searchParams.get('scope') === 'all' && options.bcm !== false
    const rows = all ? ALL : MINE
    const type = url.searchParams.get('type')
    const module = url.searchParams.get('module')
    const level = url.searchParams.get('level')
    const items = rows
      .filter((row) => !type || row.type === type)
      .filter((row) => !module || row.module === module)
      .filter((row) => !level || (level === 'stuck' ? row.type === 'signoff' && row.level === 'escalated' : row.level === level))
    return route.fulfill({ json: {
      items, page: 1, per_page: 25, total: items.length, pages: 1, scope: all ? 'all' : 'mine', counts: counts(rows),
      can_see_all: options.bcm !== false, modules: options.bcm === false ? [] : ['scca', 'ra', 'ra_branch', 'location'],
    } })
  })
  return calls
}

test('Home has one overview across the modules, each count opening Task Management', async ({ page }) => {
  await mockTasks(page)
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Overview' })
  await expect(overview.getByRole('link', { name: 'Waiting for me: 3' })).toHaveAttribute('href', '/tasks', { timeout: 60_000 })
  await expect(overview.getByRole('link', { name: 'In approval: 3' })).toHaveAttribute('href', '/tasks?scope=all&type=signoff')
  await expect(overview.getByRole('link', { name: 'Stuck sign-offs: 2' })).toHaveAttribute('href', '/tasks?scope=all&type=signoff&level=stuck')
  await expect(overview.getByRole('link', { name: 'Overdue renewals: 1' })).toHaveAttribute('href', '/tasks?scope=all&type=renewal&level=overdue')
  // The per-module "at a glance" rows and the waiting banners are gone.
  await expect(page.getByText(/at a glance/i)).toHaveCount(0)
  await expect(page.getByText(/waiting for your (sign-off|approval)/)).toHaveCount(0)

  await overview.getByRole('link', { name: 'Stuck sign-offs: 2' }).click()
  await expect(page).toHaveURL(/\/tasks\?scope=all&type=signoff&level=stuck/)
  await expect(page.getByRole('tab', { name: 'Everything' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Stuck sign-offs', { exact: true })).toBeVisible()
  const table = page.getByRole('table')
  await expect(table.getByRole('row', { name: /Core Banking/ })).toBeVisible()
  await expect(table.getByRole('row', { name: /KCP Bintaro/ })).toHaveCount(0)
})

test('without BCM rights Home and Task Management show only my own tasks', async ({ page }) => {
  await mockTasks(page, { bcm: false })
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Overview' })
  await expect(overview.getByRole('link', { name: 'Waiting for me: 3' })).toBeVisible({ timeout: 60_000 })
  await expect(overview.getByRole('link', { name: 'Sign-offs for me: 2' })).toHaveAttribute('href', '/tasks?type=signoff')
  await expect(overview.getByRole('link', { name: 'My overdue renewals: 1' })).toBeVisible()
  await expect(overview.getByRole('link', { name: /In approval/ })).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Task Management' }).click()
  await expect(page.getByRole('heading', { name: 'Task Management' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Everything' })).toHaveCount(0)
  await expect(page.getByRole('table').getByRole('row', { name: /Core Banking/ })).toHaveCount(0)
})

test('My tasks lists every module, with where to act and how urgent it is', async ({ page }) => {
  await mockTasks(page)
  await page.goto('/tasks')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Task Management' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'My tasks' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('link', { name: 'Sign-offs: 2' })).toBeVisible()
  const table = page.getByRole('table')
  const scca = table.getByRole('row', { name: /HR Portal/ })
  await expect(scca.getByText('SCCA', { exact: true })).toBeVisible()
  await expect(scca.getByRole('link', { name: 'Review: HR Portal' })).toHaveAttribute('href', '/scca/approval/4')
  const ra = table.getByRole('row', { name: /Griya CIMB Niaga 2/ })
  await expect(ra.getByText('8 working days')).toBeVisible()
  await expect(ra.getByText('Stuck', { exact: true })).toBeVisible()
  const renewal = table.getByRole('row', { name: /KCP Bintaro/ })
  await expect(renewal.getByText('RA Branch', { exact: true })).toBeVisible()
  await expect(renewal.getByText('32 days overdue')).toBeVisible()
  await expect(renewal.getByRole('link', { name: 'Renew: KCP Bintaro' })).toHaveAttribute('href', '/locations/3')
  // Nobody reminds themselves.
  await expect(table.getByRole('button', { name: /^Remind/ })).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Filter by module' }).click()
  await page.getByRole('option', { name: 'SCCA' }).click()
  await expect(page).toHaveURL(/module=scca/)
  await expect(table.getByRole('row', { name: /Griya CIMB Niaga 2/ })).toHaveCount(0)
})

test('Everything shows every waiting item, and BCM reminds whoever must act', async ({ page }) => {
  const calls = await mockTasks(page)
  await page.goto('/tasks')
  await page.getByRole('tab', { name: 'Everything' }).click({ timeout: 60_000 })
  await expect(page).toHaveURL(/scope=all/)
  const table = page.getByRole('table')
  const incident = table.getByRole('row', { name: /CR-2026-0007/ })
  await expect(incident.getByText('5 hours')).toBeVisible()
  await expect(incident.getByText('Escalated to BCM')).toBeVisible()
  await expect(incident.getByRole('link', { name: 'Open: Incident CR-2026-0007 at Menara Sentraya' })).toHaveAttribute('href', '/crises/7')
  await page.getByRole('button', { name: 'Remind: Core Banking' }).click()
  await expect(page.getByText('Reminder sent').first()).toBeVisible()
  expect(calls.some((call) => call.method === 'POST' && call.url === '/api/tasks/scca_signoff/5/remind')).toBe(true)
  await page.getByRole('link', { name: 'Incidents: 1' }).click()
  await expect(page).toHaveURL(/type=incident/)
  await expect(table.getByRole('row', { name: /Core Banking/ })).toHaveCount(0)
})
