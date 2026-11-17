<script setup lang="ts">
/** BIANCA opens on Manage (Monitoring and Approval are their own pages). */
definePageMeta({
  permission: 'bianca.access',
  middleware: [() => navigateTo('/bianca/manage', { replace: true })],
})
</script>

<template>
  <div />
</template>
