<script setup lang="ts">
import type { OrganizationPath, UnitLevel } from '~/utils/bianca-organization'

/** One level of a change, previous or current (organizationPathColumns). As SCCA shows a
 * before and after: the previous value muted, the current one in full; a value the change
 * touches is a chip, like SCCA's reassignment. */
const props = defineProps<{
  change: { level: UnitLevel, previous: OrganizationPath, current: OrganizationPath }
  field: UnitLevel
  side: 'previous' | 'current'
}>()

const value = computed(() => (props.change[props.side][props.field] ?? '').trim())
/** The value the change touches. For a new or closed unit only its own level: the levels
 * above it are where it is, not part of the change. */
const changed = computed(() => {
  const before = (props.change.previous[props.field] ?? '').trim().toLowerCase()
  const after = (props.change.current[props.field] ?? '').trim().toLowerCase()
  if (before === after) return false
  return (before && after) || props.field === props.change.level
})
</script>

<template>
  <span
    v-if="!value"
    class="text-dimmed"
  >—</span>
  <span
    v-else-if="changed"
    class="inline-block whitespace-normal rounded bg-elevated px-1.5 py-0.5"
    :class="side === 'current' ? 'font-medium text-highlighted' : 'text-muted'"
  >{{ value }}</span>
  <span
    v-else
    class="whitespace-normal"
    :class="side === 'current' ? '' : 'text-muted'"
  >{{ value }}</span>
</template>
