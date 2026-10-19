<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel: string
    cancelLabel?: string
    destructive?: boolean
  }>(),
  { cancelLabel: 'Cancel', destructive: false },
)

const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="cancelLabel"
          @click="emit('close', false)"
        />
        <UButton
          :color="destructive ? 'error' : 'primary'"
          :label="confirmLabel"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
