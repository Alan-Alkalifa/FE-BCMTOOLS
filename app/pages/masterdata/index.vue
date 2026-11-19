<script setup lang="ts">
/** Administration › Master data: the masters the user may open, one card each. */
definePageMeta({ permission: ['masterdata.access', 'bianca.config.view', 'location.master'] })

const { can } = useAuth()
const masters = computed(() => MASTER_DATA.filter((entry) => can(...entry.permission)))
</script>

<template>
  <AppPage
    title="Master data"
    icon="i-lucide-database"
    description="The lists the modules pick from. Change them here; what a form or the Excel template offers follows."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data' }]"
  >
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="entry in masters"
        :key="entry.key"
        :to="entry.to"
        class="group rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        <UCard
          class="h-full transition-colors group-hover:ring-primary/50"
          :ui="{ body: 'flex h-full flex-col gap-3' }"
        >
          <div class="flex items-center gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UIcon
                :name="entry.icon"
                class="size-5"
              />
            </span>
            <h2 class="font-semibold text-highlighted group-hover:text-primary">
              {{ entry.title }}
            </h2>
          </div>
          <p class="flex-1 text-sm text-muted">
            {{ entry.description }}
          </p>
          <p class="text-xs text-dimmed">
            Used by {{ entry.usedBy }}
          </p>
        </UCard>
      </NuxtLink>
    </div>
    <p
      v-if="!masters.length"
      class="text-sm text-muted"
    >
      You don't have access to any master yet.
    </p>
  </AppPage>
</template>
