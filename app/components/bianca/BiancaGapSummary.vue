<script setup lang="ts">
export type BiancaGapTab = 'details' | 'impact' | 'dependencies' | 'recovery'
export type BiancaGapMap = Partial<Record<BiancaGapTab, string[]>>

const props = withDefaults(defineProps<{
  gaps?: BiancaGapMap | null
  status?: string
}>(), {
  gaps: () => ({}),
  status: undefined,
})

const emit = defineEmits<{
  check: [payload: { tab: BiancaGapTab, message: string }]
}>()

const route = useRoute()
const showGapSummary = false

const TABS: Array<{ value: BiancaGapTab, label: string }> = [
  { value: 'details', label: 'Details & personnel' },
  { value: 'impact', label: 'Impact assessment' },
  { value: 'dependencies', label: 'IT & non-IT dependencies' },
  { value: 'recovery', label: 'Recovery' },
]

const normalized = computed<Record<BiancaGapTab, string[]>>(() => ({
  details: props.gaps?.details ?? [],
  impact: props.gaps?.impact ?? [],
  dependencies: props.gaps?.dependencies ?? [],
  recovery: props.gaps?.recovery ?? [],
}))

const gapCount = computed(() =>
  TABS.reduce((sum, item) => sum + normalized.value[item.value].length, 0),
)

function tabLink(tab: BiancaGapTab) {
  return { query: { ...route.query, tab: tab === 'details' ? undefined : tab } }
}
</script>

<template>
  <div
    v-if="showGapSummary"
    class="rounded-md border p-3"
    :class="gapCount ? 'border-warning/40 bg-warning/5' : 'border-default'"
  >
    <p
      class="flex items-center gap-2 text-sm font-medium"
      :class="gapCount ? 'text-warning' : 'text-success'"
    >
      <UIcon
        :name="gapCount ? 'i-lucide-triangle-alert' : 'i-lucide-circle-check'"
        class="size-4"
      />
      {{ gapCount ? `Gap check: ${gapCount} gap${gapCount === 1 ? '' : 's'}` : 'Gap check: no gaps' }}
    </p>
    <dl
      v-if="gapCount"
      class="mt-2 space-y-2 text-sm"
    >
      <template
        v-for="tab in TABS"
        :key="tab.value"
      >
        <div v-if="normalized[tab.value].length">
          <dt>
            <NuxtLink
              :to="tabLink(tab.value)"
              class="font-medium text-highlighted hover:text-primary hover:underline"
            >
              {{ tab.label }}
            </NuxtLink>
          </dt>
          <dd>
            <ul class="space-y-1.5 text-muted">
              <li
                v-for="item in normalized[tab.value]"
                :key="item"
                class="flex items-start justify-between gap-3 rounded-md py-0.5"
              >
                <span class="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    class="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-60"
                  />
                  <span>{{ item }}</span>
                </span>
                <UButton
                  type="button"
                  color="warning"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-locate-fixed"
                  label="Check"
                  class="shrink-0"
                  @click="emit('check', { tab: tab.value, message: item })"
                />
              </li>
            </ul>
          </dd>
        </div>
      </template>
    </dl>
    <p
      v-if="gapCount && status === 'draft'"
      class="mt-2 text-xs text-muted"
    >
      Gaps don't block Submit. Explain them in the justification notes on Part 2a, Part 2b or the RA Questionnaire.
    </p>
  </div>
</template>
