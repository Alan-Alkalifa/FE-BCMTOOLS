<script setup lang="ts">
import type { RaFormula } from '~/composables/useRa'

/**
 * "How to fill in the questionnaire": the workbook's Lampiran (appendix) reference tables 1–4,
 * in a dialog opened by a button.
 */
const props = defineProps<{ formula: RaFormula }>()

const open = ref(false)

const tabs = [
  { label: 'Historical', value: 'historical', slot: 'historical' as const },
  { label: 'Probability', value: 'probability', slot: 'probability' as const },
  { label: 'Impact', value: 'impact', slot: 'impact' as const },
  { label: 'Mitigation', value: 'mitigation', slot: 'mitigation' as const },
]

const RATINGS = [5, 4, 3, 2, 1]

function guide(scale: RaGuideScale, rating: number) {
  return props.formula.guides[scale]?.find((item) => item.rating === rating)
}

/** "5 (Critical)": the impact labels sit on the monetary scale, as in the workbook. */
function ratingLabel(scale: RaGuideScale, rating: number) {
  const label = guide(scale, rating)?.label
  return label ? `${rating} (${label})` : String(rating)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="How to fill in the questionnaire"
    description="The reference tables of the workbook's Lampiran (appendix)."
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-book-open"
      label="How to fill in the questionnaire"
    />

    <template #body>
      <UTabs
        :items="tabs"
        default-value="historical"
        variant="link"
        class="min-w-0"
      >
        <template #historical>
          <div class="overflow-x-auto pt-2">
            <table class="w-full text-sm">
              <caption class="pb-2 text-left font-semibold text-highlighted">
                Table 1: Historical occurrences rating
              </caption>
              <thead>
                <tr class="border-b border-default text-left text-xs text-muted uppercase">
                  <th
                    scope="col"
                    class="py-2 pr-4"
                  >
                    Historical occurrences
                  </th>
                  <th
                    scope="col"
                    class="w-28 py-2"
                  >
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rating in RATINGS"
                  :key="rating"
                  class="border-b border-default last:border-0"
                >
                  <td
                    lang="id"
                    class="py-2 pr-4"
                  >
                    {{ guide('historical', rating)?.guidance }}
                  </td>
                  <td class="py-2 font-medium text-highlighted tabular-nums">
                    {{ ratingLabel('historical', rating) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template #probability>
          <div class="overflow-x-auto pt-2">
            <table class="w-full text-sm">
              <caption class="pb-2 text-left font-semibold text-highlighted">
                Table 2: Probability of occurrences rating
              </caption>
              <thead>
                <tr class="border-b border-default text-left text-xs text-muted uppercase">
                  <th
                    scope="col"
                    class="py-2 pr-4"
                  >
                    Probability
                  </th>
                  <th
                    scope="col"
                    class="w-40 py-2"
                  >
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rating in RATINGS"
                  :key="rating"
                  class="border-b border-default last:border-0"
                >
                  <td
                    lang="id"
                    class="py-2 pr-4"
                  >
                    {{ guide('probability', rating)?.guidance }}
                  </td>
                  <td class="py-2 font-medium text-highlighted tabular-nums">
                    {{ ratingLabel('probability', rating) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template #impact>
          <div class="overflow-x-auto pt-2">
            <table class="w-full min-w-[56rem] text-sm">
              <caption class="pb-2 text-left font-semibold text-highlighted">
                Table 3: Monetary and non-monetary impact rating
                <span class="block text-xs font-normal text-muted">Rate each impact that applies.</span>
              </caption>
              <thead>
                <tr class="text-left text-xs text-muted uppercase">
                  <th
                    scope="col"
                    rowspan="2"
                    class="w-[22%] border-b border-default py-2 pr-4 align-bottom"
                  >
                    Monetary impact
                  </th>
                  <th
                    scope="colgroup"
                    colspan="3"
                    class="py-2 pr-4"
                  >
                    Non-monetary impact
                  </th>
                  <th
                    scope="col"
                    rowspan="2"
                    class="w-32 border-b border-default py-2 align-bottom"
                  >
                    Rating
                  </th>
                </tr>
                <tr class="border-b border-default text-left text-xs text-muted uppercase">
                  <th
                    scope="col"
                    class="py-2 pr-4"
                  >
                    Human impact
                  </th>
                  <th
                    scope="col"
                    class="py-2 pr-4"
                  >
                    Reputation impact
                  </th>
                  <th
                    scope="col"
                    class="py-2 pr-4"
                  >
                    Infrastructure impact
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rating in RATINGS"
                  :key="rating"
                  class="border-b border-default align-top last:border-0"
                >
                  <td
                    v-for="scale in (['monetary', 'human', 'reputation', 'infrastructure'] as const)"
                    :key="scale"
                    lang="id"
                    class="py-2 pr-4"
                  >
                    {{ guide(scale, rating)?.guidance }}
                  </td>
                  <td class="py-2 font-medium text-highlighted tabular-nums">
                    {{ ratingLabel('monetary', rating) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template #mitigation>
          <div class="overflow-x-auto pt-2">
            <table class="w-full text-sm">
              <caption class="pb-2 text-left font-semibold text-highlighted">
                Table 4: Examples of suggested risk mitigation strategies
              </caption>
              <thead>
                <tr class="border-b border-default text-left text-xs text-muted uppercase">
                  <th
                    scope="col"
                    class="w-56 py-2 pr-4"
                  >
                    Area
                  </th>
                  <th
                    scope="col"
                    class="py-2"
                  >
                    Suggested strategy
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="example in formula.mitigation_examples"
                  :key="example.area"
                  class="border-b border-default align-top last:border-0"
                >
                  <th
                    scope="row"
                    class="py-2 pr-4 text-left font-medium text-highlighted"
                  >
                    {{ example.area }}
                  </th>
                  <td
                    lang="id"
                    class="py-2 whitespace-pre-line"
                  >
                    {{ example.example }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </UTabs>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          color="neutral"
          variant="outline"
          label="Close"
          @click="open = false"
        />
      </div>
    </template>
  </UModal>
</template>
