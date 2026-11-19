<script setup lang="ts">
/** The SCCA list moved to three menus; old links (and bookmarks) land on the right one. */
definePageMeta({
  // Forwards to another page: never an in-app tab (docs/tabs.md).
  tab: false,
  permission: 'scca.access',
  middleware: [
    (to) => {
      if (to.query.view === 'waiting') return navigateTo('/scca/approval', { replace: true })
      const { view: _view, ...rest } = to.query
      return navigateTo({ path: '/scca/manage', query: rest }, { replace: true })
    },
  ],
})
</script>

<template>
  <div />
</template>
