<script setup lang="ts">
/** The assessment list moved to Monitoring, Manage and Approval; old links land on Monitoring. */
definePageMeta({
  permission: 'ra_branch.access',
  redirect: (to) => ({ path: '/ra-branch/monitoring', query: to.query }),
})
</script>

<template>
  <div />
</template>
