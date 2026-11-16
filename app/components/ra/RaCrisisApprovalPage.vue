<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaCrisisSummary, RaCrisisType } from '~/composables/useRa'

/**
 * Disaster (or Incident) › Approval: the declared ones waiting for someone else's approval
 * (four-eyes), longest waiting first, and the ones already decided. A row opens its page, where
 * it is approved or rejected.
 */
const props = defineProps<{ type: RaCrisisType }>()
const t = computed(() => RA_CRISIS_TYPES[props.type])
const plural = computed(() => t.value.plural.toLowerCase())

const route = useRoute()
const router = useRouter()
const perPage = useRowsPerPage()

type Tab = 'waiting' | 'decided'
const tab = computed<Tab>({
  get: () => (route.query.tab === 'decided' ? 'decided' : 'waiting'),
  set: (value) => router.replace({ query: { tab: value === 'waiting' ? undefined : value } }),
})
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

const waiting = useRaCrises(() => ({ type: props.type, status: 'pending', page: tab.value === 'waiting' ? page.value : 1, per_page: perPage.value }))
const decided = useRaCrises(() => ({ type: props.type, decided: 1, page: tab.value === 'decided' ? page.value : 1, per_page: perPage.value }))
const current = computed(() => (tab.value === 'waiting' ? waiting : decided))
const showSkeleton = useDelayedLoading(() => current.value.status.value === 'pending' && !current.value.data.value)

const tabs = computed(() => [
  { label: 'Waiting for approval', value: 'waiting', icon: 'i-lucide-hourglass', badge: waiting.data.value?.total || undefined },
  { label: 'Decided', value: 'decided', icon: 'i-lucide-history' },
])

const columns = computed<TableColumn<RaCrisisSummary>[]>(() => [
  { accessorKey: 'ref_no', header: 'Reference' },
  { id: 'hazard', header: 'Hazard' },
  { id: 'place', header: 'Place' },
  { accessorKey: 'declared_by', header: 'Declared by' },
  { accessorKey: 'started_at', header: 'Started' },
  ...(tab.value === 'waiting'
    ? []
    : [
        { accessorKey: 'status', header: 'Status' },
        { accessorKey: 'decided_by', header: 'Decided by' },
      ]),
])

function openRow(_event: Event, row: { original: RaCrisisSummary }) {
  navigateTo(crisisPath(row.original.id, row.original.type))
}
</script>

<template>
  <AppPage
    :title="`${t.label} approval`"
    icon="i-lucide-badge-check"
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: t.label, to: `${t.path}/monitoring` }, { label: 'Approval' }]"
  >
    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :content="false"
    />

    <SkeletonTable
      v-if="showSkeleton"
      :columns="6"
      :rows="4"
      :label="`Loading ${plural}`"
    />

    <UAlert
      v-else-if="current.error.value"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`Could not load the ${plural}`"
      :description="apiErrorMessage(current.error.value)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="current.refresh()"
        />
      </template>
    </UAlert>

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <UTable
        :data="current.data.value?.items ?? []"
        :columns="columns"
        class="cursor-pointer"
        :on-select="openRow"
      >
        <template #ref_no-cell="{ row }">
          <NuxtLink
            :to="crisisPath(row.original.id, row.original.type)"
            class="font-medium whitespace-nowrap text-primary hover:underline"
          >
            {{ row.original.ref_no }}
          </NuxtLink>
        </template>
        <template #hazard-cell="{ row }">
          {{ row.original.hazard.short_name }}
        </template>
        <template #place-cell="{ row }">
          {{ row.original.location?.name ?? raFormatCoordinates({ lat: row.original.latitude, lng: row.original.longitude }) }}
        </template>
        <template #started_at-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatDateTime(row.original.started_at) }}</span>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            :scale="raCrisisStatus"
            :value="row.original.status"
            size="sm"
          />
        </template>
        <template #decided_by-cell="{ row }">
          {{ row.original.decided_by ?? '—' }}
          <p
            v-if="row.original.decided_at"
            class="text-xs text-muted"
          >
            {{ formatDateTime(row.original.decided_at) }}
          </p>
        </template>
        <template #empty>
          <p class="py-10 text-center text-sm text-muted">
            {{ tab === 'waiting' ? `No ${t.lower} is waiting for approval.` : `No ${t.lower} has been approved or rejected yet.` }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="current.data.value"
        v-model:per-page="perPage"
        page-sizes
        :total="current.data.value.total"
        :label="t.plural"
        :to="(next) => ({ query: { ...route.query, page: next } })"
        :page="page"
      />
    </UCard>
  </AppPage>
</template>
