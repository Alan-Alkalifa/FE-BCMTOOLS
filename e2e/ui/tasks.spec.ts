import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../fixtures/auth'

test.setTimeout(90_000)

type Module = 'scca' | 'ra' | 'ra_branch' | 'bia' | 'sites'

const BASE = {
  detail: null, kind: null, assignee: null, requested_by: null, since: null, working_days_waiting: null, hours_waiting: null,
  due_date: null, days_left: null, reminders_sent: 0, escalated: false, level: 'ok', mine: false, involved: false, url: '/',
}
const TASKS = [
  { ...BASE, key: 'scca_signoff-4', module: 'scca', type: 'signoff', id: 4, title: 'HR Portal', ref: 'SCCA-2026-0004', detail: 'Approved by IT Support', assignee: 'Test User', requested_by: 'Rina Kartika', working_days_waiting: 2, mine: true, url: '/scca/approval/4' },
  { ...BASE, key: 'scca_signoff-5', module: 'scca', type: 'signoff', id: 5, title: 'Core Banking', ref: 'SCCA-2026-0005', detail: 'Reviewed by BCM Reviewer', assignee: 'Dewi Lestari', working_days_waiting: 9, level: 'escalated', escalated: true, reminders_sent: 2, url: '/scca/5' },
  { ...BASE, key: 'ra_signoff-9', module: 'ra', type: 'signoff', id: 9, title: 'Griya CIMB Niaga 2', ref: 'RA-2026-0009', detail: 'Business Continuity Management Head', assignee: 'Test User', working_days_waiting: 8, level: 'escalated', escalated: true, mine: true, url: '/ra/manage/9?tab=signoff' },
  { ...BASE, key: 'ra_renewal-3', module: 'ra_branch', type: 'renewal', id: 3, title: 'KCP Bintaro', ref: 'RAB-2025-0003', detail: 'Renewal not started', assignee: 'Budi', due_date: '2026-10-01', days_left: -32, level: 'overdue', mine: true, url: '/ra-branch/manage/new?location_id=3' },
  { ...BASE, key: 'bia_signoff-21', module: 'bia', type: 'signoff', id: 21, title: 'Treasury Operations', ref: 'BIA-2026-0021', detail: 'Group Head / IMT', assignee: 'Gina Group Head', requested_by: 'Rina Kartika', working_days_waiting: 3, level: 'reminder', involved: true, url: '/bianca/monitoring/21' },
  { ...BASE, key: 'incident-7', module: 'sites', type: 'disaster', id: 7, title: 'Disaster DS-2026-0007 at Menara Sentraya', ref: 'DS-2026-0007', detail: 'Flood/ Flash Flood', assignee: 'Approvers', requested_by: 'Rina Kartika', hours_waiting: 5.2, reminders_sent: 3, level: 'escalated', escalated: true, mine: true, url: '/disasters/7' },
  { ...BASE, key: 'building-12', module: 'ra', type: 'building', id: 12, title: 'New building: Menara Sentraya', ref: 'HO-0012', detail: 'New', kind: 'head_office', assignee: 'Approvers', requested_by: 'Rina Kartika', working_days_waiting: 1, mine: false, url: '/admin/buildings/12' },
]
const WAITING = ['signoff', 'disaster', 'incident']

