<script setup lang="ts">
/** The crisis playbook is now the crisis guidebook: old links keep working. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: '/ra/guidebook', query: to.query }),
})
</script>

<template>
  <div />
</template>
