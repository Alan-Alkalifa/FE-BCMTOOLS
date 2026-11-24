<script setup lang="ts">
import { parseDate, today, getLocalTimeZone, type CalendarDate } from '@internationalized/date'
import type { OrganizationDetected, OrganizationPath, OrganizationRow, UnitLevel } from '~/utils/bianca-organization'
import { emptyOrganizationPath, organizationChangeKind, organizationChangeKinds, organizationEndpoint, organizationLevels, organizationPathLabel } from '~/utils/bianca-organization'

/**
 * Record change: a unit's path before and after (either may be empty: a new or a closed unit),
 * the date it took effect and its reference. Confirming a detected change opens this pre-filled.
 * The type is derived; saving moves the unit's details (code, assigned user, description).
 */
const props = defineProps<{
  units: OrganizationRow[]
  unit?: OrganizationRow
  detected?: OrganizationDetected
}>()
const emit = defineEmits<{ close: [saved?: boolean] }>()
const toast = useToast()

function pathOf(row?: OrganizationPath | null): OrganizationPath {
  return row ? { directorate: row.directorate, sub_directorate: row.sub_directorate, org_group: row.org_group } : emptyOrganizationPath()
}
const start = props.detected ?? (props.unit ? { level: props.unit.level, previous: pathOf(props.unit), current: pathOf(props.unit) } : undefined)
const level = ref<UnitLevel>(start?.level ?? 'org_group')
const previousKey = ref<string | undefined>(start?.previous.directorate ? JSON.stringify(pathOf(start.previous)) : undefined)
const current = reactive<OrganizationPath>(pathOf(start?.current))
const effective = shallowRef<CalendarDate | undefined>(props.detected?.detected_at ? parseDate(props.detected.detected_at.slice(0, 10)) : today(getLocalTimeZone()))
const reference = ref('')
const note = ref('')
const closing = ref(!!start?.previous.directorate && !start.current.directorate)

const previousItems = computed(() => {
  const items = props.units
    .filter((row) => row.level === level.value)
    .map((row) => ({ value: JSON.stringify(pathOf(row)), label: organizationPathLabel(row), description: row.source === 'hr' ? 'HR' : 'BIA' }))
  // A detected change's previous unit can be gone from HR already.
  if (start?.previous.directorate && !items.some((item) => item.value === JSON.stringify(pathOf(start.previous)))) {
    items.unshift({ value: JSON.stringify(pathOf(start.previous)), label: organizationPathLabel(start.previous), description: 'No longer in HR' })
  }
  return items
})
const previous = computed<OrganizationPath>(() => (previousKey.value ? JSON.parse(previousKey.value) : emptyOrganizationPath()))
const shown = computed<OrganizationPath>(() => {
  if (closing.value) return emptyOrganizationPath()
  const depth = organizationLevels.findIndex((item) => item.value === level.value) + 1
  return {
    directorate: current.directorate.trim(),
    sub_directorate: depth > 1 ? current.sub_directorate.trim() : '',
    org_group: depth > 2 ? current.org_group.trim() : '',
  }
})
const kind = computed(() => organizationChangeKind(previous.value, shown.value))

watch(level, () => {
  if (!props.detected) previousKey.value = undefined
})
watch(previousKey, (value) => {
  if (value) Object.assign(current, JSON.parse(value))
})

const busy = ref(false)
const failure = ref('')
async function save() {
  if (busy.value || !kind.value) return
  busy.value = true
  failure.value = ''
  const body = {
    previous: previous.value.directorate ? previous.value : null,
    current: shown.value.directorate ? shown.value : null,
    effective_date: effective.value?.toString() ?? null,
    reference: reference.value.trim() || null,
    note: note.value.trim() || null,
  }
  try {
    await $fetch(props.detected ? `${organizationEndpoint}/detected/${props.detected.id}/confirm` : `${organizationEndpoint}/changes`, { method: 'POST', body })
    toast.add({ title: props.detected ? 'Change confirmed' : 'Change recorded', color: 'success', icon: 'i-lucide-circle-check' })
    emit('close', true)
  } catch (error) {
    failure.value = biancaConfigError(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="detected ? 'Confirm detected change' : 'Record change'"
    description="The unit's details (code, assigned user, description) move with it. BIAs keep the names they were made with."
    :ui="{ content: 'sm:max-w-2xl' }"
    :dismissible="!busy"
  >
    <template #body>
      <form
        id="organization-change-form"
        class="space-y-4"
        @submit.prevent="save"
      >
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failure"
        />
        <UAlert
          v-if="detected"
          color="info"
          variant="subtle"
          icon="i-lucide-scan-search"
          :title="`Found in ${detected.import_file || 'an HR import'}`"
          :description="`${detected.people_moved} of ${detected.people_total} people. Correct the names if HR's are not right yet.`"
        />
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Level"
            required
          >
            <USelect
              v-model="level"
              :items="[...organizationLevels]"
              :disabled="!!detected"
              aria-label="Level"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Effective date"
            required
          >
            <DatePicker
              v-model="effective"
              aria-label="Effective date"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Previous unit"
          hint="Empty for a new unit"
        >
          <div class="flex items-center gap-2">
            <USelectMenu
              v-model="previousKey"
              :items="previousItems"
              value-key="value"
              :disabled="!!detected"
              placeholder="Search units"
              aria-label="Previous unit"
              class="w-full"
            />
            <UButton
              v-if="previousKey && !detected"
              label="Clear"
              color="neutral"
              variant="ghost"
              @click="previousKey = undefined"
            />
          </div>
        </UFormField>
        <USwitch
          v-model="closing"
          :disabled="!previousKey"
          label="The unit was closed"
          description="No current unit: it was dissolved, not renamed or moved."
        />
        <fieldset
          v-if="!closing"
          class="grid gap-4 sm:grid-cols-3"
        >
          <legend class="mb-2 text-sm font-medium text-highlighted">
            Current unit
          </legend>
          <UFormField
            label="Directorate"
            required
          >
            <UInput
              v-model="current.directorate"
              :maxlength="255"
              aria-label="Current directorate"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="level !== 'directorate'"
            label="Sub directorate"
            required
          >
            <UInput
              v-model="current.sub_directorate"
              :maxlength="255"
              aria-label="Current sub directorate"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="level === 'org_group'"
            label="Group"
            required
          >
            <UInput
              v-model="current.org_group"
              :maxlength="255"
              aria-label="Current group"
              class="w-full"
            />
          </UFormField>
        </fieldset>
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <UFormField
            label="Reference"
            hint="Memo or decree no."
          >
            <UInput
              v-model="reference"
              :maxlength="255"
              aria-label="Reference"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Note">
            <UTextarea
              v-model="note"
              :maxlength="2000"
              :rows="2"
              aria-label="Note"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Type:</span>
          <UBadge
            v-if="kind"
            variant="subtle"
            :color="organizationChangeKinds[kind].color"
            :icon="organizationChangeKinds[kind].icon"
            :label="organizationChangeKinds[kind].label"
          />
          <span v-else>Choose a previous unit, a current one, or both, with different names.</span>
          <span v-if="kind">{{ organizationPathLabel(previous) }} → {{ organizationPathLabel(shown) }}</span>
        </p>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="busy"
          @click="emit('close')"
        />
        <UButton
          :label="detected ? 'Confirm change' : 'Record change'"
          type="submit"
          form="organization-change-form"
          :loading="busy"
          :disabled="!kind || !effective"
        />
      </div>
    </template>
  </UModal>
</template>
