<script setup lang="ts">
import type { BcpConfigVersion } from '~/composables/useBcpConfigAdmin'

/** How often a BCP is reviewed and tested, and the template label printed on the document. */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'document', (saved) => emit('saved', saved), 'Document rules saved')
</script>

<template>
  <AdminBcpConfigPartForm
    title="Document rules"
    description="The review and test periods of a BCP, and the template label printed on its documents."
    save-label="Save document rules"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <div class="grid max-w-xl gap-4 sm:grid-cols-2">
      <UFormField
        label="Review period"
        name="review_period_months"
        hint="months"
        required
        help="An approved BCP is due for its annual update (pengkinian) after this."
      >
        <UInputNumber
          v-model="draft.review_period_months"
          :min="1"
          :max="36"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Test period"
        name="test_period_months"
        hint="months"
        required
        help="How often the BCP is tested (uji coba)."
      >
        <UInputNumber
          v-model="draft.test_period_months"
          :min="1"
          :max="36"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Template label"
        name="template_label"
        required
        class="sm:col-span-2"
        help="The version of Template BCP Unit Kerja the documents follow, e.g. ver.23_2026."
      >
        <UInput
          v-model="draft.template_label"
          class="w-full"
          maxlength="32"
        />
      </UFormField>
    </div>
  </AdminBcpConfigPartForm>
</template>
