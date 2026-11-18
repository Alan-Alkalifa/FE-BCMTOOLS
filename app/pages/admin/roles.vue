<script setup lang="ts">
import type { AdminPermission, AdminRole } from '~/composables/useAdmin'

definePageMeta({ permission: 'admin.roles.manage' })

const toast = useToast()
const confirm = useConfirm()
const { fetchUser, fetchMenu } = useAuth()
const { data: roles, status, error, refresh } = useAdminRoles()
const { data: permissions } = useAdminPermissions()

const selectedId = ref<number | 'new' | null>(null)
const form = reactive({ name: '', description: '', permissions: [] as string[] })
const busy = ref(false)
const formError = ref<string | null>(null)

const selected = computed(() =>
  typeof selectedId.value === 'number' ? roles.value?.items.find((role) => role.id === selectedId.value) ?? null : null,
)
const isAdministrator = computed(() => selected.value?.code === 'administrator')

const modules = computed(() => {
  const groups = new Map<string, AdminPermission[]>()
  for (const perm of permissions.value?.items ?? []) {
    groups.set(perm.module, [...(groups.get(perm.module) ?? []), perm])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => moduleOrder(a) - moduleOrder(b))
    .map(([module, items]) => ({ module, label: moduleLabel(module), items }))
})

function load(role: AdminRole | null) {
  form.name = role?.name ?? ''
  form.description = role?.description ?? ''
  form.permissions = [...(role?.permissions ?? [])]
  formError.value = null
}

watch(roles, (value) => {
  if (selectedId.value === null && value?.items.length) selectedId.value = value.items[0]!.id
}, { immediate: true })
watch(selected, (role) => {
  if (role) load(role)
}, { immediate: true })

function startNew() {
  selectedId.value = 'new'
  load(null)
}

function toggle(code: string, on: boolean | 'indeterminate') {
  form.permissions = on === true ? [...new Set([...form.permissions, code])] : form.permissions.filter((value) => value !== code)
}

function toggleModule(codes: string[], on: boolean) {
  form.permissions = on
    ? [...new Set([...form.permissions, ...codes])]
    : form.permissions.filter((value) => !codes.includes(value))
}

const dirty = computed(() => {
  const base = selected.value
  if (selectedId.value === 'new') return !!form.name
  if (!base) return false
  return base.name !== form.name || (base.description ?? '') !== form.description
    || [...base.permissions].sort().join() !== [...form.permissions].sort().join()
})

