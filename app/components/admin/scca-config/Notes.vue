<script setup lang="ts">
import type { SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/**
 * The workbook's notes under the questions, shown to the assessor as warnings (they never
 * block a save):
 * - follows: when a question has a rating, other questions should have it too;
 * - a3: the question follows the highest category of the applications on the Interdependencies tab
 *   with a dependency that counts for A3 (Lists > Dependency);
 * - i4: the question follows the number of interfaces (from counts for ratings 2–5).
 */
const props = defineProps<{ version: SccaConfigVersion }>()
const emit = defineEmits<{ saved: [version: SccaConfigVersion] }>()

const part = useConfigPart(
  computed(() => props.version),
  (value) => value.rating_notes,
  (code, notes) => sccaConfigApi.setNotes(code, notes),
  (saved) => emit('saved', saved),
  'Rating notes saved',
)
const { draft, error, busy, dirty, submit, reset } = part

const KINDS = [
  { label: 'Follows another rating', value: 'follows' },
  { label: 'A3 from the interdependencies', value: 'a3' },
  { label: 'I4 from the number of interfaces', value: 'i4' },
] as const
const questionItems = computed(() => props.version.questions.map((q) => ({ label: `${q.code} · ${q.component}`, value: q.code })))
const ratingItems = [5, 4, 3, 2, 1].map((value) => ({ label: String(value), value }))

function add() {
  draft.value.push({ kind: 'follows', params: { question: 'C1', rating: 5, then: [] } })
}

function changeKind(index: number, kind: SccaRatingNote['kind']) {
  const question = draft.value[index]!.params.question
  draft.value[index] = kind === 'follows'
    ? { kind, params: { question, rating: 5, then: [] } }
    : kind === 'a3'
      ? { kind, params: { question } }
      : { kind, params: { question, from: [10, 20, 30, 40] } }
}

function describe(note: SccaRatingNote) {
  if (note.kind === 'follows') {
    return `When ${note.params.question} is rated ${note.params.rating}, ${note.params.then.join(', ') || '…'} should be ${note.params.rating} too.`
  }
  if (note.kind === 'a3') return `${note.params.question} should be the highest category rating among the applications whose dependency counts for A3.`
  const [a, b, c, d] = note.params.from
  return `${note.params.question} should be 2 from ${a} interfaces, 3 from ${b}, 4 from ${c} and 5 from ${d}; 1 below.`
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="max-w-3xl text-sm text-muted">
        Shown as warnings next to the question on the Rating tab. They don't block saving, as in the workbook.
      </p>
      <div
        v-if="version.can.edit"
        class="flex gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add note"
          @click="add"
        />
        <UButton
          v-if="dirty"
          color="neutral"
          variant="outline"
          label="Undo changes"
          @click="reset"
        />
        <UButton
          icon="i-lucide-save"
          label="Save notes"
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
      title="Couldn't save the rating notes"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="error"
    />
    <p
      v-if="!draft.length"
      class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No rating notes. Add one to warn assessors about ratings that don't fit together.
    </p>
    <UCard
      v-for="(note, index) in draft"
      :key="index"
    >
      <fieldset
        :disabled="!version.can.edit"
        class="space-y-4"
      >
        <legend class="sr-only">
          Note {{ index + 1 }}
        </legend>
        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <UFormField label="Kind">
            <USelect
              :model-value="note.kind"
              :items="[...KINDS]"
              class="w-full"
              @update:model-value="changeKind(index, $event as SccaRatingNote['kind'])"
            />
          </UFormField>
          <UFormField label="Question">
            <USelect
              v-model="note.params.question"
              :items="questionItems"
              class="w-full"
            />
          </UFormField>
          <div class="flex items-end">
            <UButton
              v-if="version.can.edit"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              label="Remove"
              @click="draft.splice(index, 1)"
            />
          </div>
        </div>
        <div
          v-if="note.kind === 'follows'"
          class="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <UFormField label="When rated">
            <USelect
              v-model="note.params.rating"
              :items="ratingItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="These should follow">
            <USelectMenu
              v-model="note.params.then"
              :items="questionItems"
              value-key="value"
              multiple
              class="w-full"
            />
          </UFormField>
        </div>
        <div
          v-else-if="note.kind === 'i4'"
          class="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <UFormField
            v-for="(rating, position) in [2, 3, 4, 5]"
            :key="rating"
            :label="`Rating ${rating} from`"
            hint="interfaces"
          >
            <UInputNumber
              v-model="note.params.from[position]"
              :min="0"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="text-sm text-muted">
          {{ describe(note) }}
        </p>
      </fieldset>
    </UCard>
  </div>
</template>
