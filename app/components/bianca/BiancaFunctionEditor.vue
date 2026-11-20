<script setup lang="ts">
import type { BiancaItDependency, BiancaLookups, BiancaPreview, BiancaFunction } from '~/composables/useBianca'

/**
 * One business function across the workbook's parts: 1 impact, 2a IT dependency, 2b non-IT
 * dependency, 3 recovery strategies, 4 critical timings. What the workbook works out (category,
 * DAAT and its warnings) comes from `preview`, calculated by the API as you type.
 */
const fn = defineModel<BiancaFunction>({ required: true })
const props = defineProps<{
  lookups: BiancaLookups
  preview?: BiancaPreview['functions'][number] | null
  disabled?: boolean
}>()

type Mode = 'master' | 'other' | 'na'

const part = ref('p1')
const parts = [
  { label: 'Part 1 · Impact', value: 'p1' },
  { label: 'Part 2a · IT dependency', value: 'p2a' },
  { label: 'Part 2b · Non-IT dependency', value: 'p2b' },
  { label: 'Part 3 · Recovery', value: 'p3' },
  { label: 'Part 4 · Critical timings', value: 'p4' },
]

const periods = computed(() => props.lookups.periods)
const modes = [
  { label: 'System from the list', value: 'master' },
  { label: 'Others (not in the list)', value: 'other' },
  { label: 'NA (no IT system)', value: 'na' },
]

function modeOf(row: BiancaItDependency): Mode {
  if (row.is_other) return 'other'
  if (!row.application_id && row.application_name === 'NA') return 'na'
  return 'master'
}

function setMode(row: BiancaItDependency, mode: Mode) {
  row.is_other = mode === 'other'
  row.application_id = undefined
  row.application_name = mode === 'na' ? 'NA' : undefined
  row.rto = undefined
  row.rpo = undefined
}

function pickApplication(row: BiancaItDependency, picked: { label: string, rto?: string | null, rpo?: string | null } | null) {
  row.application_name = picked?.label
  row.rto = picked?.rto ?? undefined
  row.rpo = picked?.rpo ?? undefined
}

function addIt() {
  if (fn.value.it_dependencies.length < props.lookups.it_slots) fn.value.it_dependencies.push({})
}
function addDependency() {
  if (fn.value.dependencies.length < props.lookups.dependency_slots) fn.value.dependencies.push({})
}

function daat(index: number) {
  return props.preview?.it_dependencies[index]
}

const losses = computed(() => fn.value.loss ?? [])
const nonNumeric = 'tabular-nums'
const sides = [
  { key: 'up', label: 'Upstream' },
  { key: 'down', label: 'Downstream' },
] as const
const long = TEXT_LIMITS.long

/** Part 1's rule for the Suggested MTD, worked out from the impact typed so far. */
const ruleMtd = computed(() => biancaSuggestedMtd(fn.value, {
  suggested: props.lookups.suggested_mtd,
  lossAlert: props.lookups.loss_alert_idr,
  scoreAlert: props.lookups.score_alert,
}))

const recommendedSites = computed(() => props.lookups.alternate_site_by_category?.[props.preview?.category ?? ''] ?? [])

/** The choices of the BIA configuration, plus the value already chosen when it is no longer offered. */
function withCurrent(items: readonly string[], value: string | null | undefined) {
  return value && !items.includes(value) ? [value, ...items] : [...items]
}

const hasReference = (value: string): value is 'p1' | 'p2a' | 'p3' => ['p1', 'p2a', 'p3'].includes(value)
</script>

