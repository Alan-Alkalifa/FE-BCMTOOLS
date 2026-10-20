<script setup lang="ts">
import type { AdminMenu } from '~/composables/useAdmin'

const props = defineProps<{ menu: AdminMenu, first: boolean, last: boolean, builtIn: boolean }>()
const emit = defineEmits<{ up: [], down: [], edit: [], toggle: [active: boolean], remove: [] }>()
</script>

<template>
  <div class="flex shrink-0 items-center gap-1">
    <USwitch
      :model-value="props.menu.is_active"
      :aria-label="`Show ${props.menu.label}`"
      size="sm"
      class="me-2"
      @update:model-value="emit('toggle', $event)"
    />
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-up"
      :disabled="first"
      :aria-label="`Move ${props.menu.label} up`"
      @click="emit('up')"
    />
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-down"
      :disabled="last"
      :aria-label="`Move ${props.menu.label} down`"
      @click="emit('down')"
    />
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-pencil"
      :aria-label="`Edit ${props.menu.label}`"
      @click="emit('edit')"
    />
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-trash-2"
      :disabled="builtIn"
      :aria-label="builtIn ? `${props.menu.label} is built in` : `Delete ${props.menu.label}`"
      @click="emit('remove')"
    />
  </div>
</template>
