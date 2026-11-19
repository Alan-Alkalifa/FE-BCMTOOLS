<script setup lang="ts">
definePageMeta({ permission: 'bianca.create' })

useHead({ title: 'New BIA · BCM Tools' })

function onSaved(assessment: { id: number }) {
  return navigateTo(biancaPath(assessment.id), { replace: true })
}
</script>

<template>
  <AppPage
    icon="i-lucide-file-plus"
    title="New BIA"
    description="Fill the BIA here, or upload the Excel template. Your Group comes from your profile."
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Manage', to: '/bianca/manage' },
      { label: 'New BIA' },
    ]"
  >
    <BiancaForm @saved="onSaved" />
  </AppPage>
</template>
