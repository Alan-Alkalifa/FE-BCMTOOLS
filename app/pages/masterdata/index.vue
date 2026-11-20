<script setup lang="ts">
/** Administration › Master data is gone: Master building is its own menu again. Old links open it. */
definePageMeta({ redirect: (to) => ({ path: '/admin/buildings', query: to.query }) })
</script>

<template>
  <div />
</template>
