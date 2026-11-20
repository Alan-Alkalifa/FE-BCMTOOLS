<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Building Data Entry: add a head office building or a branch. The type comes from the link
 * (`?type=branch`, e.g. from RA Branch > New assessment), otherwise the user picks it in the
 * form; every field follows it. Opened from Administration › Master building, where the saved
 * building then opens.
 */
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

function onSaved(location: RaLocationDetail) {
  return navigateTo(masterBuildingPath(location.id, 'contacts'), { replace: true })
}
</script>

<template>
  <AppPage
    title="Building Data Entry"
    icon="i-lucide-building"
    :crumbs="[{ label: 'Administration' }, { label: 'Master building', to: MASTER_BUILDINGS_PATH }, { label: 'Building Data Entry' }]"
  >
    <div class="max-w-5xl space-y-6">
      <p class="text-sm text-muted">
        After saving you can add its emergency contacts, divisions, recovery team and call tree. Every RA cycle of this building uses them.
      </p>
      <RaLocationForm
        v-model:kind="chosen"
        :kind-locked="Boolean(fixedType)"
        :cancel-to="MASTER_BUILDINGS_PATH"
        @saved="onSaved"
      />
    </div>
  </AppPage>
</template>
