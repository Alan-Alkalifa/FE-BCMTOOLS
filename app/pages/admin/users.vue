<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { AdminUser, Page, UserState } from '~/composables/useAdmin'
import AdminPasswordDialog from '~/components/admin/AdminPasswordDialog.vue'
import AdminUserForm from '~/components/admin/AdminUserForm.vue'
import AdminUserImport from '~/components/admin/AdminUserImport.vue'

definePageMeta({ permission: 'admin.users.manage' })

const PER_PAGE = 25
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const overlay = useOverlay()
const userForm = overlay.create(AdminUserForm)
const passwordDialog = overlay.create(AdminPasswordDialog)
const importDialog = overlay.create(AdminUserImport)
const { user: me } = useAuth()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const statusFilter = ref<string>(typeof route.query.status === 'string' ? route.query.status : 'all')
const roleFilter = ref<number | 'all'>(Number(route.query.role_id) || 'all')

// Directorate / Division / Organization level (the HR fields), kept in the URL.
const { data: orgValues, refresh: refreshOrg } = useUserOrgValues()
function queryFilter(name: 'directorate' | 'division' | 'org_level') {
  return computed<string>({
    get: () => (typeof route.query[name] === 'string' && route.query[name] ? route.query[name] as string : 'all'),
    set: (value) => router.replace({ query: { ...route.query, [name]: value === 'all' ? undefined : value, page: undefined } }),
  })
}
const directorateFilter = queryFilter('directorate')
const divisionFilter = queryFilter('division')
const levelFilter = queryFilter('org_level')
function valueItems(all: string, values: string[] | undefined) {
  return [{ label: all, value: 'all' }, ...(values ?? []).map((value) => ({ label: value, value }))]
}
const directorateItems = computed(() => valueItems('All directorates', orgValues.value?.directorates))
const divisionItems = computed(() => valueItems('All divisions', orgValues.value?.divisions))
const levelItems = computed(() => valueItems('All levels', orgValues.value?.org_levels))

async function openImport() {
  if (await importDialog.open().result) await Promise.all([refresh(), refreshOrg()])
}

const query = computed(() => ({
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  status: typeof route.query.status === 'string' ? route.query.status : undefined,
  role_id: Number(route.query.role_id) || undefined,
  directorate: directorateFilter.value === 'all' ? undefined : directorateFilter.value,
  division: divisionFilter.value === 'all' ? undefined : divisionFilter.value,
  org_level: levelFilter.value === 'all' ? undefined : levelFilter.value,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: PER_PAGE,
}))

const { data, status, error, refresh } = useFetch<Page<AdminUser>>('/api/admin/users', { query, key: 'admin-users' })
const { data: roles } = useAdminRoles()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

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
  { accessorKey: 'employee_id', header: 'NIP' },
  { accessorKey: 'directorate', header: 'Directorate / Division' },
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
        color="neutral"
        variant="outline"
        icon="i-lucide-file-up"
        label="Import from HR file"
        @click="openImport"
      />
      <UButton
        icon="i-lucide-user-plus"
        label="New user"
        @click="openForm()"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="8"
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
          placeholder="Search by name, email, NIP or department"
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
        <USelectMenu
          v-model="directorateFilter"
          value-key="value"
          :items="directorateItems"
          aria-label="Filter by directorate"
          class="w-56"
        />
        <USelectMenu
          v-model="divisionFilter"
          value-key="value"
          :items="divisionItems"
          aria-label="Filter by division"
          class="w-52"
        />
        <USelectMenu
          v-model="levelFilter"
          value-key="value"
          :items="levelItems"
          :search-input="false"
          aria-label="Filter by organization level"
          class="w-36"
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
        <template #employee_id-cell="{ row }">
          <span class="font-mono text-xs">{{ row.original.employee_id || '—' }}</span>
        </template>
        <template #directorate-cell="{ row }">
          <p class="max-w-56 truncate text-sm">
            {{ row.original.directorate || '—' }}
          </p>
          <p class="max-w-56 truncate text-xs text-muted">
            {{ [row.original.division, row.original.org_level].filter(Boolean).join(' · ') }}
          </p>
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
        :page="data.page"
        :per-page="PER_PAGE"
        :total="data.total"
        :to="(page) => ({ query: { ...route.query, page } })"
        label="Users"
      />
    </UCard>
  </AppPage>
</template>
