<script setup lang="ts">
import type { BiancaNoteKey } from '~/utils/biancaNotes'

/** A group of fields in a part of the business function, as the SCCA assessment groups them. */
defineProps<{ title: string, description?: string, note?: BiancaNoteKey }>()
</script>

<template>
  <UCard
    variant="outline"
    :ui="{ header: 'px-4 py-3 sm:px-5', body: 'p-4 sm:p-5' }"
  >
    <template #header>
      <div class="flex items-center gap-1.5">
        <h4 class="text-sm font-semibold text-highlighted">
          {{ title }}
        </h4>
        <BiancaNote
          v-if="note"
          :note="note"
          :label="title"
        />
      </div>
      <p
        v-if="description"
        class="mt-0.5 text-sm text-muted"
      >
        {{ description }}
      </p>
    </template>
    <slot />
  </UCard>
</template>
