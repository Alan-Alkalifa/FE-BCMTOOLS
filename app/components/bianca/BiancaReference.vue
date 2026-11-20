<script setup lang="ts">
import { BIANCA_PARTS } from '~/utils/biancaParts'

/**
 * The REFERENCE box at the bottom of the workbook's sheets (Template BIA ver 2.4), shown in a
 * panel beside the form for the part being filled, so it can be read while filling: Part 1 (the impact matrices and the Suggested MTD rule), Part 2a (MTD,
 * RTO and RPO, the categorization criteria and the DAAT timeline), Part 2b (planned capacity)
 * and Part 3 (alternate site strategy and the worked example). Part 4's sheet has none.
 */
const props = defineProps<{
  part: 'p1' | 'p2a' | 'p2b' | 'p3'
  categoryByMtd?: { value: string, category: string | null }[]
  /** Whether the Business functions tab is the one shown (the form keeps the other tabs mounted). */
  active?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

// The hint at the hide button: shown 2 seconds after the page has loaded, each time the
// Business functions tab is opened or another part is shown, until "Got it!" is clicked.
const HINT_KEY = 'bianca:guidance-hint-seen'
const hint = ref(false)
let hintTimer: ReturnType<typeof setTimeout> | undefined
function hintSeen() {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}
function loaded() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'complete') resolve()
    else window.addEventListener('load', () => resolve(), { once: true })
  })
}
async function showHint() {
  clearTimeout(hintTimer)
  hint.value = false
  if (!props.active || hintSeen()) return
  await loaded()
  hintTimer = setTimeout(() => {
    if (props.active && !hintSeen()) hint.value = true
  }, 2000)
}
function gotIt() {
  hint.value = false
  try {
    localStorage.setItem(HINT_KEY, '1')
  } catch { /* the hint shows again next time */ }
}
onMounted(showHint)
watch(() => [props.part, props.active], showHint)
onBeforeUnmount(() => clearTimeout(hintTimer))
const partLabel = computed(() => BIANCA_PARTS.find((item) => item.value === props.part)?.label ?? '')

const mtdByCategory = computed(() => {
  const out: Record<string, string[]> = {}
  for (const item of props.categoryByMtd ?? []) {
    if (item.category) (out[item.category] ??= []).push(item.value)
  }
  return out
})

const regulatory = [
  { score: 3, text: 'Breach of laws and / or regulations (other than the below), including requirements issued by the local bank regulators.' },
  { score: 2, text: 'Non-compliance with guidelines and / or requirements (i.e. best practices) issued by the internal / local bank associations / local bank regulators.' },
  { score: 1, text: 'No foreseeable breach and / or non-compliance issues.' },
]
const customer = [
  { score: 3, text: 'More than 20% of the business unit\'s customer base affected by the disaster.' },
  { score: 2, text: 'Less than 20% of the business unit\'s customer base affected by the disaster.' },
  { score: 1, text: 'No customer affected by the disaster.' },
]
const definitions = [
  {
    term: 'Maximum Tolerable Downtime (MTD)',
    text: 'The target duration to recover a specific business process. It has two components: (1) the time from the point of disruption to the declaration and activation of the BCP / DRP, and (2) the time from the activation of the BCP / DRP to the point when the business function is recovered.',
    hint: 'Pick the Expected MTD from the list, more specific as per business / regulation requirements, referring to the Suggested MTD of Part 1. It should be equal to or shorter than the Suggested MTD.',
  },
  {
    term: 'Recovery Time Objective (RTO)',
    text: 'The target duration from the incident being reported and the BCP / DRP activated to the point when the specific IT application system is recovered.',
  },
  {
    term: 'Recovery Point Objective (RPO)',
    text: 'The point in time to which data is recovered (acceptable data loss), such as the last transaction entered / last successful transaction (LST), end-of-day / previous day backup (PDB) and last successful backup (LSB).',
  },
]
const daatSteps = [
  { n: '1', text: 'Incident / outage occurs.' },
  { n: '2', text: 'DAAT: assess the damage and decide.' },
  { n: '3', text: 'DAAT checkpoint: DRP invoked, BCP activated.' },
  { n: '4A', text: 'System recovery checkpoint (the system recovery process, within the RTO).' },
  { n: '4B', text: 'DR swing period.' },
  { n: '5', text: 'System recovered.' },
  { n: '6', text: 'Backlog: clear the delayed transactions.' },
  { n: '7', text: 'Data current: the system is available to customers and the business resumes. All of this must fit within the MTD.' },
]
const capacity = [
  { term: 'Planned capacity', text: 'The % of business-as-usual activities the business / support unit will be operating at during the period of business interruption.' },
  { term: 'Planned capacity for each business process', text: 'The business unit states the planned capacity for operations during the business interruption, agreed with its upstream business unit / party if any, and plans all the resources required in the BCP on that capacity.' },
  { term: 'Planned capacity of upstream / downstream', text: 'Each business unit finds out the planned capacity of its upstream and downstream during the business interruption, so it is also aware of its obligations towards its upstream. The upstream\'s planned capacity should be more than or equal to your function\'s, and its MTD less than or equal to your function\'s MTD.' },
  { term: 'External dependencies', text: 'When the upstream / downstream is an external party, pick "SLA" as its planned capacity if there is an SLA with it on the BCP arrangement; otherwise "NA".' },
]
const example = [
  {
    row: 'Alternate site (planned capacity)',
    staff: '5 staff (note: 50% planned capacity doesn\'t mean half of the total staff)',
    level: '50% (1,000 transactions daily / support the Business Critical functions)',
    prioritization: ['Which 1,000 transactions are processed first?', 'Which support function is prioritised first?', 'Can we stop all project work?'],
    outstanding: ['Can the outstanding work be outsourced to a 3rd party?', 'Can staff work in shifts (2–3 shifts round the clock) to clear the daily outstanding work?', 'Can a shift arrangement be carried out for a disruption of up to 4 weeks?', 'Does a system have to be brought offline for a batch job run?'],
  },
  {
    row: 'Production',
    staff: '10 staff (100%)',
    level: '100% (2,000 transactions daily / all business functions)',
    prioritization: ['Business as usual'],
    outstanding: ['Business as usual'],
  },
]
</script>

