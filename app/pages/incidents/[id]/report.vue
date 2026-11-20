<script setup lang="ts">
/** A incident's print view. */
definePageMeta({ permission: ['sites.access', 'ra.access', 'ra_branch.access'] })
</script>

<template>
  <RaCrisisReportPage type="incident" />
</template>
