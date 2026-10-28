<script setup lang="ts">
import type { RaOverview } from '~/composables/useRa'

/**
 * Home: "RA at a glance" (or "RA Branch at a glance"), like SCCA's: the RAs waiting for the
 * user's sign-off, then four cards that open Monitoring or the BCM board. Shown for each side the
 * user can open.
 */
const props = defineProps<{ kind: RaKind }>()

const { can } = useAuth()
const module = computed(() => RA_MODULES[props.kind])
const { data: overview } = useFetch<RaOverview>('/api/ra/monitoring/overview', {
  key: `home-ra-overview-${props.kind}`,
  query: { kind: props.kind },
})
const { data: inbox } = useFetch<{ total: number }>('/api/ra/approvals/inbox', {
  key: `home-ra-inbox-${props.kind}`,
  query: { kind: props.kind, per_page: 1 },
  default: () => ({ total: 0 }),
})

const cards = computed(() => {
  const value = overview.value?.cards
  if (!value) return []
  const monitoring = (tab: string) => ({ path: raPath(props.kind, 'monitoring'), query: { tab } })
  // BCM (ra.manage / ra_branch.manage) acts on stuck sign-offs from the BCM board.
  const stuckTo = can(module.value.perm.manage)
    ? { path: raPath(props.kind, 'approval'), query: { tab: 'board' } }
    : monitoring('bottlenecks')
  return [
    { label: 'Overdue renewals', value: value.overdue_renewals, icon: 'i-lucide-circle-alert', to: monitoring('renewals'), alert: value.overdue_renewals > 0 },
    { label: 'Renewals due in 90 days', value: value.due_in_90_days, icon: 'i-lucide-calendar-clock', to: monitoring('renewals'), alert: false },
    { label: 'In sign-off', value: value.in_signoff, icon: 'i-lucide-hourglass', to: monitoring('bottlenecks'), alert: false },
    { label: 'Stuck sign-offs', value: value.stuck_approvals, icon: 'i-lucide-siren', to: stuckTo, alert: value.stuck_approvals > 0 },
  ]
})
const waiting = computed(() => inbox.value?.total ?? 0)
const headingId = computed(() => `home-${props.kind}`)
</script>

<template>
  <div class="space-y-3">
    <NuxtLink
      v-if="waiting > 0"
      :to="raPath(kind, 'approval')"
      class="flex items-center gap-4 rounded-lg border border-warning/40 bg-warning/5 p-4 transition-colors hover:bg-warning/10 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
        <UIcon
          name="i-lucide-clipboard-check"
          class="size-5"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block font-semibold text-highlighted">
          {{ waiting }} {{ kind === 'branch' ? 'RA Branch ' : '' }}{{ waiting === 1 ? 'RA is' : 'RAs are' }} waiting for your sign-off
        </span>
        <span class="block text-sm text-muted">Approve them or return them for changes on their Sign-off tab.</span>
      </span>
      <UIcon
        name="i-lucide-arrow-right"
        class="size-5 text-muted"
      />
    </NuxtLink>

    <section
      v-if="cards.length"
      class="space-y-3"
      :aria-labelledby="headingId"
    >
      <h2
        :id="headingId"
        class="text-sm font-semibold uppercase tracking-wide text-muted"
      >
        {{ module.title }} at a glance
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="card in cards"
          :key="card.label"
          :to="card.to"
          class="flex items-center gap-3 rounded-lg border border-default bg-default p-4 transition-colors hover:bg-elevated/40"
        >
          <UIcon
            :name="card.icon"
            class="size-5 shrink-0"
            :class="card.alert ? 'text-error' : 'text-muted'"
          />
          <span class="min-w-0 flex-1 text-sm text-muted">{{ card.label }}</span>
          <span
            class="text-xl font-semibold tabular-nums"
            :class="card.alert ? 'text-error' : 'text-highlighted'"
          >{{ card.value }}</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
