<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { parseDate, type CalendarDate } from '@internationalized/date'
import type { OrganizationChange, OrganizationDetected, OrganizationRow, UnitLevel } from '~/utils/bianca-organization'
import BiancaOrganizationForm from '~/components/bianca/BiancaOrganizationForm.vue'
import OrganizationPathCell from '~/components/bianca/OrganizationPathCell.vue'
import OrganizationChangeForm from '~/components/bianca/OrganizationChangeForm.vue'
import OrganizationHistoryDialog from '~/components/bianca/OrganizationHistoryDialog.vue'
import { organizationChangeKinds, organizationChangeSources, organizationEndpoint, organizationLevels, organizationPathColumns, organizationPathLabel } from '~/utils/bianca-organization'

/**
 * Administration › Master data › Organization structure, laid out as SCCA Monitoring: one filter
 * card, then Structure (a tree or a table of the units), Change history and Detected changes
 * (what an HR import found, waiting to be confirmed). Every filter and tab is in the URL.
 */
definePageMeta({ permission: ['masterdata.access', 'masterdata.organization.manage'] })
const { can } = useAuth()
const manage = computed(() => can('masterdata.organization.manage'))
const unitForm = useOverlay().create(BiancaOrganizationForm)
const changeForm = useOverlay().create(OrganizationChangeForm)
const historyDialog = useOverlay().create(OrganizationHistoryDialog)
const confirm = useConfirm()
const toast = useToast()
const orgRevision = useBiancaOrgRevision()
const perPage = useRowsPerPage()
const route = useRoute()
const router = useRouter()

type TreeRow = OrganizationRow & { children?: TreeRow[] }
const TABS = ['structure', 'history', 'detected'] as const
type Tab = (typeof TABS)[number]

function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}
function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch, page: undefined } })
}
function queryRef(name: string, all = 'all') {
  return computed<string>({
    get: () => text(name) ?? all,
    set: (value) => setQuery({ [name]: value === all ? undefined : value }),
  })
}

const tab = computed<Tab>({
  get: () => (TABS.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'structure'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'structure' ? undefined : value, page: undefined } }),
})
const view = computed<'tree' | 'table'>({
  get: () => (route.query.view === 'table' ? 'table' : 'tree'),
  set: (value) => setQuery({ view: value === 'table' ? 'table' : undefined }),
})
const level = computed<UnitLevel>({
  get: () => organizationLevels.find((item) => item.value === route.query.level)?.value ?? 'directorate',
  set: (value) => setQuery({ level: value === 'directorate' ? undefined : value }),
})
const levelLabel = computed(() => organizationLevels.find((item) => item.value === level.value)!.label)

// --- filters ---------------------------------------------------------------------------------

const directorate = queryRef('directorate')
const subDirectorate = queryRef('sub_directorate')
const source = queryRef('source')
const status = queryRef('status')
const owner = queryRef('owner')
const kind = queryRef('kind')
const changeSource = queryRef('change_source')
const changeLevel = queryRef('change_level')
watch(directorate, () => {
  if (text('sub_directorate')) setQuery({ sub_directorate: undefined })
})

