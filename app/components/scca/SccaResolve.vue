<script setup lang="ts">
/**
 * `/scca/{id}` (old links, emails, the audit log): opens the SCCA in the reader's section:
 * Manage for a draft they edit, Approval while they can act on it, otherwise Monitoring.
 */
const props = withDefaults(defineProps<{ page?: 'record' | 'report' }>(), { page: 'record' })

const route = useRoute()
const { can } = useAuth()
const id = computed(() => Number(route.params.id))
const { data: assessment, error } = useSccaAssessment(id)

watch(assessment, (value) => {
  if (!value) return
  const section = sccaSectionFor(value, can('scca.approval.manage'))
  void navigateTo({ path: sccaPath(section, value.id, props.page), query: route.query }, { replace: true })
}, { immediate: true })
</script>

<template>
  <AppPage
    icon="i-lucide-shield-check"
    title="Assessment"
    :crumbs="[{ label: 'SCCA' }]"
  >
    <UAlert
      v-if="error?.statusCode === 404"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-help"
      title="Assessment not found"
      description="It may have been deleted."
    />
    <UAlert
      v-else-if="error?.statusCode === 403"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="You don't have access to this assessment"
      description="Only the assessor, the contributor, the sign-off users and BCM admins can open it."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not open the assessment"
      :description="error.message"
    />
    <SkeletonGroup
      v-else
      label="Opening assessment"
    >
      <SkeletonCard :lines="4" />
    </SkeletonGroup>
  </AppPage>
</template>
