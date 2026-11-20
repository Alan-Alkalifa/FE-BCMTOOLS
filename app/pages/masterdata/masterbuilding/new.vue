<script setup lang="ts">
/** Input building data is under Administration › Master building again (/admin/buildings/new). */
definePageMeta({ redirect: (to) => ({ path: '/admin/buildings/new', query: to.query }) })
</script>

<template>
  <div />
</template>