async function save() {
  formError.value = null
  busy.value = true
  const body = { name: form.name.trim(), description: form.description.trim() || null, permissions: form.permissions }
  try {
    const saved = selectedId.value === 'new'
      ? await adminApi.createRole(body)
      : await adminApi.updateRole(selected.value!.id, body)
    await refresh()
    selectedId.value = saved.id
    await Promise.all([fetchUser(), fetchMenu()])
    toast.add({ title: 'Role saved', description: 'Users with this role get the change on their next click.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    formError.value = adminErrorText(failure)
  } finally {
    busy.value = false
  }
}

async function remove() {
  const role = selected.value
  if (!role) return
  const ok = await confirm({
    title: `Delete the ${role.name} role?`,
    description: role.user_count
      ? `${role.user_count} ${role.user_count === 1 ? 'user loses' : 'users lose'} it. Users left with no role can only sign in.`
      : 'No user has this role.',
    confirmLabel: 'Delete role',
    destructive: true,
  })
  if (!ok) return
  try {
    await adminApi.deleteRole(role.id)
    selectedId.value = null
    await refresh()
    toast.add({ title: 'Role deleted', color: 'success', icon: 'i-lucide-trash-2' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <AppPage
    title="Roles and permissions"
    icon="i-lucide-key-round"
    description="A role grants permissions; each menu and action needs one. Users get changes on their next click."
    :crumbs="[{ label: 'Administration' }, { label: 'Roles and permissions' }]"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="New role"
        @click="startNew"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load roles"
      :description="adminErrorText(error)"
    />

    <div
      v-else
      class="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <UCard :ui="{ body: 'p-2 sm:p-2' }">
        <SkeletonGroup
          v-if="status === 'pending' && !roles"
          label="Loading roles"
          class="space-y-2 p-2"
        >
          <div
            v-for="n in 4"
            :key="n"
            class="skeleton h-12"
          />
        </SkeletonGroup>
        <ul
          v-else
          class="space-y-1"
          aria-label="Roles"
        >
          <li
            v-for="role in roles?.items ?? []"
            :key="role.id"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="selectedId === role.id ? 'bg-primary/8 ring-1 ring-primary/30' : ''"
              :aria-current="selectedId === role.id ? 'true' : undefined"
              @click="selectedId = role.id"
            >
              <UIcon
                :name="role.is_system ? 'i-lucide-shield-check' : 'i-lucide-shield'"
                class="size-4 shrink-0"
                :class="selectedId === role.id ? 'text-primary' : 'text-muted'"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-highlighted">{{ role.name }}</span>
                <span class="block truncate text-xs text-muted">
                  <code>{{ role.code }}</code> · {{ role.permissions.length }} permissions
                </span>
              </span>
              <UBadge
                :label="String(role.user_count)"
                color="neutral"
                variant="subtle"
                size="sm"
                :aria-label="`${role.user_count} users`"
              />
            </button>
          </li>
        </ul>
      </UCard>

      <UCard v-if="selectedId !== null">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-highlighted">
                {{ selectedId === 'new' ? 'New role' : selected?.name }}
              </h2>
              <p
                v-if="selected"
                class="text-xs text-muted"
              >
                Code <code data-testid="role-code">{{ selected.code }}</code>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UBadge
                v-if="selected?.is_system"
                label="System role"
                color="neutral"
                variant="outline"
                icon="i-lucide-lock"
              />
              <UButton
                v-if="selected"
                :to="`/admin/users?role_id=${selected.id}`"
                color="neutral"
                variant="ghost"
                icon="i-lucide-users"
                :label="`${selected.user_count} ${selected.user_count === 1 ? 'user' : 'users'}`"
                size="sm"
              />
            </div>
          </div>
        </template>

        <form
          class="space-y-6"
          novalidate
          @submit.prevent="save"
        >
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="formError"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Name"
              name="name"
              required
            >
              <UInput
                v-model="form.name"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Description"
              name="description"
            >
              <UInput
                v-model="form.description"
                class="w-full"
              />
            </UFormField>
          </div>

          <UAlert
            v-if="isAdministrator"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="The Administrator role always holds every permission."
          />

          <div class="space-y-4">
            <section
              v-for="group in modules"
              :key="group.module"
              class="rounded-md border border-default"
            >
              <header class="flex items-center justify-between gap-2 border-b border-default bg-muted px-4 py-2.5">
                <h3 class="text-sm font-semibold text-highlighted">
                  {{ group.label }}
                </h3>
                <UCheckbox
                  :model-value="group.items.every((perm) => form.permissions.includes(perm.code))
                    ? true
                    : group.items.some((perm) => form.permissions.includes(perm.code)) ? 'indeterminate' : false"
                  :disabled="isAdministrator"
                  label="All"
                  @update:model-value="toggleModule(group.items.map((perm) => perm.code), $event === true)"
                />
              </header>
              <ul class="divide-y divide-default">
                <li
                  v-for="perm in group.items"
                  :key="perm.code"
                  class="flex items-start gap-3 px-4 py-3"
                >
                  <UCheckbox
                    :model-value="form.permissions.includes(perm.code)"
                    :disabled="isAdministrator"
                    :aria-label="perm.description"
                    class="mt-0.5"
                    @update:model-value="toggle(perm.code, $event)"
                  />
                  <div class="min-w-0">
                    <p class="text-sm text-highlighted">
                      {{ perm.description }}
                    </p>
                    <code class="text-xs text-muted">{{ perm.code }}</code>
                  </div>
                </li>
              </ul>
            </section>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <UButton
              v-if="selected && !selected.is_system"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              label="Delete role"
              @click="remove"
            />
            <span v-else />
            <UButton
              type="submit"
              :label="selectedId === 'new' ? 'Create role' : 'Save role'"
              :loading="busy"
              :disabled="!dirty || !form.name.trim()"
            />
          </div>
        </form>
      </UCard>
    </div>
  </AppPage>
</template>
