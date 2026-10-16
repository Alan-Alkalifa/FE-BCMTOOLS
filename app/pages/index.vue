<script setup lang="ts">
const { user } = useAuth()
const { data: profile } = useProfile()

const subtitle = computed(() =>
  [profile.value?.job_title, profile.value?.department].filter(Boolean).join(' · '),
)
</script>

<template>
  <UContainer class="py-10">
    <UCard>
      <template #header>
        <h1 class="text-lg font-semibold">
          Welcome, {{ profile?.display_name ?? user?.name }}
        </h1>
        <p
          v-if="subtitle"
          class="text-sm text-muted"
        >
          {{ subtitle }}
        </p>
      </template>

      <p>Signed in as {{ user?.email }}</p>
      <p>Roles: {{ user?.roles.join(', ') || 'none' }}</p>

      <template #footer>
        <UButton
          to="/profile"
          variant="link"
          trailing-icon="i-lucide-arrow-right"
          label="View your profile"
          class="px-0"
        />
      </template>
    </UCard>
  </UContainer>
</template>