<template>
  <div class="space-y-4">
    <UTabs
      v-model="part"
      :items="parts"
      :content="false"
      variant="link"
      size="sm"
      class="overflow-x-auto"
    />
    <div
      v-if="hasReference(part)"
      class="-mt-2 flex justify-end"
    >
      <BiancaReference
        :part="part"
        :lookups="lookups"
      />
    </div>

    <!-- Part 1 -->
    <section
      v-show="part === 'p1'"
      class="space-y-4"
    >
      <p class="text-sm text-muted">
        Enter cumulative financial loss (IDR) and regulatory and customer impact scores for each period of disruption.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[56rem] text-sm">
          <thead>
            <tr class="text-left text-xs text-muted">
              <th class="w-48 py-1 pe-2 font-medium">
                &nbsp;
              </th>
              <th
                v-for="period in periods"
                :key="period"
                class="px-1 py-1 font-medium"
              >
                {{ period }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th class="py-1 pe-2 text-left font-medium">
                <span class="inline-flex items-center gap-1.5">
                  Cumulative financial loss (IDR)
                  <BiancaNote
                    note="loss"
                    label="Cumulative financial loss (IDR)"
                  />
                </span>
              </th>
              <td
                v-for="(_, i) in periods"
                :key="`loss${i}`"
                class="p-1"
              >
                <UInput
                  v-if="fn.loss"
                  v-model.number="fn.loss[i]"
                  type="number"
                  min="0"
                  size="sm"
                  :disabled="disabled"
                  :class="[nonNumeric, lookups.loss_alert_idr < (Number(fn.loss[i]) || 0) ? 'ring-1 ring-error' : '']"
                  :aria-label="`Loss ${periods[i]}`"
                />
              </td>
            </tr>
            <tr>
              <th class="py-1 pe-2 text-left font-medium">
                <span class="inline-flex items-center gap-1.5">
                  Regulatory score
                  <BiancaNote
                    note="regulatory_score"
                    label="Regulatory score"
                  />
                </span>
              </th>
              <td
                v-for="(_, i) in periods"
                :key="`reg${i}`"
                class="p-1"
              >
                <USelect
                  v-if="fn.regulatory_scores"
                  v-model="fn.regulatory_scores[i]"
                  :items="lookups.scores"
                  size="sm"
                  class="w-full"
                  :ui="fn.regulatory_scores[i] === lookups.score_alert ? { base: 'ring-1 ring-warning' } : undefined"
                  :disabled="disabled"
                  :aria-label="`Regulatory score ${periods[i]}`"
                />
              </td>
            </tr>
            <tr>
              <th class="py-1 pe-2 text-left font-medium">
                <span class="inline-flex items-center gap-1.5">
                  Customer service score
                  <BiancaNote
                    note="customer_score"
                    label="Customer service score"
                  />
                </span>
              </th>
              <td
                v-for="(_, i) in periods"
                :key="`cust${i}`"
                class="p-1"
              >
                <USelect
                  v-if="fn.customer_scores"
                  v-model="fn.customer_scores[i]"
                  :items="lookups.scores"
                  size="sm"
                  class="w-full"
                  :ui="fn.customer_scores[i] === lookups.score_alert ? { base: 'ring-1 ring-warning' } : undefined"
                  :disabled="disabled"
                  :aria-label="`Customer score ${periods[i]}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="losses.some(v => (Number(v) || 0) > lookups.loss_alert_idr)"
        class="flex items-center gap-1.5 text-sm text-warning"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="size-4"
        />
        A loss above IDR {{ formatIdr(lookups.loss_alert_idr) }} is highlighted in the workbook.
      </p>
      <BiancaField
        label="Suggested MTD"
        note="suggested_mtd"
        :note-text="lookups.guides?.suggested_mtd || undefined"
        class="max-w-md"
      >
        <USelect
          v-model="fn.suggested_mtd"
          :items="lookups.suggested_mtd"
          class="w-full max-w-xs"
          :disabled="disabled"
        />
        <template #help>
          <span v-if="!ruleMtd">The maximum tolerable downtime suggested by the impact above.</span>
          <span v-else-if="ruleMtd === fn.suggested_mtd">Matches the workbook's rule for the impact above.</span>
          <span
            v-else
            class="inline-flex flex-wrap items-center gap-x-2"
          >
            By the workbook's rule, the impact above suggests <strong class="text-default">{{ ruleMtd }}</strong>.
            <UButton
              v-if="!disabled"
              size="xs"
              variant="link"
              label="Use it"
              class="px-0"
              @click="fn.suggested_mtd = ruleMtd"
            />
          </span>
        </template>
      </BiancaField>
    </section>

    <!-- Part 2a -->
    <section
      v-show="part === 'p2a'"
      class="space-y-4"
    >
      <div class="flex flex-wrap items-end gap-4">
        <BiancaField
          label="Expected MTD"
          note="expected_mtd"
          help="Should be equal to or shorter than the Suggested MTD."
          class="w-56"
        >
          <USelect
            v-model="fn.expected_mtd"
            :items="withCurrent(lookups.expected_mtd.map(item => item.value), fn.expected_mtd)"
            class="w-full"
            :disabled="disabled"
          />
        </BiancaField>
        <div class="pb-2">
          <StatusBadge
            v-if="preview?.category"
            :scale="BIANCA_CATEGORY"
            :value="preview.category as keyof typeof BIANCA_CATEGORY"
          />
          <span
            v-else
            class="text-sm text-muted"
          >Category follows the Expected MTD</span>
        </div>
      </div>
      <UAlert
        v-if="preview?.within_suggested_mtd === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The Expected MTD is longer than the Suggested MTD."
      />

      <UCard
        v-for="(row, index) in fn.it_dependencies"
        :key="index"
        :ui="{ body: 'space-y-3' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">IT system {{ index + 1 }}</span>
            <UButton
              v-if="!disabled && fn.it_dependencies.length > 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :aria-label="`Remove IT system ${index + 1}`"
              @click="fn.it_dependencies.splice(index, 1)"
            />
          </div>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <BiancaField
            label="Kind of system"
            note="it_system"
          >
            <USelect
              :model-value="modeOf(row)"
              :items="modes"
              class="w-full"
              :disabled="disabled"
              @update:model-value="setMode(row, $event as Mode)"
            />
          </BiancaField>
          <UFormField
            v-if="modeOf(row) === 'master'"
            label="IT application system"
          >
            <BiancaPicker
              v-model="row.application_id"
              kind="applications"
              :selected="row.application_id && row.application_name ? { id: row.application_id, label: row.application_name } : null"
              :disabled="disabled"
              aria-label="IT application system"
              @pick="pickApplication(row, $event)"
            />
          </UFormField>
          <UFormField
            v-else-if="modeOf(row) === 'other'"
            label="System name"
          >
            <UInput
              v-model="row.application_name"
              class="w-full"
              :maxlength="TEXT_LIMITS.name"
              :disabled="disabled"
            />
          </UFormField>
        </div>

        <template v-if="modeOf(row) !== 'na'">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BiancaField
              label="RTO"
              note="rto"
              :help="modeOf(row) === 'master' ? 'From the application master' : undefined"
            >
              <UInput
                v-model="row.rto"
                class="w-full"
                :readonly="modeOf(row) === 'master'"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="disabled"
                placeholder="e.g. 6 hrs"
              />
            </BiancaField>
            <BiancaField
              label="RPO"
              note="rpo"
              :help="modeOf(row) === 'master' ? 'From the application master' : undefined"
            >
              <UInput
                v-model="row.rpo"
                class="w-full"
                :readonly="modeOf(row) === 'master'"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="disabled"
                placeholder="LDB, LST, LSB or NA"
              />
            </BiancaField>
            <BiancaField
              label="Workaround available"
              note="workaround"
            >
              <USelect
                v-model="row.workaround"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="Time to clear backlog (hours)"
              note="backlog"
            >
              <UInput
                v-model.number="row.backlog_hours"
                type="number"
                min="0"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <BiancaField
              label="System usage"
              note="system_usage"
            >
              <USelect
                v-model="row.system_usage"
                :items="lookups.system_usage"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="Workaround critical gaps"
              note="gaps"
              :help="daat(index)?.gaps_required ? 'Required: RTO is longer than the MTD, there is no workaround and the system is a full dependency.' : 'Needed only if RTO > MTD, no workaround and full dependency.'"
              :error="daat(index)?.gaps_required && !row.gaps ? 'Required' : undefined"
            >
              <UTextarea
                v-model="row.gaps"
                class="w-full"
                :rows="2"
                :maxlength="long"
                :disabled="disabled"
              />
            </BiancaField>
          </div>
          <div
            v-if="daat(index)"
            class="rounded-md bg-elevated/50 p-3 text-sm"
          >
            <p class="flex flex-wrap items-center gap-x-1">
              <span class="inline-flex items-center gap-1 font-medium">DAAT <BiancaNote
                note="daat"
                label="DAAT"
              />:</span>
              <span :class="[nonNumeric, (daat(index)?.daat_hours ?? 0) < 0 ? 'font-semibold text-error' : '']">
                {{ daat(index)?.daat_hours == null ? '—' : `${daat(index)?.daat_hours} hours` }}
              </span>
              <span class="ms-1 text-muted">= Expected MTD − RTO − time to clear backlog, shown as worked out.</span>
            </p>
            <ul
              v-if="daat(index)?.warnings.length"
              class="mt-2 space-y-1 text-warning"
            >
              <li
                v-for="warning in daat(index)?.warnings"
                :key="warning"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-triangle-alert"
                  class="mt-0.5 size-4 shrink-0"
                />{{ warning }}
              </li>
            </ul>
            <p
              v-if="daat(index)?.rto_reaches_mtd"
              class="mt-2 text-warning"
            >
              The RTO reaches the Expected MTD: explain it in the Part 2a note (Notes tab).
            </p>
          </div>
        </template>
      </UCard>
      <UButton
        v-if="!disabled && fn.it_dependencies.length < lookups.it_slots"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add IT system"
        @click="addIt"
      />
    </section>

    <!-- Part 2b -->
    <section
      v-show="part === 'p2b'"
      class="space-y-4"
    >
      <p class="text-sm text-muted">
        Internal and external critical dependencies. Write NA in the name when there is none.
      </p>
      <BiancaField
        label="Function planned capacity"
        note="planned_capacity"
        class="max-w-xs"
      >
        <USelect
          v-model="fn.planned_capacity"
          :items="lookups.percentages"
          class="w-full"
          :disabled="disabled"
        />
      </BiancaField>
      <UCard
        v-for="(row, index) in fn.dependencies"
        :key="index"
        :ui="{ body: 'space-y-4' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">Dependency {{ index + 1 }}</span>
            <UButton
              v-if="!disabled && fn.dependencies.length > 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :aria-label="`Remove dependency ${index + 1}`"
              @click="fn.dependencies.splice(index, 1)"
            />
          </div>
        </template>
        <div
          v-for="side in sides"
          :key="side.key"
          class="space-y-2"
        >
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ side.label }}
          </h4>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <BiancaField
              label="Name"
              :note="side.key === 'up' ? 'upstream' : 'downstream'"
            >
              <UInput
                v-model="row[`${side.key}_name`]"
                class="w-full"
                :maxlength="TEXT_LIMITS.name"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="Planned capacity"
              note="dependency_capacity"
            >
              <USelect
                v-model="row[`${side.key}_capacity`]"
                :items="side.key === 'up' ? lookups.upstream_capacity : (lookups.downstream_capacity ?? lookups.upstream_capacity)"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="MTD"
              note="dependency_mtd"
            >
              <USelect
                v-model="row[`${side.key}_mtd`]"
                :items="withCurrent(lookups.dependency_mtd, row[`${side.key}_mtd`])"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="SLA"
              note="sla"
            >
              <UInput
                v-model="row[`${side.key}_sla`]"
                class="w-full"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="Outsourced"
              note="outsourced"
            >
              <USelect
                v-model="row[`${side.key}_outsourced`]"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
            <BiancaField
              label="Material"
              note="material"
            >
              <USelect
                v-model="row[`${side.key}_material`]"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="disabled"
              />
            </BiancaField>
          </div>
        </div>
      </UCard>
      <UButton
        v-if="!disabled && fn.dependencies.length < lookups.dependency_slots"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add dependency"
        @click="addDependency"
      />
    </section>

    <!-- Part 3 -->
    <section
      v-show="part === 'p3'"
      class="space-y-4"
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <BiancaField
          label="Total staff"
          note="total_staff"
        >
          <UInput
            v-model.number="fn.total_staff"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </BiancaField>
        <BiancaField
          label="Staff required"
          note="staff_required"
        >
          <UInput
            v-model.number="fn.staff_required"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </BiancaField>
        <BiancaField
          label="Recovery level"
          note="recovery_level"
        >
          <USelect
            v-model="fn.recovery_level"
            :items="lookups.expected_support_capacity ?? lookups.percentages"
            class="w-full"
            :disabled="disabled"
          />
        </BiancaField>
      </div>
      <BiancaField
        label="Prioritization strategy"
        note="prioritization_strategy"
      >
        <UTextarea
          v-model="fn.prioritization_strategy"
          class="w-full"
          :rows="2"
          :maxlength="long"
          :disabled="disabled"
        />
      </BiancaField>
      <BiancaField
        label="Outstanding strategy"
        note="outstanding_strategy"
      >
        <UTextarea
          v-model="fn.outstanding_strategy"
          class="w-full"
          :rows="2"
          :maxlength="long"
          :disabled="disabled"
        />
      </BiancaField>
      <BiancaField
        label="Recommended alternate site strategy"
        note="alt_site_strategy"
        class="max-w-xl"
      >
        <template #help>
          <span v-if="recommendedSites.length" :class="fn.alt_site_strategy && !recommendedSites.includes(fn.alt_site_strategy) ? 'text-warning' : ''">
            Recommended for {{ preview?.category }}: {{ recommendedSites.join(' or ') }}.
          </span>
          <span v-else>{{ lookups.guides.alternate_site }}</span>
        </template>
        <USelect
          v-model="fn.alt_site_strategy"
          :items="lookups.alt_site_strategies"
          class="w-full"
          :disabled="disabled"
        />
      </BiancaField>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BiancaField
          label="Current seats"
          note="seats_current"
        >
          <UInput
            v-model.number="fn.seats_current"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </BiancaField>
        <BiancaField
          label="Seats required"
          note="seats_required"
        >
          <UInput
            v-model.number="fn.seats_required"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </BiancaField>
      </div>
      <p class="flex items-center gap-1.5 text-sm font-medium">
        Resources at the alternate site
        <BiancaNote
          note="resources"
          label="Resources at the alternate site"
        />
      </p>
      <div class="grid gap-4 sm:grid-cols-4">
        <UFormField label="PC">
          <UInput
            v-model.number="fn.res_pc"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </UFormField>
        <UFormField label="Phone">
          <UInput
            v-model.number="fn.res_phone"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </UFormField>
        <UFormField label="Fax">
          <UInput
            v-model.number="fn.res_fax"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </UFormField>
        <UFormField label="Copier">
          <UInput
            v-model.number="fn.res_copier"
            type="number"
            min="0"
            class="w-full"
            :disabled="disabled"
          />
        </UFormField>
      </div>
      <BiancaField
        label="Other resources"
        note="res_others"
      >
        <UTextarea
          v-model="fn.res_others"
          class="w-full"
          :rows="2"
          :maxlength="long"
          :disabled="disabled"
        />
      </BiancaField>
      <div class="grid gap-4 sm:grid-cols-2">
        <BiancaField
          label="Vital records"
          note="vital_record"
        >
          <UTextarea
            v-model="fn.vital_record"
            class="w-full"
            :rows="2"
            :maxlength="long"
            :disabled="disabled"
          />
        </BiancaField>
        <UFormField label="Vital records location">
          <UTextarea
            v-model="fn.vital_record_location"
            class="w-full"
            :rows="2"
            :maxlength="long"
            :disabled="disabled"
          />
        </UFormField>
      </div>
    </section>

    <!-- Part 4 -->
    <section
      v-show="part === 'p4'"
      class="space-y-4"
    >
      <BiancaField
        label="Function description"
        note="description"
      >
        <UTextarea
          v-model="fn.description"
          class="w-full"
          :rows="3"
          :maxlength="long"
          :disabled="disabled"
        />
      </BiancaField>
      <BiancaField
        label="Frequency"
        note="frequency"
        class="max-w-xs"
      >
        <USelect
          v-model="fn.frequency"
          :items="lookups.frequencies"
          class="w-full"
          :disabled="disabled"
        />
      </BiancaField>
      <BiancaField
        label="Critical timings"
        note="critical_timings"
      >
        <UTextarea
          v-model="fn.critical_timings"
          class="w-full"
          :rows="2"
          :maxlength="long"
          :disabled="disabled"
        />
      </BiancaField>
      <BiancaField
        label="Critical activity"
        note="critical_activity"
      >
        <UTextarea
          v-model="fn.critical_activity"
          class="w-full"
          :rows="2"
          :maxlength="long"
          :disabled="disabled"
        />
      </BiancaField>
    </section>
  </div>
</template>
