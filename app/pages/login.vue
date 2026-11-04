<script setup lang="ts">
definePageMeta({ public: true, layout: false })

useHead({ title: 'Sign in · BCM Tools' })

const route = useRoute()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const busy = ref(false)
const error = ref<{ title: string, description?: string } | null>(null)

const notice = computed(() => {
  if (route.query.signed_out) return { color: 'success' as const, icon: 'i-lucide-circle-check', title: 'You\'ve signed out of BCM Tools.' }
  if (route.query.reset) return { color: 'success' as const, icon: 'i-lucide-circle-check', title: 'Your password is set. Sign in with it.' }
  if (route.query.expired) return { color: 'info' as const, icon: 'i-lucide-clock', title: 'Your session ended. Sign in again to continue.' }
  return null
})

function nextPath() {
  const next = route.query.redirect
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

async function onSubmit() {
  error.value = null
  if (!username.value.trim() || !password.value) {
    error.value = { title: 'Enter your ID and password.' }
    return
  }
  busy.value = true
  try {
    const user = await login(username.value.trim(), password.value)
    await navigateTo(user.must_change_password ? '/account/password' : nextPath(), { replace: true })
  } catch (failure) {
    const data = failure as { data?: { error?: string, message?: string }, statusCode?: number }
    if (data.data?.error === 'locked') {
      error.value = { title: 'Account locked', description: data.data.message }
    } else if (data.statusCode === 429) {
      error.value = { title: 'Too many attempts', description: data.data?.message }
    } else if (data.statusCode === 401) {
      error.value = { title: 'Invalid ID or password.', description: 'Check both and try again. Five wrong attempts lock the account for 15 minutes.' }
    } else {
      error.value = { title: 'Couldn\'t sign in', description: 'The server did not answer. Try again, or contact the IT Service Desk if it keeps happening.' }
    }
    password.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    title="Sign in"
    description="Use your BCM Tools ID (your email address) and password."
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error.title"
      :description="error.description"
    />
    <UAlert
      v-else-if="notice"
      :color="notice.color"
      variant="subtle"
      :icon="notice.icon"
      :title="notice.title"
    />

    <form
      class="space-y-5"
      novalidate
      @submit.prevent="onSubmit"
    >
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
          placeholder="name@cimbniaga.co.id"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UFormField
        label="Password"
        name="password"
      >
        <template #hint>
          <ULink
            to="/forgot-password"
            class="text-xs font-medium text-primary"
          >
            Forgot password?
          </ULink>
        </template>
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
          :ui="{ trailing: 'pe-1' }"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>
      <UButton
        type="submit"
        block
        size="lg"
        label="Sign in"
        :loading="busy"
        class="justify-center font-semibold"
      />
    </form>
  </AuthShell>
</template>
