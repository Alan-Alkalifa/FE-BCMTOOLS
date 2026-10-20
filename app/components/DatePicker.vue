<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { useFormField } from '#ui/composables/useFormField'

/**
 * A date field that shows the date as "19 Okt 2026" and opens a calendar under it.
 * `min` and `max` limit the days that can be picked. Inside a <UFormField> it takes the
 * field's id (so the label names it) and tells the form when the value changes.
 */
const model = defineModel<CalendarDate | undefined>()

const props = withDefaults(defineProps<{
  min?: CalendarDate
  max?: CalendarDate
  disabled?: boolean
  placeholder?: string
}>(), {
  min: undefined,
  max: undefined,
  disabled: false,
  placeholder: 'Pick a date',
})

const { id, ariaAttrs, color, emitFormChange, emitFormBlur } = useFormField(props)

const open = ref(false)
const text = computed(() => (model.value ? formatDate(model.value.toString()) : null))

function pick(value: unknown) {
  model.value = (value ?? undefined) as CalendarDate | undefined
  open.value = false
  emitFormChange()
}

watch(open, (isOpen) => {
  if (!isOpen) emitFormBlur()
})
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'start', side: 'bottom', sideOffset: 6, collisionPadding: 12 }"
  >
    <UButton
      :id="id"
      v-bind="ariaAttrs"
      type="button"
      :color="color === 'error' ? 'error' : 'neutral'"
      variant="outline"
      block
      :disabled="props.disabled"
      trailing-icon="i-lucide-calendar"
      class="justify-between font-normal"
      :ui="{ label: text ? 'text-highlighted' : 'text-dimmed', trailingIcon: 'text-muted' }"
      :label="text ?? props.placeholder"
    />
    <template #content>
      <UCalendar
        :model-value="model"
        locale="id-ID"
        :week-starts-on="1"
        :min-value="props.min"
        :max-value="props.max"
        class="p-2"
        @update:model-value="pick"
      />
    </template>
  </UPopover>
</template>
