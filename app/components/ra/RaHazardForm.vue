<script setup lang="ts">
import type { RaAssessment, RaFormula, RaRatingInputs, RaRatingUpdate } from '~/composables/useRa'

const props = defineProps<{
  assessment: RaAssessment
  formula: RaFormula
  initialHazard?: string
}>()
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const toast = useToast()
/** In sign-off or approved: the ratings are shown, not edited. */
const locked = computed(() => !props.assessment.can_edit)
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const { hazards, matrix } = useRaFormulaIndex(() => props.formula)

/** RA Branch rates one (residual) risk; RA rates the gross risk and the risk after mitigation. */
const kind = computed(() => props.formula.kind)
const singleRisk = computed(() => kind.value === 'branch')
/** The inputs this assessment asks for; the others are never sent. */
const inputs = computed(() => props.formula.inputs?.length ? props.formula.inputs : RA_KIND_INPUTS[kind.value])

interface HazardState extends RaRatingInputs {
  mitigation: string
  action_plan: string
  cim_ref_no: string
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
      cim_ref_no: saved?.cim_ref_no ?? '',
    }
  }
  return state
}

const state = ref<Record<string, HazardState>>({})
const snapshots = ref<Record<string, string>>({})
const activeCode = ref(props.initialHazard && codes.value.includes(props.initialHazard) ? props.initialHazard : codes.value[0] ?? '')

watch(() => props.initialHazard, (code) => {
  if (code && codes.value.includes(code)) activeCode.value = code
})

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

const active = computed(() => state.value[activeCode.value])
const activeHazard = computed(() => hazards.value.get(activeCode.value))
const activeEvaluation = computed(() => evaluations.value.get(activeCode.value))
const activeIndex = computed(() => codes.value.indexOf(activeCode.value))

/* Hazard groups: pick a category, then one of its hazards. */
const groups = computed(() => props.formula.categories.map((category) => {
  const items = category.hazards.map((hazard) => evaluations.value.get(hazard.code))
  return {
    category,
    total: category.hazards.length,
    rated: items.filter((item) => item?.result.is_rated).length,
    issues: items.filter((item) => item?.status === 'issues').length,
    changed: category.hazards.some((hazard) => changedCodes.value.includes(hazard.code)),
  }
}))
const activeGroup = computed(() =>
  groups.value.find((group) => group.category.hazards.some((hazard) => hazard.code === activeCode.value)) ?? groups.value[0],
)

function selectGroup(code: string) {
  const group = groups.value.find((item) => item.category.code === code)
  if (!group || group === activeGroup.value) return
  // Start at the first hazard that still needs work, or the first one.
  const next = group.category.hazards.find((hazard) => evaluations.value.get(hazard.code)?.status !== 'done')
    ?? group.category.hazards[0]
  if (next) activeCode.value = next.code
}

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
    ? 'Not needed when the hazard is not applicable.'
    : 'Not needed when the gross risk is 1 × 1 or not applicable.'
})
const highResidual = computed(() => activeEvaluation.value?.result.residual_level === 'High')

interface RatingField {
  key: RaRatingField
  label: string
  scale: RaGuideScale
}
interface Section {
  key: string
  title: string
  description?: string
  fields: readonly RatingField[]
  /** Where the existing mitigation is asked for, relative to the ratings. */
  mitigation?: 'before' | 'after'
  /** The computed rating shown next to the title. */
  result: { label: string, value: string, level?: RaLevel | 'na' | null }
}

function pair(probability: number | null, impact: number | null, level: RaLevel | null) {
  const complete = probability !== null && impact !== null
  return { label: 'Probability × impact', value: raPairLabel(probability, impact), level: complete ? raLevelKey({ level, rated: true }) : null }
}

function rating(value: number | null) {
  return value === null ? '—' : value === 0 ? 'N/A' : String(value)
}

const sections = computed<Section[]>(() => {
  const result = activeEvaluation.value?.result
  if (!result) return []
  if (singleRisk.value) {
    return [
      {
        key: 'probability',
        title: 'Probability',
        description: 'The higher of the two is the probability rating.',
        fields: RA_BRANCH_PROBABILITY_FIELDS,
        result: { label: 'Probability rating', value: rating(result.residual_probability) },
      },
      {
        key: 'impact',
        title: 'Impact after mitigation',
        description: 'The impact that remains with the existing mitigation in place. The highest is the impact rating.',
        fields: RA_BRANCH_IMPACT_FIELDS,
        mitigation: 'before',
        result: { label: 'Impact rating', value: rating(result.residual_impact) },
      },
    ]
  }
  return [
    {
      key: 'gross',
      title: 'Gross risk',
      fields: RA_GROSS_FIELDS,
      mitigation: 'after',
      result: pair(result.gross_probability, result.gross_impact, result.gross_level),
    },
    {
      key: 'residual',
      title: 'After mitigation',
      fields: RA_RESIDUAL_FIELDS,
      result: pair(result.residual_probability, result.residual_impact, result.residual_level),
    },
  ]
})

