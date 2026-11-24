<script setup lang="ts">
import type { BiancaAssessment } from '~/composables/useBianca'

definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, status, error, refresh } = useBiancaAssessment(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
/**
 * The report and the approval page read this BIA from the same cache: put what was saved in
 * it, or they would show the BIA as it was when the form opened.
 */
function onSaved(result: BiancaAssessment) {
  data.value = result
}
/** Where BiancaForm puts its buttons: this page's top bar. */
const actionsId = `bianca-actions-${useId()}`
</script>

<template>
  <AppPage
    :title="data?.ref_no ? `BIA ${data.ref_no}` : 'BIA'"
    icon="i-lucide-file-spreadsheet"
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Manage', to: '/bianca/manage' },
      { label: data?.ref_no ?? 'BIA' },
    ]"
  >
    <template #actions>
      <!-- The BIA's buttons (BiancaForm puts them here) -->
      <div
        :id="actionsId"
        class="flex items-center"
      />
    </template>
    <SkeletonTable
      v-if="showSkeleton"
      :columns="3"
      label="Loading the BIA"
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not open this BIA"
      :description="error.statusCode === 404 ? 'It does not exist, or you cannot open it.' : error.message"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>
    <BiancaForm
      v-else-if="data"
      :key="data.id"
      :assessment="data"
      :actions-to="`#${actionsId}`"
      @saved="onSaved"
    />
  </AppPage>
</template>
