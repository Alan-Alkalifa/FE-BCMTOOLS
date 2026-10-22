<script setup lang="ts">
/** The crisis playbook is now the crisis guidebook, in the Locations menu: old links keep working. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: '/crises/guidebook', query: to.query }),
})
</script>

<template>
  <div />
</template>
