<script setup lang="ts">
/**
 * The reference tables at the bottom of the workbook's sheets, opened from the part they belong
 * to: Part 1 (impact matrices and the Suggested MTD rule), Part 2a (category criteria and DAAT)
 * and Part 3 (alternate site strategy and the worked example).
 */
const props = defineProps<{ part: 'p1' | 'p2a' | 'p3', categoryByMtd?: { value: string, category: string | null }[] }>()

const titles = {
  p1: 'Part 1 reference: impact assessment',
  p2a: 'Part 2a reference: category and DAAT',
  p3: 'Part 3 reference: recovery strategies',
}

const mtdByCategory = computed(() => {
  const out: Record<string, string[]> = {}
  for (const item of props.categoryByMtd ?? []) {
    if (item.category) (out[item.category] ??= []).push(item.value)
  }
  return out
})

const regulatory = [
  { score: 3, text: 'Breach of laws and/or regulations (other than below), including the requirements of the local bank regulators.' },
  { score: 2, text: 'Non-compliance with guidelines and/or requirements (i.e. best practices) of the internal / local bank associations / local bank regulators.' },
  { score: 1, text: 'No foreseeable breach and/or non-compliance.' },
]
const customer = [
  { score: 3, text: 'More than 20% of the business unit\'s customer base affected by the disaster.' },
  { score: 2, text: 'Less than 20% of the business unit\'s customer base affected by the disaster.' },
  { score: 1, text: 'No customer affected by the disaster.' },
]
const daatSteps = [
  'Incident / outage occurs.',
  'DAAT: assess the damage and decide.',
  'DAAT checkpoint: invoke the DRP and activate the BCP.',
  'System recovery process (RTO), up to the system recovery checkpoint, then the DR swing period.',
  'System recovered.',
  'Backlog: clear the delayed transactions.',
  'Data current: the system is available to customers and business resumes. All of this must fit within the MTD.',
]
const example = [
  {
    row: 'Alternate site (planned capacity)',
    staff: '5 staff (50% planned capacity doesn\'t mean half of the total staff)',
    level: '50% (1,000 transactions daily / support the Business Critical functions)',
    prioritization: 'Which 1,000 transactions are processed first? Which support function is prioritised first? Can we stop all project work?',
    outstanding: 'Outsource to a 3rd party? Work in 2–3 shifts round the clock? Shift arrangement for up to 4 weeks? Bring a system offline for a batch job run?',
  },
  {
    row: 'Production',
    staff: '10 staff (100%)',
    level: '100% (2,000 transactions daily / all business functions)',
    prioritization: 'Business as usual',
    outstanding: 'Business as usual',
  },
]
</script>