/** BCM sees every module (with Sites); an RA HO / Branch user only their sign-offs and renewals. */
async function mockTasks(page: Page, options: { bcm?: boolean } = {}) {
  const bcm = options.bcm !== false
  await signIn(page, bcm ? {} : { permissions: ['ra.access', 'ra_branch.access'] })
  const tabs: Module[] = bcm ? ['scca', 'ra', 'ra_branch', 'bia', 'sites'] : ['ra', 'ra_branch']
  const visible = TASKS.filter((row) => tabs.includes(row.module as Module) && (bcm || row.mine || row.involved))
  const calls: string[] = []
  await page.route(/\/api\/tasks/, async (route) => {
    const url = new URL(route.request().url())
    calls.push(url.pathname + url.search)
    if (url.pathname === '/api/tasks/summary') {
      return route.fulfill({ json: { modules: bcm
        ? [
            { module: 'scca', oversees: true, mine: 1, in_approval: 2, stuck: 1, overdue_renewals: 0, due_renewals: 3 },
            { module: 'ra', oversees: true, mine: 1, in_approval: 1, stuck: 1, overdue_renewals: 0, due_renewals: 0, building: 1 },
            { module: 'ra_branch', oversees: true, mine: 0, in_approval: 0, stuck: 0, overdue_renewals: 1, due_renewals: 0, building: 0 },
            { module: 'bia', oversees: true, mine: 0, in_approval: 1, stuck: 0, overdue_renewals: 2, due_renewals: 1 },
            { module: 'sites', oversees: true, mine: 1, in_approval: 1, stuck: 1 },
          ]
        : [
            { module: 'ra', oversees: false, mine: 1, in_approval: 1 },
            { module: 'ra_branch', oversees: false, mine: 0, in_approval: 0 },
          ] } })
    }
    const asked = url.searchParams.get('module') as Module | null
    const module = asked && tabs.includes(asked) ? asked : tabs[0]!
    const own = visible.filter((row) => row.module === module)
    const type = url.searchParams.get('type')
    const level = url.searchParams.get('level')
    const view = url.searchParams.get('view')
    const waiting = (row: typeof TASKS[number]) => WAITING.includes(row.type)
    const stuck = (row: typeof TASKS[number]) => waiting(row) && row.level === 'escalated'
    const items = own
      .filter((row) => !type || row.type === type)
      .filter((row) => view !== 'mine' || (waiting(row) && row.mine))
      .filter((row) => view !== 'approval' || waiting(row))
      .filter((row) => !level || (level === 'stuck' ? stuck(row) : row.level === level))
    const of = (value: string) => own.filter((row) => row.type === value).length
    const cards = {
      mine: own.filter((row) => waiting(row) && row.mine).length,
      in_approval: own.filter(waiting).length,
      ...(bcm
        ? {
            stuck: own.filter(stuck).length,
            ...(module === 'sites' ? {} : { overdue_renewals: own.filter((row) => row.level === 'overdue').length, due_renewals: 0 }),
            ...(module === 'ra' || module === 'ra_branch' ? { building: of('building') } : {}),
          }
        : {}),
    }
    return route.fulfill({ json: {
      items, page: 1, per_page: 25, total: items.length, pages: 1, module, oversees: bcm,
      tabs: tabs.map((name) => ({ module: name, total: visible.filter((row) => row.module === name).length })),
      counts: { total: own.length, signoff: of('signoff'), renewal: of('renewal'), building: of('building'), disaster: of('disaster'), incident: of('incident'), ...cards },
    } })
  })
  return calls
}

