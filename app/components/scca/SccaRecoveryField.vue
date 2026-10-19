<script setup lang="ts">
const props = defineProps<{
  control: SccaRecoveryControl
  ariaLabel: string
  modelValue: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const value = computed({
  get: () => props.modelValue,
  set: (next: string) => emit('update:modelValue', next),
})
</script>

<template>
  <USelect
    v-if="control === 'hours'"
    v-model="value"
    :items="hourOptions(modelValue)"
    value-key="value"
    label-key="label"
    class="w-full"
    placeholder="—"
    :aria-label="ariaLabel"
  />
  <USelect
    v-else-if="control === 'rpo'"
    v-model="value"
    :items="optionsWith(modelValue, SCCA_RPO_OPTIONS)"
    class="w-full"
    placeholder="—"
    :aria-label="ariaLabel"
  />
  <USelect
    v-else-if="control === 'ha'"
    v-model="value"
    :items="optionsWith(modelValue, SCCA_HA_OPTIONS)"
    class="w-full"
    placeholder="—"
    :aria-label="ariaLabel"
  />
  <USelect
    v-else-if="control === 'instance'"
    v-model="value"
    :items="optionsWith(modelValue, SCCA_INSTANCE_OPTIONS)"
    class="w-full"
    placeholder="—"
    :aria-label="ariaLabel"
  />
  <USelect
    v-else-if="control === 'drType'"
    v-model="value"
    :items="optionsWith(modelValue, SCCA_DR_TYPE_OPTIONS)"
    class="w-full"
    placeholder="—"
    :aria-label="ariaLabel"
  />
  <USelect
    v-else-if="control === 'drCapacity'"
    v-model="value"
    :items="optionsWith(modelValue, SCCA_DR_CAPACITY_OPTIONS)"
    class="w-full"
    placeholder="—"
    :aria-label="ariaLabel"
  />
  <UInput
    v-else
    :model-value="modelValue"
    type="number"
    min="0"
    max="100"
    step="0.01"
    class="w-full"
    :aria-label="ariaLabel"
    @update:model-value="emit('update:modelValue', clampPercent($event))"
  />
</template>
