<script setup lang="ts">
import type { RaGuide } from '~/composables/useRa'

const model = defineModel<RaRatingValue>({ required: true })

const props = defineProps<{
  label: string
  guides: RaGuide[]
  issue?: string
  disabled?: boolean
}>()

const NONE = '__none__'

const items = computed(() => [
  { label: 'Not rated yet', value: NONE },
  { label: 'N/A · Not applicable', value: 'N/A' },
  ...props.guides.map((guide) => ({
    label: guide.label ? `${guide.rating} · ${guide.label}` : String(guide.rating),
    value: String(guide.rating),
  })),
])

/** USelect can't hold null, so "not rated" is a sentinel item. */
const selected = computed({
  get: () => (model.value === null || model.value === undefined ? NONE : String(model.value)),
  set: (value: string) => {
    if (value === NONE) model.value = null
    else if (value === 'N/A') model.value = 'N/A'
    else model.value = Number(value) as RaRatingValue
  },
})

const guidance = computed(() =>
  typeof model.value === 'number' ? props.guides.find((guide) => guide.rating === model.value)?.guidance : undefined,
)
</script>

<template>
  <UFormField
    :label="label"
    :help="guidance"
  >
    <USelect
      v-model="selected"
      :items="items"
      :disabled="disabled"
      class="w-full"
    />
    <template
      v-if="issue && !guidance"
      #help
    >
      <span class="inline-flex items-center gap-1 text-warning">
        <UIcon
          name="i-lucide-triangle-alert"
          class="size-3.5 shrink-0"
        />
        {{ issue }}
      </span>
    </template>
  </UFormField>
</template>
