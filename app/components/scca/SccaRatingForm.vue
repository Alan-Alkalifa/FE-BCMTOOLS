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

function ratingName(label: string) {
  return label.replace(/^\d+\./, '')
}

function percent(value: number | null | undefined) {
  return formatPercent(value, 0) ?? '—'
}

const summary = computed(() => {
  const preview = livePreview?.value
  if (preview) {
    return preview.result
      ? { cia: preview.result.cia_score, poloss: preview.result.poloss_score, category: preview.result.category }
      : null
  }
  const saved = props.assessment.result
  if (saved.cia_score == null && saved.poloss_score == null && !saved.final_category) return null
  return { cia: saved.cia_score, poloss: saved.poloss_score, category: saved.final_category }
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
      livePreview.value = await sccaApi.calculate(value)
    } catch {
      livePreview.value = { result: null, missing: props.formula.questions.map((q) => q.code) }
    }
  }, 400)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

async function onSubmit() {
  formError.value = null
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
    formError.value = apiErrorMessage(error)
  }
}
</script>

<template>
  <UForm
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
          {{ formatNumber(ratedCount, 0) }} of {{ formatNumber(formula.questions.length, 0) }} rated.
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
              <p class="mt-1 text-sm text-muted">
                {{ question.question }}
              </p>
            </div>
            <UFormField
              :name="`answers.${question.code}`"
              :label="`Rating for ${question.code}`"
            >
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="option in question.options"
                  :key="option.rating"
                  type="button"
                  :label="ratingName(option.label)"
                  :color="state.answers[question.code]!.rating === option.rating ? 'primary' : 'neutral'"
                  :variant="state.answers[question.code]!.rating === option.rating ? 'solid' : 'outline'"
                  :aria-pressed="state.answers[question.code]!.rating === option.rating"
                  @click="choose(question.code, option.rating)"
                />
              </div>
            </UFormField>
            <UFormField
              :name="`justification.${question.code}`"
              label="Justification"
            >
              <UTextarea
                v-model="state.answers[question.code]!.justification"
                class="w-full"
                :rows="2"
              />
            </UFormField>
          </div>
        </div>

        <div class="flex justify-end">
          <UButton
            type="submit"
            label="Save ratings"
            loading-auto
          />
        </div>
      </div>

      <div class="space-y-6 lg:sticky lg:top-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Summary
            </h2>
          </template>
          <dl class="space-y-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">
                CIA
              </dt>
              <dd class="font-medium tabular-nums">
                {{ percent(summary?.cia) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">
                PO-LOSS
              </dt>
              <dd class="font-medium tabular-nums">
                {{ percent(summary?.poloss) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">
                Category
              </dt>
              <dd>
                <StatusBadge
                  v-if="summary?.category"
                  :scale="sccaCategory"
                  :value="summary.category"
                  size="sm"
                />
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </dd>
            </div>
          </dl>
        </UCard>

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
              <p class="text-sm">
                {{ option.guidance || 'No guidance is written for this rating.' }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UForm>
</template>
