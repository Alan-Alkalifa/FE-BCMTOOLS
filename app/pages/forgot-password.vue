<script setup lang="ts">
definePageMeta({ public: true, layout: false })

useHead({ title: 'Forgot password · BCM Tools' })

const username = ref('')
const busy = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  error.value = null
  if (!username.value.trim()) {
    error.value = 'Enter your ID (your email address).'
    return
  }
  busy.value = true
  try {
    await $fetch('/api/auth/forgot', { method: 'POST', body: { username: username.value.trim() } })
    sent.value = true
  } catch {
    error.value = 'Couldn\'t send the request. Try again in a minute.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    title="Forgot password"
    description="We'll email you a link to set a new password. It works once, for 30 minutes."
  >
    <template v-if="sent">
      <UAlert
        color="success"
        variant="subtle"
        icon="i-lucide-mail-check"
        title="Check your email"
        description="If the ID belongs to an account, a reset link is on its way. It can take a few minutes."
      />
      <UButton
        to="/login"
        block
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-lucide-arrow-left"
        label="Back to sign in"
        class="justify-center"
      />
    </template>

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
        label="ID"
        name="username"
        help="Your email address."
      >
        <UInput
          v-model="username"
          type="email"
          autocomplete="username"
          icon="i-lucide-at-sign"
          size="lg"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UButton
        type="submit"
        block
        size="lg"
        label="Email me a reset link"
        :loading="busy"
        class="justify-center font-semibold"
      />
      <UButton
        to="/login"
        block
        color="neutral"
        variant="ghost"
        label="Back to sign in"
        class="justify-center"
      />
    </form>
  </AuthShell>
</template>
