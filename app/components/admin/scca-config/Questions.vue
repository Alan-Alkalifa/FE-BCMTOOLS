<script setup lang="ts">
import type { SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/**
 * The 18 questions and their guides (Indonesian), by dimension. The codes are fixed (the
 * weights refer to them); the texts change, and so do the ratings a question allows and each
 * rating's label and guide.
 */
const props = defineProps<{ version: SccaConfigVersion }>()
const emit = defineEmits<{ saved: [version: SccaConfigVersion] }>()

const RATINGS = [5, 4, 3, 2, 1]
const DEFAULT_LABELS: Record<number, string> = { 5: 'Critical', 4: 'High', 3: 'Medium', 2: 'Low', 1: 'Insignificant' }

const dimension = ref<'C' | 'I' | 'A' | 'P'>('C')
const dimensionItems = SCCA_DIMENSIONS.map((item) => ({ label: `${item.key} · ${item.label}`, value: item.key }))

const part = useConfigPart(
  computed(() => props.version),
  (value) => value.questions.map((q) => ({
    code: q.code,
    dimension: q.dimension,
    component: q.component,
    label: q.label,
    question: q.question,
    options: q.options,
  })),
  (code, questions) => sccaConfigApi.setQuestions(code, questions.map((q) => ({
    code: q.code,
    component: q.component,
    label: q.label,
    question: q.question,
    options: q.options.map((o) => ({ rating: o.rating, label: o.label, guidance: o.guidance?.trim() || null })),
  }) as SccaConfigQuestion)),
  (saved) => emit('saved', saved),
  'Questions and guides saved',
)
const { draft, error, busy, dirty, submit, reset } = part

const shown = computed(() => draft.value.filter((q) => q.dimension === dimension.value))

function option(question: SccaConfigQuestion, rating: number) {
  return question.options.find((item) => item.rating === rating)
}

function toggle(question: SccaConfigQuestion, rating: number, on: boolean | 'indeterminate') {
  if (on === true && !option(question, rating)) {
    question.options.push({ rating, label: DEFAULT_LABELS[rating]!, guidance: '' })
    question.options.sort((a, b) => b.rating - a.rating)
  } else if (on !== true) {
    question.options = question.options.filter((item) => item.rating !== rating)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UTabs
        v-model="dimension"
        :items="dimensionItems"
        :content="false"
        size="sm"
      />
      <div
        v-if="version.can.edit"
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
          label="Save questions"
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
      title="Couldn't save the questions"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="error"
    />
    <UCard
      v-for="question in shown"
      :key="question.code"
    >
      <template #header>
        <h2 class="font-semibold text-highlighted">
          {{ question.code }} · {{ question.component }}
        </h2>
      </template>
      <fieldset
        :disabled="!version.can.edit"
        class="space-y-4"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Component"
            required
          >
            <UInput
              v-model="question.component"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Label"
            required
          >
            <UInput
              v-model="question.label"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Question"
          required
        >
          <UTextarea
            v-model="question.question"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <caption class="sr-only">
              {{ question.code }} ratings and guides
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="w-24 px-3 py-2">
                  Rating
                </th>
                <th class="w-40 px-3 py-2">
                  Label
                </th>
                <th class="px-3 py-2">
                  Guide (Bahasa Indonesia)
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="rating in RATINGS"
                :key="rating"
              >
                <td class="px-3 py-2 align-top">
                  <UCheckbox
                    :model-value="!!option(question, rating)"
                    :label="String(rating)"
                    :aria-label="`${question.code} allows rating ${rating}`"
                    @update:model-value="toggle(question, rating, $event)"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    v-if="option(question, rating)"
                    v-model="option(question, rating)!.label"
                    class="w-full"
                    :aria-label="`${question.code} rating ${rating} label`"
                  />
                  <span
                    v-else
                    class="text-muted"
                  >Not allowed</span>
                </td>
                <td class="px-3 py-2 align-top">
                  <UTextarea
                    v-if="option(question, rating)"
                    :model-value="option(question, rating)!.guidance ?? ''"
                    :rows="2"
                    autoresize
                    class="w-full"
                    :aria-label="`${question.code} rating ${rating} guide`"
                    @update:model-value="option(question, rating)!.guidance = String($event)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>
    </UCard>
  </div>
</template>
