<script setup lang="ts">
import type { OrganizationOwner, OrganizationPath, OrganizationRow, UnitLevel } from '~/utils/bianca-organization'
import { organizationEndpoint, organizationLevels } from '~/utils/bianca-organization'

const props = defineProps<{ level: UnitLevel, units: OrganizationRow[], unit?: OrganizationRow }>()
const emit = defineEmits<{ close: [saved?: boolean] }>()
const toast = useToast()
const label = organizationLevels.find((item) => item.value === props.level)!.label
const hr = props.unit?.source === 'hr'
const name = ref(props.unit?.[props.level] ?? '')
const directorate = ref<string | undefined>(props.unit?.directorate)
const sub = ref<string | undefined>(props.unit?.sub_directorate)
const code = ref(props.unit?.code ?? '')
const description = ref(props.unit?.description ?? '')
const active = ref(hr || (props.unit?.is_active ?? true))
const owner = ref<number | undefined>(props.unit?.owner?.id)
const currentOwner = ref(props.unit?.owner)
const search = ref('')
const term = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    term.value = value.trim()
  }, 300)
})
onBeforeUnmount(() => clearTimeout(timer))
const { data: people, status, error: peopleError, refresh } = useFetch<{ items: OrganizationOwner[] }>(`${organizationEndpoint}/people`, { query: { q: term }, server: false, lazy: true })
const ownerItems = computed(() => {
  const result = people.value?.items ?? []
  return (currentOwner.value && !result.some((person) => person.id === currentOwner.value?.id) ? [currentOwner.value, ...result] : result)
    .map((person) => ({ value: person.id, label: person.name, description: person.email ?? undefined }))
})
watch(owner, (value) => {
  if (value === undefined) currentOwner.value = null
  else currentOwner.value = people.value?.items.find((person) => person.id === value) ?? currentOwner.value
})
const dirs = computed(() => props.units.filter((row) => row.level === 'directorate' && row.available).map((row) => row.directorate))
const subs = computed(() => props.units.filter((row) => row.level === 'sub_directorate' && row.available && row.directorate === directorate.value).map((row) => row.sub_directorate))
watch(directorate, () => {
  if (!props.unit) sub.value = undefined
})
const busy = ref(false)
const failure = ref('')

function path(unit: OrganizationPath): OrganizationPath {
  return { directorate: unit.directorate, sub_directorate: unit.sub_directorate, org_group: unit.org_group }
}

async function save() {
  if (busy.value || !name.value.trim()) return
  busy.value = true
  failure.value = ''
  const unit = {
    directorate: props.level === 'directorate' ? name.value.trim() : directorate.value || '',
    sub_directorate: props.level === 'sub_directorate' ? name.value.trim() : props.level === 'org_group' ? sub.value || '' : '',
    org_group: props.level === 'org_group' ? name.value.trim() : '',
    code: code.value.trim() || null,
    description: description.value.trim() || null,
    owner_id: owner.value ?? null,
    is_active: active.value,
  }
  try {
    await $fetch(organizationEndpoint, props.unit
      ? { method: 'PUT', body: { path: path(props.unit), unit } }
      : { method: 'POST', body: unit })
    toast.add({ title: props.unit ? 'Organization unit saved' : 'Organization unit added', color: 'success', icon: 'i-lucide-circle-check' })
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
    :title="(unit ? 'Edit ' : 'New ') + label.toLowerCase()"
    :description="hr ? 'HR manages the name, hierarchy, and status. You can add BIA mapping details here.' : 'Manage the unit and its availability for BIA assessments.'"
    :ui="{ content: 'sm:max-w-2xl' }"
    :dismissible="!busy"
  >
    <template #body>
      <form
        id="bia-organization-form"
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
        <div
          v-if="level !== 'directorate'"
          class="grid gap-4 sm:grid-cols-2"
        >
          <UFormField
            label="Parent directorate"
            required
          >
            <UInput
              v-if="unit"
              :model-value="directorate"
              disabled
              class="w-full"
            />
            <USelectMenu
              v-else
              v-model="directorate"
              :items="dirs"
              aria-label="Parent directorate"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="level === 'org_group'"
            label="Parent sub directorate"
            required
          >
            <UInput
              v-if="unit"
              :model-value="sub"
              disabled
              class="w-full"
            />
            <USelectMenu
              v-else
              v-model="sub"
              :items="subs"
              :disabled="!directorate"
              aria-label="Parent sub directorate"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <UFormField
            :label="label + ' code'"
            name="code"
          >
            <UInput
              v-model="code"
              :maxlength="64"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="label + ' name'"
            name="name"
            required
          >
            <UInput
              v-model="name"
              :maxlength="255"
              :disabled="hr"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Assigned user"
          name="owner"
        >
          <div class="flex items-center gap-2">
            <USelectMenu
              v-model="owner"
              v-model:search-term="search"
              :items="ownerItems"
              value-key="value"
              ignore-filter
              :loading="status === 'pending'"
              aria-label="Assigned user"
              placeholder="Search by name or email"
              class="w-full"
            />
            <UButton
              v-if="owner"
              label="Clear"
              color="neutral"
              variant="ghost"
              @click="owner = undefined"
            />
          </div>
          <UButton
            v-if="peopleError"
            label="Retry loading users"
            color="error"
            variant="link"
            @click="refresh()"
          />
        </UFormField>
        <UFormField
          label="Description"
          name="description"
        >
          <UTextarea
            v-model="description"
            :maxlength="2000"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <USwitch
          v-model="active"
          label="Active"
          :disabled="hr"
          :description="hr ? 'Availability follows active HR profiles.' : 'Inactive units and their BIA-only descendants cannot be picked for new assessments.'"
        />
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
          label="Save unit"
          type="submit"
          form="bia-organization-form"
          :loading="busy"
          :disabled="!name.trim() || (level !== 'directorate' && !directorate) || (level === 'org_group' && !sub)"
        />
      </div>
    </template>
  </UModal>
</template>
