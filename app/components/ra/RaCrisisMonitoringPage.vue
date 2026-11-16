<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaCrisisSummary, RaCrisisType } from '~/composables/useRa'
import RaCrisisModal from '~/components/ra/RaCrisisModal.vue'

/**
 * Disaster (or Incident) › Monitoring: what is open and waiting now, the places it affects, and
 * for one year (`?year=`) how many were declared per month and per hazard. Which hazards are a
 * disaster or an incident is set in Administration › RA configuration › Disaster or incident.
 */
const props = defineProps<{ type: RaCrisisType }>()
const t = computed(() => RA_CRISIS_TYPES[props.type])

const route = useRoute()
const router = useRouter()
const year = computed(() => Number(route.query.year) || undefined)
const { data, status, error, refresh } = useRaCrisisMonitoring(() => props.type, year)
const loading = computed(() => status.value === 'pending' && !data.value)
const showSkeleton = useDelayedLoading(() => loading.value)
const { data: map } = useRaMap()
const crisisModal = useOverlay().create(RaCrisisModal)

const yearModel = computed({
  get: () => data.value?.year,
  set: (value?: number) => router.replace({ query: { ...route.query, year: value === new Date().getFullYear() ? undefined : value } }),
})
const yearItems = computed(() => (data.value?.years ?? []).map((value) => ({ label: String(value), value })))

const plural = computed(() => t.value.plural.toLowerCase())
const manage = computed(() => t.value.path)

const monthPoints = computed(() => (data.value?.by_month ?? []).map((value, index) => ({
  month: `${data.value!.year}-${String(index + 1).padStart(2, '0')}`,
  value,
})))
const monthSummary = computed(() => {
  const total = data.value?.counts.total ?? 0
  return total ? `${total} ${total === 1 ? t.value.lower : plural.value} declared in ${data.value!.year}.` : ''
})
const hazardBars = computed(() => (data.value?.by_hazard ?? [])
  .filter((row) => row.total)
  .map((row) => ({ label: row.hazard.short_name, value: row.total })))
const hazardSummary = computed(() => {
  const top = [...hazardBars.value].sort((a, b) => b.value - a.value)[0]
  return top ? `${top.label} the most: ${top.value}.` : ''
})

const columns: TableColumn<RaCrisisSummary>[] = [
  { accessorKey: 'ref_no', header: 'Reference' },
  { id: 'hazard', header: 'Hazard' },
  { id: 'place', header: 'Place' },
  { accessorKey: 'started_at', header: 'Started' },
  { accessorKey: 'affected_count', header: 'Affected', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'status', header: 'Status' },
]

function openRow(_event: Event, row: { original: RaCrisisSummary }) {
  navigateTo(crisisPath(row.original.id, row.original.type))
}

async function declare() {
  const crisis = await crisisModal.open({ places: map.value?.places ?? [], type: props.type }).result
  if (crisis) await navigateTo(crisisPath(crisis.id, crisis.type))
}
</script>

<template>
  <AppPage
    :title="`${t.label} monitoring`"
    icon="i-lucide-chart-column"
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: t.label }, { label: 'Monitoring' }]"
  >
    <template #actions>
      <USelect
        v-if="yearItems.length"
        v-model="yearModel"
        :items="yearItems"
        class="w-28"
        aria-label="Year"
      />
      <UButton
        v-if="data?.can_declare"
        :icon="t.icon"
        :label="`Declare ${t.label}`"
        @click="declare"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`Could not load ${t.label} monitoring`"
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

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Open now"
          :value="data?.counts.open_now ?? null"
          tone="error"
          :icon="t.icon"
          :to="{ path: manage, query: { status: 'open' } }"
        />
        <KpiCard
          label="Waiting for approval"
          :value="data?.counts.pending_now ?? null"
          tone="warning"
          icon="i-lucide-hourglass"
          :to="`${manage}/approval`"
        />
        <KpiCard
          label="Places affected now"
          :value="data?.affected_now ?? null"
          tone="info"
          icon="i-lucide-building-2"
          :to="LOCATION_MAP_PATH"
        />
        <KpiCard
          :label="`Declared in ${data?.year ?? ''}`"
          :value="data?.counts.total ?? null"
          icon="i-lucide-calendar"
          :to="manage"
          :hint="data ? `${data.counts.closed} closed, ${data.counts.rejected} rejected.` : undefined"
        />
      </div>

      <div class="grid gap-6 xl:grid-cols-2">
        <SccaLineChart
          :title="`${t.plural} declared per month`"
          :measure="`${t.plural} declared`"
          :points="monthPoints"
          :summary="monthSummary"
          :loading="loading"
          :empty="monthSummary ? null : `No ${t.lower} was declared in ${data?.year ?? 'this year'}.`"
        />
        <SccaBarChart
          :title="`${t.plural} by hazard`"
          :measure="t.plural"
          :items="hazardBars"
          :summary="hazardSummary"
          :loading="loading"
          :empty="hazardSummary ? null : `No ${t.lower} was declared in ${data?.year ?? 'this year'}.`"
        />
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold text-highlighted">
              Open and waiting for approval
            </h2>
            <UButton
              :to="manage"
              variant="link"
              trailing-icon="i-lucide-arrow-right"
              :label="`All ${plural}`"
              class="px-0"
            />
          </div>
        </template>
        <SkeletonTable
          v-if="showSkeleton"
          :columns="6"
          :rows="3"
          :label="`Loading the open ${plural}`"
        />
        <UTable
          v-else
          :data="data?.active ?? []"
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
          <template #affected_count-cell="{ row }">
            <span class="tabular-nums">{{ formatNumber(row.original.affected_count, 0) }}</span>
          </template>
          <template #status-cell="{ row }">
            <StatusBadge
              :scale="raCrisisStatus"
              :value="row.original.status"
              size="sm"
            />
          </template>
          <template #empty>
            <p class="py-10 text-center text-sm text-muted">
              No {{ t.lower }} is open or waiting for approval.
            </p>
          </template>
        </UTable>
      </UCard>
    </template>
  </AppPage>
</template>
