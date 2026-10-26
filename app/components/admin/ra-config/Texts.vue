<script setup lang="ts">
import type { RaConfigTextField, RaConfigVersion } from '~/composables/useRaConfigAdmin'

/**
 * The texts of this version, all in English: the building type description on Building Data
 * Entry, the introduction above the hazards, the sign-off statement and the Risk Summary note
 * (the CIM follow-up). An empty text uses the default.
 */
const props = defineProps<{ version: RaConfigVersion }>()
const emit = defineEmits<{ saved: [version: RaConfigVersion] }>()

const FIELDS: { key: RaConfigTextField, label: string, help: string, rows: number }[] = [
  { key: 'type_description', label: 'Building type description', help: 'The hint under the type on Building Data Entry.', rows: 2 },
  { key: 'hazard_intro', label: 'Hazards introduction', help: 'Shown at the top of the Hazards tab.', rows: 3 },
  { key: 'signoff_statement_en', label: 'Sign-off statement', help: 'What every signer agrees to, on the Sign-off tab and the report.', rows: 6 },
  { key: 'risk_summary_note_en', label: 'Risk Summary note', help: 'The CIM follow-up at the top of the Risk Summary tab and in the report.', rows: 6 },
]

const part = useRaConfigPart(
  computed(() => props.version),
  (value) => Object.fromEntries(FIELDS.map(({ key }) => [key, value.stored_texts[key] ?? ''])) as Record<RaConfigTextField, string>,
  (code, value) => raConfigApi.setTexts(code, Object.fromEntries(Object.entries(value).map(([key, text]) => [key, text.trim() || null]))),
  (saved) => emit('saved', saved),
  'Statements and notes saved',
)
const { draft, error, busy, dirty, submit, reset } = part
const editable = computed(() => props.version.can.edit)

function placeholder(key: RaConfigTextField) {
  const value = props.version.default_texts[key]
  return value ? `Default: ${value}` : ''
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">
            Statements and notes
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-muted">
            Leave a text empty to use the default, shown in the empty box.
          </p>
        </div>
        <div
          v-if="editable"
          class="flex gap-2"
        >
          <UButton
            v-if="dirty"
            color="neutral"
            variant="outline"
            label="Undo changes"
            @click="reset"
          />
          <UButton
            icon="i-lucide-save"
            label="Save texts"
            :disabled="!dirty"
            :loading="busy"
            @click="submit"
          />
        </div>
      </div>
    </template>
    <div class="space-y-4">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't save the texts"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="error"
      />
      <fieldset
        :disabled="!editable"
        class="grid gap-4 lg:grid-cols-2"
      >
        <UFormField
          v-for="field in FIELDS"
          :key="field.key"
          :label="field.label"
          :name="field.key"
          :help="field.help"
          :class="{ 'lg:col-span-2': ['type_description', 'hazard_intro'].includes(field.key) }"
        >
          <UTextarea
            v-model="draft[field.key]"
            lang="en"
            :rows="field.rows"
            :placeholder="placeholder(field.key)"
            autoresize
            class="w-full"
          />
        </UFormField>
      </fieldset>
    </div>
  </UCard>
</template>
