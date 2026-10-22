<script setup lang="ts">
/** Lampiran Table 4: suggested mitigation strategies, next to the existing mitigation field. */
defineProps<{ examples: { area: string, example: string }[] }>()
</script>

<template>
  <UPopover>
    <UButton
      color="neutral"
      variant="link"
      icon="i-lucide-lightbulb"
      label="Suggested mitigation strategies"
      class="px-0"
    />
    <template #content>
      <dl class="max-w-md space-y-3 p-4 text-sm">
        <div
          v-for="example in examples"
          :key="example.area"
        >
          <dt class="text-xs font-semibold tracking-wide text-muted uppercase">
            {{ example.area }}
          </dt>
          <dd>{{ example.example }}</dd>
        </div>
      </dl>
    </template>
  </UPopover>
</template>
