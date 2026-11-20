<script setup lang="ts">
import type { BiancaOrg, BiancaOrgOptions } from '~/composables/useBianca'

/**
 * Directorate > Sub Directorate > Group, each picked from the organisation in the database (the
 * HR fields of the users). Changing a level clears the levels under it. `picked` fires when the
 * user completes a Group, not when the value is loaded.
 */
const model = defineModel<BiancaOrg>({ required: true })
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    help?: string
    /** Fixed to the user's own Group (only a BCM Admin picks another one). */
    locked?: boolean
  }>(),
  { disabled: false, help: undefined, locked: false },
)
const off = computed(() => props.disabled || props.locked)
const emit = defineEmits<{ picked: [org: BiancaOrg] }>()

const options = ref<BiancaOrgOptions>({ directorates: [], sub_directorates: [], groups: [] })
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    options.value = await biancaApi.orgOptions(model.value.directorate, model.value.sub_directorate)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => [model.value.directorate, model.value.sub_directorate], load)

/** Keep a saved value in the list even when the organisation no longer has it. */
function withValue(list: string[], value: string | undefined) {
  return value && !list.includes(value) ? [value, ...list] : list
}
const directorates = computed(() => withValue(options.value.directorates, model.value.directorate))
const subDirectorates = computed(() => withValue(options.value.sub_directorates, model.value.sub_directorate))
const groups = computed(() => withValue(options.value.groups, model.value.org_group))

function setDirectorate(value: string | undefined) {
  if (value === model.value.directorate) return
  model.value = { directorate: value, sub_directorate: undefined, org_group: undefined }
}
function setSub(value: string | undefined) {
  if (value === model.value.sub_directorate) return
  model.value = { ...model.value, sub_directorate: value, org_group: undefined }
}
function setGroup(value: string | undefined) {
  if (value === model.value.org_group) return
  const next = { ...model.value, org_group: value }
  model.value = next
  if (value) emit('picked', next)
}
</script>

<template>
  <div class="space-y-2">
    <div class="grid gap-4 sm:grid-cols-3">
      <UFormField
        label="Directorate"
        required
      >
        <USelectMenu
          :model-value="model.directorate"
          :items="directorates"
          :loading="loading && !directorates.length"
          :disabled="off"
          placeholder="Pick a directorate"
          aria-label="Directorate"
          class="w-full"
          @update:model-value="setDirectorate"
        />
      </UFormField>
      <UFormField
        label="Sub directorate"
        required
      >
        <USelectMenu
          :model-value="model.sub_directorate"
          :items="subDirectorates"
          :disabled="off || !model.directorate"
          :placeholder="model.directorate ? 'Pick a sub directorate' : 'Pick the directorate first'"
          aria-label="Sub directorate"
          class="w-full"
          @update:model-value="setSub"
        />
      </UFormField>
      <UFormField
        label="Group"
        required
      >
        <USelectMenu
          :model-value="model.org_group"
          :items="groups"
          :disabled="off || !model.sub_directorate"
          :placeholder="model.sub_directorate ? 'Pick a group' : 'Pick the sub directorate first'"
          aria-label="Group"
          class="w-full"
          @update:model-value="setGroup"
        />
      </UFormField>
    </div>
    <p
      v-if="locked && !model.org_group"
      class="flex items-start gap-1.5 text-sm text-warning"
    >
      <UIcon
        name="i-lucide-triangle-alert"
        class="mt-0.5 size-4 shrink-0"
      />
      Your profile has no Group yet. Ask the administrator to set it to make a BIA.
    </p>
    <p
      v-else-if="locked"
      class="flex items-start gap-1.5 text-xs text-muted"
    >
      <UIcon
        name="i-lucide-lock"
        class="mt-px size-3.5 shrink-0"
      />
      Your own Group, from your profile. Only a BCM Admin can pick another Group.
    </p>
    <p
      v-else-if="failed"
      class="text-sm text-error"
    >
      The organisation list didn't load.
      <button
        type="button"
        class="underline"
        @click="load"
      >
        Try again
      </button>
    </p>
    <p
      v-else-if="help"
      class="text-xs text-muted"
    >
      {{ help }}
    </p>
  </div>
</template>
