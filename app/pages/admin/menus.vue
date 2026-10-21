<script setup lang="ts">
import type { AdminMenu } from '~/composables/useAdmin'
import AdminMenuForm from '~/components/admin/AdminMenuForm.vue'

definePageMeta({ permission: 'admin.menus.manage' })

const BUILT_IN = new Set(['home', 'scca', 'scca.monitoring', 'scca.manage', 'scca.approval', 'admin', 'admin.users', 'admin.roles', 'admin.menus', 'admin.mail', 'admin.scca_config', 'admin.audit'])

const toast = useToast()
const confirm = useConfirm()
const menuForm = useOverlay().create(AdminMenuForm)
const { fetchMenu } = useAuth()
const { data, status, error, refresh } = useFetch<{ items: AdminMenu[] }>('/api/admin/menus', { key: 'admin-menus' })
const { data: permissions } = useAdminPermissions()

const tree = computed(() => {
  const rows = data.value?.items ?? []
  return rows
    .filter((m) => m.parent_id === null)
    .map((m) => ({ menu: m, children: rows.filter((child) => child.parent_id === m.id) }))
})

const permissionText = (code: string | null) =>
  code ? permissions.value?.items.find((perm) => perm.code === code)?.description ?? code : 'Everyone signed in'

async function changed() {
  await Promise.all([refresh(), fetchMenu()])
}

async function edit(menu?: AdminMenu) {
  const saved = await menuForm.open({ menu: menu ?? null, menus: data.value?.items ?? [], permissions: permissions.value?.items ?? [] }).result
  if (saved) await changed()
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
  await adminApi.updateMenu(menu.id, { ...menu, is_active: active })
  toast.add({ title: active ? `${menu.label} is shown` : `${menu.label} is hidden`, color: 'success', icon: 'i-lucide-circle-check' })
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
          v-for="(group, groupIndex) in tree"
          :key="group.menu.id"
        >
          <div
            class="flex items-center gap-3 px-4 py-3"
            :class="group.menu.is_active ? '' : 'opacity-60'"
          >
            <UIcon
              :name="group.menu.icon ?? 'i-lucide-circle'"
              class="size-5 shrink-0 text-muted"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted">
                {{ group.menu.label }}
                <span
                  v-if="!group.menu.is_active"
                  class="ms-1 text-xs font-normal text-muted"
                >(hidden)</span>
              </p>
              <p class="truncate text-xs text-muted">
                <code v-if="group.menu.route">{{ group.menu.route }}</code>
                <span v-else>Group</span>
                · {{ permissionText(group.menu.permission) }}
              </p>
            </div>
            <AdminMenuRowActions
              :menu="group.menu"
              :first="groupIndex === 0"
              :last="groupIndex === tree.length - 1"
              :built-in="BUILT_IN.has(group.menu.code)"
              @up="move(tree.map((g) => g.menu), groupIndex, -1)"
              @down="move(tree.map((g) => g.menu), groupIndex, 1)"
              @edit="edit(group.menu)"
              @toggle="setActive(group.menu, $event)"
              @remove="remove(group.menu)"
            />
          </div>
          <ol
            v-if="group.children.length"
            class="ms-12 border-s border-default"
          >
            <li
              v-for="(child, childIndex) in group.children"
              :key="child.id"
              class="flex items-center gap-3 border-t border-default py-2.5 pe-4 ps-4"
              :class="child.is_active ? '' : 'opacity-60'"
            >
              <UIcon
                :name="child.icon ?? 'i-lucide-circle'"
                class="size-4 shrink-0 text-muted"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-highlighted">
                  {{ child.label }}
                  <span
                    v-if="!child.is_active"
                    class="ms-1 text-xs font-normal text-muted"
                  >(hidden)</span>
                </p>
                <p class="truncate text-xs text-muted">
                  <code>{{ child.route }}</code> · {{ permissionText(child.permission) }}
                </p>
              </div>
              <AdminMenuRowActions
                :menu="child"
                :first="childIndex === 0"
                :last="childIndex === group.children.length - 1"
                :built-in="BUILT_IN.has(child.code)"
                @up="move(group.children, childIndex, -1)"
                @down="move(group.children, childIndex, 1)"
                @edit="edit(child)"
                @toggle="setActive(child, $event)"
                @remove="remove(child)"
              />
            </li>
          </ol>
        </li>
      </ol>
    </UCard>
    <p class="text-xs text-muted">
      Built-in items can be renamed, reordered and hidden but not deleted. Hiding an item does not remove access: the page still checks the permission.
    </p>
  </AppPage>
</template>
