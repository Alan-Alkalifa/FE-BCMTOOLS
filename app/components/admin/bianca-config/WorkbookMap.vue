<script setup lang="ts">
/**
 * BIA configuration > Versions > Workbook map: where each part of the BIA workbook (Template BIA
 * Ver2.4) is configured. The tabs stay grouped by kind, as SCCA configuration's; this map is the
 * way in for someone who thinks in the workbook's parts. Each link opens the exact section.
 */
const route = useRoute()
const { can } = useAuth()

type Target = { label: string, query?: Record<string, string>, to?: string, show?: boolean }
const at = (label: string, query: Record<string, string>): Target => ({ label, query })
const list = (label: string, key: string) => at(label, { tab: 'lists', list: key })
const impact = (label: string, section: string) => at(label, { tab: 'impact', impact: section })
const guide = (label: string, key: string) => at(label, { tab: 'guides', notes: 'topics', guide: key })

const parts = computed<{ part: string, purpose: string, targets: Target[] }[]>(() => [
  {
    part: 'Sign Off Page',
    purpose: 'Unit, main and alternate work locations, BCM coordinators, risk assessment and the management attestation.',
    targets: [
      at('Office location types', { tab: 'locations' }),
      list('Yes / No answers', 'yes_no'),
      guide('Attestation statement', 'attestation'),
      at('Approval template (signers)', { tab: 'steps' }),
    ],
  },
  {
    part: 'RA Questionaire',
    purpose: 'Group personnel by grade, the organization structure and the location risk assessment.',
    targets: [
      at('Personnel levels', { tab: 'personnel' }),
      guide('Personnel and risk assessment guide', 'risk_assessment'),
    ],
  },
  {
    part: 'Part 1 · Impact Assessment',
    purpose: 'Financial and non-financial impact of each business function, and its Suggested MTD.',
    targets: [
      list('Impact periods', 'periods'),
      impact('Impact thresholds', 'thresholds'),
      impact('Financial loss matrix', 'financial-bands'),
      impact('Regulatory impact matrix', 'regulator-matrix'),
      impact('Customer impact matrix', 'customer-matrix'),
      list('Suggested MTD choices', 'suggested_mtd'),
      impact('Suggested MTD rule', 'mtd-guide'),
    ],
  },
  {
    part: 'Part 2a · IT Dependency',
    purpose: 'Expected MTD, business function category and the IT application systems each function needs.',
    targets: [
      impact('Expected MTD', 'expected-mtd'),
      list('System usage', 'system_usage'),
      impact('Time conversion (DAAT)', 'conversion'),
      guide('Expected MTD guide', 'expected_mtd'),
      guide('IT dependencies guide', 'it_dependency'),
      { label: 'Application systems', to: '/admin/applications', show: can('scca.application.view', 'scca.application.manage') },
    ],
  },
  {
    part: 'Part 2b · Non-IT Dependency',
    purpose: 'Upstream and downstream dependencies, their planned capacity and MTD.',
    targets: [
      list('Planned capacity', 'capacity'),
      guide('Non-IT dependencies guide', 'non_it_dependency'),
    ],
  },
  {
    part: 'Part 3 · Recovery Strategies',
    purpose: 'Recovery prioritization, staff, alternate site, resources and vital records.',
    targets: [
      list('Planned capacity (expected support)', 'capacity'),
      list('Alternate site strategies', 'alt_site_strategies'),
      guide('Recovery guide', 'recovery'),
      guide('Alternate site guide', 'alternate_site'),
    ],
  },
  {
    part: 'Part 4 · Critical Timings',
    purpose: 'Critical timings and frequency of each business function, with the activities done then.',
    targets: [
      list('Critical timing frequencies', 'frequencies'),
      guide('Critical timings guide', 'critical_timings'),
    ],
  },
  {
    part: 'The whole BIA',
    purpose: 'The Excel template, sign-off, validity of a final BIA and its reminders.',
    targets: [
      impact('Workbook limits', 'limits'),
      impact('Review period', 'review'),
      at('Approval template', { tab: 'steps' }),
      { ...at('Reminders and escalation', { tab: 'reminders' }), show: can('bianca.approval.manage') },
      at('Form field notes', { tab: 'guides', notes: 'fields' }),
    ],
  },
])
// Keep the version being looked at; drop the other sections' choices.
function link(target: Target) {
  return target.to ?? { query: { version: route.query.version, ...target.query } }
}
const shown = (row: { targets: Target[] }) => row.targets.filter((item) => item.show !== false)
// Collapsed by default, as RA's affected places: one line per part until it is opened.
const items = computed(() => parts.value.map((row) => ({ ...row, value: row.part, label: row.part })))
const open = ref<string[]>([])
const allOpen = computed(() => open.value.length === items.value.length)
function toggleAll() {
  open.value = allOpen.value ? [] : items.value.map((item) => item.value)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 basis-60">
          <h2 class="font-semibold text-highlighted">
            Workbook map
          </h2>
          <p class="mt-1 text-sm text-muted">
            Where each part of the BIA workbook (Template BIA Ver2.4) is configured in this version. Open a part, then choose a link to go to that section.
          </p>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="allOpen ? 'i-lucide-chevrons-down-up' : 'i-lucide-chevrons-up-down'"
          :label="allOpen ? 'Collapse all' : 'Expand all'"
          @click="toggleAll"
        />
      </div>
    </template>
    <UAccordion
      v-model="open"
      type="multiple"
      :items="items"
      :ui="{ item: 'rounded-md border border-default bg-default px-4 mb-2 last:mb-0' }"
    >
      <template #default="{ item }">
        <span class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span class="font-medium text-highlighted">{{ item.part }}</span>
          <span class="text-xs text-muted">{{ shown(item).length }} setting{{ shown(item).length === 1 ? '' : 's' }}</span>
        </span>
      </template>
      <template #content="{ item }">
        <div class="space-y-3 pb-4">
          <p class="text-sm text-muted">
            {{ item.purpose }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="target in shown(item)"
              :key="target.label"
              :to="link(target)"
              size="xs"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-arrow-right"
              :label="target.label"
            />
          </div>
        </div>
      </template>
    </UAccordion>
  </UCard>
</template>
