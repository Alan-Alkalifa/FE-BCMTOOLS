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

const meta: Record<BiaAlertKey, {
  label: string
  kind: 'badge' | 'inline'
  color: 'error' | 'warning' | 'neutral'
  variant?: 'solid' | 'subtle' | 'soft'
  icon: string
  unit: string
}> = {
  overdue: { label: 'Overdue', kind: 'badge', color: 'error', variant: 'solid', icon: 'i-lucide-alert-circle', unit: 'overdue group' },
  returned: { label: 'Returned', kind: 'badge', color: 'error', variant: 'subtle', icon: 'i-lucide-undo-2', unit: 'returned BIA' },
  stuck: { label: 'Stuck approval', kind: 'badge', color: 'warning', variant: 'soft', icon: 'i-lucide-clock', unit: 'stuck approval' },
  due_soon: { label: 'Due soon', kind: 'inline', color: 'neutral', icon: 'i-lucide-calendar-clock', unit: 'group due within 30 days' },
  not_started: { label: 'Not started', kind: 'inline', color: 'neutral', icon: 'i-lucide-circle-dashed', unit: 'group with no BIA yet' },
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
  <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
    <template v-if="alerts.length">
      <UTooltip
        v-for="item in visible"
        :key="item.key"
        :text="tooltipText(item)"
      >
        <UBadge
          v-if="meta[item.key].kind === 'badge'"
          :color="meta[item.key].color"
          :variant="meta[item.key].variant"
          :size="size"
          :icon="meta[item.key].icon"
          :aria-label="ariaLabel(item)"
          :label="`${item.count} ${meta[item.key].label}`"
        />
        <span
          v-else
          class="inline-flex items-center gap-1 text-xs text-muted tabular-nums"
          :aria-label="ariaLabel(item)"
        >
          <UIcon
            :name="meta[item.key].icon"
            class="size-3.5 text-dimmed"
          />
          <span>{{ item.count }} {{ meta[item.key].label.toLowerCase() }}</span>
        </span>
      </UTooltip>
      <UTooltip
        v-if="hidden.length"
        :text="hidden.map((item) => tooltipText(item)).join(' · ')"
      >
        <span class="text-xs text-muted">+{{ hidden.length }} more</span>
      </UTooltip>
    </template>
    <UTooltip
      v-else-if="inProgressCount > 0"
      text="Initial BIA is currently in draft or approval — no overdue or stuck items."
    >
      <span
        class="inline-flex items-center gap-1 text-xs text-muted tabular-nums"
        :aria-label="`${inProgressCount} initial BIA in progress`"
      >
        <UIcon
          name="i-lucide-clock"
          class="size-3.5 text-dimmed"
        />
        <span>{{ inProgressCount }} in progress</span>
      </span>
    </UTooltip>
    <span
      v-else
      class="inline-flex items-center gap-1 text-xs font-medium text-success"
      aria-label="All groups on track"
    >
      <UIcon
        name="i-lucide-circle-check"
        class="size-3.5"
      />
      <span>On track</span>
    </span>
  </div>
</template>
