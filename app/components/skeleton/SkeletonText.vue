<script setup lang="ts">
const props = withDefaults(defineProps<{ lines?: number, label?: string }>(), { lines: 3 })

const attrs = useSkeletonRoot(() => props.label)
</script>

<template>
  <div
    v-bind="attrs"
    class="space-y-2.5"
  >
    <div
      v-for="line in lines"
      :key="line"
      class="skeleton h-3.5"
      :class="line === lines && lines > 1 ? 'w-3/5' : 'w-full'"
    />
  </div>
</template>
