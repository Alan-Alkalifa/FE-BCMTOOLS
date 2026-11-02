<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaAssessment, RaFormula, RaRatingInputs, RaRatingUpdate } from '~/composables/useRa'

/**
 * The Hazards tab. A table of every Type of Hazard with its ratings (the computed ratings are
 * filled in), and, for the hazard opened from its pencil (`?hazard=H03`), the page where it is
 * rated: Hazard group and Type of hazard, the probability, the gross impact, the existing
 * mitigation and then, as the RA HO workbook continues, the risk after mitigation and the
 * action plan. RA Branch rates one risk: the probability and the impact after mitigation.
 * Edits are kept while moving between hazards and the table, and saved together.
 */
const props = defineProps<{
  assessment: RaAssessment
  formula: RaFormula
  initialHazard?: string
}>()
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const toast = useToast()
const route = useRoute()
const router = useRouter()
/** In sign-off or approved: the ratings are shown, not edited. */
const locked = computed(() => !props.assessment.can_edit)
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const { hazards, matrix } = useRaFormulaIndex(() => props.formula)

const kind = computed(() => props.formula.kind)
const singleRisk = computed(() => kind.value === 'branch')
/** The inputs this assessment asks for; the others are never sent. */
const inputs = computed(() => props.formula.inputs?.length ? props.formula.inputs : RA_KIND_INPUTS[kind.value])

interface HazardState extends RaRatingInputs {
  mitigation: string
  action_plan: string
}

type HazardStatus = 'unrated' | 'in_progress' | 'issues' | 'done'

const codes = computed(() => props.formula.categories.flatMap((category) => category.hazards.map((h) => h.code)))

function fromAssessment(assessment: RaAssessment): Record<string, HazardState> {
  const state: Record<string, HazardState> = {}
  for (const code of codes.value) {
    const saved = assessment.ratings.find((row) => row.code === code)
    const values = Object.fromEntries(RA_RATING_FIELDS.map((key) => [key, saved?.[key] ?? null])) as RaRatingInputs
    state[code] = {
      ...values,
      mitigation: saved?.mitigation ?? '',
      action_plan: saved?.action_plan ?? '',
    }
  }
  return state
}

const state = ref<Record<string, HazardState>>({})
const snapshots = ref<Record<string, string>>({})

function reset(assessment: RaAssessment) {
  const next = fromAssessment(assessment)
  state.value = next
  snapshots.value = Object.fromEntries(Object.entries(next).map(([code, value]) => [code, JSON.stringify(value)]))
  if (dirty) dirty.value = false
}

watch(() => props.assessment, (assessment) => reset(assessment), { immediate: true })

const changedCodes = computed(() => codes.value.filter((code) => JSON.stringify(state.value[code]) !== snapshots.value[code]))
watch(changedCodes, (changed) => {
  if (dirty) dirty.value = changed.length > 0
})

const evaluations = computed(() => {
  const map = new Map<string, { result: RaHazardResult, issues: RaIssue[], warnings: RaIssue[], status: HazardStatus }>()
  for (const code of codes.value) {
    const hazard = state.value[code]
    if (!hazard) continue
    const result = raRateHazard(hazard, matrix.value, kind.value)
    const issues = raHazardIssues(hazard, hazard, result, kind.value)
    const touched = inputs.value.some((key) => hazard[key] !== null)
    const status: HazardStatus = !touched
      ? 'unrated'
      : !result.is_rated
          ? 'in_progress'
          : issues.length ? 'issues' : 'done'
    map.set(code, { result, issues, warnings: raHazardWarnings(result, kind.value), status })
  }
  return map
})

const ratedCount = computed(() => [...evaluations.value.values()].filter((item) => item.result.is_rated).length)

// --- table -----------------------------------------------------------------------------------

const groupFilter = ref<string>('all')
const page = ref(1)
const perPage = ref(ROWS_PER_PAGE)
const groupItems = computed(() => [
  { label: 'All hazard groups', value: 'all' },
  ...props.formula.categories.map((category) => ({ label: category.label, value: category.code })),
])

interface Row {
  code: string
  no: number
  group: string
  groupName: string
  name: string
}
const rows = computed<Row[]>(() => props.formula.categories
  .filter((category) => groupFilter.value === 'all' || category.code === groupFilter.value)
  .flatMap((category) => category.hazards.map((hazard) => ({
    code: hazard.code,
    no: hazard.no,
    group: category.label,
    groupName: category.name,
    name: hazard.short_name,
  }))))
