<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaTask, RaTaskType } from '~/composables/useRa'

/**
 * Task Management: the buildings and branches (new, or to make inactive) and the declared
 * incidents waiting for someone else's approval, incidents first, then the longest waiting.
 * They are approved or rejected on their own page; here the approver sees what waits, how long
 * and how often the approvers were reminded, and can remind them now.
 */
definePageMeta({ permission: ['ra.location.approve', 'ra.manage', 'ra_branch.manage'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const PER_PAGE = 25

const TYPES: RaTaskType[] = ['register', 'deactivate', 'incident']
function asType(value: unknown): RaTaskType | undefined {
  return TYPES.includes(value as RaTaskType) ? value as RaTaskType : undefined
}

const query = computed(() => ({
  type: asType(route.query.type),
  kind: route.query.kind === 'head_office' || route.query.kind === 'branch' ? route.query.kind as RaKind : undefined,
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: PER_PAGE,
}))
const { data, status, error, refresh } = useRaTasks(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const search = ref(query.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const next = value.trim()
    if (next === (query.value.q ?? '')) return
    router.replace({ query: { ...route.query, q: next || undefined, page: undefined } })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
const filtered = computed(() => Boolean(route.query.q || route.query.type || route.query.kind))
function clearFilters() {
  clearTimeout(searchTimer)
  search.value = ''
  router.replace({ query: {} })
}

function setQuery(values: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...values, page: undefined } })
}
const typeFilter = computed({
  get: () => query.value.type ?? 'all',
  set: (value: RaTaskType | 'all') => setQuery({ type: value === 'all' ? undefined : value, kind: value === 'incident' ? undefined : route.query.kind as string | undefined }),
})
const typeItems = [
  { label: 'Every task', value: 'all' },
  { label: 'New buildings and branches', value: 'register' },
  { label: 'Make inactive', value: 'deactivate' },
  { label: 'Incidents', value: 'incident' },
]
const kindFilter = computed({
  get: () => query.value.kind ?? 'all',
  set: (value: RaKind | 'all') => setQuery({ kind: value === 'all' ? undefined : value, type: query.value.type === 'incident' ? undefined : query.value.type }),
})
const kindItems = [
  { label: 'Every module', value: 'all' },
  { label: 'RA HO', value: 'head_office' },
  { label: 'RA Branch', value: 'branch' },
]

const cards = computed(() => [
  { type: 'incident' as const, label: 'Incidents', icon: 'i-lucide-siren', tone: 'error' as const, hint: 'Declared, not yet confirmed. They stay off the map until approved.' },
  { type: 'register' as const, label: 'New buildings and branches', icon: 'i-lucide-building', tone: 'warning' as const, hint: 'Their RAs can be submitted once approved.' },
  { type: 'deactivate' as const, label: 'Make inactive', icon: 'i-lucide-archive', tone: 'warning' as const, hint: 'Buildings and branches to take out of use.' },
])
function cardLink(type: RaTaskType) {
  return { query: { ...route.query, type: query.value.type === type ? undefined : type, kind: type === 'incident' ? undefined : route.query.kind, page: undefined } }
}

const TASK_LABELS: Record<RaTask['action'], string> = {
  register: 'New',
  deactivate: 'Make inactive',
  declare: 'Incident',
}
const raTaskType = defineStatusScale({
  register: { label: 'New', color: 'warning', icon: 'i-lucide-plus' },
  deactivate: { label: 'Make inactive', color: 'neutral', icon: 'i-lucide-archive' },
  declare: { label: 'Incident', color: 'error', icon: 'i-lucide-siren' },
})

function waited(task: RaTask) {
  if (task.type === 'incident') {
    const hours = Math.floor(task.hours_waiting)
    return hours < 1 ? 'Under an hour' : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const days = task.working_days_waiting
  return days === 0 ? 'Today' : `${days} working ${days === 1 ? 'day' : 'days'}`
}

function moduleLabel(task: RaTask) {
  if (task.type === 'incident') return task.kind ? RA_MODULES[task.kind].title : 'Map point'
  return task.kind ? RA_MODULES[task.kind].title : '—'
}

const columns: TableColumn<RaTask>[] = [
  { accessorKey: 'action', header: 'Task' },
  { id: 'record', header: 'Waiting for approval' },
  { id: 'module', header: 'Module' },
  { accessorKey: 'requested_by', header: 'Asked by' },
  { id: 'waiting', header: 'Waiting' },
  { id: 'reminders', header: 'Reminders', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'actions', header: '', meta: { class: { td: 'text-right' } } },
]

const reminding = ref<string | null>(null)
async function remind(task: RaTask) {
  const key = `${task.type}-${task.id}`
  reminding.value = key
  try {
    const result = await raTaskApi.remind(task.type, task.id)
    toast.add({
      title: result.email_sent ? 'Approvers reminded' : 'Reminder recorded',
      description: result.email_sent
        ? `${task.title}. Every approver but who asked got an email.`
        : 'No email went out. Check the email settings in Administration.',
      color: result.email_sent ? 'success' : 'warning',
      icon: result.email_sent ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert',
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
    description="Buildings, branches and incidents waiting for someone else's approval. Open one to approve or reject it on its page. The approvers are emailed when it starts waiting and reminded until it is decided."
    :crumbs="[{ label: 'Task Management' }]"
  >
    <template #actions>
      <UButton
        to="/crises?status=pending"
        color="neutral"
        variant="outline"
        icon="i-lucide-siren"
        label="Incidents"
      />
      <UButton
        to="/locations?status=pending"
        color="neutral"
        variant="outline"
        icon="i-lucide-building"
        label="Buildings"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="7"
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
      <div class="grid gap-4 sm:grid-cols-3">
        <KpiCard
          v-for="card in cards"
          :key="card.type"
          :to="cardLink(card.type)"
          :label="card.label"
          :value="data?.counts[card.type] ?? null"
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
              placeholder="Name, building ID or incident reference"
              aria-label="Search the tasks"
              class="w-full"
            />
          </template>
          <USelect
            v-model="typeFilter"
            :items="typeItems"
            class="w-52"
            aria-label="Filter by task"
          />
          <USelect
            v-model="kindFilter"
            :items="kindItems"
            class="w-40"
            aria-label="Filter by module"
          />
        </ListFilterBar>

        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
        >
          <template #action-cell="{ row }">
            <StatusBadge
              :scale="raTaskType"
              :value="row.original.action"
              size="sm"
            />
          </template>
          <template #record-cell="{ row }">
            <NuxtLink
              :to="row.original.url"
              class="font-medium text-primary hover:underline"
            >
              {{ row.original.name }}
            </NuxtLink>
            <p class="text-xs text-muted">
              {{ [row.original.ref, row.original.hazard].filter(Boolean).join(' · ') || TASK_LABELS[row.original.action] }}
            </p>
          </template>
          <template #module-cell="{ row }">
            {{ moduleLabel(row.original) }}
          </template>
          <template #requested_by-cell="{ row }">
            <span>{{ row.original.requested_by ?? '—' }}</span>
            <p class="text-xs text-muted whitespace-nowrap">
              {{ formatDateTime(row.original.requested_at) }}
            </p>
          </template>
          <template #waiting-cell="{ row }">
            <span
              class="whitespace-nowrap"
              :class="{ 'font-medium text-error': row.original.escalated_at }"
            >{{ waited(row.original) }}</span>
            <p
              v-if="row.original.escalated_at"
              class="text-xs text-error"
            >
              Escalated to BCM
            </p>
          </template>
          <template #reminders-cell="{ row }">
            <span class="tabular-nums">{{ formatNumber(row.original.reminders_sent, 0) }}</span>
            <p
              v-if="row.original.last_reminded_at"
              class="text-xs text-muted whitespace-nowrap"
            >
              Last {{ formatDateTime(row.original.last_reminded_at) }}
            </p>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-bell-ring"
                label="Remind"
                :aria-label="`Remind the approvers: ${row.original.title}`"
                :loading="reminding === `${row.original.type}-${row.original.id}`"
                @click="remind(row.original)"
              />
              <UButton
                :to="row.original.url"
                size="sm"
                :color="row.original.can_decide ? 'primary' : 'neutral'"
                :variant="row.original.can_decide ? 'solid' : 'outline'"
                :label="row.original.can_decide ? 'Review' : 'Open'"
                :aria-label="`${row.original.can_decide ? 'Review' : 'Open'}: ${row.original.title}`"
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
              {{ filtered ? 'Nothing waiting matches these filters.' : 'Nothing is waiting for approval.' }}
            </p>
          </template>
        </UTable>

        <TablePagination
          v-if="data"
          :total="data.total"
          :per-page="PER_PAGE"
          label="Tasks"
          :to="(page) => ({ query: { ...route.query, page } })"
          :page="query.page"
        />
      </UCard>
    </div>
  </AppPage>
</template>
