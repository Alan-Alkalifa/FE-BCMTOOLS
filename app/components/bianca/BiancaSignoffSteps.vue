<script setup lang="ts">
import type { BiancaSignoffRow } from '~/composables/useBiancaApproval'

/**
 * The sign-off boxes of a submitted BIA, in the order of its approval template: who signs each
 * step, where it stands, and the note of a decision (the reason of a return).
 */
defineProps<{ steps: BiancaSignoffRow[] }>()
</script>

<template>
  <ol class="space-y-3">
    <li
      v-for="(step, index) in steps"
      :key="step.role"
      class="flex gap-3 rounded-md border p-3"
      :class="step.current ? 'border-warning/50 bg-warning/5' : 'border-default'"
    >
      <span
        class="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold tabular-nums"
        aria-hidden="true"
      >{{ index + 1 }}</span>
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-medium">
            {{ step.title }}
          </p>
          <StatusBadge
            :scale="biancaSignoffStatus"
            :value="biancaSignoffKey(step)"
            size="sm"
          />
        </div>
        <p class="text-sm text-muted">
          {{ step.name ?? 'No signer' }}<span v-if="step.designation"> · {{ step.designation }}</span>
          <span v-if="step.on_behalf_by"> · approved on behalf by {{ step.on_behalf_by }}</span>
          <span v-if="step.decided_at"> · {{ formatDateTime(step.decided_at) }}</span>
          <span v-else-if="step.current && step.pending_since"> · waiting since {{ formatDateTime(step.pending_since) }}</span>
        </p>
        <p
          v-if="step.decision_note"
          class="text-sm whitespace-pre-line"
          :class="step.status === 'rejected' ? 'text-error' : 'text-default'"
        >
          “{{ step.decision_note }}”
        </p>
      </div>
    </li>
  </ol>
</template>
