<script setup lang="ts">
/** The disaster playbook is now the disaster guidebook, in the Locations menu: old links keep working. */
definePageMeta({
  permission: ['ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/disasters/guidebook', query: to.query }),
})
</script>

<template>
  <div />
</template>
