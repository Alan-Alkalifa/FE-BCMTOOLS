<script setup lang="ts">
definePageMeta({ permission: 'scca.create' })

useHead({ title: 'New assessment · BCM Tools' })

// Create assessment sits in the top bar and submits the form by id, as Save does on a saved SCCA.
const saving = ref(false)
provide(sccaSavingKey, saving)

const uploading = ref(false)

function onSaved(assessment: SccaAssessment) {
  return navigateTo({ path: sccaPath('manage', assessment.id), query: { tab: 'rating' } }, { replace: true })
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
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-file-spreadsheet"
        label="Upload Excel"
        @click="uploading = true"
      />
      <UButton
        type="submit"
        form="scca-form-details"
        icon="i-lucide-file-plus"
        label="Create assessment"
        :loading="saving"
      />
    </template>
    <SccaDetailsForm @saved="onSaved" />
    <SccaUploadDialog
      v-model:open="uploading"
      @saved="onSaved"
    />
  </AppPage>
</template>
