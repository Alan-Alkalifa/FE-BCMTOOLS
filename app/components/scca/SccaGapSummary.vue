<script setup lang="ts">
import type { SccaAssessment } from '~/composables/useScca'

/**
 * The SCCA's missing fields (drafts only) and its gaps, grouped by tab, each linking to the
 * tab. The same panel, wording and order in Manage, Approval and Monitoring.
 */
const props = withDefaults(defineProps<{
  assessment: SccaAssessment
  standards?: SccaConfigStandard[]
  /** Show what is still missing (Manage, while it is a draft). */
  showMissing?: boolean
}>(), { standards: () => [], showMissing: false })

const route = useRoute()
const config = useSccaConfigContext()

const missing = computed(() => sccaMissing(props.assessment, config.value))
const gaps = computed(() => sccaGaps(props.assessment, config.value, props.standards))
const missingCount = computed(() => sccaMissingCount(missing.value))
const gapCount = computed(() => sccaMissingCount(gaps.value))

function tabLink(tab: SccaCheckTab) {
  return { query: { ...route.query, tab } }
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="showMissing && missingCount"
      class="rounded-md border border-error/40 bg-error/5 p-3"
      role="alert"
    >
      <p class="flex items-center gap-2 text-sm font-medium text-error">
        <UIcon
          name="i-lucide-circle-alert"
          class="size-4"
        />
        {{ missingCount }} thing{{ missingCount === 1 ? '' : 's' }} to fill in before you submit
      </p>
      <dl class="mt-2 space-y-2 text-sm">
        <template
          v-for="tab in SCCA_CHECK_TABS"
          :key="`missing-${tab.value}`"
        >
          <div v-if="missing[tab.value].length">
            <dt>
              <NuxtLink
                :to="tabLink(tab.value)"
                class="font-medium text-highlighted hover:text-primary hover:underline"
              >
                {{ tab.label }}
              </NuxtLink>
            </dt>
            <dd>
              <ul class="list-disc space-y-0.5 pl-5 text-muted">
                <li
                  v-for="item in missing[tab.value]"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </dd>
          </div>
        </template>
      </dl>
    </div>

    <div
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
          v-for="tab in SCCA_CHECK_TABS"
          :key="`gaps-${tab.value}`"
        >
          <div v-if="gaps[tab.value].length">
            <dt>
              <NuxtLink
                :to="tabLink(tab.value)"
                class="font-medium text-highlighted hover:text-primary hover:underline"
              >
                {{ tab.label }}
              </NuxtLink>
            </dt>
            <dd>
              <ul class="list-disc space-y-0.5 pl-5 text-muted">
                <li
                  v-for="item in gaps[tab.value]"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </dd>
          </div>
        </template>
      </dl>
      <p
        v-if="gapCount && assessment.status === 'draft'"
        class="mt-2 text-xs text-muted"
      >
        Gaps don't block Submit. Explain them in the justification on Result and sign-off, or in the gap notes on Interdependencies.
      </p>
    </div>
  </div>
</template>
