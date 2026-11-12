<script setup lang="ts">
const props = defineProps<{
  control: SccaRecoveryControl
  /** Read by screen readers (the field has no visible label of its own). */
  label: string
  modelValue: string
  /** Read-only (e.g. a CIMBN value set by the configured standard). */
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const value = computed({
  get: () => props.modelValue,
  set: (next: string) => emit('update:modelValue', next),
})

// Choices come from the SCCA's configuration version; the V4.2 lists are the fallback.
const config = useSccaConfigContext()
const LISTS: Partial<Record<SccaRecoveryControl, SccaListName>> = {
  hours: 'hours',
  rpo: 'rpo',
  ha: 'ha',
  instance: 'instance_type',
  drType: 'dr_type',
  drCapacity: 'dr_capacity',
}
const FALLBACK: Partial<Record<SccaRecoveryControl, readonly string[]>> = {
  rpo: SCCA_RPO_OPTIONS,
  ha: SCCA_HA_OPTIONS,
  instance: SCCA_INSTANCE_OPTIONS,
  drType: SCCA_DR_TYPE_OPTIONS,
  drCapacity: SCCA_DR_CAPACITY_OPTIONS,
}
const items = computed(() => {
  const list = LISTS[props.control]
  if (list && config.value) return sccaListOptions(config.value, list, props.modelValue)
  if (props.control === 'hours') return hourOptions(props.modelValue)
  return optionsWith(props.modelValue, FALLBACK[props.control] ?? []).map((option) => ({ label: option, value: option }))
})
</script>

<template>
  <USelect
    v-if="control in LISTS"
    v-model="value"
    :items="items"
    value-key="value"
    label-key="label"
    class="w-full"
    placeholder="—"
    :disabled="disabled"
    :aria-label="label"
  />
  <UInput
    v-else
    :model-value="modelValue"
    type="number"
    min="0"
    max="100"
    step="0.01"
    class="w-full"
    :disabled="disabled"
    :aria-label="label"
    @update:model-value="emit('update:modelValue', clampPercent($event))"
  />
</template>