const pagedRows = computed(() => {
  const start = (page.value - 1) * perPage.value
  return rows.value.slice(start, start + perPage.value)
})
watch([groupFilter, perPage], () => {
  page.value = 1
})

const right = { class: { th: 'text-right', td: 'text-right tabular-nums' } }
const wrap = { class: { td: 'whitespace-normal min-w-40' } }
const impactColumns = RA_IMPACTS.map((impact) => ({
  id: singleRisk.value ? `residual_${impact.key}` : impact.key,
  header: `${impact.label} impact`,
  meta: right,
}))
const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'no', header: 'No', meta: right },
  { accessorKey: 'group', header: 'Hazard group', meta: wrap },
  { accessorKey: 'name', header: 'Type of Hazard', meta: wrap },
  { id: 'historical', header: 'Historical of occurrence', meta: right },
  { id: 'probability', header: 'Probability of occurrence', meta: right },
  { id: 'probability_rating', header: 'Probability rating', meta: right },
  ...impactColumns,
  { id: 'impact_rating', header: 'Impact rating', meta: right },
  { id: 'mitigation', header: 'Existing mitigation measures', meta: { class: { td: 'whitespace-normal min-w-56 max-w-sm' } } },
  { id: 'level', header: singleRisk.value ? 'Risk level' : 'Residual risk' },
  { id: 'action', header: 'Action', meta: { class: { th: 'text-right', td: 'w-0 text-right' } } },
])

function rating(value: number | 'N/A' | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value === 0 || value === 'N/A' ? 'N/A' : String(value)
}
function cell(code: string, key: string) {
  return rating(state.value[code]?.[key as RaRatingField])
}
function probabilityRating(code: string) {
  const result = evaluations.value.get(code)?.result
  return rating(singleRisk.value ? result?.residual_probability : result?.gross_probability)
}
function impactRating(code: string) {
  const result = evaluations.value.get(code)?.result
  return rating(singleRisk.value ? result?.residual_impact : result?.gross_impact)
}

// --- the page of one hazard --------------------------------------------------------------------

const activeCode = computed(() =>
  props.initialHazard && codes.value.includes(props.initialHazard) ? props.initialHazard : null)
const active = computed(() => (activeCode.value ? state.value[activeCode.value] : undefined))
const activeHazard = computed(() => (activeCode.value ? hazards.value.get(activeCode.value) : undefined))
const activeEvaluation = computed(() => (activeCode.value ? evaluations.value.get(activeCode.value) : undefined))
const activeIndex = computed(() => (activeCode.value ? codes.value.indexOf(activeCode.value) : -1))

function open(code: string | null) {
  return router.replace({ query: { ...route.query, tab: 'hazards', hazard: code ?? undefined } })
}

const groupModel = computed<string>({
  get: () => activeHazard.value?.category.code ?? '',
  set: (code) => {
    const category = props.formula.categories.find((item) => item.code === code)
    if (!category || category.code === activeHazard.value?.category.code) return
    const next = category.hazards.find((hazard) => evaluations.value.get(hazard.code)?.status !== 'done')
      ?? category.hazards[0]
    if (next) open(next.code)
  },
})
const typeItems = computed(() => (activeHazard.value?.category.hazards ?? []).map((hazard) => ({
  label: `${hazard.no} - ${hazard.short_name}`,
  value: hazard.code,
})))
const typeModel = computed<string>({
  get: () => activeCode.value ?? '',
  set: (code) => {
    if (code) open(code)
  },
})
const pickGroupItems = computed(() => props.formula.categories.map((category) => ({ label: category.label, value: category.code })))

function fieldIssue(field: string) {
  const evaluation = activeEvaluation.value
  if (!evaluation || evaluation.status === 'unrated') return undefined
  return evaluation.issues.find((issue) => issue.field === field)?.message
}

const mitigationRequired = computed(() => {
  const result = activeEvaluation.value?.result
  return result ? raMitigationRequired(result, kind.value) : false
})
const mitigationHelp = computed(() => {
  if (mitigationRequired.value) return undefined
  return singleRisk.value
    ? 'If any. Not needed when the hazard is not applicable.'
    : 'If any. Not needed when the gross risk is 1 × 1 or not applicable.'
})
const highResidual = computed(() => activeEvaluation.value?.result.residual_level === 'High')

