<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { RaRating, RaReportFormat } from '~/composables/useRa'

/**
 * The print-friendly report of one RA, inside its section (Manage, Approval or Monitoring), as
 * SCCA's View report: the details, every hazard with its ratings, the Risk Summary, the sign-off
 * statement and the signers. Print uses the browser (the app's frame is hidden when printing);
 * the PDF and the filled Excel workbook download here once the RA is approved.
 */
const props = defineProps<{ section: RaSection }>()

const ra = useRaModule()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = computed(() => Number(route.params.id))
const { data: assessment, status, error, refresh } = useRaAssessment(id)
const { data: formula, status: formulaStatus, error: formulaError } = useRaFormula(
  () => ra.value.kind,
  () => assessment.value?.formula_version,
)
// A branch assessment opened under /ra (or the reverse): show it in its own module.
watch(() => assessment.value?.kind, (kind) => {
  if (kind && kind !== ra.value.kind) router.replace(raReportPath(kind, props.section, id.value))
}, { immediate: true })

const showSkeleton = useDelayedLoading(() =>
  (status.value === 'pending' && !assessment.value)
  || (formulaStatus.value === 'pending' && !formula.value),
)
const ready = computed(() => assessment.value && formula.value && assessment.value.kind === formula.value.kind)
const section = computed(() => RA_SECTIONS[props.section])
const singleRisk = computed(() => ra.value.kind === 'branch')
const title = computed(() =>
  assessment.value ? `${assessment.value.location.name} · ${assessment.value.period_year}` : 'Assessment',
)

/** Every hazard of the RA's configuration version, in questionnaire order, with its rating. */
const rows = computed(() => {
  const ratings = new Map((assessment.value?.ratings ?? []).map((row) => [row.code, row]))
  return (formula.value?.categories ?? []).flatMap((category) => category.hazards.map((hazard) => ({
    ...hazard,
    group: category.label,
    rating: ratings.get(hazard.code) as RaRating | undefined,
  })))
})

/** The Hazards table's column widths, in its column order (RA Branch has no gross risk). */
const hazardColumns = computed(() => singleRisk.value
  ? ['4%', '18%', '32%', '7%', '7%', '9%', '23%']
  : ['4%', '15%', '5%', '5%', '8%', '25%', '5%', '5%', '8%', '20%'])

function rating(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value === 0 ? 'N/A' : String(value)
}

/** The steps of the RA's configuration version with who signed (or signs) each. */
const steps = computed(() => raRoleOptions(formula.value, ra.value.signoffRoles).map((role) => ({
  ...role,
  signoff: assessment.value?.signoffs.find((row) => row.role === role.value),
})))

type Step = (typeof steps.value)[number]
function decision(step: Step) {
  const value = assessment.value
  if (!value) return null
  if (step.signoff?.approved_at) return 'approved'
  if (value.status === 'in_signoff' && step.value === value.current_signoff_role) return 'current'
  if (value.status !== 'draft' && !step.signoff?.signer) return 'skipped'
  return null
}
const raReportStep = defineStatusScale({
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-badge-check' },
  current: { label: 'Waiting for approval', color: 'info', icon: 'i-lucide-hourglass' },
  skipped: { label: 'Not required', color: 'neutral', icon: 'i-lucide-circle-minus' },
})

/** A hazard picked on the Risk Summary opens on the RA itself. */
function openHazard(code: string) {
  return navigateTo({ path: raPath(ra.value.kind, props.section, id.value), query: { tab: 'hazards', hazard: code } })
}

function printReport() {
  window.print()
}

const downloading = ref<RaReportFormat | null>(null)
async function download(format: RaReportFormat) {
  if (!assessment.value || downloading.value) return
  downloading.value = format
  try {
    await downloadRaReport(assessment.value.id, format)
  } catch (err) {
    toast.add({ title: 'Could not download the report', description: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    downloading.value = null
  }
}
/** The PDF and the workbook are for approved RAs only (the API refuses the others with 409). */
const canDownload = computed(() => assessment.value?.status === 'approved')
const downloadItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'PDF report', description: 'Laid out like the workbook', icon: 'i-lucide-file-text', onSelect: () => download('pdf') },
    { label: 'Excel workbook', description: `The official ${ra.value.kind === 'branch' ? 'Cabang' : 'HO'} RA workbook, filled in`, icon: 'i-lucide-file-spreadsheet', onSelect: () => download('xlsx') },
  ],
])
</script>

