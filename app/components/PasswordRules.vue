<script setup lang="ts">
/** Live checklist for a new password: the same rules the backend applies. */
const props = defineProps<{ password: string, confirm?: string }>()

const rules = computed(() => [
  { label: 'At least 12 characters', ok: props.password.length >= 12 },
  { label: 'Letters and digits', ok: /[A-Za-z]/.test(props.password) && /\d/.test(props.password) },
  ...(props.confirm === undefined
    ? []
    : [{ label: 'Both entries match', ok: !!props.password && props.password === props.confirm }]),
])
</script>

<template>
  <ul
    class="space-y-1 text-xs"
    aria-label="Password rules"
  >
    <li
      v-for="rule in rules"
      :key="rule.label"
      class="flex items-center gap-2"
      :class="rule.ok ? 'text-success' : 'text-muted'"
    >
      <UIcon
        :name="rule.ok ? 'i-lucide-circle-check' : 'i-lucide-circle'"
        class="size-3.5 shrink-0"
      />
      {{ rule.label }}
      <span class="sr-only">{{ rule.ok ? '(met)' : '(not met yet)' }}</span>
    </li>
  </ul>
</template>
