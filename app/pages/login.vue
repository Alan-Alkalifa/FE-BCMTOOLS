<script setup lang="ts">
definePageMeta({ public: true })

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
        <h1 class="text-lg font-semibold">BCM Tools</h1>
      </template>

      <UAlert
        v-if="route.query.error"
        color="error"
        variant="subtle"
        title="Sign-in failed. Please try again."
        class="mb-4"
      />

      <UButton :to="loginHref" external block label="Sign in with Microsoft" />
    </UCard>
  </div>
</template>
