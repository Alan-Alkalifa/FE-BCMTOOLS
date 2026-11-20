<script setup lang="ts">
/** A disaster's print view. */
definePageMeta({ permission: ['sites.access', 'ra.access', 'ra_branch.access'] })
</script>

<template>
  <RaCrisisReportPage type="disaster" />
</template>
