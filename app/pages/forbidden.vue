<script setup lang="ts">
const route = useRoute()
const { user } = useAuth()
const noRole = computed(() => !user.value?.roles.length)
</script>

<template>
  <AppPage title="No access">
    <UCard class="mx-auto max-w-xl text-center">
      <div class="flex flex-col items-center gap-4 py-6">
        <span class="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <UIcon
            name="i-lucide-lock"
            class="size-6"
          />
        </span>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ noRole ? "You don't have a role yet" : "You don't have access to this page" }}
          </h2>
          <p class="text-sm text-muted">
            {{ noRole
              ? 'An administrator gives each user a role. Ask your BCM Tools administrator for access.'
              : 'Your role does not include this page. Ask your BCM Tools administrator if you need it.' }}
          </p>
          <p
            v-if="typeof route.query.from === 'string'"
            class="text-xs text-dimmed"
          >
            {{ route.query.from }}
          </p>
        </div>
        <UButton
          to="/"
          icon="i-lucide-house"
          label="Go to Home"
          color="neutral"
          variant="outline"
        />
      </div>
    </UCard>
  </AppPage>
</template>
