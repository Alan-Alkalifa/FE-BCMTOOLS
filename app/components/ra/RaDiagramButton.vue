<script setup lang="ts">
/**
 * A button that opens a team chart in a dialog: the recovery team structure or the location
 * call tree of the HO workbook's LCP sheets, or the picture BCM uploaded for the kind in
 * Administration > RA configuration > Team diagrams.
 */
const props = defineProps<{
  kind: RaKind
  diagram: RaDiagram
  /** A small link-style button, for lists such as an incident's affected places. */
  compact?: boolean
}>()

const open = ref(false)
const failed = ref(false)
const loaded = ref(false)
const text = computed(() => RA_DIAGRAMS[props.diagram])
const kindLabel = computed(() => RA_MODULES[props.kind].title)
const src = computed(() => raDiagramUrl(props.kind, props.diagram))

watch(open, (value) => {
  if (value) {
    failed.value = false
    loaded.value = false
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`${text.label} (${kindLabel})`"
    :description="text.description"
    :ui="{ content: 'sm:max-w-6xl' }"
  >
    <UButton
      :color="compact ? 'primary' : 'neutral'"
      :variant="compact ? 'link' : 'outline'"
      :size="compact ? 'xs' : 'md'"
      icon="i-lucide-network"
      :label="text.button"
      :class="compact ? 'px-0' : undefined"
    />

    <template #body>
      <UAlert
        v-if="failed"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't load the chart"
        description="Close this dialog and try again. If it keeps failing, tell BCM."
      />
      <figure
        v-else
        class="space-y-3"
      >
        <div
          v-if="!loaded"
          class="flex h-64 items-center justify-center rounded-md border border-default text-sm text-muted"
          role="status"
        >
          Loading the chart…
        </div>
        <img
          :src="src"
          :alt="`${text.label}: ${text.description}`"
          class="mx-auto h-auto max-h-[calc(100dvh-15rem)] w-auto max-w-full rounded-md border border-default bg-white object-contain"
          :class="{ 'sr-only': !loaded }"
          @load="loaded = true"
          @error="failed = true"
        >
        <figcaption class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>Set by BCM in Administration > RA configuration > Team diagrams.</span>
          <UButton
            :to="src"
            target="_blank"
            external
            color="neutral"
            variant="link"
            size="sm"
            icon="i-lucide-external-link"
            label="Open full size"
            class="px-0"
          />
        </figcaption>
      </figure>
    </template>
  </UModal>
</template>
