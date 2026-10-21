<script setup lang="ts">
import type { AdminRole, AdminUser, AdminUserInput } from '~/composables/useAdmin'

/** Create or edit a user: profile, roles and (on create) how they get their first password. */
const props = defineProps<{ user?: AdminUser | null, roles: AdminRole[] }>()
const emit = defineEmits<{ close: [saved?: AdminUser] }>()

const toast = useToast()
const { user: me } = useAuth()

const form = reactive({
  email: props.user?.email ?? '',
  display_name: props.user?.display_name ?? '',
  job_title: props.user?.job_title ?? '',
  department: props.user?.department ?? '',
  employee_id: props.user?.employee_id ?? '',
  mobile_phone: props.user?.mobile_phone ?? '',
  is_active: props.user?.is_active ?? true,
  role_ids: props.user?.roles.map((role) => role.id) ?? [] as number[],
  setup: 'invite' as 'invite' | 'password',
  password: '',
})
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const isSelf = computed(() => !!props.user && props.user.id === me.value?.id)

function toggleRole(id: number, on: boolean | 'indeterminate') {
  form.role_ids = on === true ? [...new Set([...form.role_ids, id])] : form.role_ids.filter((value) => value !== id)
}

async function save() {
  errors.value = {}
  busy.value = true
  const body: AdminUserInput = blankToNull({
    email: form.email.trim(),
    display_name: form.display_name.trim(),
    job_title: form.job_title,
    department: form.department,
    employee_id: form.employee_id,
    mobile_phone: form.mobile_phone,
  })
  body.role_ids = form.role_ids
  try {
    if (props.user) {
      const saved = await adminApi.updateUser(props.user.id, { ...body, is_active: form.is_active })
      toast.add({ title: 'User saved', color: 'success', icon: 'i-lucide-circle-check' })
      emit('close', saved)
    } else {
      const result = await adminApi.createUser({
        ...body,
        password: form.setup === 'password' ? form.password : undefined,
      })
      toast.add({
        title: 'User created',
        description: form.setup === 'password'
          ? 'Give them the temporary password; they set their own at the first sign-in.'
          : result.invitation_sent
            ? `An invitation to set a password was emailed to ${result.user.email}.`
            : 'The invitation email could not be sent. Check Administration > Email settings, then send a password link from the user list.',
        color: result.invitation_sent || form.setup === 'password' ? 'success' : 'warning',
        icon: 'i-lucide-user-plus',
      })
      emit('close', result.user)
    }
  } catch (error) {
    const details = (error as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ? { ...details } : { form: adminErrorText(error) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="user ? `Edit ${user.display_name ?? user.username}` : 'New user'"
    :description="user ? user.username : 'They sign in with this email address as their ID.'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        id="admin-user-form"
        class="space-y-6"
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
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Email (ID)"
            name="email"
            required
            :error="errors.email"
          >
            <UInput
              v-model="form.email"
              type="email"
              autocomplete="off"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Full name"
            name="display_name"
            required
            :error="errors.display_name"
          >
            <UInput
              v-model="form.display_name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Job title"
            name="job_title"
            help="Shown as the designation on SCCA sign-offs."
          >
            <UInput
              v-model="form.job_title"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Department"
            name="department"
            help="Shown as the sub-directorate on SCCA sign-offs."
          >
            <UInput
              v-model="form.department"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Employee ID"
            name="employee_id"
          >
            <UInput
              v-model="form.employee_id"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Mobile phone"
            name="mobile_phone"
          >
            <UInput
              v-model="form.mobile_phone"
              class="w-full"
            />
          </UFormField>
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm font-medium text-highlighted">
            Roles
          </legend>
          <p class="text-xs text-muted">
            Without a role the user can sign in but open nothing.
          </p>
          <p
            v-if="errors.role_ids"
            class="text-sm text-error"
          >
            {{ errors.role_ids }}
          </p>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="role in roles"
              :key="role.id"
              class="flex cursor-pointer items-start gap-3 rounded-md border border-default p-3 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
            >
              <UCheckbox
                :model-value="form.role_ids.includes(role.id)"
                :aria-label="role.name"
                class="mt-0.5"
                @update:model-value="toggleRole(role.id, $event)"
              />
              <span class="min-w-0">
                <span class="block text-sm font-medium text-highlighted">{{ role.name }}</span>
                <span class="block text-xs text-muted">{{ role.description }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset
          v-if="!user"
          class="space-y-3"
        >
          <legend class="text-sm font-medium text-highlighted">
            First password
          </legend>
          <URadioGroup
            v-model="form.setup"
            :items="[
              { value: 'invite', label: 'Email an invitation link', description: 'They choose their own password. The link works for 72 hours.' },
              { value: 'password', label: 'Set a temporary password', description: 'Give it to them yourself; they must change it at the first sign-in.' },
            ]"
          />
          <UFormField
            v-if="form.setup === 'password'"
            label="Temporary password"
            name="password"
            :error="errors.password"
          >
            <UInput
              v-model="form.password"
              type="text"
              autocomplete="off"
              class="w-full font-mono"
            />
            <PasswordRules
              :password="form.password"
              class="mt-2"
            />
          </UFormField>
        </fieldset>

        <USwitch
          v-if="user"
          v-model="form.is_active"
          :disabled="isSelf"
          label="Active"
          :description="isSelf ? 'You can\'t deactivate your own account.' : 'An inactive user cannot sign in. Their SCCAs and sign-offs stay.'"
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
          form="admin-user-form"
          :label="user ? 'Save user' : 'Create user'"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