<template>
  <USlideover
    :title="titles[part]"
    description="From the BIA workbook (Template BIA ver 2.4)."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <UButton
      color="neutral"
      variant="link"
      icon="i-lucide-book-open"
      label="Reference"
      class="px-0"
    />
    <template #body>
      <div class="space-y-6 text-sm">
        <template v-if="part === 'p1'">
          <section class="space-y-2">
            <h3 class="font-semibold">
              Potential cumulative financial loss
            </h3>
            <table class="w-full text-left">
              <thead class="text-xs text-muted">
                <tr>
                  <th class="py-1 pe-3 font-medium">
                    Risk impact
                  </th>
                  <th class="py-1 font-medium">
                    Cumulative financial loss
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="row in BIANCA_LOSS_MATRIX"
                  :key="row.impact"
                >
                  <td class="py-1.5 pe-3 font-medium">
                    {{ row.impact }}
                  </td>
                  <td class="py-1.5">
                    {{ row.loss }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="text-xs text-muted">
              Updated to SOP BIA 2026.
            </p>
          </section>
          <section
            v-for="matrix in [{ title: 'Potential regulatory impact (A)', rows: regulatory }, { title: 'Potential customer service impact (B)', rows: customer }]"
            :key="matrix.title"
            class="space-y-2"
          >
            <h3 class="font-semibold">
              {{ matrix.title }}
            </h3>
            <dl class="divide-y divide-default">
              <div
                v-for="row in matrix.rows"
                :key="row.score"
                class="flex gap-3 py-1.5"
              >
                <dt class="w-16 shrink-0 font-medium whitespace-nowrap">
                  Score {{ row.score }}
                </dt>
                <dd>{{ row.text }}</dd>
              </div>
            </dl>
          </section>
          <section class="space-y-2">
            <h3 class="font-semibold">
              Suggested MTD
            </h3>
            <p>The Suggested MTD is the first period in which:</p>
            <ol class="list-decimal space-y-1 ps-5">
              <li>the potential cumulative financial loss is more than IDR 4 billion, or</li>
              <li>the potential regulatory impact is rated 3, or</li>
              <li>the potential customer service impact is rated 3.</li>
            </ol>
            <p>Whichever comes first. If none of them happens, pick 4 weeks.</p>
          </section>
        </template>

        <template v-else-if="part === 'p2a'">
          <section class="space-y-3">
            <h3 class="font-semibold">
              Business function categorization criteria
            </h3>
            <div
              v-for="item in BIANCA_CATEGORY_CRITERIA"
              :key="item.category"
              class="space-y-1.5 rounded-md border border-default p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge
                  :scale="BIANCA_CATEGORY"
                  :value="item.category as keyof typeof BIANCA_CATEGORY"
                  size="sm"
                />
                <span class="text-xs text-muted">{{ item.mtd }}</span>
              </div>
              <ul class="list-disc space-y-1 ps-5">
                <li
                  v-for="point in item.points"
                  :key="point"
                >
                  {{ point }}
                </li>
              </ul>
              <p
                v-if="mtdByCategory[item.category]"
                class="text-xs text-muted"
              >
                Expected MTD: {{ mtdByCategory[item.category]!.join(', ') }}
              </p>
            </div>
          </section>
          <section class="space-y-2">
            <h3 class="font-semibold">
              DAAT: Damage Assessment Allowable Time
            </h3>
            <p class="rounded-md bg-elevated/50 p-2 font-medium">
              DAAT = Expected MTD − system RTO − backlog clearing time
            </p>
            <p>The time allowed to assess the damage before the BCP / DR has to be activated, so that recovery and the backlog still fit in the MTD:</p>
            <ol class="list-decimal space-y-1 ps-5">
              <li
                v-for="step in daatSteps"
                :key="step"
              >
                {{ step }}
              </li>
            </ol>
          </section>
        </template>

        <template v-else>
          <section class="space-y-3">
            <h3 class="font-semibold">
              Recommended alternate site strategy
            </h3>
            <div
              v-for="(item, category) in BIANCA_ALT_SITE_BY_CATEGORY"
              :key="category"
              class="space-y-1.5 rounded-md border border-default p-3"
            >
              <StatusBadge
                :scale="BIANCA_CATEGORY"
                :value="category as keyof typeof BIANCA_CATEGORY"
                size="sm"
              />
              <p>{{ item.text }}</p>
            </div>
          </section>
          <section class="space-y-3">
            <h3 class="font-semibold">
              Example
            </h3>
            <div
              v-for="row in example"
              :key="row.row"
              class="space-y-1 rounded-md border border-default p-3"
            >
              <p class="font-medium">
                {{ row.row }}
              </p>
              <dl class="grid gap-x-3 gap-y-1 sm:grid-cols-[10rem_1fr]">
                <dt class="text-muted">
                  Staff required
                </dt>
                <dd>{{ row.staff }}</dd>
                <dt class="text-muted">
                  Recovery level
                </dt>
                <dd>{{ row.level }}</dd>
                <dt class="text-muted">
                  Prioritization
                </dt>
                <dd>{{ row.prioritization }}</dd>
                <dt class="text-muted">
                  Outstanding work
                </dt>
                <dd>{{ row.outstanding }}</dd>
              </dl>
            </div>
          </section>
        </template>
      </div>
    </template>
  </USlideover>
</template>
