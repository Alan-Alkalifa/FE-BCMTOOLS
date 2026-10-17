<script setup lang="ts">
const props = defineProps<{ label?: string }>()

const attrs = useSkeletonRoot(() => props.label)
provideSkeletonGroup()
</script>

<template>
  <div v-bind="attrs">
    <span
      v-if="attrs.role"
      class="sr-only"
    >{{ attrs['aria-label'] }}…</span>
    <slot />
  </div>
</template>
