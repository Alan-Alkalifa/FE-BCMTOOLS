<script setup lang="ts">
definePageMeta({ public: true, layout: false })

const route = useRoute()

const loginHref = computed(() => {
  const next = route.query.redirect
  return typeof next === 'string' ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login'
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">
          BCM Tools
        </h1>
      </template>

      <UAlert
        v-if="route.query.error"
        color="error"
        variant="subtle"
        title="Sign-in failed. Please try again."
        class="mb-4"
      />

      <UAlert
        v-else-if="route.query.signed_out"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        title="You've signed out of BCM Tools."
        description="You're still signed in to your Microsoft account, so signing in again won't ask for your password."
        class="mb-4"
      />

      <UButton
        :to="loginHref"
        external
        block
        label="Sign in with Microsoft"
      />
    </UCard>
  </div>
</template>