const search = ref(text('q') ?? '')
watch(() => route.query.q, () => (search.value = text('q') ?? ''))
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (text('q') ?? '')) setQuery({ q: value.trim() || undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const fromDate = computed<CalendarDate | undefined>({
  get: () => (text('from') ? parseDate(text('from')!) : undefined),
  set: (value) => setQuery({ from: value?.toString() }),
})
const toDate = computed<CalendarDate | undefined>({
  get: () => (text('to') ? parseDate(text('to')!) : undefined),
  set: (value) => setQuery({ to: value?.toString() }),
})

const FILTERS = ['q', 'directorate', 'sub_directorate', 'source', 'status', 'owner', 'kind', 'change_source', 'change_level', 'from', 'to']
const filtered = computed(() => FILTERS.some((name) => text(name)))
function clearFilters() {
  search.value = ''
  const keep = Object.fromEntries(Object.entries(route.query).filter(([name]) => !FILTERS.includes(name) && name !== 'page'))
  router.replace({ query: keep })
}

function options(all: string, values: string[]) {
  return [{ label: all, value: 'all' }, ...[...new Set(values)].sort((a, b) => a.localeCompare(b)).map((value) => ({ label: value, value }))]
}
const sourceItems = [{ label: 'HR and BIA', value: 'all' }, { label: 'HR', value: 'hr' }, { label: 'BIA', value: 'bia' }]
const statusItems = [
  { label: 'Any status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Waiting for HR', value: 'waiting' },
  { label: 'No longer in HR', value: 'left' },
]
const ownerItems = [{ label: 'Any assigned user', value: 'all' }, { label: 'No assigned user', value: 'none' }, { label: 'Has an assigned user', value: 'set' }]
const kindItems = [{ label: 'All types', value: 'all' }, ...Object.entries(organizationChangeKinds).map(([value, item]) => ({ label: item.label, value }))]
// Changes > Changed level: the level of the unit that changed, not every unit under it.
const changeLevelItems = [{ label: 'All levels', value: 'all' }, ...organizationLevels.map((item) => ({ label: item.label, value: item.value }))]
const changeSourceItems = [{ label: 'Manual and HR import', value: 'all' }, ...Object.entries(organizationChangeSources).map(([value, label]) => ({ label, value }))]

// --- structure -------------------------------------------------------------------------------

const { data, error, status: loadStatus, refresh } = useFetch<{ items: OrganizationRow[] }>(organizationEndpoint, { query: { details: 1 } })
const showSkeleton = useDelayedLoading(() => loadStatus.value === 'pending' && !data.value)
const units = computed(() => data.value?.items ?? [])
const directorateItems = computed(() => options('All directorates', units.value.map((row) => row.directorate)))
const subDirectorateItems = computed(() => options('All sub directorates', units.value
  .filter((row) => row.sub_directorate && (directorate.value === 'all' || row.directorate === directorate.value))
  .map((row) => row.sub_directorate)))

function matches(row: OrganizationRow) {
  const term = (text('q') ?? '').toLowerCase()
  return (directorate.value === 'all' || row.directorate === directorate.value)
    && (subDirectorate.value === 'all' || row.sub_directorate === subDirectorate.value)
    && (source.value === 'all' || row.source === source.value)
    && (status.value === 'all' || (status.value === 'waiting' ? !!row.waiting_hr : status.value === 'left' ? !!row.left_hr : row.available === (status.value === 'active')))
    && (owner.value === 'all' || !!row.owner === (owner.value === 'set'))
    && (!term || [row[row.level], row.code, row.description, row.owner?.name, row.owner?.email]
      .some((value) => value?.toLowerCase().includes(term)))
}

/** Directorates with their sub directorates and groups; a unit shows when it or a unit under it
 * matches the filters. */
const tree = computed<TreeRow[]>(() => {
  const children = (parent: OrganizationRow, childLevel: UnitLevel): TreeRow[] => units.value
    .filter((row) => row.level === childLevel && row.directorate === parent.directorate
      && (childLevel === 'sub_directorate' || row.sub_directorate === parent.sub_directorate))
    .map((row) => node(row))
    .filter((row): row is TreeRow => !!row)
  function node(row: OrganizationRow): TreeRow | null {
    const next = row.level === 'directorate' ? 'sub_directorate' : row.level === 'sub_directorate' ? 'org_group' : null
    const kids = next ? children(row, next) : []
    if (!kids.length && !matches(row)) return null
    return kids.length ? { ...row, children: kids } : { ...row }
  }
  return units.value.filter((row) => row.level === 'directorate').map(node).filter((row): row is TreeRow => !!row)
})
const flat = computed(() => units.value.filter((row) => row.level === level.value && matches(row)))
const structureRows = computed<TreeRow[]>(() => (view.value === 'tree' ? tree.value : flat.value))
const page = computed(() => Math.min(Math.max(1, Math.floor(Number(route.query.page)) || 1), Math.max(1, Math.ceil(structureRows.value.length / perPage.value))))
const pageRows = computed(() => structureRows.value.slice((page.value - 1) * perPage.value, page.value * perPage.value))
watch(perPage, () => setQuery({}))
// A filtered tree opens fully so the matches show; otherwise every directorate starts closed.
const expanded = ref<Record<string, boolean> | true>({})
watch(filtered, (value) => (expanded.value = value ? true : {}), { immediate: true })

const countLine = computed(() => {
  if (view.value === 'table') return `${flat.value.length} ${levelLabel.value.toLowerCase()}${flat.value.length === 1 ? '' : 's'}`
  const shown = (rows: TreeRow[]): number => rows.reduce((sum, row) => sum + 1 + shown(row.children ?? []), 0)
  return `${shown(tree.value)} units in ${tree.value.length} directorate${tree.value.length === 1 ? '' : 's'}`
})

const structureColumns = computed<TableColumn<TreeRow>[]>(() => [
  ...(view.value === 'table'
    ? organizationLevels.slice(0, organizationLevels.findIndex((item) => item.value === level.value)).map((item) => ({ accessorKey: item.value, header: item.label, meta: { class: { th: 'min-w-36', td: 'min-w-36' } } }))
    : []),
  { id: 'unit', header: view.value === 'table' ? levelLabel.value : 'Unit', meta: { class: { th: 'min-w-64', td: 'min-w-64' } } },
  { id: 'employees', header: 'Employees', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { id: 'owner', header: 'Assigned user', meta: { class: { th: 'min-w-44', td: 'min-w-44' } } },
  { accessorKey: 'description', header: 'Description' },
  { id: 'source', header: 'Source' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '', meta: { class: { td: 'w-12 text-end' } } },
])

// --- KPI cards -------------------------------------------------------------------------------

const detected = useFetch<{ items: OrganizationDetected[] }>(`${organizationEndpoint}/detected`, { query: { status: 'pending' }, server: false })
const pending = computed(() => detected.data.value?.items ?? [])
// The tab's list, with the filter bar applied (its badge counts every pending change).
const pendingShown = computed(() => {
  const term = text('q')?.toLowerCase()
  const dir = text('directorate')
  const lvl = text('change_level')
  return pending.value.filter((row) => (!lvl || row.level === lvl)
    && (!dir || row.previous.directorate === dir || row.current.directorate === dir)
    && (!term || [...Object.values(row.previous), ...Object.values(row.current), row.import_file ?? '']
      .some((value) => value.toLowerCase().includes(term))))
})
const cards = computed(() => {
  const active = units.value.filter((row) => row.available)
  const count = (value: UnitLevel) => (data.value ? active.filter((row) => row.level === value).length : null)
  return [
    { key: 'directorate', label: 'Directorates', hint: 'Active', icon: 'i-lucide-building-2', value: count('directorate'), to: { tab: undefined, view: 'table', level: undefined, status: 'active' }, tone: 'neutral' as const, on: view.value === 'table' && level.value === 'directorate' },
    { key: 'sub_directorate', label: 'Sub directorates', hint: 'Active', icon: 'i-lucide-network', value: count('sub_directorate'), to: { tab: undefined, view: 'table', level: 'sub_directorate', status: 'active' }, tone: 'neutral' as const, on: view.value === 'table' && level.value === 'sub_directorate' },
    { key: 'org_group', label: 'Groups', hint: 'Active', icon: 'i-lucide-users', value: count('org_group'), to: { tab: undefined, view: 'table', level: 'org_group', status: 'active' }, tone: 'neutral' as const, on: view.value === 'table' && level.value === 'org_group' },
    { key: 'owner', label: 'No assigned user', hint: 'Active units nobody is assigned to', icon: 'i-lucide-user-x', value: data.value ? active.filter((row) => !row.owner).length : null, to: { tab: undefined, owner: 'none', status: 'active' }, tone: 'warning' as const, on: owner.value === 'none' },
    { key: 'detected', label: 'Waiting confirmation', hint: 'Changes found by an HR import', icon: 'i-lucide-scan-search', value: detected.data.value ? pending.value.length : null, to: { tab: 'detected' }, tone: 'info' as const, on: false },
  ]
})
function cardLink(target: Record<string, string | undefined>) {
  return { query: { ...route.query, ...target, page: undefined } }
}

// --- history ---------------------------------------------------------------------------------

const historyQuery = computed(() => ({
  q: text('q'),
  directorate: text('directorate'),
  kind: text('kind'),
  level: text('change_level'),
  source: text('change_source'),
  from: text('from'),
  to: text('to'),
  page: tab.value === 'history' ? Math.max(1, Number(route.query.page) || 1) : 1,
  per_page: perPage.value,
}))
const history = useFetch<{ items: OrganizationChange[], total: number }>(`${organizationEndpoint}/changes`, { query: historyQuery, server: false })
const historyExport = computed(() => {
  const params = new URLSearchParams(Object.entries(historyQuery.value).filter(([name, value]) => value && !['page', 'per_page'].includes(name)).map(([name, value]) => [name, String(value)]))
  return `${organizationEndpoint}/changes/export.xlsx${params.size ? `?${params}` : ''}`
})
const historyColumns: TableColumn<OrganizationChange>[] = [
  { accessorKey: 'effective_date', header: 'Effective date', meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { accessorKey: 'kind', header: 'Type' },
  ...organizationPathColumns,
  { accessorKey: 'reference', header: 'Reference' },
  { accessorKey: 'source', header: 'Source' },
  { id: 'recorded_by', header: 'Recorded by', meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
]

// --- detected changes ------------------------------------------------------------------------

const detectedColumns: TableColumn<OrganizationDetected>[] = [
  { accessorKey: 'detected_at', header: 'Detected', meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { accessorKey: 'kind', header: 'Type' },
  ...organizationPathColumns,
  { id: 'evidence', header: 'Evidence', meta: { class: { th: 'min-w-64', td: 'min-w-64' } } },
  { id: 'bia_impact', header: 'BIA impact', meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  { accessorKey: 'import_file', header: 'HR file' },
  { id: 'actions', header: '', meta: { class: { td: 'w-24 text-end' } } },
]

// --- actions ---------------------------------------------------------------------------------

async function reload() {
  orgRevision.value++
  await Promise.all([refresh(), history.refresh(), detected.refresh()])
}
async function openUnit(unit?: OrganizationRow) {
  if (!manage.value) return
  const saved = await unitForm.open({ level: unit?.level ?? level.value, unit, units: units.value }).result
  if (saved) await reload()
}
async function recordChange(unit?: OrganizationRow, found?: OrganizationDetected) {
  const saved = await changeForm.open({ units: units.value, unit, detected: found }).result
  if (saved) await reload()
}
async function dismiss(found: OrganizationDetected) {
  const ok = await confirm({
    title: 'Dismiss this change?',
    description: `${organizationPathLabel(found.previous)} → ${organizationPathLabel(found.current)} will not be added to the history. The same change found again later stays dismissed.`,
    confirmLabel: 'Dismiss',
    destructive: true,
  })
  if (!ok) return
  try {
    await $fetch(`${organizationEndpoint}/detected/${found.id}/dismiss`, { method: 'POST' })
    toast.add({ title: 'Change dismissed', color: 'success', icon: 'i-lucide-circle-check' })
    await detected.refresh()
  } catch (failure) {
    toast.add({ title: 'Could not dismiss the change', description: biancaConfigError(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
function unitActions(row: OrganizationRow): DropdownMenuItem[] {
  return [
    ...(manage.value ? [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openUnit(row) }] : []),
    { label: 'View history', icon: 'i-lucide-history', onSelect: () => historyDialog.open({ unit: row }) },
    ...(manage.value ? [{ label: 'Record change', icon: 'i-lucide-git-compare-arrows', onSelect: () => recordChange(row) }] : []),
  ]
}
function detectedActions(row: OrganizationDetected): DropdownMenuItem[] {
  return [
    { label: 'Confirm…', icon: 'i-lucide-check', onSelect: () => recordChange(undefined, row) },
    { label: 'Dismiss', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => dismiss(row) },
  ]
}

const tabs = computed(() => [
  { label: 'Structure', value: 'structure', icon: 'i-lucide-network', slot: 'structure' as const },
  { label: 'Change history', value: 'history', icon: 'i-lucide-history', slot: 'history' as const },
  { label: 'Detected changes', value: 'detected', icon: 'i-lucide-scan-search', slot: 'detected' as const, badge: pending.value.length || undefined },
])
function pageTo(next: number) {
  return { query: { ...route.query, page: next > 1 ? next : undefined } }
}
/** Detected changes > Evidence: what the HR import saw, in a sentence. */
function evidence(row: OrganizationDetected) {
  const from = row.previous[row.level]
  const to = row.current[row.level]
  const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`
  if (row.kind === 'new') return `${people(row.people_total)} in ${to}, a unit that is not in the structure yet.`
  if (row.kind === 'closed') return `None of the ${people(row.people_total)} of ${from} are in it any more.`
  const moved = row.people_moved === row.people_total
    ? `All ${people(row.people_total)} of ${from}`
    : `${row.people_moved} of the ${people(row.people_total)} of ${from}`
  if (row.kind === 'rename') return `${moved} are now in ${to}.`
  // A move changes the parent; the name may stay.
  const index = organizationLevels.findIndex((item) => item.value === row.level)
  const parent = organizationLevels[index - 1]
  const under = parent ? `under ${row.current[parent.value]}` : ''
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) return `${moved} are now ${under}.`
  return `${moved} are now in ${to} ${under}.`.replace(' .', '.')
}
function levelName(value: UnitLevel) {
  return organizationLevels.find((item) => item.value === value)?.label
}
</script>

<template>
  <AppPage
    title="Organization structure"
    icon="i-lucide-network"
    description="The HR hierarchy and the BIA's own units, every change to them, and the changes an HR import found."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Organization structure' }]"
  >
    <template #actions>
      <UButton
        v-if="manage"
        color="neutral"
        variant="outline"
        icon="i-lucide-git-compare-arrows"
        label="Record change"
        :disabled="!data || !!error"
        @click="recordChange()"
      />
      <UButton
        v-if="manage"
        icon="i-lucide-plus"
        :label="'New ' + levelLabel.toLowerCase()"
        :disabled="!data || !!error"
        @click="openUnit()"
      />
    </template>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <ListFilterBar
        :filtered="filtered"
        :bordered="false"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="tab === 'history' ? 'Unit or reference' : tab === 'detected' ? 'Unit or HR file' : 'Unit, code, user or description'"
            aria-label="Search"
            class="w-full"
          />
        </template>
        <USelectMenu
          v-model="directorate"
          value-key="value"
          :items="directorateItems"
          class="w-56"
          aria-label="Directorate"
        />
        <template v-if="tab === 'structure'">
          <USelectMenu
            v-model="subDirectorate"
            value-key="value"
            :items="subDirectorateItems"
            class="w-56"
            aria-label="Sub directorate"
          />
          <USelectMenu
            v-model="source"
            value-key="value"
            :items="sourceItems"
            :search-input="false"
            class="w-36"
            aria-label="Source"
          />
          <USelectMenu
            v-model="status"
            value-key="value"
            :items="statusItems"
            :search-input="false"
            class="w-40"
            aria-label="Status"
          />
          <USelectMenu
            v-model="owner"
            value-key="value"
            :items="ownerItems"
            :search-input="false"
            class="w-52"
            aria-label="Assigned user"
          />
        </template>
        <template v-else-if="tab === 'history'">
          <USelectMenu
            v-model="changeLevel"
            value-key="value"
            :items="changeLevelItems"
            :search-input="false"
            class="w-44"
            aria-label="Changed level"
          />
          <USelectMenu
            v-model="kind"
            value-key="value"
            :items="kindItems"
            :search-input="false"
            class="w-36"
            aria-label="Type"
          />
          <USelectMenu
            v-model="changeSource"
            value-key="value"
            :items="changeSourceItems"
            :search-input="false"
            class="w-52"
            aria-label="Source"
          />
          <DatePicker
            v-model="fromDate"
            class="w-40"
            placeholder="From"
            aria-label="Effective from"
          />
          <DatePicker
            v-model="toDate"
            class="w-40"
            placeholder="To"
            aria-label="Effective to"
          />
        </template>
        <template v-else-if="tab === 'detected'">
          <USelectMenu
            v-model="changeLevel"
            value-key="value"
            :items="changeLevelItems"
            :search-input="false"
            class="w-44"
            aria-label="Changed level"
          />
        </template>
      </ListFilterBar>
    </UCard>

    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
    >
      <template #structure>
        <div class="mt-4 space-y-4">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              v-for="card in cards"
              :key="card.key"
              :to="cardLink(card.to)"
              :label="card.label"
              :value="card.value"
              :hint="card.hint"
              :icon="card.icon"
              :tone="card.tone"
              :active="card.on"
            />
          </div>
          <SkeletonTable
            v-if="showSkeleton"
            :columns="structureColumns.length"
            label="Loading organization units"
          />
          <UAlert
            v-else-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Could not load the organization structure"
            :description="adminErrorText(error)"
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
          <UCard
            v-else
            :ui="{ body: 'p-0 sm:p-0' }"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
              <p class="text-sm text-muted">
                {{ countLine }}
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <USelect
                  v-if="view === 'table'"
                  v-model="level"
                  :items="[...organizationLevels]"
                  class="w-44"
                  aria-label="Level"
                />
                <UFieldGroup>
                  <UButton
                    color="neutral"
                    :variant="view === 'tree' ? 'subtle' : 'outline'"
                    icon="i-lucide-list-tree"
                    label="Tree"
                    :aria-pressed="view === 'tree'"
                    @click="view = 'tree'"
                  />
                  <UButton
                    color="neutral"
                    :variant="view === 'table' ? 'subtle' : 'outline'"
                    icon="i-lucide-table"
                    label="Table"
                    :aria-pressed="view === 'table'"
                    @click="view = 'table'"
                  />
                </UFieldGroup>
                <UButton
                  :to="`${organizationEndpoint}/export.xlsx`"
                  external
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-file-spreadsheet"
                  label="Export to Excel"
                />
              </div>
            </div>
            <UTable
              v-model:expanded="expanded"
              :data="pageRows"
              :columns="structureColumns"
              :get-sub-rows="(row: TreeRow) => row.children"
              :get-row-id="(row: TreeRow) => `${row.directorate}\u0000${row.sub_directorate}\u0000${row.org_group}`"
              :loading="loadStatus === 'pending'"
              :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #unit-cell="{ row }">
                <div
                  class="flex items-start gap-1"
                  :style="{ paddingInlineStart: `${row.depth * 1.5}rem` }"
                >
                  <UButton
                    v-if="row.getCanExpand()"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    class="-ms-1.5"
                    :icon="row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    :aria-label="`${row.getIsExpanded() ? 'Collapse' : 'Expand'} ${row.original[row.original.level]}`"
                    :aria-expanded="row.getIsExpanded()"
                    @click="row.toggleExpanded()"
                  />
                  <span
                    v-else-if="view === 'tree'"
                    class="inline-block w-5"
                  />
                  <div>
                    <component
                      :is="manage ? 'button' : 'span'"
                      class="block text-start font-medium text-highlighted"
                      :class="manage ? 'hover:text-primary hover:underline' : ''"
                      @click="openUnit(row.original)"
                    >
                      {{ row.original[row.original.level] }}
                    </component>
                    <p class="text-xs text-muted">
                      <span v-if="view === 'tree'">{{ organizationLevels.find((item) => item.value === row.original.level)?.label }}</span>
                      <span v-if="view === 'tree' && row.original.code"> · </span>
                      <span
                        v-if="row.original.code"
                        class="font-mono"
                      >{{ row.original.code }}</span>
                    </p>
                  </div>
                </div>
              </template>
              <template #employees-cell="{ row }">
                {{ row.original.employees ?? 0 }}
              </template>
              <template #owner-cell="{ row }">
                <template v-if="row.original.owner">
                  <p>{{ row.original.owner.name }}</p>
                  <p class="text-xs text-muted">
                    {{ row.original.owner.email }}
                  </p>
                </template>
                <span
                  v-else-if="row.original.available"
                  class="inline-flex items-center gap-1 text-warning"
                >
                  <UIcon
                    name="i-lucide-triangle-alert"
                    class="size-4"
                  />
                  Not assigned
                </span>
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </template>
              <template #description-cell="{ row }">
                <p class="max-w-64 whitespace-normal wrap-break-word">
                  {{ row.original.description || '—' }}
                </p>
              </template>
              <template #source-cell="{ row }">
                <UBadge
                  variant="subtle"
                  color="neutral"
                  size="sm"
                  :label="row.original.source.toUpperCase()"
                />
              </template>
              <template #status-cell="{ row }">
                <UBadge
                  v-if="row.original.waiting_hr"
                  variant="subtle"
                  color="info"
                  size="sm"
                  icon="i-lucide-clock"
                  label="Waiting for HR"
                />
                <UTooltip
                  v-else-if="row.original.left_hr"
                  text="HR's people left this unit. Confirm or record the change that moved them to carry its details along."
                >
                  <UBadge
                    variant="subtle"
                    color="warning"
                    size="sm"
                    icon="i-lucide-user-round-minus"
                    label="No longer in HR"
                  />
                </UTooltip>
                <UBadge
                  v-else
                  variant="subtle"
                  size="sm"
                  :color="row.original.available ? 'success' : 'neutral'"
                  :label="row.original.available ? 'Active' : 'Inactive'"
                  :icon="row.original.available ? 'i-lucide-circle-check' : 'i-lucide-circle-minus'"
                />
              </template>
              <template #actions-cell="{ row }">
                <UDropdownMenu
                  :items="unitActions(row.original)"
                  :content="{ align: 'end' }"
                >
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    trailing-icon="i-lucide-chevron-down"
                    label="Act"
                    :aria-label="`Act on ${row.original[row.original.level]}`"
                  />
                </UDropdownMenu>
              </template>
              <template #empty>
                <p class="py-6 text-center text-sm text-muted">
                  {{ filtered ? 'No units match these filters.' : 'No units yet.' }}
                </p>
              </template>
            </UTable>
            <TablePagination
              v-model:per-page="perPage"
              :page="page"
              page-sizes
              :total="structureRows.length"
              :to="pageTo"
              :label="view === 'tree' ? 'Directorates' : 'Organization units'"
            />
          </UCard>
        </div>
      </template>

      <template #history>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
            <p class="text-sm text-muted">
              {{ history.data.value?.total ?? 0 }} change{{ history.data.value?.total === 1 ? '' : 's' }}, latest effective date first.
            </p>
            <UButton
              :to="historyExport"
              external
              download
              color="neutral"
              variant="outline"
              icon="i-lucide-file-spreadsheet"
              label="Export to Excel"
            />
          </div>
          <UTable
            :data="history.data.value?.items ?? []"
            :columns="historyColumns"
            :loading="history.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #effective_date-cell="{ row }">
              {{ formatDate(row.original.effective_date) }}
            </template>
            <template #kind-cell="{ row }">
              <StatusBadge
                :scale="organizationChangeKinds"
                :value="row.original.kind"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ levelName(row.original.level) }}
              </p>
            </template>
            <template
              v-for="column in organizationPathColumns"
              :key="column.id"
              #[`${column.id}-cell`]="{ row }"
            >
              <OrganizationPathCell
                :change="row.original"
                :field="column.field"
                :side="column.side"
              />
            </template>
            <template #reference-cell="{ row }">
              <p>{{ row.original.reference || '—' }}</p>
              <p
                v-if="row.original.note"
                class="max-w-64 whitespace-normal text-xs text-muted"
              >
                {{ row.original.note }}
              </p>
            </template>
            <template #source-cell="{ row }">
              {{ organizationChangeSources[row.original.source] }}
            </template>
            <template #recorded_by-cell="{ row }">
              <p>{{ row.original.recorded_by?.name || '—' }}</p>
              <p class="text-xs text-muted">
                {{ formatDateTime(row.original.recorded_at) }}
              </p>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                {{ filtered ? 'No changes match these filters.' : 'No change is recorded yet. Record one, or confirm a change an HR import found.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            :page="historyQuery.page"
            page-sizes
            :total="history.data.value?.total ?? 0"
            :to="pageTo"
            label="Change history"
          />
        </UCard>
      </template>

      <template #detected>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="border-b border-default p-4">
            <p class="text-sm text-muted">
              {{ pending.length ? `${pending.length} change${pending.length === 1 ? '' : 's'} found by HR imports, waiting for you to confirm or dismiss${pendingShown.length < pending.length ? ` (${pendingShown.length} shown with these filters)` : ''}. HR data can be late or wrong, so nothing is history until confirmed.` : 'Nothing is waiting. Changes an HR import finds show here.' }}
            </p>
          </div>
          <UTable
            :data="pendingShown"
            :columns="detectedColumns"
            :loading="detected.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #detected_at-cell="{ row }">
              {{ formatDate(row.original.detected_at) }}
            </template>
            <template #kind-cell="{ row }">
              <StatusBadge
                :scale="organizationChangeKinds"
                :value="row.original.kind"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ levelName(row.original.level) }}
              </p>
            </template>
            <template
              v-for="column in organizationPathColumns"
              :key="column.id"
              #[`${column.id}-cell`]="{ row }"
            >
              <OrganizationPathCell
                :change="row.original"
                :field="column.field"
                :side="column.side"
              />
            </template>
            <template #evidence-cell="{ row }">
              <p class="max-w-72 whitespace-normal text-sm">
                {{ evidence(row.original) }}
              </p>
            </template>
            <template #bia_impact-cell="{ row }">
              <span
                v-if="row.original.bia_impact === null"
                class="text-dimmed"
              >—</span>
              <span
                v-else-if="row.original.bia_impact"
                class="inline-flex items-center gap-1 text-warning"
              >
                <UIcon
                  name="i-lucide-triangle-alert"
                  class="size-4"
                />
                {{ row.original.bia_impact }} running BIA{{ row.original.bia_impact === 1 ? '' : 's' }}
              </span>
              <span
                v-else
                class="text-muted"
              >None</span>
            </template>
            <template #import_file-cell="{ row }">
              <span class="text-xs">{{ row.original.import_file || '—' }}</span>
            </template>
            <template #actions-cell="{ row }">
              <UDropdownMenu
                v-if="manage"
                :items="detectedActions(row.original)"
                :content="{ align: 'end' }"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  trailing-icon="i-lucide-chevron-down"
                  label="Act"
                  :aria-label="`Act on the change of ${organizationPathLabel(row.original.previous)}`"
                />
              </UDropdownMenu>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                {{ pending.length ? 'No detected change matches these filters.' : 'No detected change is waiting.' }}
              </p>
            </template>
          </UTable>
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
