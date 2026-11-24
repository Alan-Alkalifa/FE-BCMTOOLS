<script setup lang="ts">
export interface SpotlightTourStep {
  target: string
  title: string
  description: string
  badge?: string
  color?: 'error' | 'warning' | 'primary'
  beforeEnter?: () => Promise<void> | void
}

const props = defineProps<{
  steps: SpotlightTourStep[]
}>()

const model = defineModel<number | null>({ default: null })

const rect = ref<{ top: number, left: number, width: number, height: number } | null>(null)
const viewport = ref({ width: 1280, height: 720 })
let activeEl: Element | null = null
let retryTimer: ReturnType<typeof setTimeout> | undefined
let rafId: number | undefined
let trackUntil = 0

const currentStep = computed(() => (
  model.value !== null ? props.steps[model.value] ?? null : null
))

function syncRect() {
  if (!import.meta.client) return
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  if (!activeEl || !document.contains(activeEl)) {
    rect.value = null
    return
  }
  const box = activeEl.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) {
    rect.value = null
    return
  }
  const pad = 6
  rect.value = {
    top: box.top - pad,
    left: box.left - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  }
}

function trackFor(ms: number) {
  if (!import.meta.client) return
  if (rafId !== undefined) cancelAnimationFrame(rafId)
  trackUntil = performance.now() + ms
  const tick = () => {
    syncRect()
    if (performance.now() < trackUntil && model.value !== null) {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = undefined
    }
  }
  rafId = requestAnimationFrame(tick)
}

async function activateStep(index: number | null) {
  clearTimeout(retryTimer)
  if (rafId !== undefined) {
    cancelAnimationFrame(rafId)
    rafId = undefined
  }
  if (index === null || !props.steps[index]) {
    activeEl = null
    rect.value = null
    return
  }
  const step = props.steps[index]!
  await step.beforeEnter?.()
  await nextTick()

  const locate = (attempt = 0) => {
    const el = document.querySelector(step.target)
    if (!el) {
      if (attempt < 10) {
        retryTimer = setTimeout(() => locate(attempt + 1), 60)
      } else {
        activeEl = null
        rect.value = null
      }
      return
    }
    activeEl = el
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    syncRect()
    // Keep spotlight + popover synced while smooth vertical/horizontal scrolling finishes.
    trackFor(750)
  }
  locate()
}

watch(model, (idx) => {
  activateStep(idx)
})

function close() {
  model.value = null
}

function prev() {
  if (model.value !== null && model.value > 0) {
    model.value -= 1
  }
}

function next() {
  if (model.value === null) return
  if (model.value < props.steps.length - 1) {
    model.value += 1
  } else {
    close()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (model.value === null) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

onMounted(() => {
  window.addEventListener('scroll', syncRect, true)
  window.addEventListener('resize', syncRect)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  clearTimeout(retryTimer)
  if (rafId !== undefined) cancelAnimationFrame(rafId)
  window.removeEventListener('scroll', syncRect, true)
  window.removeEventListener('resize', syncRect)
  window.removeEventListener('keydown', onKeydown)
})

const spotlightStyle = computed(() => {
  if (!rect.value) return null
  return {
    top: `${rect.value.top}px`,
    left: `${rect.value.left}px`,
    width: `${rect.value.width}px`,
    height: `${rect.value.height}px`,
  }
})

const popoverLayout = computed(() => {
  const cardWidth = Math.min(360, viewport.value.width - 24)
  if (!rect.value) {
    return {
      style: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${cardWidth}px`,
      },
      placeAbove: false,
      arrowLeft: null as number | null,
    }
  }
  const margin = 14
  const spaceBelow = viewport.value.height - (rect.value.top + rect.value.height)
  const placeAbove = spaceBelow < 220 && rect.value.top > 220
  const top = placeAbove
    ? Math.max(margin, rect.value.top - margin)
    : Math.min(viewport.value.height - 200, rect.value.top + rect.value.height + margin)
  const targetCenterX = rect.value.left + rect.value.width / 2
  const left = Math.min(
    Math.max(margin, targetCenterX - cardWidth / 2),
    viewport.value.width - cardWidth - margin,
  )
  const arrowLeft = Math.min(Math.max(20, targetCenterX - left), cardWidth - 20)
  return {
    style: {
      top: `${top}px`,
      left: `${left}px`,
      transform: placeAbove ? 'translateY(-100%)' : undefined,
      width: `${cardWidth}px`,
    },
    placeAbove,
    arrowLeft,
  }
})

const ringClass = computed(() => {
  if (currentStep.value?.color === 'error') return 'ring-2 ring-error'
  if (currentStep.value?.color === 'warning') return 'ring-2 ring-warning'
  return 'ring-2 ring-primary'
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="currentStep"
      class="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      :aria-label="currentStep.title"
    >
      <!-- Clickable dimmed backdrop (spotlight cutout uses box-shadow when target is visible) -->
      <div
        v-if="!spotlightStyle"
        class="fixed inset-0 bg-slate-950/55 transition-opacity"
        @click="close"
      />
      <div
        v-else
        class="fixed inset-0 bg-transparent"
        @click="close"
      />

      <!-- Spotlight cutout -->
      <div
        v-if="spotlightStyle"
        :style="[spotlightStyle, { boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.58)' }]"
        class="pointer-events-none fixed rounded-md"
        :class="ringClass"
      />

      <!-- Floating step popover -->
      <div
        :style="popoverLayout.style"
        class="fixed z-10 rounded-lg border border-default bg-default p-4 shadow-xl"
        @click.stop
      >
        <div
          v-if="popoverLayout.arrowLeft !== null"
          :style="{ left: `${popoverLayout.arrowLeft}px` }"
          class="pointer-events-none absolute size-3 -translate-x-1/2 rotate-45 border-default bg-default"
          :class="popoverLayout.placeAbove ? '-bottom-1.5 border-r border-b' : '-top-1.5 border-t border-l'"
        />
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="currentStep.color ?? 'primary'"
              variant="subtle"
              size="xs"
              :label="`Step ${model! + 1} of ${steps.length}`"
            />
            <UBadge
              v-if="currentStep.badge"
              color="neutral"
              variant="outline"
              size="xs"
              :label="currentStep.badge"
            />
          </div>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Close guide"
            @click="close"
          />
        </div>

        <h3 class="mt-2 text-sm font-semibold text-highlighted">
          {{ currentStep.title }}
        </h3>
        <p class="mt-1 text-xs leading-relaxed text-muted">
          {{ currentStep.description }}
        </p>

        <div class="mt-4 flex items-center justify-between gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-left"
            label="Back"
            :disabled="model === 0"
            @click="prev"
          />
          <UButton
            size="xs"
            :color="currentStep.color ?? 'primary'"
            :trailing-icon="model! < steps.length - 1 ? 'i-lucide-chevron-right' : 'i-lucide-check'"
            :label="model! < steps.length - 1 ? 'Next' : 'Finish'"
            @click="next"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