/** RA Branch: the one risk of the hazard, shown above the action plan. */
const branchRisk = computed(() => {
  const result = activeEvaluation.value?.result
  return result ? pair(result.residual_probability, result.residual_impact, result.residual_level) : null
})

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

function go(offset: number) {
  const next = codes.value[activeIndex.value + offset]
  if (next) activeCode.value = next
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
    ...blankToNull({ mitigation: hazard.mitigation, action_plan: hazard.action_plan, cim_ref_no: hazard.cim_ref_no }),
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
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the ratings"
      :description="formError"
    />

    <section
      aria-labelledby="ra-hazard-groups"
      class="space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="ra-hazard-groups"
            class="text-lg font-semibold"
          >
            Hazard groups
          </h2>
          <p class="text-sm text-muted">
            {{ formatNumber(ratedCount, 0) }} of {{ formatNumber(codes.length, 0) }} hazards rated
          </p>
        </div>
        <RaGuideModal :formula="formula" />
      </div>
      <div
        role="group"
        aria-label="Hazard groups"
        class="grid grid-cols-2 gap-3 lg:grid-cols-3"
      >
        <button
          v-for="group in groups"
          :key="group.category.code"
          type="button"
          class="flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="group === activeGroup ? 'border-primary bg-elevated ring-1 ring-primary' : 'border-default bg-default'"
          :aria-pressed="group === activeGroup"
          @click="selectGroup(group.category.code)"
        >
          <span class="flex items-start justify-between gap-2">
            <span class="min-w-0">
              <span class="block text-sm font-medium text-highlighted">{{ group.category.label }}</span>
              <span
                lang="id"
                class="block truncate text-xs text-muted"
              >{{ group.category.name }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-1">
              <UIcon
                v-if="group.changed"
                name="i-lucide-circle-dot"
                class="size-3 text-primary"
                aria-label="Unsaved changes"
              />
              <UIcon
                v-if="group.issues"
                name="i-lucide-triangle-alert"
                class="size-4 text-warning"
                :aria-label="`${group.issues} need attention`"
              />
              <UIcon
                v-else-if="group.rated === group.total"
                name="i-lucide-circle-check"
                class="size-4 text-success"
                aria-label="All rated"
              />
            </span>
          </span>
          <span class="flex items-center gap-2">
            <UProgress
              :model-value="group.rated"
              :max="group.total"
              size="xs"
              :color="group.rated === group.total && !group.issues ? 'success' : 'neutral'"
              class="flex-1"
              aria-hidden="true"
            />
            <span class="shrink-0 text-xs text-muted tabular-nums">{{ group.rated }} of {{ group.total }} rated</span>
          </span>
        </button>
      </div>
    </section>

    <div class="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <UCard
        v-if="activeGroup"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <h3 class="font-semibold">
            {{ activeGroup.category.label }}
          </h3>
          <p
            lang="id"
            class="text-sm text-muted"
          >
            {{ activeGroup.category.name }}
          </p>
        </template>
        <nav
          :aria-label="`Hazards: ${activeGroup.category.label}`"
          class="py-2"
        >
          <ul>
            <li
              v-for="hazard in activeGroup.category.hazards"
              :key="hazard.code"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
                :class="hazard.code === activeCode ? 'bg-elevated font-medium text-highlighted' : 'text-default'"
                :aria-current="hazard.code === activeCode ? 'true' : undefined"
                @click="activeCode = hazard.code"
              >
                <span class="w-5 shrink-0 text-right text-xs text-muted tabular-nums">{{ hazard.no }}</span>
                <span class="min-w-0 flex-1 truncate">{{ hazard.short_name }}</span>
                <UIcon
                  v-if="changedCodes.includes(hazard.code)"
                  name="i-lucide-circle-dot"
                  class="size-3 shrink-0 text-primary"
                  aria-label="Unsaved changes"
                />
                <template v-if="evaluations.get(hazard.code)?.result.is_rated">
                  <UIcon
                    v-if="evaluations.get(hazard.code)?.status === 'issues'"
                    name="i-lucide-triangle-alert"
                    class="size-4 shrink-0 text-warning"
                    aria-label="Needs attention"
                  />
                  <StatusBadge
                    v-if="evaluations.get(hazard.code)?.result.residual_level"
                    :scale="raRiskLevel"
                    :value="evaluations.get(hazard.code)!.result.residual_level"
                    size="sm"
                  />
                  <span
                    v-else
                    class="shrink-0 text-xs text-muted"
                  >N/A</span>
                </template>
                <span
                  v-else-if="evaluations.get(hazard.code)?.status === 'in_progress'"
                  class="shrink-0 text-xs text-muted"
                >In progress</span>
              </button>
            </li>
          </ul>
        </nav>
      </UCard>

      <UCard v-if="active && activeHazard && activeEvaluation">
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-muted">
                {{ activeHazard.category.label }} · {{ activeHazard.category.name }}
              </p>
              <h2 class="text-lg font-semibold">
                {{ activeHazard.no }}. {{ activeHazard.short_name }}
              </h2>
              <p
                v-if="activeHazard.name !== activeHazard.short_name"
                class="text-sm text-muted"
              >
                {{ activeHazard.name }}
              </p>
            </div>
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
          <template
            v-for="(section, index) in sections"
            :key="section.key"
          >
            <USeparator v-if="index > 0" />
            <section class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="font-semibold">
                    {{ section.title }}
                  </h3>
                  <p
                    v-if="section.description"
                    class="text-sm text-muted"
                  >
                    {{ section.description }}
                  </p>
                </div>
                <p class="flex items-center gap-2 text-sm text-muted">
                  {{ section.result.label }}
                  <span class="font-medium text-highlighted tabular-nums">
                    {{ section.result.value }}
                  </span>
                  <StatusBadge
                    v-if="section.result.level"
                    :scale="raRiskLevel"
                    :value="section.result.level"
                    size="sm"
                  />
                </p>
              </div>
              <template v-if="section.mitigation === 'before'">
                <UFormField
                  label="Existing mitigation measures"
                  :required="mitigationRequired"
                  :help="mitigationHelp"
                >
                  <UTextarea
                    v-model="active.mitigation"
                    :disabled="locked"
                    :rows="4"
                    :maxrows="12"
                    autoresize
                    class="w-full"
                  />
                </UFormField>
                <RaMitigationExamples :examples="formula.mitigation_examples" />
              </template>
              <div class="grid gap-4 sm:grid-cols-2">
                <RaRatingSelect
                  v-for="field in section.fields"
                  :key="field.key"
                  v-model="active[field.key]"
                  :label="field.label"
                  :guides="formula.guides[field.scale]"
                  :issue="fieldIssue(field.key)"
                  :disabled="locked"
                />
              </div>
              <template v-if="section.mitigation === 'after'">
                <UFormField
                  label="Existing mitigation measures"
                  :required="mitigationRequired"
                  :help="mitigationHelp"
                >
                  <UTextarea
                    v-model="active.mitigation"
                    :disabled="locked"
                    :rows="4"
                    :maxrows="12"
                    autoresize
                    class="w-full"
                  />
                </UFormField>
                <RaMitigationExamples :examples="formula.mitigation_examples" />
              </template>
            </section>
          </template>

          <USeparator v-if="singleRisk" />
          <section class="space-y-4">
            <div
              v-if="singleRisk && branchRisk"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <h3 class="font-semibold">
                Risk rating
              </h3>
              <p class="flex items-center gap-2 text-sm text-muted">
                {{ branchRisk.label }}
                <span class="font-medium text-highlighted tabular-nums">{{ branchRisk.value }}</span>
                <StatusBadge
                  v-if="branchRisk.level"
                  :scale="raRiskLevel"
                  :value="branchRisk.level"
                  size="sm"
                />
              </p>
            </div>
            <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <UFormField
                label="Action plan"
                :help="highResidual ? 'Optional. A high residual risk is followed up through CIM.' : 'Optional.'"
              >
                <UTextarea
                  v-model="active.action_plan"
                  :disabled="locked"
                  :rows="3"
                  autoresize
                  class="w-full"
                />
              </UFormField>
              <UFormField label="CIM ref. no.">
                <UInput
                  v-model="active.cim_ref_no"
                  :disabled="locked"
                  class="w-full"
                />
              </UFormField>
            </div>
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
            description="Check the ratings; mitigation normally lowers the risk."
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

    <div
      v-if="!locked"
      class="flex flex-wrap items-center justify-end gap-3"
    >
      <p class="text-sm text-muted">
        {{ changedCodes.length
          ? `${changedCodes.length} ${changedCodes.length === 1 ? 'hazard has' : 'hazards have'} unsaved changes`
          : 'All changes saved' }}
      </p>
      <UButton
        label="Save ratings"
        :disabled="!changedCodes.length"
        loading-auto
        @click="save"
      />
    </div>
  </div>
</template>
