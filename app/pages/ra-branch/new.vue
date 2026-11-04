<script setup lang="ts">
/** New assessment moved under Manage: old links keep working. */
definePageMeta({
  permission: 'ra_branch.edit',
  redirect: (to) => ({ path: '/ra-branch/manage/new', query: to.query }),
})
</script>

<template>
  <div />
</template>
