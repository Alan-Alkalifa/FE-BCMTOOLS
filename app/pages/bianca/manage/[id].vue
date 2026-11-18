<script setup lang="ts">
definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, status, error, refresh } = useBiancaAssessment(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
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
    />
  </AppPage>
</template>
