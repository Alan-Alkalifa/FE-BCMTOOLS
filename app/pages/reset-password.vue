<script setup lang="ts">
definePageMeta({ public: true, layout: false })

useHead({ title: 'Set a new password · BCM Tools' })

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  error.value = null
  if (password.value !== confirm.value) {
    error.value = 'The two passwords are different.'
    return
  }
  busy.value = true
  try {
    await sealedFetch('/api/auth/reset', 'reset_password', { token: token.value, password: password.value })
    await navigateTo({ path: '/login', query: { reset: '1' } }, { replace: true })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    error.value = details?.token ?? details?.password ?? 'Couldn\'t set the password. Try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    title="Set a new password"
    description="Choose a password you don't use anywhere else."
  >
    <UAlert
      v-if="!token"
      color="warning"
      variant="subtle"
      icon="i-lucide-link-2-off"
      title="This link is incomplete"
      description="Open the link from your email again, or ask for a new one."
    >
      <template #actions>
        <UButton
          to="/forgot-password"
          color="neutral"
          variant="outline"
          label="Ask for a new link"
        />
      </template>
    </UAlert>

    <form
      v-else
      class="space-y-5"
      novalidate
      @submit.prevent="onSubmit"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
      />
      <UFormField
        label="New password"
        name="password"
      >
        <UInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          size="lg"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Repeat the new password"
        name="confirm"
      >
        <UInput
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          size="lg"
          class="w-full"
        />
      </UFormField>
      <PasswordRules
        :password="password"
        :confirm="confirm"
      />
      <UButton
        type="submit"
        block
        size="lg"
        label="Set password"
        :loading="busy"
        :disabled="password.length < 12 || password !== confirm"
        class="justify-center font-semibold"
      />
    </form>
  </AuthShell>
</template>
