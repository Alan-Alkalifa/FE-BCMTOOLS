<script setup lang="ts">
import type { BcpConfigVersion } from '~/composables/useBcpConfigAdmin'

/** Chapter 1.10 Daftar istilah dan definisi. */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'glossary', (saved) => emit('saved', saved), 'Glossary saved')
const saved = computed(() => bcpSavedCodes(props.version.payload.glossary))

function add() {
  draft.value.push({ code: bcpCodeFrom('term', draft.value.map((row) => row.code)), term: '', definition: '' })
}
function rename(index: number) {
  const row = draft.value[index]!
  if (saved.value.has(row.code)) return
  row.code = bcpCodeFrom(row.term, draft.value.filter((_, i) => i !== index).map((item) => item.code))
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Glossary"
    description="Chapter 1.10 of every BCP: the terms and their definitions, in this order."
    save-label="Save glossary"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <div class="space-y-3">
      <div
        v-for="(row, index) in draft"
        :key="index"
        class="grid gap-3 rounded-md border border-default p-3 md:grid-cols-[16rem_minmax(0,1fr)_auto]"
      >
        <UFormField
          label="Term"
          :name="`glossary.${index}.term`"
          required
        >
          <UInput
            v-model="row.term"
            class="w-full"
            maxlength="255"
            :aria-label="`Term ${index + 1}`"
            @blur="rename(index)"
          />
        </UFormField>
        <UFormField
          label="Definition"
          :name="`glossary.${index}.definition`"
          required
        >
          <UTextarea
            v-model="row.definition"
            class="w-full"
            :rows="3"
            autoresize
            :aria-label="`Definition of ${row.term || `term ${index + 1}`}`"
          />
        </UFormField>
        <UButton
          v-if="version.can.edit"
          class="self-start md:mt-6"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="`Remove ${row.term || `term ${index + 1}`}`"
          @click="draft.splice(index, 1)"
        />
      </div>
    </div>
    <UButton
      v-if="version.can.edit"
      color="neutral"
      variant="outline"
      icon="i-lucide-plus"
      label="Add term"
      @click="add"
    />
  </AdminBcpConfigPartForm>
</template>
