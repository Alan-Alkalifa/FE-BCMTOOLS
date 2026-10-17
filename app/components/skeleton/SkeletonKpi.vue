<script setup lang="ts">
const props = defineProps<{ label?: string }>()

const attrs = useSkeletonRoot(() => props.label)
</script>

<template>
  <UCard v-bind="attrs">
    <div class="skeleton h-3.5 w-28" />
    <div class="skeleton mt-3 h-8 w-20" />
    <div class="skeleton mt-3 h-3 w-36" />
  </UCard>
</template>
