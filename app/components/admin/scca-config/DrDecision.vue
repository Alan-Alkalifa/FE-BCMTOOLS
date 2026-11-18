<script setup lang="ts">
import type { SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/**
 * SCCA configuration > DR decision (per version): the decision tree of Lampiran 9 and the
 * parameters every DR rule reads, the DR type catalogue of Lampiran 10, and the system
 * characteristics of Lampiran 8 per category. Nothing about the DR decision is hard-coded.
 */
const props = defineProps<{ version: SccaConfigVersion }>()
const emit = defineEmits<{ saved: [version: SccaConfigVersion] }>()

const EMPTY: SccaDrConfig = {
  settings: {
    mandatory_categories: [],
    mtd_threshold_h: 24,
    question_alt_process: '',
    question_accept: '',
    outcome_proposed: 'Proposed DR',
    outcome_not_required: 'No DR required',
    category_mtd_h: {},
    rto_gap_pct: 70,
    band_upper_inclusive: true,
    acceptance_mode: 'assessor',
    legacy_mode: 'not_assessed',
  },
  catalogue: [],
  characteristics: {},
}

const part = useConfigPart(
  computed(() => props.version),
  (value) => value.dr ?? EMPTY,
  (code, dr) => sccaConfigApi.setDr(code, dr),
  (saved) => emit('saved', saved),
  'DR decision saved',
)
const { draft, error, busy, dirty, submit, reset } = part

const categories = computed(() => props.version.recovery_standards.map((row) => row.category))
const categoryItems = computed(() => categories.value.map((value) => ({ label: sccaCategory[value as SccaCategory]?.label ?? value, value })))
const editable = computed(() => props.version.can.edit)

const NUMBER_FIELDS = ['mtd_from_h', 'mtd_to_h'] as const

function standardMtd(category: string) {
  const row = props.version.recovery_standards.find((item) => item.category === category)
  return row ? (row.mtd_to_h ?? row.mtd_from_h ?? null) : null
}

function addBand() {
  const last = draft.value.catalogue.at(-1)
  const from = last?.mtd_to_h ?? last?.mtd_from_h ?? 0
  if (last && last.mtd_to_h == null) last.mtd_to_h = from + 24
  draft.value.catalogue.push({
    mtd_from_h: last?.mtd_to_h ?? 0,
    mtd_to_h: null,
    suggested_dr: '',
    target_rto: '',
    target_rpo: '',
    dr_type: '',
    dr_capacity: '',
    data_sync_type: '',
    sync_method: '',
    backup_tools: '',
  })
}

function removeBand(index: number) {
  draft.value.catalogue.splice(index, 1)
}

function move(index: number, by: -1 | 1) {
  const rows = draft.value.catalogue
  const target = index + by
  if (target < 0 || target >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row!)
}

function numberValue(value: string | number | null | undefined) {
  return value === '' || value == null ? null : Number(value)
}

function setCategoryMtd(category: string, value: string | number | null | undefined) {
  const number = numberValue(value)
  const next = Object.fromEntries(Object.entries(draft.value.settings.category_mtd_h).filter(([key]) => key !== category))
  if (number != null) next[category] = number
  draft.value.settings.category_mtd_h = next
}

function textsOf(category: string) {
  return (draft.value.characteristics[category] ??= {
    data_sync: '', disaster_recovery: '', rpo: '', backup_interval: '', app_resiliency: '',
    infra_resiliency: '', dr_testing: '', service_monitoring: '', dr_type_minimum: '',
  })
}

const acceptanceItems = [
  { label: 'Assessor records it, with the business owner\'s name', value: 'assessor' },
  { label: 'Application owner signs it off', value: 'owner_signoff' },
]
const legacyItems = [
  { label: 'Show "Not assessed" until the next review', value: 'not_assessed' },
  { label: 'BCM may run the decision on a final SCCA', value: 'bcm_may_run' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="max-w-3xl text-sm text-muted">
        The DR Decision Tree (Lampiran 9), the DR type catalogue (Lampiran 10) and the system characteristics (Lampiran 8) of Standard Teknologi H.03.P.02.01 versi 08.2026. Every rule of the Recovery tab's DR decision reads this tab; an SCCA keeps the version it was created with.
      </p>
      <div
        v-if="editable"
        class="flex gap-2"
      >
        <UButton
          v-if="dirty"
          color="neutral"
          variant="outline"
          label="Undo changes"
          @click="reset"
        />
        <UButton
          icon="i-lucide-save"
          label="Save DR decision"
          :disabled="!dirty"
          :loading="busy"
          @click="submit"
        />
      </div>
    </div>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the DR decision"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="error"
    />

    <fieldset
      :disabled="!editable"
      class="min-w-0 space-y-6"
    >
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Decision tree and parameters
          </h3>
        </template>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UFormField
            label="Categories where DR is mandatory"
            help="They skip the questions and go straight to the proposed DR."
            class="md:col-span-2 xl:col-span-3"
          >
            <USelect
              v-model="draft.settings.mandatory_categories"
              :items="categoryItems"
              value-key="value"
              label-key="label"
              multiple
              class="w-full"
              aria-label="Categories where DR is mandatory"
            />
          </UFormField>
          <UFormField
            label="MTD threshold of the tree (hours)"
            help="&quot;MTD > threshold?&quot; in the tree."
          >
            <UInput
              v-model.number="draft.settings.mtd_threshold_h"
              type="number"
              min="0"
              step="1"
              class="w-full"
              aria-label="MTD threshold"
            />
          </UFormField>
          <UFormField
            label="RTO gap threshold (% of the category MTD)"
            help="The Final RTO above this share of the MTD is a gap."
          >
            <UInput
              v-model.number="draft.settings.rto_gap_pct"
              type="number"
              min="1"
              max="100"
              class="w-full"
              aria-label="RTO gap threshold"
            />
          </UFormField>
          <UFormField
            label="Catalogue band edge"
            help="Upper bound inclusive: MTD 4 h belongs to the 2 – 4 h band."
          >
            <USwitch
              v-model="draft.settings.band_upper_inclusive"
              label="Upper bound inclusive"
              aria-label="Band upper bound inclusive"
            />
          </UFormField>
          <UFormField label="Business acceptance recorded by">
            <USelect
              v-model="draft.settings.acceptance_mode"
              :items="acceptanceItems"
              value-key="value"
              label-key="label"
              class="w-full"
              aria-label="Business acceptance recorded by"
            />
          </UFormField>
          <UFormField label="SCCAs finalised before the DR decision">
            <USelect
              v-model="draft.settings.legacy_mode"
              :items="legacyItems"
              value-key="value"
              label-key="label"
              class="w-full"
              aria-label="Legacy SCCAs"
            />
          </UFormField>
          <UFormField
            label="Question 1"
            class="md:col-span-2"
          >
            <UInput
              v-model="draft.settings.question_alt_process"
              class="w-full"
              :maxlength="500"
              aria-label="Question: alternate business process"
            />
          </UFormField>
          <UFormField label="Outcome text: DR proposed">
            <UInput
              v-model="draft.settings.outcome_proposed"
              class="w-full"
              :maxlength="500"
              aria-label="Outcome text: proposed"
            />
          </UFormField>
          <UFormField
            label="Question 2"
            class="md:col-span-2"
          >
            <UInput
              v-model="draft.settings.question_accept"
              class="w-full"
              :maxlength="500"
              aria-label="Question: business accepts"
            />
          </UFormField>
          <UFormField label="Outcome text: no DR required">
            <UInput
              v-model="draft.settings.outcome_not_required"
              class="w-full"
              :maxlength="500"
              aria-label="Outcome text: not required"
            />
          </UFormField>
        </div>
        <h4 class="mt-6 mb-2 text-sm font-semibold">
          MTD per category for the DR decision (hours)
        </h4>
        <p class="mb-3 text-sm text-muted">
          Empty follows the recovery standard (SCCA configuration > Formula): the upper bound of the category's MTD.
        </p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <UFormField
            v-for="category in categories"
            :key="category"
            :label="sccaCategory[category as SccaCategory]?.label ?? category"
          >
            <UInput
              :model-value="String(draft.settings.category_mtd_h[category] ?? '')"
              type="number"
              min="0"
              step="1"
              class="w-full"
              :placeholder="standardMtd(category) == null ? '—' : String(standardMtd(category))"
              :aria-label="`MTD ${category}`"
              @update:model-value="setCategoryMtd(category, $event)"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold">
                DR type catalogue (Lampiran 10)
              </h3>
              <p class="text-sm text-muted">
                One row per tier. The bands start at 0, don't overlap, leave no gap, and the last one is open-ended (leave "to" empty).
              </p>
            </div>
            <UButton
              v-if="editable"
              type="button"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              label="Add band"
              @click="addBand"
            />
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[110rem] text-sm">
            <thead>
              <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th class="px-3 py-2">
                  MTD from (h)
                </th>
                <th class="px-3 py-2">
                  MTD to (h)
                </th>
                <th
                  v-for="field in SCCA_DR_BAND_FIELDS"
                  :key="field.key"
                  class="px-3 py-2"
                >
                  {{ field.label }}
                </th>
                <th class="px-3 py-2">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(band, index) in draft.catalogue"
                :key="index"
              >
                <td
                  v-for="key in NUMBER_FIELDS"
                  :key="key"
                  class="px-3 py-2 align-top"
                >
                  <UInput
                    :model-value="String(band[key] ?? '')"
                    type="number"
                    min="0"
                    step="0.5"
                    class="w-24"
                    :placeholder="key === 'mtd_to_h' ? 'open' : ''"
                    :aria-label="`${key === 'mtd_from_h' ? 'MTD from' : 'MTD to'} ${index + 1}`"
                    @update:model-value="band[key] = numberValue($event as string | number)"
                  />
                </td>
                <td
                  v-for="field in SCCA_DR_BAND_FIELDS"
                  :key="field.key"
                  class="px-3 py-2 align-top"
                >
                  <UTextarea
                    v-model="band[field.key] as string"
                    :rows="2"
                    autoresize
                    :maxlength="500"
                    class="w-full min-w-40"
                    :aria-label="`${field.label} ${index + 1}`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <div
                    v-if="editable"
                    class="flex gap-1"
                  >
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-arrow-up"
                      :disabled="index === 0"
                      :aria-label="`Move band ${index + 1} up`"
                      @click="move(index, -1)"
                    />
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-arrow-down"
                      :disabled="index === draft.catalogue.length - 1"
                      :aria-label="`Move band ${index + 1} down`"
                      @click="move(index, 1)"
                    />
                    <UButton
                      type="button"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      :aria-label="`Remove band ${index + 1}`"
                      @click="removeBand(index)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">
            System characteristics (Lampiran 8)
          </h3>
          <p class="text-sm text-muted">
            Shown for the SCCA's category on the Recovery tab and in the reports (at most 500 characters each).
          </p>
        </template>
        <div class="space-y-6">
          <section
            v-for="category in categories"
            :key="category"
          >
            <h4 class="mb-2 flex items-center gap-2 text-sm font-semibold">
              <StatusBadge
                :scale="sccaCategory"
                :value="(category as SccaCategory)"
                size="sm"
              />
            </h4>
            <div class="grid gap-3 md:grid-cols-2">
              <UFormField
                v-for="item in SCCA_DR_CHARACTERISTICS"
                :key="item.key"
                :label="item.label"
              >
                <UTextarea
                  v-model="textsOf(category)[item.key]"
                  :rows="2"
                  autoresize
                  :maxlength="500"
                  class="w-full"
                  :aria-label="`${item.label} ${category}`"
                />
              </UFormField>
            </div>
          </section>
        </div>
      </UCard>
    </fieldset>
  </div>
</template>
