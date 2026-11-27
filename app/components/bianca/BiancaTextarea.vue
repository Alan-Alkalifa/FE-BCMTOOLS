<script setup lang="ts">
/**
 * A free-text box of the BIA form: at most 500 characters (BCM's limit for the BIA's texts), with
 * how many are used under it.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string | null | undefined>()
const props = withDefaults(defineProps<{ maxlength?: number, disabled?: boolean }>(), { maxlength: TEXT_LIMITS.bia })
const used = computed(() => model.value?.length ?? 0)
</script>

<template>
  <div class="w-full">
    <UTextarea
      :model-value="model ?? undefined"
      v-bind="$attrs"
      :maxlength="props.maxlength"
      :disabled="props.disabled"
      class="w-full"
      @update:model-value="model = $event"
    />
    <p
      v-if="!props.disabled"
      class="mt-1 text-right text-xs tabular-nums"
      :class="used >= props.maxlength ? 'text-warning' : 'text-dimmed'"
      aria-live="polite"
    >
      {{ used }}/{{ props.maxlength }} characters
    </p>
  </div>
</template>
