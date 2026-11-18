<script setup lang="ts">
import type { AdminMenu } from '~/composables/useAdmin'

const props = defineProps<{ menu: AdminMenu, first: boolean, last: boolean, builtIn: boolean, group: boolean, canIndent: boolean, canOutdent: boolean }>()
const emit = defineEmits<{ up: [], down: [], indent: [], outdent: [], add: [], edit: [], toggle: [active: boolean], remove: [] }>()
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
      icon="i-lucide-indent-decrease"
      :disabled="!canOutdent"
      :aria-label="`Move ${props.menu.label} out of its group`"
      @click="emit('outdent')"
    />
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-indent-increase"
      :disabled="!canIndent"
      :aria-label="`Move ${props.menu.label} into the group above`"
      @click="emit('indent')"
    />
    <UButton
      v-if="group"
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-plus"
      :aria-label="`Add an item inside ${props.menu.label}`"
      @click="emit('add')"
    />
    <span
      v-else
      class="size-8"
      aria-hidden="true"
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
