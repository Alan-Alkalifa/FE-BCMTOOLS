<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <UContainer class="py-10">
    <UCard>
      <template #header>
        <h1 class="text-lg font-semibold">
          Welcome, {{ user?.name }}
        </h1>
      </template>

      <p>Signed in as {{ user?.email }}</p>
      <p>Roles: {{ user?.roles.join(', ') || 'none' }}</p>
    </UCard>
  </UContainer>
</template>