<template>
  <section
    id="bianca-reference"
    class="@container scroll-mt-4 overflow-hidden rounded-md border border-error/30 bg-default"
    :aria-label="`Reference for ${partLabel}`"
  >
    <div class="sticky top-0 z-10 flex items-center justify-between gap-2 bg-error/10 px-3 py-2 backdrop-blur">
      <div class="min-w-0">
        <p class="flex items-center gap-2 text-sm font-semibold tracking-wide text-error uppercase">
          <UIcon
            name="i-lucide-book-open"
            class="size-4"
          />
          Guidance
        </p>
        <p class="truncate text-xs text-muted">
          {{ partLabel }} · from the workbook (ver 2.4)
        </p>
      </div>
      <!-- Says once it opens that it can be hidden -->
      <UPopover
        v-model:open="hint"
        :content="{ side: 'left', sideOffset: 6, onOpenAutoFocus: (event: Event) => event.preventDefault() }"
        arrow
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-panel-right-close"
          aria-label="Hide the guidance"
          @click="emit('close')"
        />
        <template #content>
          <div class="max-w-60 space-y-2 p-3 text-xs">
            <div class="flex items-start gap-2">
              <UIcon
                name="i-lucide-info"
                class="mt-px size-4 shrink-0 text-primary"
              />
              <p>You can hide the guidance here, and show it again with <span class="font-medium">Show Guidance</span>.</p>
            </div>
            <div class="flex justify-end">
              <UButton
                size="xs"
                label="Got it!"
                @click="gotIt"
              />
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <div class="space-y-6 p-3 text-sm">
      <!-- Part 1 -->
      <template v-if="part === 'p1'">
        <div class="grid gap-6 @3xl:grid-cols-2">
          <section class="space-y-2">
            <h4 class="font-semibold text-error">
              Potential cumulative financial loss matrix*
            </h4>
            <table class="w-full border border-default text-left">
              <thead class="bg-elevated text-xs">
                <tr>
                  <th class="border-e border-default px-2 py-1.5 font-semibold">
                    Risk impact
                  </th>
                  <th class="px-2 py-1.5 font-semibold">
                    Potential cumulative financial loss
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="row in BIANCA_LOSS_MATRIX"
                  :key="row.impact"
                >
                  <td class="border-e border-default px-2 py-1.5 font-medium">
                    {{ row.impact }}
                  </td>
                  <td class="px-2 py-1.5">
                    {{ row.loss }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="text-xs text-muted">
              *) Updated to SOP BIA 2026.
            </p>
          </section>
          <div class="space-y-6">
            <section
              v-for="matrix in [{ title: 'Potential regulatory impact matrix', head: 'Potential regulatory impact (A)', rows: regulatory }, { title: 'Potential customer service impact matrix', head: 'Potential customer service impact (B)', rows: customer }]"
              :key="matrix.title"
              class="space-y-2"
            >
              <h4 class="font-semibold text-error">
                {{ matrix.title }}
              </h4>
              <table class="w-full border border-default text-left">
                <thead class="bg-elevated text-xs">
                  <tr>
                    <th class="w-16 border-e border-default px-2 py-1.5 text-center font-semibold">
                      Score
                    </th>
                    <th class="px-2 py-1.5 font-semibold">
                      {{ matrix.head }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dashed divide-default">
                  <tr
                    v-for="row in matrix.rows"
                    :key="row.score"
                  >
                    <td class="border-e border-default px-2 py-1.5 text-center font-medium tabular-nums">
                      {{ row.score }}
                    </td>
                    <td class="px-2 py-1.5">
                      {{ row.text }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </div>
        <section class="space-y-1 text-error">
          <h4 class="font-semibold">
            Determination of the business function Suggested MTD
          </h4>
          <p>The business function's MTD is determined when:</p>
          <ol class="list-decimal space-y-0.5 ps-5">
            <li>the potential cumulative financial loss is more than IDR 4 billion*; or</li>
            <li>the potential regulatory impact is rated 3; or</li>
            <li>the potential customer service impact is rated 3.</li>
          </ol>
          <p class="font-semibold">
            Whichever comes first. If none of the above is reached, select 4 weeks as the business function's Suggested MTD.
          </p>
        </section>
      </template>

      <!-- Part 2a -->
      <template v-else-if="part === 'p2a'">
        <section class="space-y-1 text-muted">
          <p>* If the IT committed RTO of an IT application system is equal to or more than the business function's Expected MTD, say whether there is a process workaround when the system is not available (and justify it in the note under the table).</p>
          <p>** The IT application system details in the list have been confirmed and endorsed by the IT Infra team in the annual DR assessment. They are reviewed annually, or as and when required.</p>
        </section>
        <div class="grid gap-6 @3xl:grid-cols-2">
          <section class="space-y-3">
            <div
              v-for="item in definitions"
              :key="item.term"
              class="space-y-1"
            >
              <h4 class="font-semibold text-error">
                {{ item.term }}
              </h4>
              <p>{{ item.text }}</p>
              <p
                v-if="item.hint"
                class="text-muted"
              >
                {{ item.hint }}
              </p>
            </div>
          </section>
          <section class="space-y-2">
            <h4 class="font-semibold text-error">
              Business function categorization
            </h4>
            <table class="w-full border border-default text-left">
              <thead class="bg-elevated text-xs">
                <tr>
                  <th class="w-32 border-e border-default px-2 py-1.5 font-semibold">
                    Category
                  </th>
                  <th class="px-2 py-1.5 font-semibold">
                    Categorization criteria
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="item in BIANCA_CATEGORY_CRITERIA"
                  :key="item.category"
                  class="align-top"
                >
                  <td class="border-e border-default px-2 py-1.5">
                    <StatusBadge
                      :scale="BIANCA_CATEGORY"
                      :value="item.category as keyof typeof BIANCA_CATEGORY"
                      size="sm"
                    />
                  </td>
                  <td class="space-y-1 px-2 py-1.5">
                    <ul class="list-disc space-y-0.5 ps-4">
                      <li
                        v-for="point in item.points"
                        :key="point"
                      >
                        {{ point }}
                      </li>
                      <li>{{ item.mtd }}.</li>
                    </ul>
                    <p
                      v-if="mtdByCategory[item.category]"
                      class="text-xs text-muted"
                    >
                      Expected MTD in BIANCA: {{ mtdByCategory[item.category]!.join(', ') }}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <section class="space-y-3">
          <h4 class="font-semibold text-error">
            DAAT: Damage Assessment Allowable Time
          </h4>
          <p class="rounded-md bg-elevated/60 p-2 font-medium">
            DAAT = Expected MTD − system RTO − backlog clearing time
          </p>
          <!-- The workbook's timeline picture, drawn -->
          <div
            class="space-y-1 overflow-x-auto pb-1 text-xs"
            role="img"
            aria-label="Timeline: the MTD runs from the incident to data current; the RTO from the DAAT checkpoint to the system recovered; the BCP period from the DAAT checkpoint to the end."
          >
            <div class="min-w-[36rem] space-y-1">
              <div class="grid grid-cols-[20%_55%_25%]">
                <div class="col-span-3 border-x-2 border-b-2 border-warning/70 pb-0.5 text-center font-medium">
                  Maximum Tolerable Downtime (MTD)
                </div>
              </div>
              <div class="grid grid-cols-[20%_55%_25%]">
                <span />
                <div class="border-x-2 border-b-2 border-error/70 pb-0.5 text-center font-medium">
                  Recovery Time Objective (RTO)
                </div>
              </div>
              <div class="grid grid-cols-[20%_80%]">
                <span />
                <div class="border-x-2 border-b-2 border-success/70 pb-0.5 text-center font-medium">
                  BCP period
                </div>
              </div>
              <div class="grid grid-cols-[20%_55%_25%] text-center">
                <div class="border-b-2 border-dashed border-info p-1">
                  (2) DAAT
                </div>
                <div class="grid grid-cols-2 border-b-2 border-info bg-info/10">
                  <span class="border-e border-dashed border-info p-1">(4A) System recovery</span>
                  <span class="p-1">(4B) DR swing period</span>
                </div>
                <div class="border-b-2 border-dashed border-info p-1">
                  (6) Backlog
                </div>
              </div>
              <div class="grid grid-cols-[20%_55%_25%] text-muted">
                <span>(1) Incident</span>
                <span>(3) DAAT checkpoint: DRP invoked, BCP activated</span>
                <span>(5) System recovered → (7) Data current</span>
              </div>
            </div>
          </div>
          <ol class="grid gap-x-6 gap-y-1 @xl:grid-cols-2">
            <li
              v-for="step in daatSteps"
              :key="step.n"
              class="flex gap-2"
            >
              <span class="w-7 shrink-0 font-medium tabular-nums">({{ step.n }})</span>
              <span>{{ step.text }}</span>
            </li>
          </ol>
        </section>
      </template>

      <!-- Part 2b -->
      <template v-else-if="part === 'p2b'">
        <p class="text-muted">
          * If the upstream's / downstream's planned capacity is less than your business function's planned capacity, or its MTD is longer than your function's Expected MTD, state the action required / any process workaround to keep supporting your business function within the agreed timeline / SLA when your upstream / downstream is struck by a disaster (in the note under the table).
        </p>
        <dl class="space-y-3">
          <div
            v-for="item in capacity"
            :key="item.term"
          >
            <dt class="font-semibold text-error">
              {{ item.term }}
            </dt>
            <dd>{{ item.text }}</dd>
          </div>
        </dl>
      </template>

      <!-- Part 3 -->
      <template v-else>
        <section class="space-y-2">
          <h4 class="font-semibold text-error">
            Recommended alternate site strategy
          </h4>
          <table class="w-full border border-default text-left">
            <thead class="bg-elevated text-xs">
              <tr>
                <th class="w-36 border-e border-default px-2 py-1.5 font-semibold">
                  Business function category
                </th>
                <th class="px-2 py-1.5 font-semibold">
                  Recommended alternate site strategy
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(item, category) in BIANCA_ALT_SITE_BY_CATEGORY"
                :key="category"
              >
                <td class="border-e border-default px-2 py-1.5">
                  <StatusBadge
                    :scale="BIANCA_CATEGORY"
                    :value="category as keyof typeof BIANCA_CATEGORY"
                    size="sm"
                  />
                </td>
                <td class="px-2 py-1.5">
                  {{ item.text }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section class="space-y-2">
          <h4 class="font-semibold text-error">
            Example
          </h4>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[44rem] border border-default text-left align-top">
              <thead class="bg-elevated text-xs">
                <tr>
                  <th class="border-e border-default px-2 py-1.5 font-semibold">
                    Description
                  </th>
                  <th class="border-e border-default px-2 py-1.5 font-semibold">
                    Staff required to deliver the planned capacity
                  </th>
                  <th class="border-e border-default px-2 py-1.5 font-semibold">
                    Expected business / support recovery level
                  </th>
                  <th class="border-e border-default px-2 py-1.5 font-semibold">
                    Prioritization recovery strategy
                  </th>
                  <th class="px-2 py-1.5 font-semibold">
                    Outstanding recovery strategy
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="row in example"
                  :key="row.row"
                  class="align-top"
                >
                  <td class="border-e border-default px-2 py-1.5 font-medium">
                    {{ row.row }}
                  </td>
                  <td class="border-e border-default px-2 py-1.5">
                    {{ row.staff }}
                  </td>
                  <td class="border-e border-default px-2 py-1.5">
                    {{ row.level }}
                  </td>
                  <td class="border-e border-default px-2 py-1.5">
                    <ul
                      :class="row.prioritization.length > 1 ? 'list-disc ps-4' : ''"
                      class="space-y-0.5"
                    >
                      <li
                        v-for="line in row.prioritization"
                        :key="line"
                      >
                        {{ line }}
                      </li>
                    </ul>
                  </td>
                  <td class="px-2 py-1.5">
                    <ul
                      :class="row.outstanding.length > 1 ? 'list-disc ps-4' : ''"
                      class="space-y-0.5"
                    >
                      <li
                        v-for="line in row.outstanding"
                        :key="line"
                      >
                        {{ line }}
                      </li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>
