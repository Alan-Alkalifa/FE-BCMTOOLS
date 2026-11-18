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
  const orders: { id: number, parent_id: number | null, sort_order: number }[][] = []
  await page.route('**/api/admin/menus/order', (route) => {
    orders.push((route.request().postDataJSON() as { items: (typeof orders)[number] }).items)
    return route.fulfill({ json: { items: menus } })
  })
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
  return { posts, orders }
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

test('an item is moved into the group above it and back out, without opening the form', async ({ page }) => {
  const { orders } = await openMenus(page, (body) => ({ status: 201, json: body }))
  // RA Branch (17) goes to the end of RA HO (13), which holds 14, 15 and 16.
  await page.getByRole('button', { name: 'Move RA Branch into the group above' }).click()
  await expect.poll(() => orders.length).toBe(1)
  expect(orders[0]).toEqual([14, 15, 16, 17].map((id, i) => ({ id, parent_id: 13, sort_order: (i + 1) * 10 })))

  // Disaster (23) leaves Sites (21) and lands right after it, at the top level.
  await page.getByRole('button', { name: 'Move Disaster out of its group' }).click()
  await expect.poll(() => orders.length).toBe(2)
  const top = [...orders[1]!].sort((a, b) => a.sort_order - b.sort_order).map((item) => item.id)
  expect(top.indexOf(23)).toBe(top.indexOf(21) + 1)
  expect(orders[1]!.every((item) => item.parent_id === null)).toBe(true)
  await expect(page.getByRole('button', { name: 'Home is built in' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Move Home out of its group' })).toBeDisabled()
})

test('the + of a group adds an item inside it, as a page or as another group', async ({ page }) => {
  const { posts } = await openMenus(page, (body) => ({ status: 201, json: body }))
  await page.getByRole('button', { name: 'Add an item inside Sites' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Sites', { exact: true })).toBeVisible()
  await dialog.getByRole('textbox').first().fill('Reports')
  await dialog.getByRole('switch', { name: 'This is a group' }).click()
  await dialog.getByRole('button', { name: 'Add item' }).click()
  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0]).toMatchObject({ label: 'Reports', route: null, parent_id: 21 })
})
