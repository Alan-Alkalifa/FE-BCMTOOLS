<script setup lang="ts">
definePageMeta({ permission: 'scca.create' })

useHead({ title: 'New assessment · BCM Tools' })

function onSaved(assessment: SccaAssessment) {
  return navigateTo({ path: sccaPath('manage', assessment.id), query: { tab: 'rating' } })
}
</script>

<template>
  <AppPage
    icon="i-lucide-file-plus"
    title="New assessment"
    :crumbs="[
      { label: 'SCCA' },
      { label: 'Manage', to: '/scca/manage' },
      { label: 'New assessment' },
    ]"
  >
    <SccaDetailsForm @saved="onSaved" />
  </AppPage>
</template>
