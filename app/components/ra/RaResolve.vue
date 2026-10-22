<script setup lang="ts">
/**
 * `/ra/{id}` and `/ra-branch/{id}` (old links, bookmarks, the audit log): opens the RA in the
 * reader's section: Manage for a draft they edit, Approval while they can sign it, otherwise
 * Monitoring. A branch RA opened under /ra (or the reverse) lands in its own module.
 */
const route = useRoute()
const ra = useRaModule()
const id = computed(() => Number(route.params.id))
const { data: assessment, error } = useRaAssessment(id)

watch(assessment, (value) => {
  if (!value) return
  const section: RaSection = value.status === 'draft' && value.can_edit
    ? 'manage'
    : value.status === 'in_signoff' && value.can_approve ? 'approval' : 'monitoring'
  void navigateTo({ path: raPath(value.kind, section, value.id), query: route.query }, { replace: true })
}, { immediate: true })
</script>

<template>
  <AppPage
    icon="i-lucide-building-2"
    title="Assessment"
    :crumbs="[{ label: ra.title, to: raPath(ra.kind, 'monitoring') }]"
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
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not open the assessment"
      :description="apiErrorMessage(error)"
    />
    <SkeletonGroup
      v-else
      label="Opening assessment"
    >
      <SkeletonCard :lines="4" />
    </SkeletonGroup>
  </AppPage>
</template>
