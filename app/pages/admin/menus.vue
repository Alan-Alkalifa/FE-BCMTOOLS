<script setup lang="ts">
import type { AdminMenu } from '~/composables/useAdmin'
import AdminMenuForm from '~/components/admin/AdminMenuForm.vue'

definePageMeta({ permission: 'admin.menus.manage' })

const BUILT_IN = new Set(['home', 'scca', 'scca.monitoring', 'scca.manage', 'scca.approval', 'admin', 'admin.users', 'admin.roles', 'admin.menus', 'admin.mail', 'admin.scca_config', 'admin.applications', 'admin.audit'])

const toast = useToast()
const confirm = useConfirm()
const menuForm = useOverlay().create(AdminMenuForm)
const { fetchMenu } = useAuth()
const { data, status, error, refresh } = useFetch<{ items: AdminMenu[] }>('/api/admin/menus', { key: 'admin-menus' })
const { data: permissions } = useAdminPermissions()

/** The tree as rows in display order: groups can hold pages and other groups (three deep). */
interface TreeRow {
  menu: AdminMenu
  depth: number
  siblings: AdminMenu[]
  index: number
  children: number
}
const collapsed = ref(new Set<number>())
const rows = computed<TreeRow[]>(() => {
  const all = data.value?.items ?? []
  const out: TreeRow[] = []
  const walk = (parent: number | null, depth: number) => {
    const siblings = all.filter((m) => m.parent_id === parent)
    siblings.forEach((menu, index) => {
      const children = all.filter((child) => child.parent_id === menu.id).length
      out.push({ menu, depth, siblings, index, children })
      if (!collapsed.value.has(menu.id)) walk(menu.id, depth + 1)
    })
  }
  walk(null, 0)
  return out
})
function toggle(id: number) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

const permissionText = (code: string | null) =>
  code ? permissions.value?.items.find((perm) => perm.code === code)?.description ?? code : 'Everyone signed in'

async function changed() {
  await Promise.all([refresh(), fetchMenu()])
}

async function edit(menu?: AdminMenu, parentId: number | null = null) {
  const saved = await menuForm.open({ menu: menu ?? null, parentId, menus: data.value?.items ?? [], permissions: permissions.value?.items ?? [] }).result
  if (saved) await changed()
}

const all = computed(() => data.value?.items ?? [])
const byId = computed(() => new Map(all.value.map((m) => [m.id, m])))
/** 1 for a top-level menu, 2 for one inside a group, and so on. */
function level(menu: AdminMenu): number {
  let depth = 1
  for (let current = menu; current.parent_id && depth < 10; depth++) current = byId.value.get(current.parent_id) ?? { ...current, parent_id: null }
  return depth
}
/** The group directly above in the same list takes it in, as the last item (up to the third group level). */
const intoGroupAbove = (row: TreeRow) => {
  const above = row.siblings[row.index - 1]
  return above && !above.route && level(above) <= 3 ? above : null
}

