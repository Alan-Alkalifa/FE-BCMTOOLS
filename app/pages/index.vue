<script setup lang="ts">
import type { MenuNode } from '~/composables/useAuth'
import type { TaskGlance, TaskModule } from '~/composables/useTasks'

const { user, menu } = useAuth()

const subtitle = computed(() =>
  [user.value?.job_title, user.value?.department].filter(Boolean).join(' · '),
)

const MODULE_TEXT: Record<string, string> = {
  scca: 'System criticality categorisation: monitor every SCCA, manage yours, and sign off what waits for you.',
  ra: 'Location risk assessment for head office buildings: monitor every RA, manage the drafts, and sign off what waits for you.',
  ra_branch: 'Location risk assessment for branches, in the same three steps.',
  locations: 'The building map, and disasters and incidents: monitor them, declare and manage them, approve the declared ones, and their guidebooks.',
  admin: 'Users, roles and permissions, menus, email settings and the audit log.',
}

/** A group's pages, with those of its own groups (Sites › Disaster › Monitoring as "Disaster
 *  monitoring"). */
function linksOf(node: MenuNode): (MenuNode & { route: string })[] {
  return node.children.flatMap((child) => child.route
    ? [child as MenuNode & { route: string }]
    : linksOf(child).map((link) => ({ ...link, label: `${child.label} ${link.label.toLowerCase()}`, icon: link.icon ?? child.icon })))
}

/** The modules are the menu's top-level groups the user can see. */
const modules = computed(() =>
  (menu.value ?? [])
    .filter((node) => node.children.length)
    .map((node) => ({
      node,
      description: MODULE_TEXT[node.code] ?? '',
      links: linksOf(node),
    })),
)

/**
 * The overview: each module the user's roles open, at a glance (SCCA, RA HO, RA Branch, Sites).
 * Its BCM sees the whole module (waiting for me, in approval, stuck, overdue, and for RA HO and
 * RA Branch the buildings waiting for approval); everyone else what is theirs (sign-offs for me,
 * overdue and due renewals). Sites counts the disasters and incidents waiting for approval. Each
 * card opens that module's tab in Task Management.
 */
interface GlanceCard { key: string, label: string, value: number, icon: string, tone: 'neutral' | 'warning' | 'error' | 'info', hint: string, to: string }
const { data: summary } = useTaskSummary()
function tasksLink(module: TaskModule, extra: Record<string, string> = {}) {
  return `/tasks?${new URLSearchParams({ module, ...extra }).toString()}`
}
function glanceCards(glance: TaskGlance): GlanceCard[] {
  const { module } = glance
  if (module === 'sites') {
    return [
      { key: 'disaster', label: 'Disasters waiting', value: glance.disaster ?? 0, icon: 'i-lucide-siren', tone: 'error', hint: 'Declared, waiting for approval.', to: tasksLink(module, { type: 'disaster' }) },
      { key: 'incident', label: 'Incidents waiting', value: glance.incident ?? 0, icon: 'i-lucide-triangle-alert', tone: 'error', hint: 'Declared, waiting for approval.', to: tasksLink(module, { type: 'incident' }) },
    ]
  }
  const what = module === 'scca' ? 'SCCA' : 'RA'
  const mine: GlanceCard = { key: 'mine', label: 'Waiting for me', value: glance.mine ?? 0, icon: 'i-lucide-user-check', tone: 'warning', hint: module === 'scca' ? 'SCCA approvals for you.' : 'RA sign-off steps for you.', to: tasksLink(module, { type: 'signoff' }) }
  const overdue: GlanceCard = { key: 'overdue', label: glance.oversees ? 'Overdue renewals' : 'My overdue renewals', value: glance.overdue_renewals ?? 0, icon: 'i-lucide-circle-alert', tone: 'error', hint: `${glance.due_renewals ?? 0} more due within 90 days.`, to: tasksLink(module, { type: 'renewal', level: 'overdue' }) }
  // Only for who reviews buildings in Master building (the API leaves `building` out otherwise).
  const buildings: GlanceCard[] = module !== 'scca' && glance.building !== undefined
    ? [{ key: 'building', label: 'Buildings waiting', value: glance.building ?? 0, icon: 'i-lucide-building', tone: 'warning', hint: 'New, or to make inactive, waiting for approval.', to: tasksLink(module, { type: 'building' }) }]
    : []
  if (!glance.oversees) return [mine, overdue, ...buildings]
  return [
    mine,
    { key: 'in_approval', label: 'In approval', value: glance.in_approval ?? 0, icon: 'i-lucide-hourglass', tone: 'info', hint: `Every ${what} waiting for a signer.`, to: tasksLink(module, { type: 'signoff' }) },
    { key: 'stuck', label: 'Stuck sign-offs', value: glance.stuck ?? 0, icon: 'i-lucide-siren', tone: 'error', hint: 'Waiting past the escalation.', to: tasksLink(module, { type: 'signoff', level: 'stuck' }) },
    overdue,
    ...buildings,
  ]
}
const glances = computed(() => (summary.value?.modules ?? []).map((glance) => ({
  module: glance.module,
  title: `${TASK_MODULES[glance.module]} at a glance`,
  icon: TASK_MODULE_ICONS[glance.module],
  cards: glanceCards(glance),
})))

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
      v-if="glances.length"
      class="space-y-6"
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
      <section
        v-for="glance in glances"
        :key="glance.module"
        class="space-y-3"
        :aria-labelledby="`home-glance-${glance.module}`"
      >
        <h3
          :id="`home-glance-${glance.module}`"
          class="flex items-center gap-2 font-semibold text-highlighted"
        >
          <UIcon
            :name="glance.icon"
            class="size-4 text-muted"
          />
          {{ glance.title }}
        </h3>
        <div
          class="grid gap-4 sm:grid-cols-2"
          :class="{ 'xl:grid-cols-3': glance.cards.length === 3, 'xl:grid-cols-4': glance.cards.length === 4, 'xl:grid-cols-5': glance.cards.length === 5 }"
        >
          <KpiCard
            v-for="card in glance.cards"
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
