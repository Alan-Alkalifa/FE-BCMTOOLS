<script setup lang="ts">
// Import from Excel is a dialog on Buildings now: old links open it there.
definePageMeta({ permission: ['ra.edit', 'ra_branch.edit'] })
const route = useRoute()
await navigateTo({ path: LOCATIONS_PATH, query: { ...route.query, import: route.query.kind === 'branch' ? 'branch' : 'head_office' } }, { replace: true })
</script>

<template>
  <div />
</template>
