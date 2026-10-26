<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * One number with its label, as on Monitoring > Overview. A link when `to` is set; `active`
 * marks the card whose filter is applied.
 */
const props = withDefaults(defineProps<{
  label: string
  value?: number | null
  hint?: string
  icon?: string
  tone?: 'neutral' | 'warning' | 'error' | 'info'
  to?: RouteLocationRaw
  active?: boolean
}>(), { value: null, hint: undefined, icon: undefined, tone: 'neutral', to: undefined, active: false })

const valueClass = computed(() => {
  if (!props.value) return 'text-highlighted'
  return { error: 'text-error', warning: 'text-warning', info: 'text-info', neutral: 'text-highlighted' }[props.tone]
})
</script>

<template>
  <ULink
    :to="to"
    :aria-current="active ? 'true' : undefined"
    :aria-label="`${label}: ${value ?? 'loading'}`"
    class="group block rounded-lg border bg-default p-4 transition hover:border-accented hover:bg-elevated/40"
    :class="active ? 'border-primary ring-1 ring-primary' : 'border-default'"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm text-muted">
          {{ label }}
        </p>
        <p
          class="mt-1 text-3xl font-semibold tabular-nums"
          :class="valueClass"
        >
          {{ value ?? '—' }}
        </p>
        <p
          v-if="hint"
          class="mt-1 text-xs text-muted"
        >
          {{ hint }}
        </p>
      </div>
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-5 text-dimmed group-hover:text-muted"
      />
    </div>
  </ULink>
</template>
