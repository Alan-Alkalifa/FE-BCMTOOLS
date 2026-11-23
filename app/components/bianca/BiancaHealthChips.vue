<script setup lang="ts">
import type { BiaAlertItem, BiaAlertKey } from '~/composables/useBiaWorkflow'

const props = withDefaults(defineProps<{
  alerts: BiaAlertItem[]
  maxVisible?: number
  size?: 'xs' | 'sm'
  escalationDays?: number
  inProgressCount?: number
}>(), {
  maxVisible: 4,
  size: 'sm',
  escalationDays: 5,
  inProgressCount: 0,
})

const meta: Record<BiaAlertKey, { label: string, color: 'error' | 'warning' | 'neutral', icon: string, unit: string }> = {
  overdue: { label: 'Overdue', color: 'error', icon: 'i-lucide-alert-circle', unit: 'overdue group' },
  returned: { label: 'Returned', color: 'error', icon: 'i-lucide-undo-2', unit: 'returned BIA' },
  stuck: { label: 'Stuck approval', color: 'error', icon: 'i-lucide-flame', unit: 'stuck approval' },
  due_soon: { label: 'Due soon', color: 'warning', icon: 'i-lucide-clock-alert', unit: 'group due within 30 days' },
  not_started: { label: 'Not started', color: 'neutral', icon: 'i-lucide-circle-dashed', unit: 'group with no BIA yet' },
}

const visible = computed(() => props.alerts.slice(0, props.maxVisible))
const hidden = computed(() => props.alerts.slice(props.maxVisible))

function tooltipText(item: BiaAlertItem) {
  const names = item.groups.slice(0, 3)
  const extra = item.groups.length - names.length
  const base = item.key === 'stuck'
    ? `${item.count} waiting ≥ ${props.escalationDays} working days`
    : `${item.count} ${meta[item.key].label.toLowerCase()}`
  if (!names.length) return base
  return `${base}: ${names.join(', ')}${extra > 0 ? `, +${extra} more` : ''}`
}

function ariaLabel(item: BiaAlertItem) {
  return `${item.count} ${meta[item.key].unit}${item.count === 1 ? '' : 's'}`
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <template v-if="alerts.length">
      <UTooltip
        v-for="item in visible"
        :key="item.key"
        :text="tooltipText(item)"
      >
        <UBadge
          :color="meta[item.key].color"
          variant="subtle"
          :size="size"
          :icon="meta[item.key].icon"
          :aria-label="ariaLabel(item)"
          :label="`${item.count} ${meta[item.key].label}`"
        />
      </UTooltip>
      <UTooltip
        v-if="hidden.length"
        :text="hidden.map((item) => tooltipText(item)).join(' · ')"
      >
        <UBadge
          color="neutral"
          variant="outline"
          :size="size"
          :label="`+${hidden.length} more`"
        />
      </UTooltip>
    </template>
    <UTooltip
      v-else-if="inProgressCount > 0"
      text="Initial BIA is currently in draft or approval — no overdue or stuck items."
    >
      <UBadge
        color="neutral"
        variant="subtle"
        :size="size"
        icon="i-lucide-clock"
        :aria-label="`${inProgressCount} initial BIA in progress`"
        :label="`${inProgressCount} In progress`"
      />
    </UTooltip>
    <UBadge
      v-else
      color="success"
      variant="subtle"
      :size="size"
      icon="i-lucide-circle-check"
      aria-label="All groups on track"
      label="All on track"
    />
  </div>
</template>
