<script setup lang="ts">
import type { SccaAssessment, SccaFormula } from '~/composables/useScca'

const props = defineProps<{
  assessment: SccaAssessment
  formula: SccaFormula
}>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const form = useTemplateRef('form')
const dirty = useSccaDirty()
const livePreview = useSccaLivePreview()
const formError = ref<string | null>(null)
const snapshot = ref('')

interface AnswerState {
  rating: number | undefined
  justification: string
}

function fromAssessment(): Record<string, AnswerState> {
  const answers: Record<string, AnswerState> = {}
  for (const question of props.formula.questions) {
    const saved = props.assessment.answers.find((row) => row.code === question.code)
    answers[question.code] = {
      rating: saved?.rating,
      justification: saved?.justification ?? '',
    }
  }
  return answers
}

const state = reactive({ answers: fromAssessment() })
const dimension = ref<SccaDimension>('C')
const activeCode = ref(props.formula.questions[0]?.code ?? '')

const dimensionItems = [
  { label: 'C', value: 'C' },
  { label: 'I', value: 'I' },
  { label: 'A', value: 'A' },
  { label: 'PO-LOS', value: 'P' },
]

const questions = computed(() =>
  props.formula.questions.filter((question) => question.dimension === dimension.value),
)

const dimensionLabel = computed(() =>
  SCCA_DIMENSIONS.find((item) => item.key === dimension.value)?.label ?? '',
)

const activeQuestion = computed(() =>
  props.formula.questions.find((question) => question.code === activeCode.value) ?? questions.value[0] ?? null,
)

const activeOption = computed(() => {
  const question = activeQuestion.value
  if (!question) return null
  const rating = state.answers[question.code]?.rating
  return question.options.find((option) => option.rating === rating) ?? null
})

/** Every question shows the five levels; a level its configuration does not allow is shown
 * disabled, so a missing button never reads as a missing level. */
const LEVELS = [
  { rating: 5, name: 'Critical' },
  { rating: 4, name: 'High' },
  { rating: 3, name: 'Medium' },
  { rating: 2, name: 'Low' },
  { rating: 1, name: 'Insignificant' },
] as const

function levelsOf(question: { code: string, options: { rating: number, label: string }[] }) {
  return LEVELS.map((level) => {
    const option = question.options.find((item) => item.rating === level.rating)
    return {
      rating: level.rating,
      label: option ? ratingName(option.label) : level.name,
      allowed: Boolean(option),
      tooltip: option ? undefined : `Not a choice for ${question.code} in ${props.assessment.formula_version}`,
    }
  })
}

const justifiedCount = computed(() =>
  Object.values(state.answers).filter((answer) => answer.justification.trim() !== '').length,
)

function ratingName(label: string) {
  return label.replace(/^\d+\./, '')
}

/** Same figures as the workbook's SCC_Result: C, I, A and CIA with its level, then Potential Loss. */
const summary = computed(() => {
  const preview = livePreview?.value
  const scores = preview ? preview.result : props.assessment.result
  if (!scores || (scores.cia_score == null && scores.poloss_score == null)) return null
  return {
    c: scores.confidentiality_score,
    i: scores.integrity_score,
    a: scores.availability_score,
    cia: scores.cia_score,
    ciaLevel: sccaLevelLabel(scores.cia_level, 'CIA'),
    poloss: scores.poloss_score,
    polossLevel: sccaLevelLabel(scores.poloss_level, 'POLOSS'),
    category: preview?.result ? preview.result.category : props.assessment.result.final_category,
  }
})

/** The workbook's notes (V4.2: C1, A3 and I4; each configuration version has its own), shown
 * as warnings next to the question. */
const config = useSccaConfigContext()
const noteWarnings = computed(() => {
  const current: Record<string, number | undefined> = {}
  for (const [code, answer] of Object.entries(state.answers)) current[code] = answer.rating
  const byCode: Record<string, string[]> = {}
  for (const warning of ratingNoteWarnings(current, props.assessment.interdependencies, config.value)) {
    (byCode[warning.code] ??= []).push(warning.message)
  }
  return byCode
})

function choose(code: string, rating: number) {
  const answer = state.answers[code]
  if (!answer) return
  answer.rating = rating
  activeCode.value = code
}

watch(dimension, () => {
  const first = questions.value[0]
  if (first) activeCode.value = first.code
})

const ratedCount = computed(() =>
  Object.values(state.answers).filter((answer) => answer.rating != null).length,
)

const ratings = computed(() => {
  const next: Record<string, number> = {}
  for (const [code, answer] of Object.entries(state.answers)) {
    if (answer.rating != null) next[code] = answer.rating
  }
  return next
})

function reset() {
  state.answers = fromAssessment()
  snapshot.value = JSON.stringify(state.answers)
  if (dirty) dirty.value = false
}

watch(() => props.assessment, reset)
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state.answers) !== snapshot.value
}, { deep: true })
onMounted(reset)

