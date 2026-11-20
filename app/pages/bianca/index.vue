<script setup lang="ts">
/** BIANCA opens on Manage (Monitoring and Approval are their own pages). */
definePageMeta({
  // Forwards to another page: never an in-app tab (docs/tabs.md).
  tab: false,
  permission: 'bianca.access',
  middleware: [() => navigateTo('/bianca/manage', { replace: true })],
})
</script>

<template>
  <div />
</template>
