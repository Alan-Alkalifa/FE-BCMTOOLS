<script setup lang="ts">
export interface ProfileField {
  label: string
  value: string | null | undefined
}

defineProps<{ fields: ProfileField[] }>()
</script>

<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
    <template
      v-for="field in fields"
      :key="field.label"
    >
      <dt class="text-muted">
        {{ field.label }}
      </dt>
      <dd>{{ field.value || '—' }}</dd>
    </template>
  </dl>
</template>