let timer: ReturnType<typeof setTimeout> | undefined
watch(ratings, (value) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (!livePreview) return
    try {
      livePreview.value = await sccaApi.calculate(value, props.assessment.formula_version)
    } catch {
      livePreview.value = { result: null, missing: props.formula.questions.map((q) => q.code) }
    }
  }, 400)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

// The Save button sits in the page's top bar and submits this form by its id
// (`<button form="scca-form-…">`); `saving` drives its spinner.
const saving = useSccaSaving()

async function onSubmit() {
  formError.value = null
  if (saving) saving.value = true
  const answers = Object.entries(state.answers)
    .filter(([, answer]) => answer.rating != null)
    .map(([code, answer]) => ({
      code,
      rating: answer.rating!,
      justification: answer.justification.trim() || null,
    }))
  try {
    const saved = await sccaApi.setAnswers(props.assessment.id, answers)
    emit('saved', saved)
    nextTick(reset)
    toast.add({ title: 'Ratings saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    form.value?.setErrors(apiFieldErrors(error))
    formError.value = apiErrorText(error)
  } finally {
    if (saving) saving.value = false
  }
}
</script>

<template>
  <UForm
    id="scca-form-rating"
    ref="form"
    :state="state"
    @submit="onSubmit"
  >
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="min-w-0 space-y-6">
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't save the ratings"
          :ui="{ description: 'whitespace-pre-line' }"
          :description="formError"
        />

        <UTabs
          v-model="dimension"
          :items="dimensionItems"
          :content="false"
          variant="pill"
          :ui="{ list: 'w-full' }"
        />

        <p class="text-sm text-muted">
          {{ formatNumber(ratedCount, 0) }} of {{ formatNumber(formula.questions.length, 0) }} rated ·
          {{ formatNumber(justifiedCount, 0) }} of {{ formatNumber(formula.questions.length, 0) }} justified.
        </p>

        <div class="space-y-8">
          <h2 class="text-lg font-semibold">
            {{ dimensionLabel }}
          </h2>
          <div
            v-for="question in questions"
            :key="question.code"
            class="space-y-3 rounded-lg p-3"
            :class="activeQuestion?.code === question.code ? 'ring-1 ring-primary' : ''"
            @click="activeCode = question.code"
          >
            <div>
              <p class="font-medium">
                {{ question.code }} · {{ question.label }}
              </p>
              <p class="mt-1 text-sm text-muted whitespace-pre-line">
                {{ question.question.trim() }}
              </p>
            </div>
            <UFormField
              :name="`answers.${question.code}`"
              :label="`Rating for ${question.code}`"
            >
              <div class="flex flex-wrap gap-2">
                <UTooltip
                  v-for="level in levelsOf(question)"
                  :key="level.rating"
                  :text="level.tooltip"
                  :disabled="level.allowed"
                >
                  <UButton
                    type="button"
                    :label="level.label"
                    :disabled="!level.allowed"
                    :color="state.answers[question.code]!.rating === level.rating ? 'primary' : 'neutral'"
                    :variant="state.answers[question.code]!.rating === level.rating ? 'solid' : 'outline'"
                    :aria-pressed="state.answers[question.code]!.rating === level.rating"
                    :class="level.allowed ? '' : 'line-through decoration-1'"
                    @click="choose(question.code, level.rating)"
                  />
                </UTooltip>
              </div>
              <p
                v-for="message in noteWarnings[question.code] ?? []"
                :key="message"
                class="mt-2 flex items-start gap-1.5 text-sm text-warning"
              >
                <UIcon
                  name="i-lucide-triangle-alert"
                  class="mt-0.5 size-4 shrink-0"
                />
                {{ message }}
              </p>
            </UFormField>
            <UFormField
              :name="`justification.${question.code}`"
              label="Justification"
              required
              :error="state.answers[question.code]!.rating != null && !state.answers[question.code]!.justification.trim() ? 'Explain why this rating (needed to submit).' : undefined"
            >
              <template #hint>
                <FieldCount
                  :value="state.answers[question.code]!.justification"
                  :max="TEXT_LIMITS.long"
                />
              </template>
              <UTextarea
                v-model="state.answers[question.code]!.justification"
                :maxlength="TEXT_LIMITS.long"
                class="w-full"
                :rows="2"
              />
            </UFormField>
          </div>
        </div>
      </div>

      <div class="space-y-6 lg:sticky lg:top-6">
        <SccaScoreSummary :summary="summary" />

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Guidance
            </h2>
          </template>
          <div
            v-if="activeQuestion"
            class="max-h-96 space-y-4 overflow-y-auto"
          >
            <div
              v-for="option in activeQuestion.options"
              :key="option.rating"
              class="space-y-1"
              :class="activeOption?.rating === option.rating ? 'rounded-md p-3 ring-1 ring-primary' : ''"
            >
              <p class="font-medium">
                {{ ratingName(option.label) }}
              </p>
              <p class="text-sm whitespace-pre-line">
                {{ option.guidance || 'No guidance is written for this rating.' }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UForm>
</template>
