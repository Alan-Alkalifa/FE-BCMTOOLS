<script setup lang="ts">
/**
 * "12/255" under a text field: how many characters are used of the field's limit. Turns red at
 * the limit (the field's maxlength stops further typing).
 */
const props = defineProps<{ value?: string | null, max: number }>()
const used = computed(() => (props.value ?? '').length)
</script>

<template>
  <span
    class="tabular-nums"
    :class="used >= max ? 'font-medium text-error' : 'text-dimmed'"
    :aria-label="`${used} of ${max} characters`"
  >{{ used }}/{{ max }}</span>
</template>
