<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Building Data Entry: add a head office building or a branch. The type comes from the link
 * (`?type=branch`, e.g. from RA Branch > New assessment), otherwise the user picks it in the
 * form; every field follows it. `master`: opened from Administration › Master data › Master building, where the
 * saved building then opens.
 */
const props = defineProps<{ master?: boolean }>()
const route = useRoute()

/** RA and RA Branch are granted separately: someone who adds only branches (or only head office
 *  buildings) gets that type fixed. */
const editKinds = useRaKinds('edit')
const fixedType = computed<RaKind | null>(() => {
  const asked = route.query.type === 'branch' || route.query.type === 'head_office' ? route.query.type : null
  if (editKinds.value.length === 1) return editKinds.value[0]!
  return asked
})
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
    : buildingPath(location.id, props.master, 'contacts'))
}
</script>

<template>
  <AppPage
    title="Building Data Entry"
    icon="i-lucide-building"
    :crumbs="[
      ...(props.master
        ? [{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Master building', to: MASTER_BUILDINGS_PATH }]
        : [{ label: BUILDINGS_GROUP }, { label: 'Buildings', to: LOCATIONS_PATH }]),
      { label: 'Building Data Entry' },
    ]"
  >
    <div class="max-w-5xl space-y-6">
      <p class="text-sm text-muted">
        After saving you can add its emergency contacts, divisions, recovery team and call tree. Every RA cycle of this building uses them.
      </p>
      <RaLocationForm
        v-model:kind="chosen"
        :kind-locked="Boolean(fixedType)"
        :cancel-to="forAssessment ? raPath(kind, 'manage', 'new') : props.master ? MASTER_BUILDINGS_PATH : LOCATIONS_PATH"
        @saved="onSaved"
      />
    </div>
  </AppPage>
</template>
