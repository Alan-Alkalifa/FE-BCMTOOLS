import { expect, test, type Page } from '@playwright/test'
import { ADMIN_MENU, ALL_PERMISSIONS, signIn } from '../fixtures/auth'

test.setTimeout(90_000)

/** The Administration > Menus page on the built-in tree; POST /api/admin/menus is answered by `post`. */
async function openMenus(page: Page, post: (body: Record<string, unknown>) => { status: number, json: unknown }) {
  await signIn(page)
  const menus = ADMIN_MENU.map((m, index) => ({
    id: index + 1,
    code: m.code,
    label: m.label,
    icon: m.icon,
    route: m.route,
    parent_id: m.parent ? ADMIN_MENU.findIndex((p) => p.code === m.parent) + 1 : null,
    sort_order: (index + 1) * 10,
    permission: m.permission,
    is_active: true,
  }))
  const posts: Record<string, unknown>[] = []
  await page.route('**/api/admin/permissions', (route) => route.fulfill({ json: { items: ALL_PERMISSIONS.map((code) => ({ code, module: 'admin', description: code })) } }))
  await page.route('**/api/admin/menus', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fulfill({ json: { items: menus } })
    const body = request.postDataJSON() as Record<string, unknown>
    posts.push(body)
    const answer = post(body)
    if (answer.status === 201) menus.push({ id: menus.length + 1, code: 'new', permission: null, ...body } as (typeof menus)[number])
    return route.fulfill({ status: answer.status, json: answer.json })
  })
  await page.goto('/admin/menus')
  await expect(page.getByText('Roles and permissions').first()).toBeVisible({ timeout: 40_000 })
  return { posts }
}

async function fillGroup(page: Page, label: string, parent: string) {
  await page.getByRole('button', { name: 'Add item' }).first().click()
  await page.getByRole('dialog').getByRole('textbox').first().fill(label)
  await page.getByRole('dialog').getByText('Top level', { exact: true }).click()
  await page.getByRole('option', { name: parent, exact: true }).click()
}

test('a group is added inside a group that is already inside a group', async ({ page }) => {
  const { posts } = await openMenus(page, (body) => ({ status: 201, json: body }))
  await fillGroup(page, 'Sub group', 'Sites / Disaster')
  await page.getByRole('dialog').getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByText('Menu item added').first()).toBeVisible()
  // Disaster is the group under Sites: the new group has it as its parent and no page of its own.
  expect(posts[0]).toMatchObject({ label: 'Sub group', route: null, parent_id: 23 })
})

test('an error the server returns for a field the form has not is shown, not lost', async ({ page }) => {
  await openMenus(page, () => ({ status: 422, json: { error: 'validation_failed', details: { code: 'A menu with this code already exists.' } } }))
  await fillGroup(page, 'Monitoring', 'Administration')
  await page.getByRole('dialog').getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByRole('dialog').getByText('A menu with this code already exists.')).toBeVisible()
})