<template>
  <AppPage
    icon="i-lucide-file-text"
    :title="`${assessment?.location.name ?? 'Assessment'} report`"
    :crumbs="[
      { label: ra.title, to: raPath(ra.kind, 'monitoring') },
      { label: section.label, to: raPath(ra.kind, props.section) },
      ...(assessment
        ? [
          { label: assessment.ref_no ?? title, to: raPath(ra.kind, props.section, assessment.id) },
          { label: 'Report' },
        ]
        : []),
    ]"
  >
    <template #actions>
      <UDropdownMenu
        v-if="canDownload"
        :items="downloadItems"
        :content="{ align: 'end' }"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-download"
          trailing-icon="i-lucide-chevron-down"
          label="Download"
          :loading="downloading !== null"
        />
      </UDropdownMenu>
      <UButton
        icon="i-lucide-printer"
        label="Print"
        @click="printReport"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading report"
      class="space-y-6"
    >
      <SkeletonCard :lines="8" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error || formulaError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the report"
      :description="apiErrorMessage(error ?? formulaError)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>

    <template v-else-if="ready && assessment && formula">
      <header class="space-y-2">
        <p class="text-sm text-muted">
          {{ ra.kind === 'branch' ? 'RA Branch' : 'RA HO' }} {{ assessment.formula_version }}
          <template v-if="assessment.ref_no">
            · {{ assessment.ref_no }}
          </template>
        </p>
        <h1 class="text-2xl font-semibold">
          {{ title }}
        </h1>
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge
            :scale="raStatus"
            :value="raStatusKey(assessment)"
          />
          <span
            v-if="assessment.summary.highest_residual_level"
            class="inline-flex items-center gap-2 text-sm text-muted"
          >
            Highest residual
            <StatusBadge
              :scale="raRiskLevel"
              :value="assessment.summary.highest_residual_level"
            />
          </span>
          <span class="text-sm text-muted">
            {{ formatDate(assessment.assessment_date) || 'No assessment date' }}
          </span>
        </div>
      </header>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Details
          </h2>
        </template>
        <dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt class="text-muted">
              Ref. no.
            </dt>
            <dd>{{ assessment.ref_no || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              {{ ra.kind === 'branch' ? 'Branch' : 'Building' }}
            </dt>
            <dd>
              {{ assessment.location.name }}
              <span
                v-if="assessment.location.code"
                class="text-muted"
              >· {{ assessment.location.code }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Address
            </dt>
            <dd>{{ assessment.location.address || '—' }}</dd>
          </div>
          <div v-if="ra.kind === 'branch'">
            <dt class="text-muted">
              Region / Area
            </dt>
            <dd>{{ [assessment.location.region, assessment.location.area].filter(Boolean).join(' / ') || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Directorate
            </dt>
            <dd>{{ assessment.location.directorate || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Reason for assessment
            </dt>
            <dd>{{ raReasonLabel(assessment.reason) || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Assessment date
            </dt>
            <dd>{{ formatDate(assessment.assessment_date) || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Renewal due
            </dt>
            <dd>{{ formatDate(assessment.due_date) || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Assessor
            </dt>
            <dd>{{ assessment.created_by || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              LIC
            </dt>
            <dd>
              {{ assessment.lic_user?.name ?? assessment.lic_name ?? '—' }}
              <span
                v-if="assessment.lic_phone"
                class="text-muted"
              >· {{ assessment.lic_phone }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              LICOM
            </dt>
            <dd>
              {{ assessment.licom_user?.name ?? assessment.licom_name ?? '—' }}
              <span
                v-if="assessment.licom_phone"
                class="text-muted"
              >· {{ assessment.licom_phone }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Final
            </dt>
            <dd>{{ formatDateTime(assessment.approved_at) || '—' }}</dd>
          </div>
        </dl>
      </UCard>

      <!-- Printed from a new page (a fixed-layout table won't start on a partly used one), and
           the card must not clip the table where it breaks across pages. -->
      <UCard class="print:break-before-page print:overflow-visible">
        <template #header>
          <h2 class="text-lg font-semibold">
            Hazards
          </h2>
          <p class="text-sm text-muted">
            {{ formatNumber(assessment.summary.rated, 0) }} of {{ formatNumber(assessment.summary.total, 0) }} hazards rated.
          </p>
        </template>
        <!-- Fixed column widths so the text columns get room and the table fits the printed
             page; on a narrow screen it scrolls sideways. -->
        <div class="overflow-x-auto print:overflow-visible">
          <table
            class="w-full min-w-5xl table-fixed text-sm print:min-w-0 print:text-xs"
            data-testid="ra-report-hazards"
          >
            <colgroup>
              <col
                v-for="(width, index) in hazardColumns"
                :key="index"
                :style="{ width }"
              >
            </colgroup>
            <thead>
              <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th class="px-2 py-2 text-right">
                  No
                </th>
                <th class="px-2 py-2">
                  Type of Hazard
                </th>
                <template v-if="!singleRisk">
                  <th class="px-2 py-2 text-right">
                    Gross P
                  </th>
                  <th class="px-2 py-2 text-right">
                    Gross I
                  </th>
                  <th class="px-2 py-2">
                    Gross risk
                  </th>
                </template>
                <th class="px-2 py-2">
                  Existing mitigation measures
                </th>
                <th class="px-2 py-2 text-right">
                  {{ singleRisk ? 'Probability' : 'Residual P' }}
                </th>
                <th class="px-2 py-2 text-right">
                  {{ singleRisk ? 'Impact' : 'Residual I' }}
                </th>
                <th class="px-2 py-2">
                  {{ singleRisk ? 'Risk level' : 'Residual risk' }}
                </th>
                <th class="px-2 py-2">
                  Action plan
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="row in rows"
                :key="row.code"
                class="align-top"
              >
                <td class="px-2 py-2 text-right tabular-nums">
                  {{ row.no }}
                </td>
                <td class="px-2 py-2">
                  <span class="font-medium text-highlighted">{{ row.name }}</span>
                  <span class="block text-xs text-muted">{{ row.group }}</span>
                </td>
                <template v-if="!singleRisk">
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ rating(row.rating?.result.gross_probability) }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ rating(row.rating?.result.gross_impact) }}
                  </td>
                  <td class="px-2 py-2">
                    <StatusBadge
                      v-if="row.rating?.result.is_rated"
                      :scale="raRiskLevel"
                      :value="raLevelKey({ level: row.rating.result.gross_level, rated: true })"
                      size="sm"
                    />
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                </template>
                <td class="px-2 py-2 break-words whitespace-pre-line">
                  {{ row.rating?.mitigation || '—' }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums">
                  {{ rating(row.rating?.result.residual_probability) }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums">
                  {{ rating(row.rating?.result.residual_impact) }}
                </td>
                <td class="px-2 py-2">
                  <StatusBadge
                    v-if="row.rating?.result.is_rated"
                    :scale="raRiskLevel"
                    :value="raLevelKey({ level: row.rating.result.residual_level, rated: true })"
                    size="sm"
                  />
                  <span
                    v-else
                    class="text-muted"
                  >—</span>
                </td>
                <td class="px-2 py-2 break-words whitespace-pre-line">
                  {{ row.rating?.action_plan || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- The Risk Summary tab as it is (its own heading), starting a new printed page. -->
      <div class="break-before-page">
        <RaRiskSummary
          :assessment="assessment"
          :formula="formula"
          report
          @select="openHazard"
        />
      </div>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Sign-off
          </h2>
        </template>
        <blockquote
          v-if="formula.signoff_statement_en"
          lang="en"
          class="mb-4 border-l-2 border-accented pl-4 text-sm whitespace-pre-line text-default"
        >
          {{ formula.signoff_statement_en }}
        </blockquote>
        <table
          class="w-full text-sm"
          data-testid="ra-report-signoff"
        >
          <thead>
            <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th class="px-3 py-2">
                Step
              </th>
              <th class="px-3 py-2">
                Name
              </th>
              <th class="px-3 py-2">
                Designation
              </th>
              <th class="px-3 py-2">
                Decision
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="step in steps"
              :key="step.value"
              class="align-top"
            >
              <td class="px-3 py-2">
                <span class="font-medium text-highlighted">{{ step.label }}</span>
                <span class="block text-xs text-muted">{{ step.hint }}</span>
              </td>
              <td class="px-3 py-2">
                {{ step.signoff?.name || '—' }}
              </td>
              <td class="px-3 py-2">
                {{ step.signoff?.designation || '—' }}
              </td>
              <td class="px-3 py-2">
                <template v-if="decision(step)">
                  <StatusBadge
                    :scale="raReportStep"
                    :value="decision(step)"
                    size="sm"
                  />
                  <span
                    v-if="step.signoff?.approved_at"
                    class="ml-1 text-xs text-muted"
                  >{{ formatDateTime(step.signoff.approved_at) }}<template v-if="step.signoff.approved_by && step.signoff.approved_by !== step.signoff.name"> · by {{ step.signoff.approved_by }} on their behalf</template></span>
                </template>
                <span v-else>—</span>
                <p
                  v-if="step.signoff?.comment"
                  class="mt-1 whitespace-pre-line text-xs"
                >
                  {{ step.signoff.comment }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </AppPage>
</template>
