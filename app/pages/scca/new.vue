<script setup lang="ts">
useHead({ title: 'New assessment · BCM Tools' })

function onSaved(assessment: SccaAssessment) {
  return navigateTo(`/scca/${assessment.id}?tab=rating`)
}
</script>

<template>
  <AppPage
    title="New assessment"
    :crumbs="[
      { label: 'SCCA', to: '/scca' },
      { label: 'New assessment' },
    ]"
  >
    <SccaDetailsForm @saved="onSaved" />
  </AppPage>
</template>