/** Issues that aren't about one empty rating (those show under each field). */
const hazardMessages = computed(() => {
  const evaluation = activeEvaluation.value
  if (!evaluation || evaluation.status === 'unrated') return []
  const empty = evaluation.issues.filter((issue) => inputs.value.includes(issue.field as RaRatingField)
    && issue.message.startsWith('Choose'))
  const other = evaluation.issues.filter((issue) => !empty.includes(issue))
  return [
    ...(empty.length ? [`${empty.length} ${empty.length === 1 ? 'rating is' : 'ratings are'} still empty.`] : []),
    ...other.map((issue) => issue.message),
  ]
})

const probabilityFields = RA_BRANCH_PROBABILITY_FIELDS
const grossImpactFields = RA_GROSS_FIELDS.slice(2)
const residualProbabilityField = RA_RESIDUAL_FIELDS[0]
const residualImpactFields = RA_RESIDUAL_FIELDS.slice(1)

const hazardCard = useTemplateRef<{ $el: HTMLElement }>('hazardCard')

/** Slides back to the top of the page (at once for people who ask for reduced motion). The
 *  panel scrolls, not the window, so every scrolled ancestor. */
function scrollToTop() {
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  let element: HTMLElement | null = hazardCard.value?.$el ?? null
  while (element) {
    if (element.scrollTop > 0) element.scrollTo({ top: 0, behavior })
    element = element.parentElement
  }
  window.scrollTo({ top: 0, behavior })
}

/** Previous / Next hazard: the next one opens at its top, not where the buttons were. */
async function go(offset: number) {
  const next = codes.value[activeIndex.value + offset]
  if (!next) return
  await open(next)
  await nextTick()
  scrollToTop()
}

function markNotApplicable() {
  const hazard = active.value
  if (!hazard) return
  for (const key of inputs.value) hazard[key] = 'N/A'
}

function payload(code: string): RaRatingUpdate {
  const hazard = state.value[code]!
  return {
    code,
    ...Object.fromEntries(inputs.value.map((key) => [key, hazard[key]])),
    ...blankToNull({ mitigation: hazard.mitigation, action_plan: hazard.action_plan }),
  }
}