async function saveOrder(items: { id: number, parent_id: number | null, sort_order: number }[]) {
  try {
    await adminApi.orderMenus(items)
    await changed()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function indent(row: TreeRow) {
  const group = intoGroupAbove(row)
  if (!group) return
  const inside = [...all.value.filter((m) => m.parent_id === group.id), row.menu]
  collapsed.value = new Set([...collapsed.value].filter((id) => id !== group.id))
  await saveOrder(inside.map((m, i) => ({ id: m.id, parent_id: group.id, sort_order: (i + 1) * 10 })))
}

async function outdent(row: TreeRow) {
  const parent = row.menu.parent_id ? byId.value.get(row.menu.parent_id) : undefined
  if (!parent) return
  // It goes right after the group it leaves, in that group's own list.
  const beside = all.value.filter((m) => m.parent_id === parent.parent_id && m.id !== row.menu.id)
  beside.splice(beside.findIndex((m) => m.id === parent.id) + 1, 0, row.menu)
  await saveOrder(beside.map((m, i) => ({ id: m.id, parent_id: parent.parent_id, sort_order: (i + 1) * 10 })))
}

async function move(siblings: AdminMenu[], index: number, step: -1 | 1) {
  const target = index + step
  if (target < 0 || target >= siblings.length) return
  const order = [...siblings]
  ;[order[index], order[target]] = [order[target]!, order[index]!]
  await adminApi.orderMenus(order.map((m, i) => ({ id: m.id, parent_id: m.parent_id, sort_order: (i + 1) * 10 })))
  await changed()
}

async function setActive(menu: AdminMenu, active: boolean) {
  // The API takes the editable fields only: sending the row as it is (with its id) is refused.
  const { id: _id, code: _code, ...fields } = menu
  try {
    await adminApi.updateMenu(menu.id, { ...fields, is_active: active })
    toast.add({ title: active ? `${menu.label} is shown` : `${menu.label} is hidden`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  // Also after a refusal, so the switch goes back to what is saved.
  await changed()
}

async function remove(menu: AdminMenu) {
  if (!(await confirm({ title: `Delete ${menu.label}?`, description: 'It disappears from every menu.', confirmLabel: 'Delete', destructive: true }))) return
  try {
    await adminApi.deleteMenu(menu.id)
    await changed()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <AppPage
    title="Menus"
    icon="i-lucide-panel-left"
    description="The sidebar, from the database. Each user sees the items their role allows."
    :crumbs="[{ label: 'Administration' }, { label: 'Menus' }]"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Add item"
        @click="edit()"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load menus"
      :description="adminErrorText(error)"
    />

    <SkeletonCard
      v-else-if="status === 'pending' && !data"
      :lines="8"
    />

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <ol class="divide-y divide-default">
        <li
          v-for="row in rows"
          :key="row.menu.id"
          class="flex items-center gap-3 py-2.5 pe-4"
          :class="row.menu.is_active ? '' : 'opacity-60'"
          :style="{ paddingInlineStart: `${1 + row.depth * 2}rem` }"
        >
          <UButton
            v-if="row.children"
            color="neutral"
            variant="ghost"
            size="xs"
            :icon="collapsed.has(row.menu.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            :aria-label="`${collapsed.has(row.menu.id) ? 'Expand' : 'Collapse'} ${row.menu.label}`"
            :aria-expanded="!collapsed.has(row.menu.id)"
            class="-ms-2"
            @click="toggle(row.menu.id)"
          />
          <span
            v-else
            class="w-4"
          />
          <UIcon
            :name="row.menu.icon ?? 'i-lucide-circle'"
            class="shrink-0 text-muted"
            :class="row.depth ? 'size-4' : 'size-5'"
          />
          <div class="min-w-0 flex-1">
            <p
              class="text-highlighted"
              :class="row.menu.route ? 'text-sm font-medium' : 'font-medium'"
            >
              {{ row.menu.label }}
              <span
                v-if="!row.menu.is_active"
                class="ms-1 text-xs font-normal text-muted"
              >(hidden)</span>
            </p>
            <p class="truncate text-xs text-muted">
              <code v-if="row.menu.route">{{ row.menu.route }}</code>
              <span v-else>Group{{ row.children ? ` of ${row.children}` : ', empty: hidden in the sidebar' }}</span>
              · {{ permissionText(row.menu.permission) }}
            </p>
          </div>
          <AdminMenuRowActions
            :menu="row.menu"
            :first="row.index === 0"
            :last="row.index === row.siblings.length - 1"
            :built-in="BUILT_IN.has(row.menu.code)"
            :group="!row.menu.route"
            :can-indent="!!intoGroupAbove(row)"
            :can-outdent="!!row.menu.parent_id"
            @indent="indent(row)"
            @outdent="outdent(row)"
            @add="edit(undefined, row.menu.id)"
            @up="move(row.siblings, row.index, -1)"
            @down="move(row.siblings, row.index, 1)"
            @edit="edit(row.menu)"
            @toggle="setActive(row.menu, $event)"
            @remove="remove(row.menu)"
          />
        </li>
      </ol>
    </UCard>
    <p class="text-xs text-muted">
      A group can hold pages and other groups, three groups deep (group › group › group › page). Use the indent buttons to move an item into the group above it or back out, or + to add an item inside a group. A group with nothing visible in it is hidden in the sidebar.
      Built-in items can be renamed, reordered and hidden but not deleted. Hiding an item does not remove access: the page still checks the permission.
    </p>
  </AppPage>
</template>
