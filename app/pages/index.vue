<script setup lang="ts">
import type { MenuNode } from '~/composables/useAuth'

const { user, menu, can } = useAuth()

const subtitle = computed(() =>
  [user.value?.job_title, user.value?.department].filter(Boolean).join(' · '),
)

const MODULE_TEXT: Record<string, string> = {
  scca: 'System criticality categorisation: monitor every SCCA, manage yours, and sign off what waits for you.',
  ra: 'Location risk assessment for head office buildings, the location map of every building and branch, and crises.',
  ra_branch: 'Location risk assessment for branches.',
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
  immediate: can('scca.monitor'),
})

const monitorCards = computed(() => {
  const cards = monitor.value?.cards
  if (!cards) return []
  return [
    { label: 'Overdue renewals', value: cards.overdue_renewals, icon: 'i-lucide-circle-alert', to: '/scca/monitoring?tab=renewals', alert: cards.overdue_renewals > 0 },
    { label: 'Renewals due in 90 days', value: cards.due_in_90_days, icon: 'i-lucide-calendar-clock', to: '/scca/monitoring?tab=renewals', alert: false },
    { label: 'In approval', value: cards.in_approval, icon: 'i-lucide-hourglass', to: '/scca/monitoring?tab=bottlenecks', alert: false },
    { label: 'Stuck approvals', value: cards.stuck_approvals, icon: 'i-lucide-siren', to: '/scca/approval?tab=board', alert: cards.stuck_approvals > 0 },
  ]
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

    <NuxtLink
      v-if="can('scca.access') && waiting && waiting.total > 0"
      to="/scca/approval"
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
          {{ waiting.total }} {{ waiting.total === 1 ? 'SCCA is' : 'SCCAs are' }} waiting for your approval
        </span>
        <span class="block text-sm text-muted">Review and approve or reject them on Result and sign-off.</span>
      </span>
      <UIcon
        name="i-lucide-arrow-right"
        class="size-5 text-muted"
      />
    </NuxtLink>

    <section
      v-if="monitorCards.length"
      class="space-y-3"
      aria-labelledby="home-monitoring"
    >
      <h2
        id="home-monitoring"
        class="text-sm font-semibold uppercase tracking-wide text-muted"
      >
        SCCA at a glance
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="card in monitorCards"
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
