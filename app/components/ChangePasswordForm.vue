<script setup lang="ts">
const props = defineProps<{ required?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const { changePassword, logout } = useAuth()
const toast = useToast()

const current = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const errors = ref<Record<string, string>>({})

async function onSubmit() {
  errors.value = {}
  if (password.value !== confirm.value) {
    errors.value = { confirm: 'The two passwords are different.' }
    return
  }
  busy.value = true
  try {
    await changePassword(current.value, password.value)
    toast.add({ title: 'Password changed', color: 'success', icon: 'i-lucide-circle-check' })
    current.value = password.value = confirm.value = ''
    emit('changed')
  } catch (failure) {
    errors.value = (failure as { data?: { details?: Record<string, string> } }).data?.details
      ?? { password: 'Couldn\'t change the password. Try again.' }
  } finally {
    busy.value = false
  }
}

async function signOut() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <form
    class="space-y-5"
    novalidate
    @submit.prevent="onSubmit"
  >
    <UFormField
      label="Current password"
      name="current_password"
      :error="errors.current_password"
      :help="props.required ? 'The temporary password you signed in with.' : undefined"
    >
      <UInput
        v-model="current"
        type="password"
        autocomplete="current-password"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="New password"
      name="password"
      :error="errors.password"
    >
      <UInput
        v-model="password"
        type="password"
        autocomplete="new-password"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="Repeat the new password"
      name="confirm"
      :error="errors.confirm"
    >
      <UInput
        v-model="confirm"
        type="password"
        autocomplete="new-password"
        class="w-full"
      />
    </UFormField>
    <PasswordRules
      :password="password"
      :confirm="confirm"
    />
    <p class="text-xs text-muted">
      You can't reuse any of your last 5 passwords.
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <UButton
        type="submit"
        :label="props.required ? 'Set password and continue' : 'Change password'"
        :loading="busy"
        :disabled="!current || password.length < 12 || password !== confirm"
      />
      <UButton
        v-if="props.required"
        color="neutral"
        variant="ghost"
        label="Sign out"
        @click="signOut"
      />
    </div>
  </form>
</template>
