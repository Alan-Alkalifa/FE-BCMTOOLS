<script setup lang="ts">
// Import from Excel is a dialog on RA HO and RA Branch › Manage now: old links open it there.
const route = useRoute()
const kind: RaKind = route.query.kind === 'branch' || route.query.import === 'branch' ? 'branch' : 'head_office'
await navigateTo({ path: raPath(kind, 'manage'), query: { import: '1' } }, { replace: true })
</script>

<template>
  <div />
</template>
