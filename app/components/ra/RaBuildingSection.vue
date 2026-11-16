<script setup lang="ts">
import type { RaCallTreeEntry, RaLocationDetail, RaRecoveryTeamMember } from '~/composables/useRa'

/**
 * The RA's building on its Details tab, as on the building's page: Details, Map, Emergency
 * contacts and, for head office, Occupants, Recovery team and Call tree, each saved on its own.
 * Edited while the RA can be edited and the user may edit buildings; read-only otherwise. Its
 * unsaved changes are its own, not the RA's (the top bar's Save is the RA's).
 */
const props = defineProps<{ locationId: number, assessmentId: number, editable: boolean }>()

const ra = useRaModule()
const { can } = useAuth()
const confirm = useConfirm()
const { data: location, error, refresh } = useRaLocation(() => props.locationId)
const canEdit = computed(() => props.editable && can(ra.value.perm.edit))

/** The RA's own unsaved changes (its Details form), kept apart from the building's. */
const raDirty = inject(raDirtyKey, null)
const dirty = ref(false)
provide(raDirtyKey, dirty)
const formKey = ref(0)

type Tab = 'details' | 'map' | 'contacts' | 'occupants' | 'team' | 'calltree'
const LCP_TABS: Tab[] = ['occupants', 'team', 'calltree']
const tabItems = computed(() => [
  { label: 'Details', value: 'details', icon: 'i-lucide-building-2', slot: 'details' as const },
  { label: 'Map', value: 'map', icon: 'i-lucide-map-pinned', slot: 'map' as const },
  { label: 'Emergency contacts', value: 'contacts', icon: 'i-lucide-phone', slot: 'contacts' as const },
  { label: 'Occupants', value: 'occupants', icon: 'i-lucide-users', slot: 'occupants' as const },
  { label: 'Recovery team', value: 'team', icon: 'i-lucide-life-buoy', slot: 'team' as const },
  { label: 'Call tree', value: 'calltree', icon: 'i-lucide-network', slot: 'calltree' as const },
].filter((item) => ra.value.hasLcp || !LCP_TABS.includes(item.value as Tab)))
const current = ref<Tab>('details')
const tab = computed({
  get: () => current.value,
  set: async (next: Tab) => {
    if (next === current.value) return
    if (dirty.value && !(await confirm({
      title: 'Discard unsaved changes?',
      description: `Your unsaved edits on this ${ra.value.location.lower} tab will be lost.`,
      confirmLabel: 'Discard changes',
      destructive: true,
    }))) return
    dirty.value = false
    current.value = next
    formKey.value += 1
  },
})

function onSaved(saved: RaLocationDetail) {
  location.value = saved
  dirty.value = false
}

/** Its name and address also show on the RA (read again unless the RA has unsaved changes). */
function onDetailsSaved(saved: RaLocationDetail) {
  onSaved(saved)
  if (!raDirty?.value) refreshNuxtData(`ra-assessment-${props.assessmentId}`)
}

type RowValues = Record<string, string | number | null>
const teamRows = computed(() => (location.value?.recovery_team ?? []) as unknown as RowValues[])
const callTreeRows = computed(() => (location.value?.call_tree ?? []) as unknown as RowValues[])
function saveTeam(rows: RowValues[]) {
  return raApi.setRecoveryTeam(props.locationId, rows as unknown as RaRecoveryTeamMember[])
}
function saveCallTree(rows: RowValues[]) {
  return raApi.setCallTree(props.locationId, rows as unknown as RaCallTreeEntry[])
}
</script>

<template>
  <section
    class="space-y-4"
    aria-labelledby="ra-building-heading"
  >
    <h2
      id="ra-building-heading"
      class="text-lg font-semibold"
    >
      {{ ra.location.single }}
    </h2>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`Could not load the ${ra.location.lower}`"
      :description="apiErrorMessage(error)"
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

    <SkeletonCard
      v-else-if="!location"
      :lines="6"
    />

    <UTabs
      v-else
      v-model="tab"
      :items="tabItems"
      variant="link"
      :ui="{ content: 'pt-4' }"
    >
      <template #details>
        <fieldset
          :disabled="!canEdit"
          class="min-w-0"
        >
          <RaLocationForm
            :key="`details-${formKey}`"
            :location="location"
            kind-locked
            @saved="onDetailsSaved"
          />
        </fieldset>
      </template>
      <template #map>
        <fieldset
          :disabled="!canEdit"
          class="min-w-0"
        >
          <RaLocationMapTab
            :key="`map-${formKey}`"
            :location="location"
            @saved="onSaved"
          />
        </fieldset>
      </template>
      <template #contacts>
        <fieldset
          :disabled="!canEdit"
          class="min-w-0"
        >
          <RaContactsForm
            :key="`contacts-${formKey}`"
            :location="location"
            @saved="onSaved"
          />
        </fieldset>
      </template>
      <template #occupants>
        <fieldset
          :disabled="!canEdit"
          class="min-w-0"
        >
          <RaOccupantsTab
            :location="location"
            @saved="onSaved"
          />
        </fieldset>
      </template>
      <template #team>
        <fieldset
          :disabled="!canEdit"
          class="min-w-0"
        >
          <RaGroupedRowsForm
            :key="`team-${formKey}`"
            :groups="RA_RECOVERY_TEAMS"
            group-key="team"
            :lead="RA_TEAM_LEAD"
            :fields="RA_TEAM_FIELDS"
            :initial="teamRows"
            item-label="member"
            save-label="Save recovery team"
            saved-message="Recovery team saved"
            error-title="Couldn't save the recovery team"
            :save="saveTeam"
            @saved="onSaved"
          />
        </fieldset>
      </template>
      <template #calltree>
        <fieldset
          :disabled="!canEdit"
          class="min-w-0"
        >
          <RaGroupedRowsForm
            :key="`calltree-${formKey}`"
            :groups="RA_CALL_TREE_GROUPS"
            group-key="level"
            :lead="RA_CALL_TREE_LEAD"
            :fields="RA_CALL_TREE_FIELDS"
            :initial="callTreeRows"
            item-label="contact"
            save-label="Save call tree"
            saved-message="Call tree saved"
            error-title="Couldn't save the call tree"
            :save="saveCallTree"
            @saved="onSaved"
          />
        </fieldset>
      </template>
    </UTabs>
  </section>
</template>
