<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
</script>

<template>
  <NuxtLink
    to="/"
    class="flex items-center gap-2.5 min-w-0"
    aria-label="BCM Tools home"
  >
    <img
      src="/cimb-niaga-logo.svg"
      alt="CIMB Niaga"
      class="size-8 shrink-0 rounded-sm"
    >
    <span
      v-if="!collapsed"
      class="flex flex-col leading-tight truncate"
    >
      <span class="text-sm font-semibold text-highlighted">BCM Tools</span>
      <span class="text-xs text-muted">CIMB Niaga</span>
    </span>
  </NuxtLink>
</template>
