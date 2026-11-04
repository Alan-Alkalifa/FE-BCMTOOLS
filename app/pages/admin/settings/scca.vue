<script setup lang="ts">
/** The SCCA settings moved to Administration > SCCA configuration > Reminders and escalation.
 * Old links and bookmarks are redirected by the router, before this page would render. */
definePageMeta({
  redirect: { path: '/admin/scca-config', query: { tab: 'reminders' } },
})
</script>

<template>
  <div />
</template>
