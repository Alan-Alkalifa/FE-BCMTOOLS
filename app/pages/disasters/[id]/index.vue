<script setup lang="ts">
/** One disaster: its instructions per affected place and its history. */
definePageMeta({ permission: ['sites.access', 'ra.access', 'ra_branch.access'] })
</script>

<template>
  <RaCrisisPage type="disaster" />
</template>
