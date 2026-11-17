<script setup lang="ts">
import type { BiancaNoteKey } from '~/utils/biancaNotes'

/**
 * The workbook's note on a field: an info icon next to the label that shows the note on hover
 * (or tap, on a touch screen) and on keyboard focus.
 */
const props = defineProps<{ note?: BiancaNoteKey, text?: string, label?: string }>()

const body = computed(() => props.text ?? (props.note ? BIANCA_NOTES[props.note] : ''))
const lines = computed(() => body.value.split('\n').filter(Boolean))

const hover = ref(true)
onMounted(() => {
  hover.value = window.matchMedia?.('(hover: hover)').matches ?? true
})
</script>

<template>
  <UPopover
    v-if="body"
    :mode="hover ? 'hover' : 'click'"
    :open-delay="100"
    :close-delay="150"
    :content="{ side: 'top', align: 'start', sideOffset: 6 }"
  >
    <button
      type="button"
      class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="label ? `About ${label}` : 'More about this field'"
      @click.prevent
    >
      <UIcon
        name="i-lucide-info"
        class="size-4"
      />
    </button>
    <template #content>
      <div class="max-w-xs p-3 text-xs/5">
        <template
          v-for="(line, index) in lines"
          :key="index"
        >
          <p
            v-if="!line.startsWith('- ')"
            :class="index ? 'mt-1' : ''"
          >
            {{ line }}
          </p>
          <p
            v-else
            class="flex gap-1.5 ps-1"
          >
            <span aria-hidden="true">•</span><span>{{ line.slice(2) }}</span>
          </p>
        </template>
      </div>
    </template>
  </UPopover>
</template>
