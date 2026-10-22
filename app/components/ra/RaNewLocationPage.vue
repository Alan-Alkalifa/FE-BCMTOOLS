<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Add a head office building or a branch. The type comes from the link (`?type=branch`, e.g.
 * from RA Branch > New assessment), otherwise the user picks it here; every field below follows
 * it (a branch needs a region).
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

/** Opened from "New assessment": go back there with the new location chosen. */
const forAssessment = computed(() => route.query.then === 'assessment')
const typeItems = [
  { label: 'Head office building', value: 'head_office', description: 'Assessed in RA, with the HO workbook.' },
  { label: 'Branch', value: 'branch', description: 'Assessed in RA Branch; needs a region.' },
]

function onSaved(location: RaLocationDetail) {
  return navigateTo(forAssessment.value
    ? { path: raPath(location.kind, 'manage', 'new'), query: { location_id: location.id } }
    : locationPath(location.id, 'contacts'))
}

function pick(value: unknown) {
  chosen.value = value === 'branch' ? 'branch' : 'head_office'
}
</script>

<template>
  <AppPage
    :title="fixedType ? (kind === 'branch' ? 'Add branch' : 'Add building') : 'Add location'"
    icon="i-lucide-building"
    :crumbs="[
      { label: 'Locations' },
      { label: 'Locations', to: LOCATIONS_PATH },
      { label: 'Add location' },
    ]"
  >
    <div class="max-w-xl space-y-6">
      <UFormField
        v-if="!fixedType"
        label="Type"
        required
      >
        <URadioGroup
          :model-value="chosen"
          :items="typeItems"
          orientation="horizontal"
          variant="card"
          :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
          @update:model-value="pick"
        />
      </UFormField>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="kind === 'branch' ? 'Add the branch first' : 'Add the building first'"
        description="After saving you can add its emergency contacts, occupants, recovery team and call tree. Every RA cycle of this location uses them."
      />
      <RaLocationForm
        :key="kind"
        :cancel-to="forAssessment ? raPath(kind, 'manage', 'new') : LOCATIONS_PATH"
        @saved="onSaved"
      />
    </div>
  </AppPage>
</template>
