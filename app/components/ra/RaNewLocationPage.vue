<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

const ra = useRaModule()
const route = useRoute()
/** Opened from "New assessment": go back there with the new location chosen. */
const forAssessment = computed(() => route.query.then === 'assessment')

function onSaved(location: RaLocationDetail) {
  return navigateTo(forAssessment.value
    ? { path: raPath(ra.value.kind, 'manage', 'new'), query: { location_id: location.id } }
    : `${ra.value.base}/locations/${location.id}?tab=contacts`)
}
</script>

<template>
  <AppPage
    :title="`New ${ra.location.lower}`"
    :crumbs="[
      { label: ra.title, to: raPath(ra.kind, 'monitoring') },
      { label: ra.location.plural, to: `${ra.base}/locations` },
      { label: `New ${ra.location.lower}` },
    ]"
  >
    <div class="max-w-xl space-y-6">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="ra.kind === 'branch' ? 'Add the branch first' : 'Add the building first'"
        :description="ra.hasLcp
          ? 'After saving you can add its emergency contacts, occupants, recovery team and call tree. Every RA cycle of this location uses them.'
          : 'After saving you can add its emergency contacts. Every RA cycle of this branch uses them.'"
      />
      <RaLocationForm
        :cancel-to="forAssessment ? `${ra.base}/new` : `${ra.base}/locations`"
        @saved="onSaved"
      />
    </div>
  </AppPage>
</template>