test('Home shows each module in a tab: Waiting for me and In approval, and the Overview Administrator for BCM', async ({ page }) => {
  await mockTasks(page)
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Overview', exact: true })
  await expect(overview.getByRole('tab')).toHaveText([/SCCA/, /RA HO/, /RA Branch/, /BIA/, /Sites/], { timeout: 60_000 })
  await expect(overview.getByRole('tab', { name: /SCCA/ })).toHaveAttribute('aria-selected', 'true')
  const cards = overview.getByTestId('home-overview-cards')
  await expect(cards.getByRole('link')).toHaveCount(2)
  await expect(cards.getByRole('link', { name: 'Waiting for me: 1' })).toHaveAttribute('href', '/tasks?module=scca&view=mine')
  await expect(cards.getByRole('link', { name: 'In approval: 2' })).toHaveAttribute('href', '/tasks?module=scca&view=approval')
  const admin = overview.getByRole('region', { name: /Overview Administrator/ })
  await expect(admin.getByRole('link')).toHaveCount(2)
  await expect(admin.getByRole('link', { name: 'Stuck sign-offs: 1' })).toHaveAttribute('href', '/tasks?module=scca&level=stuck')
  await expect(admin.getByRole('link', { name: 'Overdue renewals: 0' })).toHaveAttribute('href', '/tasks?module=scca&type=renewal&level=overdue')

  // RA HO adds the buildings waiting for approval; BIA has its own tab.
  await overview.getByRole('tab', { name: /RA HO/ }).click()
  await expect(admin.getByRole('link', { name: 'Buildings waiting: 1' })).toHaveAttribute('href', '/tasks?module=ra&type=building')
  await overview.getByRole('tab', { name: /BIA/ }).click()
  await expect(cards.getByRole('link', { name: 'In approval: 1' })).toHaveAttribute('href', '/tasks?module=bia&view=approval')
  await expect(admin.getByRole('link', { name: 'Overdue renewals: 2' })).toBeVisible()
  await expect(admin.getByRole('link', { name: /Buildings/ })).toHaveCount(0)

  await overview.getByRole('tab', { name: /SCCA/ }).click()
  await admin.getByRole('link', { name: 'Stuck sign-offs: 1' }).click()
  await expect(page).toHaveURL(/\/tasks\?module=scca&level=stuck/)
  await expect(page.getByRole('tab', { name: /SCCA/ })).toHaveAttribute('aria-selected', 'true')
  const table = page.getByRole('table')
  await expect(table.getByRole('row', { name: /Core Banking/ })).toBeVisible()
  await expect(table.getByRole('row', { name: /HR Portal/ })).toHaveCount(0)
  // The same cards in Task Management: the Admin Task row, then Waiting for me and In approval.
  const row = page.getByTestId('tasks-admin-cards')
  await expect(page.getByRole('heading', { name: 'Admin Task' })).toBeVisible()
  await expect(row.getByRole('link', { name: 'Stuck sign-offs: 1' })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('tasks-cards').getByRole('link').first()).toHaveAccessibleName('Waiting for me: 1')
  await expect(page.getByTestId('tasks-cards').getByRole('link').nth(1)).toHaveAccessibleName('In approval: 2')
})

