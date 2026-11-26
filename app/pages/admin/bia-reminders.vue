<script setup lang="ts">
/**
 * The old address of BIA reminders and escalation. The rules now live in Administration > BIA
 * configuration > Reminders and escalation (a submenu and a tab of that page); old links and
 * bookmarks land there.
 */
definePageMeta({
  permission: 'bianca.approval.manage',
  tab: false,
  middleware: () => navigateTo('/admin/bianca-config?tab=reminders', { replace: true }),
})
</script>

<template>
  <div />
</template>
