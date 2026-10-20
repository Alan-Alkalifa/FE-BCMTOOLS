<script setup lang="ts">
import type { AdminUser } from '~/composables/useAdmin'

/** Email a password link, or set a temporary password the user must change. */
const props = defineProps<{ user: AdminUser }>()
const emit = defineEmits<{ close: [done?: boolean] }>()

const toast = useToast()
const mode = ref<'email' | 'password'>('email')
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  busy.value = true
  try {
    const result = await adminApi.resetPassword(props.user.id, mode.value === 'password' ? password.value : undefined)
    toast.add(mode.value === 'password'
      ? { title: 'Temporary password set', description: 'They must change it at the next sign-in.', color: 'success', icon: 'i-lucide-key-round' }
      : result.email_sent
        ? { title: 'Password link sent', description: `Emailed to ${props.user.email}.`, color: 'success', icon: 'i-lucide-mail-check' }
        : { title: 'The email couldn\'t be sent', description: 'Check Administration > Email settings and the audit log.', color: 'warning', icon: 'i-lucide-mail-x' })
    emit('close', true)
  } catch (failure) {
    error.value = adminErrorText(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="`Password for ${user.display_name ?? user.username}`"
    :description="user.username"
  >
    <template #body>
      <form
        id="admin-password-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
        />
        <URadioGroup
          v-model="mode"
          :items="[
            { value: 'email', label: 'Email a link', description: user.has_password ? 'A reset link that works once, for 30 minutes.' : 'An invitation link that works once, for 72 hours.' },
            { value: 'password', label: 'Set a temporary password', description: 'They must change it at the next sign-in.' },
          ]"
        />
        <UFormField
          v-if="mode === 'password'"
          label="Temporary password"
          name="password"
        >
          <UInput
            v-model="password"
            autocomplete="off"
            class="w-full font-mono"
          />
          <PasswordRules
            :password="password"
            class="mt-2"
          />
        </UFormField>
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
          form="admin-password-form"
          :label="mode === 'email' ? 'Send link' : 'Set password'"
          :disabled="mode === 'password' && password.length < 12"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
