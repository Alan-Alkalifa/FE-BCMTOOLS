<script setup lang="ts">
// Import from Excel is a dialog on Master building now: old links open it there.
definePageMeta({ permission: 'location.master' })
const route = useRoute()
await navigateTo({ path: MASTER_BUILDINGS_PATH, query: { ...route.query, import: route.query.kind === 'branch' ? 'branch' : 'head_office' } }, { replace: true })
</script>

<template>
  <div />
</template>
