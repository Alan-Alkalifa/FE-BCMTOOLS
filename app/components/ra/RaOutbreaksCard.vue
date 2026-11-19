<script setup lang="ts">
import type { RaOutbreakReport } from '~/composables/useRa'

/**
 * The building map's "Disease outbreaks (WHO)" tab. WHO's Disease Outbreak News about the
 * country, newest first, each linked to who.int. The latest 20, or every item of the years
 * picked (from, to). It says when WHO was last read and credits WHO as the source.
 */
const from = ref<number | null>(null)
const to = ref<number | null>(null)
const { data: report, error } = useFetch<RaOutbreakReport>('/api/ra/outbreaks', {
  key: computed(() => `ra-outbreaks-${from.value ?? ''}-${to.value ?? ''}`),
  query: computed(() => ({ from: from.value ?? undefined, to: to.value ?? undefined })),
})
const yearItems = computed(() => raYearItems(report.value?.first_year ?? 1996))
const filtered = computed(() => from.value !== null || to.value !== null)
const backwards = computed(() => from.value !== null && to.value !== null && from.value > to.value)
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-outbreaks"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Disease outbreaks in {{ report?.country ?? 'Indonesia' }} (WHO)
          </h2>
          <p
            v-if="report?.synced_at"
            class="text-xs text-muted"
          >
            Updated {{ formatDateTime(report.synced_at) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <USelectMenu
            :model-value="from ?? undefined"
            value-key="value"
            :items="yearItems"
            placeholder="From year"
            :search-input="false"
            :clear="from !== null"
            class="w-36"
            aria-label="WHO news from year"
            @update:model-value="(value: number | null | undefined) => (from = value ?? null)"
          />
          <USelectMenu
            :model-value="to ?? undefined"
            value-key="value"
            :items="yearItems"
            placeholder="To year"
            :search-input="false"
            :clear="to !== null"
            class="w-36"
            aria-label="WHO news to year"
            @update:model-value="(value: number | null | undefined) => (to = value ?? null)"
          />
        </div>
      </div>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="backwards"
        color="warning"
        variant="subtle"
        icon="i-lucide-calendar-x"
        title="The to year is before the from year"
      />
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load WHO's outbreak news"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="report && !report.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="WHO's outbreak news is switched off"
        description="BCM switches it on in Administration › Sites configuration › Past disasters."
      />
      <UAlert
        v-else-if="report?.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        title="The last read of WHO failed"
        :description="report.error"
      />

      <ul
        v-if="report?.items.length"
        class="divide-y divide-default rounded-md border border-default"
      >
        <li
          v-for="item in report.items"
          :key="item.id"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
        >
          <UBadge
            color="warning"
            variant="subtle"
            size="lg"
            class="w-fit shrink-0 tabular-nums"
            :label="formatDate(item.on) ?? item.on"
          />
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-medium text-highlighted">
              {{ item.title }}
            </p>
            <p
              v-if="item.don_id"
              class="text-muted"
            >
              {{ item.don_id }}
            </p>
          </div>
          <UButton
            :to="item.url"
            target="_blank"
            rel="noopener"
            color="neutral"
            variant="ghost"
            size="sm"
            trailing-icon="i-lucide-external-link"
            label="Read on who.int"
          />
        </li>
      </ul>
      <p
        v-else-if="report && report.enabled && !error"
        class="py-4 text-center text-sm text-muted"
      >
        <template v-if="!report.synced_at">
          WHO hasn't been read yet.
        </template>
        <template v-else-if="filtered">
          WHO has no outbreak news about {{ report.country }} in these years.
        </template>
        <template v-else>
          WHO has no outbreak news about {{ report.country }}.
        </template>
      </p>
      <p
        v-if="report && report.items.length && filtered"
        class="text-sm text-muted"
      >
        {{ formatNumber(report.matching, 0) }} {{ report.matching === 1 ? 'item' : 'items' }}<template v-if="report.matching > report.items.length">
          , the latest {{ report.items.length }} shown
        </template>.
      </p>
      <p
        v-else-if="report && report.total > report.items.length"
        class="text-sm text-muted"
      >
        The latest {{ report.items.length }} of {{ formatNumber(report.total, 0) }}.
      </p>

      <p class="text-xs text-muted">
        Source: {{ report?.source ?? 'WHO Disease Outbreak News' }},
        <a
          :href="report?.source_url ?? 'https://www.who.int/emergencies/disease-outbreak-news'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >who.int</a>.
      </p>
    </div>
  </UCard>
</template>
