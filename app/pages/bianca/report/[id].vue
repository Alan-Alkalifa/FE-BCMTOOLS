<script setup lang="ts">
import type { BiancaDependency, BiancaFunction } from '~/composables/useBianca'

/**
 * The report of a BIA's business functions, read only: each part of the workbook for the picked
 * function (?fn=, 1-based), and its export to Excel. The Appendix opens it.
 */
definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))
const { data, status, error, refresh } = useBiancaAssessment(id)
const { data: lookups } = useBiancaLookups(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const exporter = useBiancaExport()

useHead({ title: computed(() => `Report ${data.value?.ref_no ?? 'BIA'} · BCM Tools`) })

const functions = computed(() => data.value?.functions ?? [])
/** The function shown (1-based, as in the address). */
const number = computed({
  get: () => {
    const value = Number(route.query.fn) || 1
    return Math.min(Math.max(value, 1), Math.max(functions.value.length, 1))
  },
  set: (value: number) => {
    router.replace({ query: { ...route.query, fn: String(value) } })
  },
})
const fn = computed<BiancaFunction | undefined>(() => functions.value[number.value - 1])
const functionItems = computed(() => functions.value.map((item, index) => ({ label: `${index + 1}. ${item.name}`, value: index + 1 })))
const periods = computed(() => lookups.value?.periods ?? [])

const shown = (value: unknown) => (value == null || value === '' ? '—' : String(value))
const sideOf = (row: BiancaDependency, side: 'up' | 'down') => ({
  name: row[`${side}_name`],
  capacity: row[`${side}_capacity`],
  mtd: row[`${side}_mtd`],
  sla: row[`${side}_sla`],
  outsourced: row[`${side}_outsourced`],
  material: row[`${side}_material`],
  justification: row[`${side}_justification`],
})
const sides = [
  { key: 'up', title: 'Upstream', text: 'Who triggers the activity' },
  { key: 'down', title: 'Downstream', text: 'Who receives or processes the output / instruction' },
] as const
function entries(side: 'up' | 'down') {
  return (fn.value?.dependencies ?? []).map((row) => sideOf(row, side)).filter((row) => row.name)
}
function systemName(row: { application_name?: string, is_other?: boolean }) {
  return row.is_other ? `${row.application_name} (Others)` : shown(row.application_name)
}

const editable = computed(() => !!data.value?.can_edit)
</script>

<template>
  <AppPage
    :title="data?.ref_no ? `Report · BIA ${data.ref_no}` : 'Report'"
    icon="i-lucide-file-text"
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Manage', to: '/bianca/manage' },
      { label: data?.ref_no ?? 'BIA', to: data ? biancaPath(data.id) : undefined },
      { label: 'Report' },
    ]"
  >
    <SkeletonTable
      v-if="showSkeleton"
      :columns="3"
      label="Loading the report"
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not open this BIA"
      :description="error.statusCode === 404 ? 'It does not exist, or you cannot open it.' : error.message"
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
      v-else-if="data"
      class="space-y-6"
    >
      <!-- The BIA, and what to do with the report -->
      <UCard>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <dl class="grid flex-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt class="text-xs text-muted">
                BIA
              </dt>
              <dd class="font-medium">
                {{ data.ref_no ?? `#${data.id}` }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Directorate
              </dt>
              <dd>{{ shown(data.directorate) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Sub directorate
              </dt>
              <dd>{{ shown(data.sub_directorate) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Group
              </dt>
              <dd>{{ shown(data.org_group) }}</dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              :label="editable ? 'Back to the form' : 'Back to the BIA'"
              :to="`${biancaPath(data.id)}?tab=appendix`"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-file-spreadsheet"
              label="Export all to Excel"
              :loading="exporter.busy.value"
              @click="exporter.run(data.id)"
            />
          </div>
        </div>
      </UCard>

      <UAlert
        v-if="!functions.length"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="This BIA has no business functions yet."
      />

      <template v-else-if="fn">
        <!-- The function shown -->
        <div class="flex flex-wrap items-end justify-between gap-3">
          <UFormField
            label="Business function"
            class="w-full max-w-md"
          >
            <USelect
              v-model="number"
              :items="functionItems"
              class="w-full"
            />
          </UFormField>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="editable"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              label="Edit in the form"
              :to="`${biancaPath(data.id)}?tab=functions`"
            />
            <UButton
              icon="i-lucide-file-spreadsheet"
              label="Export this function to Excel"
              :loading="exporter.busy.value"
              @click="exporter.run(data.id, [number])"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-lg font-semibold">
            {{ number }}. {{ fn.name }}
          </h2>
          <StatusBadge
            v-if="fn.category"
            :scale="BIANCA_CATEGORY"
            :value="fn.category as keyof typeof BIANCA_CATEGORY"
          />
        </div>

        <!-- Part 1 -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <h3 class="text-sm font-semibold">
              Part 1 · Impact assessment
            </h3>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[48rem] text-sm">
              <thead class="bg-elevated/50 text-xs text-muted">
                <tr>
                  <th class="px-4 py-2 text-left font-medium">
                    &nbsp;
                  </th>
                  <th
                    v-for="period in periods"
                    :key="period"
                    class="px-3 py-2 text-right font-medium"
                  >
                    {{ period }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr>
                  <th class="px-4 py-2 text-left font-medium">
                    Cumulative financial loss (IDR)
                  </th>
                  <td
                    v-for="(_, i) in periods"
                    :key="i"
                    class="px-3 py-2 text-right tabular-nums"
                  >
                    {{ fn.loss?.[i] == null ? '—' : formatIdr(fn.loss[i]!) }}
                  </td>
                </tr>
                <tr>
                  <th class="px-4 py-2 text-left font-medium">
                    Regulatory impact (A) score (1–3)
                  </th>
                  <td
                    v-for="(_, i) in periods"
                    :key="i"
                    class="px-3 py-2 text-right tabular-nums"
                  >
                    {{ shown(fn.regulatory_scores?.[i]) }}
                  </td>
                </tr>
                <tr>
                  <th class="px-4 py-2 text-left font-medium">
                    Customer service impact (B) score (1–3)
                  </th>
                  <td
                    v-for="(_, i) in periods"
                    :key="i"
                    class="px-3 py-2 text-right tabular-nums"
                  >
                    {{ shown(fn.customer_scores?.[i]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <template #footer>
            <p class="text-sm">
              <span class="text-muted">Suggested MTD (hours / days):</span> <span class="font-medium">{{ shown(fn.suggested_mtd) }}</span>
            </p>
          </template>
        </UCard>

        <!-- Part 2a -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <h3 class="text-sm font-semibold">
              Part 2a · IT dependency
            </h3>
            <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span class="text-muted">Suggested MTD:</span> {{ shown(fn.suggested_mtd) }}</span>
              <span><span class="text-muted">Expected MTD:</span> <span class="font-medium">{{ shown(fn.expected_mtd) }}</span></span>
              <span><span class="text-muted">Category:</span> {{ shown(fn.category) }}</span>
            </div>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[64rem] text-sm">
              <thead class="bg-elevated/50 text-left text-xs text-muted">
                <tr>
                  <th class="px-4 py-2 font-medium">
                    IT application system
                  </th>
                  <th class="px-3 py-2 font-medium">
                    RTO (hours / days)
                  </th>
                  <th class="px-3 py-2 font-medium">
                    RPO
                  </th>
                  <th class="px-3 py-2 font-medium">
                    Workaround
                  </th>
                  <th class="px-3 py-2 font-medium">
                    Backlog (hours)
                  </th>
                  <th class="px-3 py-2 font-medium">
                    DAAT (hours)
                  </th>
                  <th class="px-3 py-2 font-medium">
                    System usage
                  </th>
                  <th class="px-3 py-2 font-medium">
                    Workaround critical gaps
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="(row, i) in fn.it_dependencies"
                  :key="i"
                  class="align-top"
                >
                  <td class="px-4 py-2 font-medium">
                    {{ systemName(row) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ shown(row.rto) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ shown(row.rpo) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ shown(row.workaround) }}
                  </td>
                  <td class="px-3 py-2 tabular-nums">
                    {{ shown(row.backlog_hours) }}
                  </td>
                  <td
                    class="px-3 py-2 tabular-nums"
                    :class="(row.daat_hours ?? 0) < 0 ? 'font-semibold text-error' : ''"
                  >
                    {{ shown(row.daat_hours) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ shown(row.system_usage) }}
                  </td>
                  <td class="px-3 py-2 whitespace-pre-line">
                    {{ shown(row.gaps) }}
                  </td>
                </tr>
                <tr v-if="!fn.it_dependencies.length">
                  <td
                    colspan="8"
                    class="px-4 py-3 text-muted"
                  >
                    No IT system.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- Part 2b -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <h3 class="text-sm font-semibold">
              Part 2b · Non-IT dependency
            </h3>
            <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span class="text-muted">Planned capacity (%) of the function:</span> <span class="font-medium">{{ shown(fn.planned_capacity) }}</span></span>
              <span><span class="text-muted">Expected MTD:</span> {{ shown(fn.expected_mtd) }}</span>
            </div>
          </template>
          <div
            v-for="side in sides"
            :key="side.key"
            class="border-t border-default first:border-t-0"
          >
            <p class="px-4 pt-3 text-sm font-medium">
              {{ side.title }} <span class="font-normal text-muted">· {{ side.text }}</span>
            </p>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[64rem] text-sm">
                <thead class="text-left text-xs text-muted">
                  <tr>
                    <th class="px-4 py-2 font-medium">
                      Name
                    </th>
                    <th class="px-3 py-2 font-medium">
                      Planned capacity (%)
                    </th>
                    <th class="px-3 py-2 font-medium">
                      Expected MTD
                    </th>
                    <th class="px-3 py-2 font-medium">
                      SLA
                    </th>
                    <th class="px-3 py-2 font-medium">
                      Outsourcing provider
                    </th>
                    <th class="px-3 py-2 font-medium">
                      Material services
                    </th>
                    <th class="px-3 py-2 font-medium">
                      Justification
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="(row, i) in entries(side.key)"
                    :key="i"
                    class="align-top"
                  >
                    <td class="px-4 py-2 font-medium">
                      {{ row.name }}
                    </td>
                    <td class="px-3 py-2">
                      {{ shown(row.capacity) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ shown(row.mtd) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ shown(row.sla) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ shown(row.outsourced) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ shown(row.material) }}
                    </td>
                    <td class="px-3 py-2 whitespace-pre-line">
                      {{ shown(row.justification) }}
                    </td>
                  </tr>
                  <tr v-if="!entries(side.key).length">
                    <td
                      colspan="7"
                      class="px-4 py-3 text-muted"
                    >
                      None.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </UCard>

        <!-- Part 3 -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold">
              Part 3 · Recovery strategies
            </h3>
          </template>
          <dl class="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="item in [
                ['Planned capacity (%) of the function', fn.planned_capacity],
                ['Business function category', fn.category],
                ['Expected MTD', fn.expected_mtd],
                ['Total staff strength (no. of staff)', fn.total_staff],
                ['Staff required for the planned capacity (no. of staff)', fn.staff_required],
                ['Expected recovery level (%)', fn.recovery_level],
                ['Recommended alternate site strategy', fn.alt_site_strategy],
                ['Current BCP seats in place (seats)', fn.seats_current],
                ['BCP seats required after the BIA (seats)', fn.seats_required],
                ['PC (units)', fn.res_pc],
                ['Phone, fixed line (units)', fn.res_phone],
                ['Fax (units)', fn.res_fax],
                ['Copier (units)', fn.res_copier],
              ]"
              :key="String(item[0])"
            >
              <dt class="text-xs text-muted">
                {{ item[0] }}
              </dt>
              <dd>{{ shown(item[1]) }}</dd>
            </div>
          </dl>
          <dl class="mt-4 grid gap-4 border-t border-default pt-4 text-sm sm:grid-cols-2">
            <div
              v-for="item in [
                ['Prioritization recovery strategy', fn.prioritization_strategy],
                ['Outstanding recovery strategy', fn.outstanding_strategy],
                ['Other resources', fn.res_others],
                ['Vital records', fn.vital_record],
                ['Vital records location', fn.vital_record_location],
              ]"
              :key="String(item[0])"
            >
              <dt class="text-xs text-muted">
                {{ item[0] }}
              </dt>
              <dd class="whitespace-pre-line">
                {{ shown(item[1]) }}
              </dd>
            </div>
          </dl>
        </UCard>

        <!-- Part 4 -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold">
              Part 4 · Critical timings
            </h3>
          </template>
          <dl class="grid gap-4 text-sm sm:grid-cols-2">
            <div
              v-for="item in [
                ['Business function category', fn.category],
                ['Frequency', fn.frequency],
                ['Brief description of the critical business function', fn.description],
                ['Critical timings', fn.critical_timings],
                ['Activity performed at the critical timings', fn.critical_activity],
              ]"
              :key="String(item[0])"
            >
              <dt class="text-xs text-muted">
                {{ item[0] }}
              </dt>
              <dd class="whitespace-pre-line">
                {{ shown(item[1]) }}
              </dd>
            </div>
          </dl>
        </UCard>
      </template>
    </div>
  </AppPage>
</template>
