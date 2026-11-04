<script setup lang="ts">
/** New assessment moved under Manage: old links keep working. */
definePageMeta({
  permission: 'ra.edit',
  redirect: (to) => ({ path: '/ra/manage/new', query: to.query }),
})
</script>

<template>
  <div />
</template>
