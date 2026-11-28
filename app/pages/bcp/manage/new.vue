<script setup lang="ts">
import type { BcpPlan } from '~/composables/useBcp'

definePageMeta({ permission: 'bcp.create' })

useHead({ title: 'New BCP · BCM Tools' })

// Create BCP sits in the top bar and submits the form by id, as SCCA's Create assessment.
const saving = ref(false)
provide(bcpSavingKey, saving)
const form = ref<{ canCreate: boolean } | null>(null)

function onSaved(plan: BcpPlan) {
  return navigateTo(bcpPath('manage', plan.id), { replace: true })
}
</script>

<template>
  <AppPage
    icon="i-lucide-file-plus"
    title="New BCP"
    :crumbs="[
      { label: 'BCP' },
      { label: 'Manage', to: '/bcp/manage' },
      { label: 'New BCP' },
    ]"
  >
    <template #actions>
      <UButton
        type="submit"
        form="bcp-form-details"
        icon="i-lucide-file-plus"
        label="Create BCP"
        :disabled="!form?.canCreate"
        :loading="saving"
      />
    </template>
    <BcpDetailsForm
      ref="form"
      @saved="onSaved"
    />
  </AppPage>
</template>
