<script setup lang="ts">
definePageMeta({
  // Forwards to another page: never an in-app tab (docs/tabs.md).
  tab: false, permission: 'ra_branch.access' })
</script>

<template>
  <RaResolve />
</template>