test('without BCM rights Home and Task Management show only the user\'s modules and own tasks', async ({ page }) => {
  await mockTasks(page, { bcm: false })
  await page.goto('/')
  const overview = page.getByRole('region', { name: 'Overview', exact: true })
  await expect(overview.getByRole('tab')).toHaveText([/RA HO/, /RA Branch/], { timeout: 60_000 })
  const cards = overview.getByTestId('home-overview-cards')
  await expect(cards.getByRole('link', { name: 'Waiting for me: 1' })).toHaveAttribute('href', '/tasks?module=ra&view=mine')
  await expect(cards.getByRole('link', { name: 'In approval: 1' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Overview Administrator/ })).toHaveCount(0)
  await expect(overview.getByRole('link', { name: /Stuck|Overdue|Buildings/ })).toHaveCount(0)

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Task Management' }).click()
  await expect(page.getByRole('heading', { name: 'Task Management' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('tab')).toHaveText([/RA HO/, /RA Branch/])
  await expect(page.getByRole('tab', { name: /RA HO/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Admin Task' })).toHaveCount(0)
  await expect(page.getByTestId('tasks-cards').getByRole('link').first()).toHaveAccessibleName('Waiting for me: 1')
  await expect(page.getByRole('table').getByRole('row', { name: /Griya CIMB Niaga 2/ })).toBeVisible()
  // Buildings waiting for approval are only for who opens Master building.
  await expect(page.getByRole('link', { name: /^Buildings/ })).toHaveCount(0)
})

test('Task Management has one tab per module, no My tasks / Everything, and nothing to remind', async ({ page }) => {
  const calls = await mockTasks(page)
  await page.goto('/tasks')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Task Management' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 })
  await expect(page.getByRole('main').getByRole('tab')).toHaveText([/SCCA/, /RA HO/, /RA Branch/, /BIA/, /Sites/])
  await expect(page.getByRole('tab', { name: 'My tasks' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Everything' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Filter by module' })).toHaveCount(0)

  // SCCA: Waiting for me and In approval first, then its sign-offs and renewals.
  const table = page.getByRole('table')
  const cards = page.getByTestId('tasks-cards')
  await expect(cards.getByRole('link')).toHaveText([/Waiting for me/, /In approval/])
  await expect(page.getByRole('link', { name: /^Sign-offs/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Renewals/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Buildings: / })).toHaveCount(0)
  await expect(table.getByRole('row', { name: /HR Portal/ }).getByRole('link', { name: 'Review: HR Portal' })).toHaveAttribute('href', '/scca/approval/4')
  await expect(table.getByRole('button', { name: /Remind/ })).toHaveCount(0)
  await cards.getByRole('link', { name: 'Waiting for me: 1' }).click()
  await expect(page).toHaveURL(/view=mine/)
  await expect(table.getByRole('row', { name: /Core Banking/ })).toHaveCount(0)
  await expect(table.getByRole('row', { name: /HR Portal/ })).toBeVisible()

  // RA Branch: an overdue renewal.
  await page.getByRole('tab', { name: /RA Branch/ }).click()
  await expect(page).toHaveURL(/module=ra_branch/)
  const renewal = table.getByRole('row', { name: /KCP Bintaro/ })
  await expect(renewal.getByText('32 days overdue')).toBeVisible()
  await expect(renewal.getByRole('link', { name: 'Renew: KCP Bintaro' })).toHaveAttribute('href', '/ra-branch/manage/new?location_id=3')

  // BIA: its approvals and renewals.
  await page.getByRole('tab', { name: /BIA/ }).click()
  await expect(page).toHaveURL(/module=bia/)
  await expect(cards.getByRole('link')).toHaveText([/Waiting for me/, /In approval/])
  await expect(table.getByRole('row', { name: /Treasury Operations/ }).getByRole('link', { name: 'Open: Treasury Operations' })).toHaveAttribute('href', '/bianca/monitoring/21')

  // Sites: disasters and incidents waiting for approval, never reminded from here.
  await page.getByRole('tab', { name: /Sites/ }).click()
  await expect(page).toHaveURL(/module=sites/)
  await expect(page.getByRole('link', { name: 'Disasters: 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Incidents: 0' })).toBeVisible()
  await expect(page.getByTestId('tasks-admin-cards').getByRole('link', { name: 'Escalated approvals: 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Buildings/ })).toHaveCount(0)
  const disaster = table.getByRole('row', { name: /DS-2026-0007/ })
  await expect(disaster.getByText('5 hours')).toBeVisible()
  await expect(disaster.getByRole('link', { name: 'Review: Disaster DS-2026-0007 at Menara Sentraya' })).toHaveAttribute('href', '/disasters/7')
  await expect(page.getByRole('button', { name: /Remind/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Disasters: 1' }).click()
  await expect(page).toHaveURL(/module=sites.*type=disaster|type=disaster.*module=sites/)

  // RA HO: its building waiting for approval is an admin task.
  await page.getByRole('tab', { name: /RA HO/ }).click()
  await expect(page.getByTestId('tasks-admin-cards').getByRole('link', { name: 'Buildings waiting: 1' })).toBeVisible()
  await expect(cards.getByRole('link', { name: /^Buildings/ })).toHaveCount(0)
  const building = table.getByRole('row', { name: /New building: Menara Sentraya/ })
  await expect(building.getByText('HO-0012 · New')).toBeVisible()
  // Reviewed in Administration › Master building.
  await expect(building.getByRole('link', { name: 'Open: New building: Menara Sentraya' })).toHaveAttribute('href', '/admin/buildings/12')
  // Old links to the Location tab open Sites.
  await page.goto('/tasks?module=location')
  await expect(page.getByRole('tab', { name: /Sites/ })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  expect(calls.some((call) => call.includes('/remind'))).toBe(false)
})
