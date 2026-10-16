<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <UContainer class="py-10">
    <UCard>
      <template #header>
        <h1 class="text-lg font-semibold">Welcome, {{ user?.name }}</h1>
      </template>

      <p>Signed in as {{ user?.email }}</p>
      <p>Roles: {{ user?.roles.join(', ') || 'none' }}</p>

      <template #footer>
        <UButton to="/auth/logout" external color="neutral" variant="outline" label="Sign out" />
      </template>
    </UCard>
  </UContainer>
</template>
