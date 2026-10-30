import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../fixtures/auth'

test.setTimeout(90_000)

const TASKS = [
  {
    type: 'incident', id: 7, action: 'declare', name: 'Griya CIMB Niaga 2', ref: 'CR-2026-0007', kind: 'head_office', hazard: 'Flood/ Flash Flood',
    title: 'Incident CR-2026-0007 at Griya CIMB Niaga 2', url: '/crises/7', requested_by: 'Rina Kartika', requested_at: '2026-10-30T01:00:00Z',
    working_days_waiting: 0, hours_waiting: 5.2, reminders_sent: 4, last_reminded_at: '2026-10-30T05:00:00Z', escalated_at: '2026-10-30T05:00:00Z', can_decide: true, own: false,
  },
  {
    type: 'building', id: 12, action: 'register', name: 'KCP Bintaro', ref: 'RA-BR-0012', kind: 'branch', hazard: null,
    title: 'New branch: KCP Bintaro', url: '/locations/12', requested_by: 'Test User', requested_at: '2026-10-27T02:00:00Z',
    working_days_waiting: 3, hours_waiting: 72, reminders_sent: 1, last_reminded_at: '2026-10-30T02:00:00Z', escalated_at: null, can_decide: false, own: true,
  },
  {
    type: 'building', id: 3, action: 'deactivate', name: 'Menara Sentraya', ref: 'RA-HQ-0003', kind: 'head_office', hazard: null,
    title: 'Make inactive: Menara Sentraya', url: '/locations/3', requested_by: 'Budi', requested_at: '2026-10-29T02:00:00Z',
    working_days_waiting: 1, hours_waiting: 24, reminders_sent: 0, last_reminded_at: null, escalated_at: null, can_decide: true, own: false,
  },
]

async function mockTasks(page: Page) {
  await signIn(page)
  const calls: { url: string, method: string }[] = []
  await page.route(/\/api\/ra\/tasks/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    calls.push({ url: url.pathname + url.search, method: request.method() })
    if (request.method() === 'POST') {
      const task = { ...TASKS[2]!, reminders_sent: 1, last_reminded_at: '2026-10-30T06:00:00Z' }
      return route.fulfill({ json: { task, email_sent: true } })
    }
    const type = url.searchParams.get('type')
    const kind = url.searchParams.get('kind')
    const items = TASKS
      .filter((task) => !type || (type === 'incident' ? task.type === 'incident' : task.action === type))
      .filter((task) => !kind || (task.type === 'building' && task.kind === kind))
    return route.fulfill({ json: { items, page: 1, per_page: 25, total: items.length, pages: 1, counts: { total: 3, register: 1, deactivate: 1, incident: 1 } } })
  })
  return calls
}

test('Task Management is its own menu and lists what waits for approval', async ({ page }) => {
  await mockTasks(page)
  await page.goto('/tasks')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Task Management' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Task Management' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Incidents: 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New buildings and branches: 1' })).toBeVisible()

  const table = page.getByRole('table')
  const incident = table.getByRole('row', { name: /CR-2026-0007/ })
  await expect(incident.getByText('5 hours')).toBeVisible()
  await expect(incident.getByText('Escalated to BCM')).toBeVisible()
  await expect(incident.getByRole('link', { name: 'Review: Incident CR-2026-0007 at Griya CIMB Niaga 2' })).toHaveAttribute('href', '/crises/7')
  const own = table.getByRole('row', { name: /KCP Bintaro/ })
  await expect(own.getByText('RA Branch', { exact: true })).toBeVisible()
  await expect(own.getByText('3 working days')).toBeVisible()
  await expect(own.getByText('You asked. Someone else approves.')).toBeVisible()
  await expect(own.getByRole('link', { name: 'Open: New branch: KCP Bintaro' })).toHaveAttribute('href', '/locations/12')
})

test('the KPI cards and filters narrow the list, and Remind emails the approvers', async ({ page }) => {
  const calls = await mockTasks(page)
  await page.goto('/tasks')
  await page.getByRole('link', { name: 'Incidents: 1' }).click({ timeout: 60_000 })
  await expect(page).toHaveURL(/type=incident/)
  await expect(page.getByRole('table').getByRole('row', { name: /KCP Bintaro/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('combobox', { name: 'Filter by module' }).click()
  await page.getByRole('option', { name: 'RA Branch' }).click()
  await expect(page).toHaveURL(/kind=branch/)
  await expect(page.getByRole('table').getByRole('row', { name: /CR-2026-0007/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters' }).click()

  await page.getByRole('button', { name: 'Remind the approvers: Make inactive: Menara Sentraya' }).click()
  await expect(page.getByText('Approvers reminded').first()).toBeVisible()
  expect(calls.some((call) => call.method === 'POST' && call.url === '/api/ra/tasks/building/3/remind')).toBe(true)
})

test('without approval rights Task Management is not offered', async ({ page }) => {
  await signIn(page, { permissions: ['ra.access', 'ra.edit'] })
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('link', { name: 'Task Management' })).toHaveCount(0)
  await page.goto('/tasks')
  await expect(page).toHaveURL(/\/forbidden/)
})
