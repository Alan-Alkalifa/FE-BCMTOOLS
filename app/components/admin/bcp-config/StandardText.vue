<script setup lang="ts">
import type { BcpConfigVersion, BcpStandardTextKey } from '~/composables/useBcpConfigAdmin'

/** The fixed text of the BCP template, chapter by chapter. Lines starting with "- " are bullets. */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'standard_text', (saved) => emit('saved', saved), 'Standard text saved')
const LIMIT = 20000
const groups = BCP_STANDARD_TEXT_GROUPS as { title: string, keys: { key: BcpStandardTextKey, label: string }[] }[]
</script>

<template>
  <AdminBcpConfigPartForm
    title="Standard text"
    description="The text every BCP prints as it is. Use {unit_name}, {group} or {directorate}; they are filled in on each BCP. Start a line with '- ' for a bullet."
    save-label="Save standard text"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <section
      v-for="group in groups"
      :key="group.title"
      class="space-y-4"
    >
      <h3 class="text-sm font-semibold text-highlighted">
        {{ group.title }}
      </h3>
      <UFormField
        v-for="item in group.keys"
        :key="item.key"
        :label="item.label"
        :name="`standard_text.${item.key}`"
      >
        <UTextarea
          v-model="draft[item.key]"
          class="w-full"
          :rows="4"
          autoresize
          :maxlength="LIMIT"
          :aria-label="item.label"
        />
        <template #hint>
          <FieldCount
            :value="draft[item.key]"
            :max="LIMIT"
          />
        </template>
      </UFormField>
    </section>
  </AdminBcpConfigPartForm>
</template>
