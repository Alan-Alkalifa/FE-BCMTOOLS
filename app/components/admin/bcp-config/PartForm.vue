<script setup lang="ts">
/**
 * The frame of every BCP configuration tab, as SCCA configuration's tabs: a card with the tab's
 * heading, the save error, the fields (disabled unless the draft can be edited) and, on the right
 * at the bottom, "Unsaved changes" and the tab's Save button.
 */
defineProps<{
  title: string
  description: string
  saveLabel: string
  editable: boolean
  dirty: boolean
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        {{ title }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ description }}
      </p>
    </template>
    <form
      class="space-y-6"
      novalidate
      @submit.prevent="emit('submit')"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't save"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="error"
      />
      <fieldset
        :disabled="!editable"
        class="min-w-0 space-y-6"
      >
        <slot />
      </fieldset>
      <div
        v-if="editable"
        class="flex items-center justify-end gap-2"
      >
        <UBadge
          v-if="dirty"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-dot"
          label="Unsaved changes"
        />
        <UButton
          type="submit"
          icon="i-lucide-save"
          :label="saveLabel"
          :disabled="!dirty"
          :loading="busy"
        />
      </div>
    </form>
  </UCard>
</template>
