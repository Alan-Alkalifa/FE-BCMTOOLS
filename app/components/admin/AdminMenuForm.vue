<script setup lang="ts">
import type { AdminMenu, AdminPermission } from '~/composables/useAdmin'

/** Add or edit one sidebar item: its label, icon, page, parent group and needed permission. */
const props = defineProps<{ menu?: AdminMenu | null, menus: AdminMenu[], permissions: AdminPermission[] }>()
const emit = defineEmits<{ close: [saved?: AdminMenu] }>()

const toast = useToast()
const form = reactive({
  label: props.menu?.label ?? '',
  icon: props.menu?.icon ?? 'i-lucide-circle',
  route: props.menu?.route ?? '',
  parent_id: props.menu?.parent_id ?? null as number | null,
  sort_order: props.menu?.sort_order ?? 100,
  permission: props.menu?.permission ?? null as string | null,
  is_active: props.menu?.is_active ?? true,
})
const busy = ref(false)
const errors = ref<Record<string, string>>({})

const iconItems = MENU_ICONS.map((name): { label: string, value: string, icon: string } => ({
  label: name.replace('i-lucide-', '').replaceAll('-', ' '),
  value: name,
  icon: name,
}))

const isGroup = computed(() => !!props.menu && !props.menu.route && props.menus.some((m) => m.parent_id === props.menu!.id))
const parentItems = computed(() => [
  { label: 'Top level', value: null },
  ...props.menus
    .filter((m) => m.parent_id === null && m.id !== props.menu?.id && !m.route)
    .map((m) => ({ label: m.label, value: m.id })),
])
const permissionItems = computed(() => [
  { label: 'Everyone signed in', value: null, description: 'No permission needed' },
  ...props.permissions.map((perm) => ({ label: perm.description, value: perm.code, description: perm.code })),
])

async function save() {
  errors.value = {}
  busy.value = true
  const body = { ...form, route: form.route.trim() || null, icon: form.icon.trim() || null }
  try {
    const saved = props.menu ? await adminApi.updateMenu(props.menu.id, body) : await adminApi.createMenu(body)
    toast.add({ title: props.menu ? 'Menu item saved' : 'Menu item added', color: 'success', icon: 'i-lucide-circle-check' })
    emit('close', saved)
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ? { ...details } : { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="menu ? `Edit ${menu.label}` : 'Add a menu item'"
    :description="menu ? menu.code : 'The page it opens must exist in the app.'"
  >
    <template #body>
      <form
        id="admin-menu-form"
        class="space-y-4"
        novalidate
        @submit.prevent="save"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />
        <UFormField
          label="Label"
          name="label"
          required
          :error="errors.label"
        >
          <UInput
            v-model="form.label"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Icon"
            name="icon"
            :error="errors.icon"
          >
            <USelectMenu
              v-model="form.icon"
              :items="iconItems"
              value-key="value"
              :icon="form.icon || 'i-lucide-circle'"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Page"
            name="route"
            :help="isGroup ? 'A group has no page of its own.' : 'The path, e.g. /scca'"
            :error="errors.route"
          >
            <UInput
              v-model="form.route"
              :disabled="isGroup"
              placeholder="/"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField
            label="Group"
            name="parent_id"
            :error="errors.parent_id"
          >
            <USelectMenu
              v-model="form.parent_id"
              value-key="value"
              :items="parentItems"
              :search-input="false"
              :disabled="isGroup"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Order"
            name="sort_order"
            help="Lower comes first."
          >
            <UInputNumber
              v-model="form.sort_order"
              :min="0"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Who sees it"
          name="permission"
          help="Only users whose role grants this permission see the item. The page checks it too."
          :error="errors.permission"
        >
          <USelectMenu
            v-model="form.permission"
            value-key="value"
            :items="permissionItems"
            class="w-full"
          />
        </UFormField>
        <USwitch
          v-model="form.is_active"
          label="Shown in the menu"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close')"
        />
        <UButton
          type="submit"
          form="admin-menu-form"
          :label="menu ? 'Save' : 'Add item'"
          :loading="busy"
          :disabled="!form.label.trim()"
        />
      </div>
    </template>
  </UModal>
</template>
