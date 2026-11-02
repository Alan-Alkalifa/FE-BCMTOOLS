<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { AdminUser, Page, UserState } from '~/composables/useAdmin'
import AdminPasswordDialog from '~/components/admin/AdminPasswordDialog.vue'
import AdminUserForm from '~/components/admin/AdminUserForm.vue'

definePageMeta({ permission: 'admin.users.manage' })

const perPage = ref(10)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const overlay = useOverlay()
const userForm = overlay.create(AdminUserForm)
const passwordDialog = overlay.create(AdminPasswordDialog)
const { user: me } = useAuth()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const statusFilter = ref<string>(typeof route.query.status === 'string' ? route.query.status : 'all')
const roleFilter = ref<number | 'all'>(Number(route.query.role_id) || 'all')

const query = computed(() => ({
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  status: typeof route.query.status === 'string' ? route.query.status : undefined,
  role_id: Number(route.query.role_id) || undefined,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
}))

const { data, status, error, refresh } = useFetch<Page<AdminUser>>('/api/admin/users', { query, key: 'admin-users' })
const { data: roles } = useAdminRoles()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

watch(perPage, () => {
  router.replace({ query: { ...route.query, page: undefined } })
})

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => router.replace({ query: { ...route.query, q: value.trim() || undefined, page: undefined } }), 300)
})
onBeforeUnmount(() => clearTimeout(timer))
watch(statusFilter, (value) => router.replace({ query: { ...route.query, status: value === 'all' ? undefined : value, page: undefined } }))
watch(roleFilter, (value) => router.replace({ query: { ...route.query, role_id: value === 'all' ? undefined : value, page: undefined } }))

const statusItems = [
  { label: 'All users', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Without a role', value: 'no_role' },
]
const roleItems = computed(() => [
  { label: 'All roles', value: 'all' as const },
  ...(roles.value?.items ?? []).map((role) => ({ label: role.name, value: role.id })),
])

const columns: TableColumn<AdminUser>[] = [
  { accessorKey: 'display_name', header: 'User' },
  { accessorKey: 'department', header: 'Department' },
  { accessorKey: 'roles', header: 'Roles' },
  { id: 'state', header: 'Status' },
  { accessorKey: 'last_login_at', header: 'Last sign-in' },
  { id: 'actions', header: '', meta: { class: { td: 'w-12 text-end' } } },
]

async function openForm(user?: AdminUser) {
  const saved = await userForm.open({ user: user ?? null, roles: roles.value?.items ?? [] }).result
  if (saved) await refresh()
}

async function setActive(user: AdminUser, active: boolean) {
  if (!active && !(await confirm({
    title: `Deactivate ${user.display_name ?? user.username}?`,
    description: 'They are signed out and cannot sign in. Their SCCAs, comments and sign-offs stay.',
    confirmLabel: 'Deactivate',
    destructive: true,
  }))) return
  try {
    await adminApi.updateUser(user.id, { is_active: active })
    toast.add({ title: active ? 'User activated' : 'User deactivated', color: 'success', icon: 'i-lucide-circle-check' })
    await refresh()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function unlock(user: AdminUser) {
  await adminApi.unlockUser(user.id)
  toast.add({ title: 'User unlocked', color: 'success', icon: 'i-lucide-lock-open' })
  await refresh()
}

async function password(user: AdminUser) {
  if (await passwordDialog.open({ user }).result) await refresh()
}

function actions(user: AdminUser): DropdownMenuItem[][] {
  const state: UserState = userState(user)
  return [
    [
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openForm(user) },
      ...(state === 'locked' ? [{ label: 'Unlock', icon: 'i-lucide-lock-open', onSelect: () => unlock(user) }] : []),
      ...(user.auth_provider === 'local'
        ? [{ label: user.has_password ? 'Reset password' : 'Send invitation again', icon: 'i-lucide-key-round', onSelect: () => password(user) }]
        : []),
    ],
    [
      user.is_active
        ? { label: 'Deactivate', icon: 'i-lucide-user-x', color: 'error' as const, disabled: user.id === me.value?.id, onSelect: () => setActive(user, false) }
        : { label: 'Activate', icon: 'i-lucide-user-check', onSelect: () => setActive(user, true) },
    ],
  ]
}
</script>

<template>
  <AppPage
    title="Users"
    icon="i-lucide-users"
    description="Accounts that can sign in to BCM Tools, and the roles that decide what each one sees."
    :crumbs="[{ label: 'Administration' }, { label: 'Users' }]"
  >
    <template #actions>
      <UButton
        icon="i-lucide-user-plus"
        label="New user"
        @click="openForm()"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="6"
      label="Loading users"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load users"
      :description="adminErrorText(error)"
    />

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by name, email or department"
          aria-label="Search users"
          class="w-full sm:w-80"
        />
        <USelectMenu
          v-model="statusFilter"
          value-key="value"
          :items="statusItems"
          :search-input="false"
          aria-label="Filter by status"
          class="w-44"
        />
        <USelectMenu
          v-model="roleFilter"
          value-key="value"
          :items="roleItems"
          :search-input="false"
          aria-label="Filter by role"
          class="w-48"
        />
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #display_name-cell="{ row }">
          <div class="flex items-center gap-3">
            <UAvatar
              :alt="row.original.display_name ?? row.original.username"
              size="sm"
            />
            <div class="min-w-0">
              <button
                type="button"
                class="block truncate text-start font-medium text-highlighted hover:text-primary hover:underline"
                @click="openForm(row.original)"
              >
                {{ row.original.display_name || row.original.username }}
              </button>
              <p class="truncate text-xs text-muted">
                {{ row.original.username }}
              </p>
            </div>
          </div>
        </template>
        <template #department-cell="{ row }">
          <p class="text-sm">
            {{ row.original.department || '—' }}
          </p>
          <p
            v-if="row.original.job_title"
            class="text-xs text-muted"
          >
            {{ row.original.job_title }}
          </p>
        </template>
        <template #roles-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="role in row.original.roles"
              :key="role.id"
              :label="role.name"
              color="neutral"
              variant="subtle"
              size="sm"
            />
            <span
              v-if="!row.original.roles.length"
              class="text-xs font-medium text-warning"
            >No role</span>
          </div>
        </template>
        <template #state-cell="{ row }">
          <StatusBadge
            :scale="userStatus"
            :value="userState(row.original)"
            size="sm"
          />
        </template>
        <template #last_login_at-cell="{ row }">
          {{ formatDateTime(row.original.last_login_at) || 'Never' }}
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu
            :items="actions(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="`Actions for ${row.original.display_name ?? row.original.username}`"
            />
          </UDropdownMenu>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            No users match these filters.
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        v-model:per-page="perPage"
        :page="data.page"
        :total="data.total"
        :to="(page) => ({ query: { ...route.query, page } })"
        label="Users"
      />
    </UCard>
  </AppPage>
</template>
