<script setup lang="ts">
/** New assessment moved under Manage. */
definePageMeta({
  // Forwards to another page: never an in-app tab (docs/tabs.md).
  tab: false,
  permission: 'scca.create',
  middleware: [() => navigateTo('/scca/manage/new', { replace: true })],
})
</script>

<template>
  <div />
</template>
