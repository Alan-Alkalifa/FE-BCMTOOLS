<script setup lang="ts">
import type { MenuNode } from '~/composables/useAuth'

const { user, menu } = useAuth()

const subtitle = computed(() =>
  [user.value?.job_title, user.value?.department].filter(Boolean).join(' · '),
)

const MODULE_TEXT: Record<string, string> = {
  scca: 'System criticality categorisation: monitor every SCCA, manage yours, and sign off what waits for you.',
  ra: 'Location risk assessment for head office buildings: monitor every RA, manage the drafts, and sign off what waits for you.',
  ra_branch: 'Location risk assessment for branches, in the same three steps.',
  locations: 'Every head office building and branch: its profile and map pin, the building map, incidents and the incident guidebook.',
  admin: 'Users, roles and permissions, menus, email settings and the audit log.',
}

/** The modules are the menu's top-level groups the user can see. */
const modules = computed(() =>
  (menu.value ?? [])
    .filter((node) => node.children.length)
    .map((node) => ({
      node,
      description: MODULE_TEXT[node.code] ?? '',
      links: node.children.filter((child): child is MenuNode & { route: string } => !!child.route),
    })),
)

const { data: waiting } = useFetch<{ total: number }>('/api/scca/assessments', {
  key: 'home-waiting',
  query: { waiting: 1, per_page: 1 },
  immediate: can('scca.access'),
  default: () => ({ total: 0 }),
})

const { data: monitor } = useFetch<{ cards: { overdue_renewals: number, due_in_90_days: number, stuck_approvals: number, in_approval: number } }>('/api/scca/monitoring/overview', {
  key: 'home-monitor',
  // Every SCCA user: the overview counts only the SCCAs they can see (all of them with scca.monitor).
  immediate: can('scca.access'),
})

const monitorCards = computed(() => {
  const cards = monitor.value?.cards
  if (!cards) return []
  return [
    { label: 'Overdue renewals', value: cards.overdue_renewals, icon: 'i-lucide-circle-alert', to: '/scca/monitoring?tab=renewals', alert: cards.overdue_renewals > 0 },
    { label: 'Renewals due in 90 days', value: cards.due_in_90_days, icon: 'i-lucide-calendar-clock', to: '/scca/monitoring?tab=renewals', alert: false },
    { label: 'In approval', value: cards.in_approval, icon: 'i-lucide-hourglass', to: '/scca/monitoring?tab=bottlenecks', alert: false },
    // BCM (scca.approval.manage) acts on stuck approvals from the BCM board; others see them in Monitoring.
    { label: 'Stuck approvals', value: cards.stuck_approvals, icon: 'i-lucide-siren', to: can('scca.approval.manage') ? '/scca/approval?tab=board' : '/scca/monitoring?tab=bottlenecks', alert: cards.stuck_approvals > 0 },
  ]
  const all = counts.all
  if (all) {
    cards.push(
      { key: 'in_approval', label: 'In approval', value: all.in_approval, icon: 'i-lucide-hourglass', tone: 'info', hint: 'Every SCCA and RA waiting for a signer.', to: '/tasks?scope=all&type=signoff' },
      { key: 'stuck', label: 'Stuck sign-offs', value: all.stuck, icon: 'i-lucide-siren', tone: 'error', hint: 'Waiting past the escalation.', to: '/tasks?scope=all&type=signoff&level=stuck' },
      { key: 'overdue', label: 'Overdue renewals', value: all.overdue_renewals, icon: 'i-lucide-circle-alert', tone: 'error', hint: `${all.due_renewals} more due within 90 days.`, to: '/tasks?scope=all&type=renewal&level=overdue' },
    )
  } else {
    cards.push(
      { key: 'signoff', label: 'Sign-offs for me', value: mine.signoff, icon: 'i-lucide-badge-check', tone: 'info', hint: 'SCCA approvals and RA steps to approve.', to: '/tasks?type=signoff' },
      { key: 'overdue', label: 'My overdue renewals', value: mine.overdue_renewals, icon: 'i-lucide-circle-alert', tone: 'error', hint: 'Of the SCCAs and RAs you look after.', to: '/tasks?type=renewal&level=overdue' },
    )
  }
  return cards
})

const greeting = computed(() => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date()))
  return hour < 11 ? 'Good morning' : hour < 15 ? 'Good afternoon' : 'Good evening'
})
</script>

<template>
  <AppPage
    title="Home"
    icon="i-lucide-house"
  >
    <section class="overflow-hidden rounded-lg border border-default bg-default">
      <div class="flex flex-col gap-4 border-s-4 border-primary p-6 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0 space-y-1">
          <p class="text-sm text-muted">
            {{ greeting }},
          </p>
          <h2 class="truncate text-2xl font-semibold tracking-tight text-highlighted">
            {{ user?.name }}
          </h2>
          <p
            v-if="subtitle"
            class="text-sm text-muted"
          >
            {{ subtitle }}
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5 sm:justify-end">
          <UBadge
            v-for="role in user?.roles ?? []"
            :key="role.code"
            :label="role.name"
            color="neutral"
            variant="subtle"
            icon="i-lucide-shield"
          />
        </div>
      </div>
    </section>

    <UAlert
      v-if="user && !user.roles.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="You don't have a role yet"
      description="You can sign in, but every module needs a role. Ask your BCM Tools administrator to give you one."
    />

    <section
      v-if="overview.length"
      class="space-y-3"
      aria-labelledby="home-overview"
    >
      <div class="flex items-baseline justify-between gap-3">
        <h2
          id="home-overview"
          class="text-sm font-semibold uppercase tracking-wide text-muted"
        >
          Overview
        </h2>
        <ULink
          to="/tasks"
          class="text-sm text-primary hover:underline"
        >
          Open Task Management
        </ULink>
      </div>
      <div
        class="grid gap-4 sm:grid-cols-2"
        :class="overview.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'"
      >
        <KpiCard
          v-for="card in overview"
          :key="card.key"
          :to="card.to"
          :label="card.label"
          :value="card.value"
          :hint="card.hint"
          :icon="card.icon"
          :tone="card.tone"
        />
      </div>
    </section>

    <section
      v-if="modules.length"
      class="space-y-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        Modules
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="module in modules"
          :key="module.node.code"
          :ui="{ body: 'space-y-4' }"
        >
          <div class="flex items-start gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UIcon
                :name="module.node.icon ?? 'i-lucide-square'"
                class="size-5"
              />
            </span>
            <div class="min-w-0">
              <h3 class="font-semibold text-highlighted">
                {{ module.node.label }}
              </h3>
              <p class="mt-0.5 text-sm text-muted">
                {{ module.description }}
              </p>
            </div>
          </div>
          <ul class="divide-y divide-default rounded-md border border-default">
            <li
              v-for="link in module.links"
              :key="link.code"
            >
              <NuxtLink
                :to="link.route"
                class="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <UIcon
                  :name="link.icon ?? 'i-lucide-chevron-right'"
                  class="size-4 text-muted"
                />
                <span class="flex-1">{{ link.label }}</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="size-4 text-dimmed"
                />
              </NuxtLink>
            </li>
          </ul>
        </UCard>
      </div>
    </section>
  </AppPage>
</template>
