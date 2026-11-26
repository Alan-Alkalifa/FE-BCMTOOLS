<script setup lang="ts">
import type { MenuNode } from '~/composables/useAuth'
import type { TaskCardFilter, TaskModule } from '~/composables/useTasks'

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
 * The overview, one tab per module the user's roles open (SCCA, RA HO, RA Branch, BIA, Sites),
 * with the same cards as its Task Management tab (`taskCards`): Waiting for me and In approval
 * for everyone, and for the module's BCM the Overview Administrator (stuck sign-offs, overdue
 * renewals, and in RA HO and RA Branch the buildings waiting for approval). Each card opens
 * that list in Task Management.
 */
const { data: summary } = useTaskSummary()
function tasksLink(module: TaskModule, filter: TaskCardFilter) {
  const query: Record<string, string> = { module }
  for (const [key, value] of Object.entries(filter)) if (value) query[key] = value
  return `/tasks?${new URLSearchParams(query).toString()}`
}
const glances = computed(() => (summary.value?.modules ?? []).map((glance) => ({
  module: glance.module,
  oversees: glance.oversees,
  mine: glance.mine ?? 0,
  ...taskCards(glance.module, glance, glance.oversees),
})))
const overviewTab = ref<TaskModule>()
const glance = computed(() => glances.value.find((item) => item.module === overviewTab.value) ?? glances.value[0])
const overviewTabs = computed(() => glances.value.map((item) => ({
  label: TASK_MODULES[item.module],
  value: item.module,
  icon: TASK_MODULE_ICONS[item.module],
  badge: item.mine ? { label: String(item.mine), color: 'warning' as const, variant: 'subtle' as const } : undefined,
})))
const overviewModel = computed<TaskModule | undefined>({
  get: () => glance.value?.module,
  set: (value) => { overviewTab.value = value },
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
      v-if="glance"
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
      <UTabs
        v-model="overviewModel"
        :items="overviewTabs"
        :content="false"
        variant="link"
        class="w-full"
        aria-label="Overview by module"
      />
      <div
        class="grid gap-4 sm:grid-cols-2"
        data-testid="home-overview-cards"
      >
        <KpiCard
          v-for="card in glance.basic"
          :key="card.key"
          :to="tasksLink(glance.module, card.filter)"
          :label="card.label"
          :value="card.value ?? 0"
          :hint="card.hint"
          :icon="card.icon"
          :tone="card.tone"
        />
      </div>
      <section
        v-if="glance.admin.length"
        class="space-y-3"
        aria-labelledby="home-overview-admin"
      >
        <h3
          id="home-overview-admin"
          class="flex items-center gap-2 font-semibold text-highlighted"
        >
          <UIcon
            name="i-lucide-shield-alert"
            class="size-4 text-muted"
          />
          Overview Administrator
          <span class="text-sm font-normal text-muted">{{ TASK_MODULES[glance.module] }}</span>
        </h3>
        <div
          class="grid gap-4 sm:grid-cols-2"
          :class="{ 'xl:grid-cols-3': glance.admin.length === 3 }"
          data-testid="home-overview-admin-cards"
        >
          <KpiCard
            v-for="card in glance.admin"
            :key="card.key"
            :to="tasksLink(glance.module, card.filter)"
            :label="card.label"
            :value="card.value ?? 0"
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
