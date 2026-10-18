<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SccaAssessmentSummary, SccaListQuery } from '~/composables/useScca'

useHead({ title: 'SCCA · BCM Tools' })

const route = useRoute()
const router = useRouter()

const PER_PAGE = 25

function asCategory(value: unknown): SccaCategory | undefined {
  return typeof value === 'string' && SCCA_CATEGORIES.includes(value as SccaCategory)
    ? value as SccaCategory
    : undefined
}

const query = computed<SccaListQuery>(() => ({
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  category: asCategory(route.query.category),
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: PER_PAGE,
}))

const search = ref(query.value.q ?? '')
const categoryFilter = ref<SccaCategory | 'all'>(query.value.category ?? 'all')

watch(
  () => [route.query.q, route.query.category],
  () => {
    search.value = query.value.q ?? ''
    categoryFilter.value = query.value.category ?? 'all'
  },
)

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

watch(categoryFilter, (value) => {
  const next = value === 'all' ? undefined : value
  if (next === query.value.category) return
  router.replace({ query: { ...route.query, category: next, page: undefined } })
})

const { data, status, error, refresh } = useSccaAssessments(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const range = computed(() => {
  const total = data.value?.total ?? 0
  if (!total) return { from: 0, to: 0 }
  const from = ((data.value?.page ?? 1) - 1) * PER_PAGE + 1
  return { from, to: Math.min(from + PER_PAGE - 1, total) }
})

const columns: TableColumn<SccaAssessmentSummary>[] = [
  { accessorKey: 'ref_no', header: 'Ref. no.' },
  { accessorKey: 'application_code', header: 'Code' },
  { accessorKey: 'application_name', header: 'Application' },
  { accessorKey: 'assessment_reason', header: 'Reason' },
  { accessorKey: 'due_date', header: 'Renewal due' },
  { accessorKey: 'final_category', header: 'Category' },
  { accessorKey: 'is_complete', header: 'Status' },
]

const categoryItems = [
  { label: 'All categories', value: 'all' as const },
  ...SCCA_CATEGORIES.map((category) => ({ label: sccaCategory[category].label, value: category })),
]

function openRow(_event: Event, row: { original: SccaAssessmentSummary }) {
  navigateTo(`/scca/${row.original.id}`)
}
</script>

<template>
  <AppPage
    title="SCCA"
    :crumbs="[{ label: 'SCCA' }]"
  >
    <template #actions>
      <UButton
        to="/scca/new"
        icon="i-lucide-plus"
        label="New assessment"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="7"
      label="Loading assessments"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load assessments"
      :description="error.message"
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

    <UCard v-else>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by name, code, or ref. no."
          class="w-full sm:w-72"
          aria-label="Search by name, code, or ref. no."
        />
        <USelectMenu
          v-model="categoryFilter"
          value-key="value"
          :items="categoryItems"
          class="w-48"
          aria-label="Filter by category"
        />
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
      >
        <template #ref_no-cell="{ row }">
          {{ row.original.ref_no || '—' }}
        </template>
        <template #application_code-cell="{ row }">
          {{ row.original.application_code || '—' }}
        </template>
        <template #application_name-cell="{ row }">
          <NuxtLink
            :to="`/scca/${row.original.id}`"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.application_name }}
          </NuxtLink>
        </template>
        <template #assessment_reason-cell="{ row }">
          {{ reasonLabel(row.original.assessment_reason) || '—' }}
        </template>
        <template #due_date-cell="{ row }">
          {{ formatDate(row.original.due_date) || '—' }}
        </template>
        <template #final_category-cell="{ row }">
          <StatusBadge
            v-if="row.original.final_category"
            :scale="sccaCategory"
            :value="row.original.final_category"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #is_complete-cell="{ row }">
          <StatusBadge
            :scale="{
              complete: { label: 'Complete', color: 'success', icon: 'i-lucide-circle-check' },
              draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
            }"
            :value="row.original.is_complete ? 'complete' : 'draft'"
            size="sm"
          />
        </template>
        <template #updated_at-cell="{ row }">
          {{ formatDateTime(row.original.updated_at) || '—' }}
        </template>
      </UTable>

      <div
        v-if="data && !data.items.length"
        class="py-10 text-center"
      >
        <p class="text-sm text-muted">
          {{ query.q || query.category ? 'No assessments match these filters.' : 'No assessments yet. Create the first assessment.' }}
        </p>
        <UButton
          v-if="!query.q && !query.category"
          class="mt-3"
          to="/scca/new"
          icon="i-lucide-plus"
          label="New assessment"
        />
      </div>

      <div
        v-if="data && data.total > 0"
        class="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm text-muted">
          Showing {{ formatNumber(range.from, 0) }}–{{ formatNumber(range.to, 0) }} of {{ formatNumber(data.total, 0) }}
        </p>
        <UPagination
          :page="data.page"
          :items-per-page="PER_PAGE"
          :total="data.total"
          :to="(page) => ({ query: { ...route.query, page } })"
        />
      </div>
    </UCard>
  </AppPage>
</template>
