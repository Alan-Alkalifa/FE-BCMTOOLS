<script setup lang="ts">
const { user } = useAuth()
const { data: profile } = useProfile()

const subtitle = computed(() =>
  [profile.value?.job_title, profile.value?.department].filter(Boolean).join(' · '),
)

const modules = [
  {
    title: 'SCCA',
    description: 'System criticality categorisation for an application.',
    to: '/scca',
    icon: 'i-lucide-shield-check',
    available: true,
  },
  {
    title: 'RA',
    description: 'Location risk assessment and risk profile for an office building.',
    to: '/ra',
    icon: 'i-lucide-building-2',
    available: true,
  },
  {
    title: 'RA Branch',
    description: 'Location risk assessment for a branch.',
    to: '/ra-branch',
    icon: 'i-lucide-landmark',
    available: true,
  },
]
</script>

<template>
  <AppPage title="Home">
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Welcome, {{ profile?.display_name ?? user?.name }}
        </h2>
        <p
          v-if="subtitle"
          class="text-sm text-muted"
        >
          {{ subtitle }}
        </p>
      </template>
      <p>Signed in as {{ user?.email }}</p>
      <p>Roles: {{ user?.roles.join(', ') || 'none' }}</p>
    </UCard>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">
        Modules
      </h2>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="module in modules"
          :key="module.title"
        >
          <div class="flex items-start gap-3">
            <UIcon
              :name="module.icon"
              class="mt-0.5 size-5 text-primary"
            />
            <div class="min-w-0">
              <h3 class="font-semibold">
                {{ module.title }}
              </h3>
              <p class="mt-1 text-sm text-muted">
                {{ module.description }}
              </p>
            </div>
          </div>
          <template #footer>
            <UButton
              v-if="module.available && module.to"
              :to="module.to"
              variant="link"
              trailing-icon="i-lucide-arrow-right"
              label="Open"
              :aria-label="`Open ${module.title}`"
              class="px-0"
            />
            <UBadge
              v-else
              label="Coming soon"
              color="neutral"
              variant="subtle"
              icon="i-lucide-clock"
            />
          </template>
        </UCard>
      </div>
    </section>
  </AppPage>
</template>
