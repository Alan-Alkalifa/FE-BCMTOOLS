<script setup lang="ts">
import type { BiancaNoteKey } from '~/utils/biancaNotes'

/** A form field with the workbook's note on it (BiancaNote) right after its label. */
defineOptions({ inheritAttrs: false })
defineProps<{ label: string, note?: BiancaNoteKey, noteText?: string }>()
</script>

<template>
  <UFormField
    v-bind="$attrs"
    :label="label"
    :ui="{ labelWrapper: 'justify-start gap-1.5' }"
  >
    <template
      v-if="note || noteText"
      #hint
    >
      <BiancaNote
        :note="note"
        :text="noteText"
        :label="label"
      />
    </template>
    <!-- Every other slot (default, help, …) goes to the form field as given; read at render
         time, as a slot can come and go (v-if). -->
    <template
      v-for="name in Object.keys($slots).filter(slot => slot !== 'hint')"
      :key="name"
      #[name]="scope"
    >
      <slot
        :name="name"
        v-bind="scope ?? {}"
      />
    </template>
  </UFormField>
</template>
