<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Task, TaskLevelFilter, TaskModule, TaskScope, TaskType } from '~/composables/useTasks'

/**
 * Task Management: what waits for someone, across SCCA, RA HO, RA Branch and Location.
 * **My tasks** (everyone): the approvals and sign-off steps waiting for me, the buildings and
 * incidents I may approve, and the renewals of what I am responsible for. **Everything** (BCM):
 * every sign-off in approval, stuck step, renewal and waiting building or incident of the
 * modules they oversee. Each task is done on its own page; here BCM can remind whoever must act.
 */
definePageMeta({ permission: ['scca.access', 'ra.access', 'ra_branch.access'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const perPage = useRowsPerPage()

const MODULES: TaskModule[] = ['scca', 'ra', 'ra_branch', 'location']
const TYPES: TaskType[] = ['signoff', 'renewal', 'building', 'incident']
const LEVELS: TaskLevelFilter[] = ['stuck', 'overdue', 'due']
function pick<T extends string>(value: unknown, options: T[]): T | undefined {
  return options.includes(value as T) ? value as T : undefined
}

const query = computed(() => ({
  scope: (route.query.scope === 'all' ? 'all' : 'mine') as TaskScope,
  module: pick(route.query.module, MODULES),
  type: pick(route.query.type, TYPES),
  level: pick(route.query.level, LEVELS),
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
}))
const { data, status, error, refresh } = useTasks(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const scope = computed<TaskScope>({
  get: () => query.value.scope,
  set: (value) => router.replace({ query: { scope: value === 'all' ? 'all' : undefined } }),
})
const scopeItems = computed(() => [
  { label: 'My tasks', value: 'mine', icon: 'i-lucide-user-check' },
  ...(data.value?.can_see_all ? [{ label: 'Everything', value: 'all', icon: 'i-lucide-layers' }] : []),
])

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
const filtered = computed(() => Boolean(query.value.q || query.value.module || query.value.type || query.value.level))
function clearFilters() {
  clearTimeout(searchTimer)
  search.value = ''
  router.replace({ query: { scope: query.value.scope === 'all' ? 'all' : undefined } })
}
function setQuery(values: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...values, page: undefined } })
}

const moduleFilter = computed({
  get: () => query.value.module ?? 'all',
  set: (value: TaskModule | 'all') => setQuery({ module: value === 'all' ? undefined : value }),
})
const moduleItems = computed(() => [
  { label: 'Every module', value: 'all' },
  ...MODULES
    .filter((module) => query.value.scope === 'mine' || data.value?.modules.includes(module))
    .map((module) => ({ label: TASK_MODULES[module], value: module })),
])
const typeFilter = computed({
  get: () => query.value.type ?? 'all',
  set: (value: TaskType | 'all') => setQuery({ type: value === 'all' ? undefined : value, level: undefined }),
})
const typeItems = [
  { label: 'Every task', value: 'all' },
  { label: 'Sign-offs', value: 'signoff' },
  { label: 'Renewals', value: 'renewal' },
  { label: 'Buildings', value: 'building' },
  { label: 'Incidents', value: 'incident' },
]

/** The cards filter the list, like Monitoring's; clicking the active one shows all again. */
const cards = computed(() => {
  const counts = data.value?.counts
  return [
    { label: 'Sign-offs', type: 'signoff' as const, icon: 'i-lucide-badge-check', tone: 'info' as const, value: counts?.signoff, hint: query.value.scope === 'mine' ? 'SCCA approvals and RA steps waiting for you.' : 'Every SCCA and RA in approval.' },
    { label: 'Renewals', type: 'renewal' as const, icon: 'i-lucide-calendar-clock', tone: 'warning' as const, value: counts?.renewal, hint: 'Overdue or due within 90 days.' },
    { label: 'Buildings', type: 'building' as const, icon: 'i-lucide-building', tone: 'warning' as const, value: counts?.building, hint: 'New, or to make inactive, waiting for approval.' },
    { label: 'Incidents', type: 'incident' as const, icon: 'i-lucide-siren', tone: 'error' as const, value: counts?.incident, hint: 'Declared, waiting for approval.' },
  ]
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
  if (task.type === 'incident') {
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
function moduleLabel(task: Task) {
  if (task.module === 'location') return task.kind ? `Location · ${task.kind === 'branch' ? 'Branch' : 'Head office'}` : 'Location'
  return TASK_MODULES[task.module]
}
function openLabel(task: Task) {
  if (!task.mine) return 'Open'
  return task.type === 'renewal' ? 'Renew' : 'Review'
}

const columns: TableColumn<Task>[] = [
  { accessorKey: 'type', header: 'Task' },
  { id: 'record', header: 'What' },
  { accessorKey: 'module', header: 'Module' },
  { accessorKey: 'assignee', header: 'Who acts' },
  { id: 'waiting', header: 'Waiting or due' },
  { id: 'actions', header: '', meta: { class: { td: 'text-right' } } },
]

const reminding = ref<string | null>(null)
async function remind(task: Task) {
  reminding.value = task.key
  try {
    const result = await taskApi.remind(task)
    toast.add({
      title: result.sent ? 'Reminder sent' : 'Reminder recorded',
      description: result.sent
        ? `${task.title}: ${task.type === 'signoff' ? 'the signer' : 'every approver but who asked'} got an email.`
        : 'No email went out. Check the email settings in Administration.',
      color: result.sent ? 'success' : 'warning',
      icon: result.sent ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert',
    })
    await refresh()
  } catch (failure) {
    toast.add({ title: 'Couldn\'t send the reminder', description: apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reminding.value = null
  }
}
</script>

<template>
  <AppPage
    title="Task Management"
    icon="i-lucide-list-todo"
    description="What waits for someone, across SCCA, RA HO, RA Branch and Location. Each task is done on its own page."
    :crumbs="[{ label: 'Task Management' }]"
  >
    <UTabs
      v-if="scopeItems.length > 1"
      v-model="scope"
      :items="scopeItems"
      :content="false"
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
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <USelect
            v-model="moduleFilter"
            :items="moduleItems"
            class="w-40"
            aria-label="Filter by module"
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
              {{ [row.original.ref, row.original.detail].filter(Boolean).join(' · ') }}
            </p>
          </template>
          <template #module-cell="{ row }">
            <span class="whitespace-nowrap">{{ moduleLabel(row.original) }}</span>
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
                v-if="row.original.can_remind"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-bell-ring"
                label="Remind"
                :aria-label="`Remind: ${row.original.title}`"
                :loading="reminding === row.original.key"
                @click="remind(row.original)"
              />
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
              {{ filtered ? 'No task matches these filters.' : query.scope === 'mine' ? 'Nothing waits for you.' : 'Nothing is waiting.' }}
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
