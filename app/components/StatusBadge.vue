<script setup lang="ts" generic="K extends string">
import type { StatusScale } from '~/utils/status'

const props = defineProps<{
  scale: StatusScale<K>
  value: K | null | undefined
  size?: 'sm' | 'md' | 'lg'
}>()

const status = computed(() => (props.value ? props.scale[props.value] : undefined))
</script>

<template>
  <UBadge
    v-if="status"
    :label="status.label"
    :color="status.color"
    :icon="status.icon"
    :size="size ?? 'md'"
    variant="subtle"
  />
  <UBadge
    v-else
    label="Unknown"
    color="neutral"
    icon="i-lucide-circle-help"
    :size="size ?? 'md'"
    variant="outline"
  />
</template>
