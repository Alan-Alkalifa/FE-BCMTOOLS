<script setup lang="ts">
import type { BiancaLocationLabels, BiancaLocationMode, BiancaPlace } from '~/composables/useBianca'

const mode = defineModel<BiancaLocationMode>('mode')
const site = defineModel<number>('site')
const floor = defineModel<string>('floor')
const props = defineProps<{
  label: string
  note: 'main_location' | 'alt_location'
  labels: BiancaLocationLabels
  selected?: BiancaPlace | null
  disabled?: boolean
  buildingError?: string
  floorError?: string
}>()
const emit = defineEmits<{ change: [], place: [label: string | null] }>()
const picked = ref<{ id: number, address?: string | null } | null>(null)
const address = computed(() => [picked.value, props.selected].find((row) => row?.id === site.value)?.address)
const modes = computed<{ label: string, value: 'building' | BiancaLocationMode }[]>(() => [
  { label: 'Building / office', value: 'building' },
  { label: props.labels.work_from_home, value: 'work_from_home' },
  { label: props.labels.hyspace, value: 'hyspace' },
])

function setMode(value: 'building' | BiancaLocationMode) {
  mode.value = value === 'building' ? undefined : value
  if (value === 'work_from_home') clearSite()
  emit('change')
}

/** The floor is a whole number from 1: a 0 can't be typed. */
function setFloor(value: string | number | null | undefined) {
  floor.value = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '')
}
function blockNonDigits(event: KeyboardEvent) {
  if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault()
}

function clearSite() {
  site.value = undefined
  floor.value = undefined
  picked.value = null
  emit('change')
}
</script>

<template>
  <div class="space-y-3">
    <BiancaField
      :label="label"
      :note="note"
    >
      <USelect
        :model-value="mode ?? 'building'"
        :items="modes"
        :disabled="disabled"
        :aria-label="`${label} type`"
        class="w-full"
        @update:model-value="setMode"
      />
    </BiancaField>
    <p
      v-if="mode === 'work_from_home'"
      class="text-sm text-muted"
    >
      Address and floor are not applicable.
    </p>
    <template v-else>
      <UFormField
        :label="mode === 'hyspace' ? `${label} site (optional)` : `${label} building`"
        :required="!mode"
        :error="buildingError"
        :data-missing="!!buildingError"
      >
        <div class="flex items-center gap-2">
          <BiancaPicker
            v-model="site"
            kind="locations"
            :selected="selected?.id === site ? selected : null"
            :aria-label="mode === 'hyspace' ? `${label} site` : `${label} building`"
            :disabled="disabled"
            @pick="picked = $event; floor = undefined; emit('place', ($event as { label?: string } | null)?.label ?? null); emit('change')"
          />
          <UButton
            v-if="mode === 'hyspace' && site && !disabled"
            label="Clear site"
            color="neutral"
            variant="ghost"
            @click="clearSite"
          />
        </div>
      </UFormField>
      <p
        v-if="mode === 'hyspace' && site == null"
        class="text-sm text-muted"
      >
        Site not specified
      </p>
      <p
        v-if="address"
        class="text-sm text-muted"
      >
        {{ address }}
      </p>
      <UFormField
        v-if="!mode || site != null"
        :label="`${label} floor`"
        :required="!mode"
        :error="floorError"
        :data-missing="!!floorError"
      >
        <UInput
          :model-value="floor"
          type="number"
          inputmode="numeric"
          min="1"
          placeholder="E.g. 12"
          step="1"
          :disabled="disabled"
          class="w-full"
          :ui="{ base: 'tabular-nums' }"
          :aria-label="`${label} floor`"
          @update:model-value="setFloor"
          @keydown="blockNonDigits"
        />
      </UFormField>
    </template>
    <slot />
  </div>
</template>