async function save() {
  formError.value = null
  const changed = changedCodes.value
  if (!changed.length) return
  try {
    const saved = await raApi.setRatings(props.assessment.id, changed.map(payload))
    reset(saved)
    toast.add({
      title: `${changed.length} ${changed.length === 1 ? 'hazard' : 'hazards'} saved`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('saved', saved)
  } catch (error) {
    formError.value = apiErrorMessage(error)
  }
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :description="formula.hazard_intro ?? undefined"
      data-testid="hazard-intro"
    />

    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the ratings"
      :description="formError"
    />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">
          {{ active ? 'Rate the hazard' : 'Hazards' }}
        </h2>
        <p class="text-sm text-muted">
          {{ formatNumber(ratedCount, 0) }} of {{ formatNumber(codes.length, 0) }} hazards rated
          <template v-if="changedCodes.length">
            · {{ changedCodes.length }} {{ changedCodes.length === 1 ? 'hazard has' : 'hazards have' }} unsaved changes
          </template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="active"
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-left"
          label="Back to the hazards"
          @click="open(null)"
        />
        <RaGuideModal :formula="formula" />
        <UButton
          v-if="!locked"
          icon="i-lucide-save"
          label="Save ratings"
          :disabled="!changedCodes.length"
          loading-auto
          @click="save"
        />
      </div>
    </div>

    <!-- The table of every hazard -->
    <UCard
      v-if="!active"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
        <USelect
          v-model="groupFilter"
          :items="groupItems"
          aria-label="Hazard group"
          class="w-full sm:w-72"
        />
      </div>
      <UTable
        :data="pagedRows"
        :columns="columns"
        sticky
        class="max-h-[70vh]"
        :ui="{ th: 'first:ps-4 last:pe-4 whitespace-normal align-bottom', td: 'first:ps-4 last:pe-4 align-top' }"
      >
        <template #name-cell="{ row }">
          <span class="flex items-center gap-1.5">
            <span class="font-medium text-highlighted">{{ row.original.name }}</span>
            <UIcon
              v-if="changedCodes.includes(row.original.code)"
              name="i-lucide-circle-dot"
              class="size-3 shrink-0 text-primary"
              aria-label="Unsaved changes"
            />
            <UIcon
              v-if="evaluations.get(row.original.code)?.status === 'issues'"
              name="i-lucide-triangle-alert"
              class="size-4 shrink-0 text-warning"
              aria-label="Needs attention"
            />
          </span>
        </template>
        <template #historical-cell="{ row }">
          {{ cell(row.original.code, 'historical') }}
        </template>
        <template #probability-cell="{ row }">
          {{ cell(row.original.code, 'probability') }}
        </template>
        <template #probability_rating-cell="{ row }">
          <span class="font-medium text-highlighted">{{ probabilityRating(row.original.code) }}</span>
        </template>
        <template
          v-for="column in impactColumns"
          :key="column.id"
          #[`${column.id}-cell`]="{ row }"
        >
          {{ cell(row.original.code, column.id) }}
        </template>
        <template #impact_rating-cell="{ row }">
          <span class="font-medium text-highlighted">{{ impactRating(row.original.code) }}</span>
        </template>
        <template #mitigation-cell="{ row }">
          <span
            v-if="state[row.original.code]?.mitigation"
            class="line-clamp-3"
          >{{ state[row.original.code]?.mitigation }}</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #level-cell="{ row }">
          <StatusBadge
            v-if="evaluations.get(row.original.code)?.result.is_rated"
            :scale="raRiskLevel"
            :value="raLevelKey({ level: evaluations.get(row.original.code)!.result.residual_level, rated: true })"
            size="sm"
          />
          <span
            v-else-if="evaluations.get(row.original.code)?.status === 'in_progress'"
            class="text-xs text-muted"
          >In progress</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #action-cell="{ row }">
          <UTooltip :text="locked ? 'View' : 'Rate'">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :icon="locked ? 'i-lucide-eye' : 'i-lucide-pencil'"
              :aria-label="`${locked ? 'View' : 'Rate'} ${row.original.name}`"
              @click="open(row.original.code)"
            />
          </UTooltip>
        </template>
      </UTable>
      <TablePagination
        v-model:page="page"
        v-model:per-page="perPage"
        page-sizes
        :total="rows.length"
        label="Hazards"
      />
    </UCard>

    <!-- The page of one hazard -->
    <UCard
      v-else-if="active && activeHazard && activeEvaluation"
      ref="hazardCard"
    >
      <template #header>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Hazard group name">
            <USelect
              v-model="groupModel"
              :items="pickGroupItems"
              aria-label="Hazard group name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Type of Hazard">
            <USelectMenu
              v-model="typeModel"
              value-key="value"
              :items="typeItems"
              aria-label="Type of Hazard"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="mt-3 flex flex-wrap items-start justify-between gap-3">
          <p
            v-if="activeHazard.name !== activeHazard.short_name"
            class="text-sm text-muted"
          >
            {{ activeHazard.name }}
          </p>
          <span v-else />
          <UButton
            v-if="!locked"
            color="neutral"
            variant="ghost"
            icon="i-lucide-circle-minus"
            label="Mark as not applicable"
            @click="markNotApplicable"
          />
        </div>
      </template>

      <div class="space-y-6">
        <section class="space-y-4">
          <h3 class="font-semibold">
            Probability
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <RaRatingSelect
              v-for="(field, index) in probabilityFields"
              :key="field.key"
              v-model="active[field.key]"
              :label="`${index + 1} - ${index === 0 ? 'Historical of occurrence' : 'Probability of occurrence'}`"
              :guides="formula.guides[field.scale]"
              :issue="fieldIssue(field.key)"
              :disabled="locked"
            />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Probability rating"
              help="Filled in: the higher of the two."
            >
              <UInput
                :model-value="rating(singleRisk ? activeEvaluation.result.residual_probability : activeEvaluation.result.gross_probability)"
                disabled
                aria-label="Probability rating"
                class="w-full sm:w-40"
                :ui="{ base: 'text-right tabular-nums' }"
              />
            </UFormField>
          </div>
        </section>

        <USeparator />

        <section class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold">
              {{ singleRisk ? 'Impact after mitigation' : 'Gross impact' }}
            </h3>
            <span
              v-if="!singleRisk && activeEvaluation.result.gross_level"
              class="flex items-center gap-2 text-sm text-muted"
            >
              Gross risk
              <StatusBadge
                :scale="raRiskLevel"
                :value="activeEvaluation.result.gross_level"
                size="sm"
              />
            </span>
          </div>
          <p
            v-if="singleRisk"
            class="text-sm text-muted"
          >
            The impact that remains with the existing mitigation in place.
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <RaRatingSelect
              v-for="(field, index) in (singleRisk ? residualImpactFields : grossImpactFields)"
              :key="field.key"
              v-model="active[field.key]"
              :label="`${index + 1} - ${field.label}`"
              :guides="formula.guides[field.scale]"
              :issue="fieldIssue(field.key)"
              :disabled="locked"
            />
          </div>
          <UFormField
            label="Impact rating"
            help="Filled in: the highest impact."
          >
            <UInput
              :model-value="rating(singleRisk ? activeEvaluation.result.residual_impact : activeEvaluation.result.gross_impact)"
              disabled
              aria-label="Impact rating"
              class="w-full sm:w-40"
              :ui="{ base: 'text-right tabular-nums' }"
            />
          </UFormField>
        </section>

        <USeparator />

        <UFormField
          label="Existing mitigation measures"
          :required="mitigationRequired"
          :help="mitigationHelp"
        >
          <template #hint>
            <FieldCount
              :value="active.mitigation"
              :max="TEXT_LIMITS.hazard"
            />
          </template>
          <UTextarea
            v-model="active.mitigation"
            :maxlength="TEXT_LIMITS.hazard"
            :disabled="locked"
            :rows="4"
            :maxrows="12"
            autoresize
            class="w-full"
          />
        </UFormField>

        <template v-if="!singleRisk">
          <USeparator />
          <section class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="font-semibold">
                  After mitigation
                </h3>
                <p class="text-sm text-muted">
                  The probability and impact with the existing mitigation measures in place.
                </p>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <RaRatingSelect
                v-model="active[residualProbabilityField.key]"
                :label="residualProbabilityField.label"
                :guides="formula.guides[residualProbabilityField.scale]"
                :issue="fieldIssue(residualProbabilityField.key)"
                :disabled="locked"
              />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <RaRatingSelect
                v-for="field in residualImpactFields"
                :key="field.key"
                v-model="active[field.key]"
                :label="field.label"
                :guides="formula.guides[field.scale]"
                :issue="fieldIssue(field.key)"
                :disabled="locked"
              />
            </div>
          </section>
        </template>

        <USeparator />

        <section class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold">
              {{ singleRisk ? 'Risk rating' : 'Residual risk' }}
            </h3>
            <p class="flex items-center gap-2 text-sm text-muted">
              Probability <span class="font-medium text-highlighted tabular-nums">{{ rating(activeEvaluation.result.residual_probability) }}</span>
              - Gross Impact <span class="font-medium text-highlighted tabular-nums">{{ rating(activeEvaluation.result.residual_impact) }}</span>
              <StatusBadge
                v-if="activeEvaluation.result.is_rated"
                :scale="raRiskLevel"
                :value="raLevelKey({ level: activeEvaluation.result.residual_level, rated: true })"
                size="sm"
              />
            </p>
          </div>
          <UFormField
            label="Action plan"
            :help="highResidual ? 'Optional. A high residual risk is followed up through CIM.' : 'Optional.'"
          >
            <template #hint>
              <FieldCount
                :value="active.action_plan"
                :max="TEXT_LIMITS.hazard"
              />
            </template>
            <UTextarea
              v-model="active.action_plan"
              :maxlength="TEXT_LIMITS.hazard"
              :disabled="locked"
              :rows="3"
              autoresize
              class="w-full"
            />
          </UFormField>
        </section>

        <UAlert
          v-if="hazardMessages.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Still needed for this hazard"
        >
          <template #description>
            <ul class="list-disc space-y-1 pl-4">
              <li
                v-for="message in hazardMessages"
                :key="message"
              >
                {{ message }}
              </li>
            </ul>
          </template>
        </UAlert>
        <UAlert
          v-for="warning in activeEvaluation.warnings"
          :key="warning.field"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="warning.message"
          description="Check the ratings. Mitigation normally lowers the risk."
        />
      </div>

      <template #footer>
        <div class="flex justify-between gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-left"
            label="Previous hazard"
            :disabled="activeIndex <= 0"
            @click="go(-1)"
          />
          <UButton
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-arrow-right"
            label="Next hazard"
            :disabled="activeIndex >= codes.length - 1"
            @click="go(1)"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
