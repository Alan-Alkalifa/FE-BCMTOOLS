<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <div>
    <UHeader
      title="BCM Tools"
      to="/"
    >
      <template #right>
        <span
          v-if="user"
          class="text-sm text-muted hidden sm:inline"
        >{{ user.name }}</span>
        <UButton
          to="/auth/logout"
          external
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          label="Sign out"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>
  </div>
</template>
