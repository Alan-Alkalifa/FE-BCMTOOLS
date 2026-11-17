<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Task, TaskLevelFilter, TaskModule, TaskType } from '~/composables/useTasks'

/**
 * Task Management: one tab per module the user's roles open — SCCA, RA HO, RA Branch (with
 * their buildings waiting for approval) and Sites (disasters and incidents waiting for approval,
 * for their approvers). In a tab the
 * module's BCM sees every task; everyone else what waits for them: the approvals and sign-off
 * steps they sign and the renewals of what they look after. Each task is done on its own page.
 * Nothing is reminded from here.
 */
definePageMeta({ permission: ['scca.access', 'ra.access', 'ra_branch.access'] })

const route = useRoute()
const router = useRouter()
const perPage = useRowsPerPage()

const MODULES: TaskModule[] = ['scca', 'ra', 'ra_branch', 'sites']
const TYPES: TaskType[] = ['signoff', 'renewal', 'building', 'disaster', 'incident']
const LEVELS: TaskLevelFilter[] = ['stuck', 'overdue', 'due']
function pick<T extends string>(value: unknown, options: T[]): T | undefined {
  return options.includes(value as T) ? value as T : undefined
}

const query = computed(() => ({
  // Sites was called Location: old links open it.
  module: pick(route.query.module === 'location' ? 'sites' : route.query.module, MODULES),
  type: pick(route.query.type, TYPES),
  level: pick(route.query.level, LEVELS),
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
}))
const { data, status, error, refresh } = useTasks(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const search = ref(query.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const next = value.trim()
    if (next === (query.value.q ?? '')) return
    setQuery({ q: next || undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

/** The tab: the module shown (the API falls back to the first the user may open). */
const module = computed<TaskModule | null>(() => {
  const asked = query.value.module
  if (asked && data.value?.tabs.some((item) => item.module === asked)) return asked
  return data.value?.module ?? null
})
const tab = computed<TaskModule | undefined>({
  get: () => module.value ?? undefined,
  set: (value) => {
    clearTimeout(searchTimer)
    search.value = ''
    router.replace({ query: { module: value } })
  },
})
const tabItems = computed(() => (data.value?.tabs ?? []).map((item) => ({
  label: TASK_MODULES[item.module],
  value: item.module,
  icon: TASK_MODULE_ICONS[item.module],
  badge: item.total ? { label: String(item.total), color: 'neutral' as const, variant: 'subtle' as const } : undefined,
})))
const filtered = computed(() => Boolean(query.value.q || query.value.type || query.value.level))
function clearFilters() {
  clearTimeout(searchTimer)
  search.value = ''
  router.replace({ query: { module: query.value.module } })
}
function setQuery(values: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...values, page: undefined } })
}

const typeFilter = computed({
  get: () => query.value.type ?? 'all',
  set: (value: TaskType | 'all') => setQuery({ type: value === 'all' ? undefined : value, level: undefined }),
})
const TYPE_LABELS: Record<TaskType, string> = { signoff: 'Sign-offs', renewal: 'Renewals', building: 'Buildings', disaster: 'Disasters', incident: 'Incidents' }
const { can } = useAuth()
/** Buildings waiting for approval are reviewed in Master building: only for who opens it. */
const moduleTypes = computed(() => (module.value ? TASK_MODULE_TYPES[module.value] : TYPES)
  .filter((type) => type !== 'building' || can('location.master')))
const typeItems = computed(() => [
  { label: 'Every task', value: 'all' },
  ...moduleTypes.value.map((type) => ({ label: TYPE_LABELS[type], value: type })),
])

/** The tab's cards filter the list, like Monitoring's; clicking the active one shows all again. */
const cards = computed(() => {
  const counts = data.value?.counts
  const all = data.value?.oversees
  const hints: Record<TaskType, string> = {
    signoff: module.value === 'scca'
      ? (all ? 'Every SCCA in approval.' : 'SCCA approvals waiting for you.')
      : (all ? 'Every RA in sign-off.' : 'RA sign-off steps waiting for you.'),
    renewal: all ? 'Overdue or due within 90 days.' : 'Of what you look after, overdue or due within 90 days.',
    building: 'New, or to make inactive, waiting for approval.',
    disaster: 'Declared, waiting for approval.',
    incident: 'Declared, waiting for approval.',
  }
  const looks: Record<TaskType, { icon: string, tone: 'info' | 'warning' | 'error' }> = {
    signoff: { icon: 'i-lucide-badge-check', tone: 'info' },
    renewal: { icon: 'i-lucide-calendar-clock', tone: 'warning' },
    building: { icon: 'i-lucide-building', tone: 'warning' },
    disaster: { icon: 'i-lucide-siren', tone: 'error' },
    incident: { icon: 'i-lucide-triangle-alert', tone: 'error' },
  }
  return moduleTypes.value.map((type) => ({ label: TYPE_LABELS[type], type, value: counts?.[type], hint: hints[type], ...looks[type] }))
})
function cardLink(type: TaskType) {
  return { query: { ...route.query, type: query.value.type === type ? undefined : type, level: undefined, page: undefined } }
}

const LEVEL_LABELS: Record<TaskLevelFilter, string> = { stuck: 'Stuck sign-offs', overdue: 'Overdue renewals', due: 'Renewals due' }

function waited(task: Task) {
  if (task.type === 'renewal') {
    const days = task.days_left ?? 0
    if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} overdue`
    return days === 0 ? 'Due today' : `Due in ${days} ${days === 1 ? 'day' : 'days'}`
  }
  if (task.type === 'disaster' || task.type === 'incident') {
    const hours = Math.floor(task.hours_waiting ?? 0)
    return hours < 1 ? 'Under an hour' : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const days = task.working_days_waiting ?? 0
  return days === 0 ? 'Today' : `${days} working ${days === 1 ? 'day' : 'days'}`
}
function urgent(task: Task) {
  return task.level === 'escalated' || task.level === 'overdue'
}
function urgentLabel(task: Task) {
  return task.type === 'signoff' ? 'Stuck' : 'Escalated to BCM'
}
function subline(task: Task) {
  return [task.ref, task.detail].filter(Boolean).join(' · ')
}
function openLabel(task: Task) {
  if (!task.mine) return 'Open'
  return task.type === 'renewal' ? 'Renew' : 'Review'
}

const columns: TableColumn<Task>[] = [
  { accessorKey: 'type', header: 'Task' },
  { id: 'record', header: 'What' },
  { accessorKey: 'assignee', header: 'Who acts' },
  { id: 'waiting', header: 'Waiting or due' },
  { id: 'actions', header: '', meta: { class: { td: 'text-right' } } },
]
</script>

<template>
  <AppPage
    title="Task Management"
    icon="i-lucide-list-todo"
    description="What waits for someone, one tab per module you work in. Each task is done on its own page."
    :crumbs="[{ label: 'Task Management' }]"
  >
    <UTabs
      v-if="tabItems.length"
      v-model="tab"
      :items="tabItems"
      :content="false"
      variant="link"
      class="w-full"
    />

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="6"
      :rows="5"
      label="Loading the tasks"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the tasks"
      :description="apiErrorMessage(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>

    <div
      v-else
      class="space-y-6"
    >
      <UAlert
        v-if="data && !data.module"
        color="neutral"
        variant="subtle"
        icon="i-lucide-lock"
        title="No module to show"
        description="Your roles open none of SCCA, RA HO, RA Branch or Sites."
      />
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2"
        :class="cards.length > 2 ? 'xl:grid-cols-3' : ''"
      >
        <KpiCard
          v-for="card in cards"
          :key="card.type"
          :to="cardLink(card.type)"
          :label="card.label"
          :value="card.value ?? null"
          :hint="query.type === card.type ? 'Showing only these. Click again to show all.' : card.hint"
          :icon="card.icon"
          :tone="card.tone"
          :active="query.type === card.type"
        />
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <ListFilterBar
          :filtered="filtered"
          @clear="clearFilters"
        >
          <template #search>
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Name, reference, step or person"
              aria-label="Search the tasks"
              class="w-full"
            />
          </template>
          <USelect
            v-model="typeFilter"
            :items="typeItems"
            class="w-40"
            aria-label="Filter by task"
          />
          <UBadge
            v-if="query.level"
            color="neutral"
            variant="subtle"
            size="lg"
            class="gap-1"
          >
            {{ LEVEL_LABELS[query.level] }}
            <UButton
              color="neutral"
              variant="link"
              size="xs"
              icon="i-lucide-x"
              class="p-0"
              :aria-label="`Show more than ${LEVEL_LABELS[query.level].toLowerCase()}`"
              @click="setQuery({ level: undefined })"
            />
          </UBadge>
        </ListFilterBar>

        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          :ui="{ td: 'align-top' }"
        >
          <template #type-cell="{ row }">
            <StatusBadge
              :scale="taskType"
              :value="row.original.type"
              size="sm"
            />
          </template>
          <template #record-cell="{ row }">
            <NuxtLink
              :to="row.original.url"
              class="font-medium text-primary hover:underline"
            >
              {{ row.original.title }}
            </NuxtLink>
            <p class="text-xs text-muted">
              {{ subline(row.original) }}
            </p>
          </template>
          <template #assignee-cell="{ row }">
            <span>{{ row.original.mine && row.original.type === 'signoff' ? 'You' : (row.original.assignee ?? '—') }}</span>
            <p
              v-if="row.original.requested_by"
              class="text-xs text-muted"
            >
              Asked by {{ row.original.requested_by }}
            </p>
          </template>
          <template #waiting-cell="{ row }">
            <span
              class="whitespace-nowrap"
              :class="{ 'font-medium text-error': urgent(row.original) }"
            >{{ waited(row.original) }}</span>
            <p
              v-if="urgent(row.original) && row.original.type !== 'renewal'"
              class="text-xs text-error"
            >
              {{ urgentLabel(row.original) }}
            </p>
            <p
              v-if="row.original.reminders_sent"
              class="text-xs text-muted"
            >
              {{ row.original.reminders_sent }} {{ row.original.reminders_sent === 1 ? 'reminder' : 'reminders' }}
            </p>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-2">
              <UButton
                :to="row.original.url"
                size="sm"
                :color="row.original.mine ? 'primary' : 'neutral'"
                :variant="row.original.mine ? 'solid' : 'outline'"
                :label="openLabel(row.original)"
                :aria-label="`${openLabel(row.original)}: ${row.original.title}`"
              />
            </div>
            <p
              v-if="row.original.own"
              class="mt-1 text-xs text-muted"
            >
              You asked. Someone else approves.
            </p>
          </template>
          <template #empty>
            <p class="py-10 text-center text-sm text-muted">
              {{ filtered ? 'No task matches these filters.' : data?.oversees ? 'Nothing is waiting.' : 'Nothing waits for you.' }}
            </p>
          </template>
        </UTable>

        <TablePagination
          v-if="data"
          v-model:per-page="perPage"
          page-sizes
          :total="data.total"
          label="Tasks"
          :to="(page) => ({ query: { ...route.query, page } })"
          :page="query.page"
        />
      </UCard>
    </div>
  </AppPage>
</template>
