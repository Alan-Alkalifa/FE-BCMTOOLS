<script setup lang="ts">
/**
 * "Is this correct?": what was filled in on the Sign off page and the RA questionnaire, shown
 * before going on, so it is read once more. Opened with useOverlay (see BiancaForm's goTab).
 */
import type { BiancaReviewSection } from '~/composables/useBianca'

defineProps<{
  title: string
  description: string
  sections: BiancaReviewSection[]
  confirmLabel: string
}>()
const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-5">
        <section
          v-for="section in sections"
          :key="section.title"
        >
          <h3 class="mb-2 text-sm font-semibold">
            {{ section.title }}
          </h3>
          <dl class="divide-y divide-default rounded-md border border-default text-sm">
            <div
              v-for="row in section.rows"
              :key="row.label"
              class="grid gap-1 px-3 py-2 sm:grid-cols-[14rem_1fr] sm:gap-3"
            >
              <dt class="text-muted">
                {{ row.label }}
              </dt>
              <dd
                class="whitespace-pre-line break-words"
                :class="row.value ? 'font-medium' : 'text-muted'"
              >
                {{ row.value || '—' }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-pencil"
          label="No, let me fix it"
          @click="emit('close', false)"
        />
        <UButton
          icon="i-lucide-check"
          :label="confirmLabel"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
