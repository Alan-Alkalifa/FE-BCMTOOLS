<script setup lang="ts">
import type { BcpFunction, BcpWorkaroundRow } from '~/composables/useBcp'

/**
 * Edit or add one procedure row of a condition, as the production BCP's "Edit Kondisi" dialog
 * (scenario, procedure, form, PIC), plus which business critical functions it covers. Apply
 * changes the table; the condition is saved with Save in the top bar.
 */
const props = defineProps<{ row: BcpWorkaroundRow | null, title: string, functions: BcpFunction[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [row: BcpWorkaroundRow] }>()

const draft = ref<BcpWorkaroundRow>(blank())
const coverage = ref<'all' | 'selected'>('all')
const selected = ref<number[]>([])
function blank(): BcpWorkaroundRow {
  return { id: null, scenario_code: null, scenario_name: '', procedure: '', form: '', pic: '', functions: 'all' }
}
watch(open, (value) => {
  if (!value) return
  draft.value = props.row ? { ...props.row } : blank()
  coverage.value = draft.value.functions === 'all' ? 'all' : 'selected'
  selected.value = draft.value.functions === 'all' ? [] : [...draft.value.functions]
}, { immediate: true })

const COVERAGE = [
  { label: 'All business critical functions', value: 'all' },
  { label: 'Selected functions', value: 'selected' },
]
const valid = computed(() =>
  !!draft.value.scenario_name.trim() && !!draft.value.procedure.trim() && !!draft.value.pic.trim()
  && (coverage.value === 'all' || selected.value.length > 0),
)
function toggle(id: number, on: boolean | 'indeterminate') {
  selected.value = on === true ? [...new Set([...selected.value, id])] : selected.value.filter((value) => value !== id)
}
function apply() {
  if (!valid.value) return
  emit('apply', { ...draft.value, functions: coverage.value === 'all' ? 'all' : [...selected.value] })
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="Changes the table; save the condition with Save in the top bar."
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <form
        class="space-y-4"
        novalidate
        @submit.prevent="apply"
      >
        <UFormField
          label="Scenario"
          required
          :hint="draft.scenario_code ?? 'Added by the unit'"
        >
          <UInput
            v-model="draft.scenario_name"
            class="w-full"
            maxlength="255"
            aria-label="Scenario"
          />
        </UFormField>
        <UFormField
          label="Business critical"
          required
        >
          <URadioGroup
            v-model="coverage"
            :items="COVERAGE"
            orientation="horizontal"
          />
          <div
            v-if="coverage === 'selected'"
            class="mt-2 flex flex-wrap gap-x-4 gap-y-2"
          >
            <UCheckbox
              v-for="fn in functions"
              :key="fn.id"
              :model-value="selected.includes(fn.id)"
              :label="fn.name"
              @update:model-value="(value) => toggle(fn.id, value)"
            />
          </div>
        </UFormField>
        <UFormField
          label="Procedure"
          required
          help="Start a line with '- ' for a bullet."
        >
          <UTextarea
            v-model="draft.procedure"
            class="w-full"
            :rows="10"
            autoresize
            aria-label="Procedure"
          />
        </UFormField>
        <UFormField label="Form">
          <UTextarea
            v-model="draft.form"
            class="w-full"
            :rows="2"
            autoresize
            aria-label="Form"
          />
        </UFormField>
        <UFormField
          label="PIC"
          required
        >
          <UInput
            v-model="draft.pic"
            class="w-full"
            maxlength="255"
            aria-label="PIC"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          label="Apply"
          :disabled="!valid"
          @click="apply"
        />
      </div>
    </template>
  </UModal>
</template>
