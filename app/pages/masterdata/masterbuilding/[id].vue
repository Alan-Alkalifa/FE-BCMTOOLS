<script setup lang="ts">
/** A building's page is under Administration › Master building again (/admin/buildings/{id}). */
definePageMeta({
  redirect: (to) => ({ path: `/admin/buildings/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
