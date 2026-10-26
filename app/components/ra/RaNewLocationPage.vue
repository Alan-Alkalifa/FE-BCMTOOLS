<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Building Data Entry: add a head office building or a branch. The type comes from the link
 * (`?type=branch`, e.g. from RA Branch > New assessment), otherwise the user picks it in the
 * form; every field follows it (a branch needs a region).
 */
const route = useRoute()

const fixedType = computed<RaKind | null>(() =>
  route.query.type === 'branch' || route.query.type === 'head_office' ? route.query.type : null)
const chosen = ref<RaKind>(fixedType.value ?? 'head_office')
watch(fixedType, (value) => {
  if (value) chosen.value = value
})
const kind = computed<RaKind>(() => fixedType.value ?? chosen.value)
provide(raKindKey, kind)

/** Opened from "New assessment": go back there with the new building chosen. */
const forAssessment = computed(() => route.query.then === 'assessment')

function onSaved(location: RaLocationDetail) {
  return navigateTo(forAssessment.value
    ? { path: raPath(location.kind, 'manage', 'new'), query: { location_id: location.id } }
    : locationPath(location.id, 'contacts'))
}
</script>

<template>
  <AppPage
    title="Building Data Entry"
    icon="i-lucide-building"
    :crumbs="[
      { label: BUILDINGS_GROUP },
      { label: 'Buildings', to: LOCATIONS_PATH },
      { label: 'Building Data Entry' },
    ]"
  >
    <div class="max-w-2xl space-y-6">
      <p class="text-sm text-muted">
        After saving you can add its emergency contacts, divisions, recovery team and call tree. Every RA cycle of this building uses them.
      </p>
      <RaLocationForm
        v-model:kind="chosen"
        :kind-locked="Boolean(fixedType)"
        :cancel-to="forAssessment ? raPath(kind, 'manage', 'new') : LOCATIONS_PATH"
        @saved="onSaved"
      />
    </div>
  </AppPage>
</template>
