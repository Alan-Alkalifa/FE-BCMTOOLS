<script setup lang="ts">
import type { BiancaAssessment } from '~/composables/useBianca'

/**
 * A BIA opened from Approval: its sign-off (and, for the signer of the current step, Approve
 * and Return for changes) above the BIA itself, read-only on its tabs.
 */
definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, status, error, refresh } = useBiancaAssessment(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

function onDecided(updated: BiancaAssessment) {
  data.value = updated
  refreshNuxtData(['bianca-approvals-inbox', 'bianca-approvals-upcoming', 'bianca-approvals-history'])
}
</script>

<template>
  <AppPage
    :title="data?.ref_no ? `BIA ${data.ref_no}` : 'BIA'"
    icon="i-lucide-badge-check"
    :description="data ? [data.org_group, data.sub_directorate, data.directorate].filter(Boolean).join(' · ') : undefined"
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Approval', to: '/bianca/approval' },
      { label: data?.ref_no ?? 'BIA' },
    ]"
  >
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
    <div
      v-else-if="data"
      class="space-y-6"
    >
      <BiancaDecisionPanel
        :assessment="data"
        @decided="onDecided"
      />
      <BiancaForm
        :key="`${data.id}-${data.status}-${data.pending_role}`"
        :assessment="data"
      />
    </div>
  </AppPage>
</template>
