<script setup lang="ts">
definePageMeta({ permission: 'bianca.create' })

useHead({ title: 'New BIA · BCM Tools' })

const { data: lookups } = useBiancaLookups()

function onSaved(assessment: { id: number }, tab?: string) {
  // On the saved BIA, the tab that was open (e.g. Business functions, after the RA questionnaire).
  return navigateTo({ path: biancaPath(assessment.id), query: tab && tab !== 'sign' ? { tab } : undefined }, { replace: true })
}
/** Where BiancaForm puts its buttons: this page's top bar. */
const actionsId = `bianca-actions-${useId()}`
</script>

<template>
  <AppPage
    icon="i-lucide-file-plus"
    title="New BIA"
    :description="lookups?.can_pick_group
      ? 'Fill the BIA here, or upload the Excel template. Your own Group is filled in; pick another if the BIA is for one.'
      : 'Fill the BIA here, or upload the Excel template. The BIA is for your own Group.'"
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Manage', to: '/bianca/manage' },
      { label: 'New BIA' },
    ]"
  >
    <template #actions>
      <!-- The BIA's buttons (BiancaForm puts them here) -->
      <div
        :id="actionsId"
        class="flex items-center"
      />
    </template>
    <BiancaForm
      :actions-to="`#${actionsId}`"
      @saved="onSaved"
    />
  </AppPage>
</template>
