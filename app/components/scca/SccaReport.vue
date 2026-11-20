<script setup lang="ts">
/** The print-friendly report of one SCCA, inside its section (Manage, Approval or Monitoring). */
const props = defineProps<{ section: SccaSection }>()

const { can } = useAuth()

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data: assessment, status, error, refresh } = useSccaAssessment(id)
const version = computed(() => assessment.value?.formula_version)
const { data: formula, status: formulaStatus } = useSccaFormula(version)
const { data: config, status: configStatus } = useSccaConfig(version)
const showSkeleton = useDelayedLoading(() =>
  (status.value === 'pending' && !assessment.value)
  || (formulaStatus.value === 'pending' && !formula.value)
  || (configStatus.value === 'pending' && !config.value),
)
/** The SCCA's sign-off steps in approval order (its configuration version). */
const reportSteps = computed(() =>
  config.value?.steps.map((step) => ({ value: step.code, label: step.title }))
  ?? SCCA_SIGNOFF_ROLES.map((role) => ({ value: role.value, label: role.label })),
)

function answerFor(code: string) {
  return assessment.value?.answers.find((row) => row.code === code)
}

function optionLabel(code: string, rating: number | undefined) {
  if (rating == null) return '—'
  const question = formula.value?.questions.find((row) => row.code === code)
  return question?.options.find((option) => option.rating === rating)?.label ?? String(rating)
}

function recovery(kind: SccaRecoveryKind, field: SccaRecoveryField) {
  return assessment.value?.recovery_values.find((row) => row.kind === kind)?.[field] || '—'
}

function signoff(role: SccaSignoffRole) {
  return assessment.value?.signoffs.find((row) => row.role === role)
}

function percent(value: number | null | undefined) {
  return formatPercent(value, 0) ?? '—'
}

function printReport() {
  window.print()
}
</script>

<template>
  <AppPage
    icon="i-lucide-file-text"
    :title="`${assessment?.application_name ?? 'Assessment'} report`"
    :tab-title="assessment ? [assessment.ref_no, assessment.application_name].filter(Boolean).join(' · ') : undefined"
    :crumbs="[
      { label: 'SCCA' },
      { label: SCCA_SECTIONS[props.section].label, to: SCCA_SECTIONS[props.section].to },
      ...(assessment
        ? [
          { label: assessment.application_name, to: sccaPath(props.section, assessment.id) },
          { label: 'Report' },
        ]
        : []),
    ]"
  >
    <template #actions>
      <SccaReportDownloads
        v-if="assessment?.status === 'final' && can('scca.report.download')"
        :assessment-id="assessment.id"
      />
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
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the report"
      :description="error.message"
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

    <template v-else-if="assessment && formula">
      <header class="space-y-2">
        <p class="text-sm text-muted">
          SCCA {{ assessment.formula_version }}
        </p>
        <h1 class="text-2xl font-semibold">
          {{ assessment.application_name }}
        </h1>
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge
            :scale="sccaCategory"
            :value="assessment.result.final_category"
          />
          <span class="text-sm text-muted">
            {{ formatDate(assessment.assessment_date) || 'No assessment date' }}
          </span>
        </div>
      </header>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Application
          </h2>
        </template>
        <dl class="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt class="text-muted">
              Ref. no.
            </dt>
            <dd>{{ assessment.ref_no || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Code
            </dt>
            <dd>{{ assessment.application_code || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Reason
            </dt>
            <dd>{{ reasonLabel(assessment.assessment_reason) || '—' }}</dd>
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
              Owner
            </dt>
            <dd>{{ assessment.application_owner || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              IT support
            </dt>
            <dd>{{ assessment.it_support || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Assessor
            </dt>
            <dd>{{ assessment.assessor || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Country
            </dt>
            <dd>{{ assessment.country || '—' }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-muted">
              Description
            </dt>
            <dd>{{ assessment.application_description || '—' }}</dd>
          </div>
        </dl>
      </UCard>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Ratings
          </h2>
        </template>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th class="px-3 py-2">
                Question
              </th>
              <th class="px-3 py-2">
                Rating
              </th>
              <th class="px-3 py-2">
                Justification
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="question in formula.questions"
              :key="question.code"
            >
              <td class="px-3 py-2">
                <span class="font-medium">{{ question.code }} · {{ question.label }}</span>
              </td>
              <td class="px-3 py-2">
                {{ optionLabel(question.code, answerFor(question.code)?.rating) }}
              </td>
              <td class="px-3 py-2">
                {{ answerFor(question.code)?.justification || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Scores
          </h2>
        </template>
        <dl class="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt class="text-muted">
              Confidentiality
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ percent(assessment.result.confidentiality_score) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Integrity
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ percent(assessment.result.integrity_score) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Availability
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ percent(assessment.result.availability_score) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              CIA
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ percent(assessment.result.cia_score) }}
              <span v-if="assessment.result.cia_level"> · {{ sccaLevelLabel(assessment.result.cia_level, 'CIA') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Potential loss
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ percent(assessment.result.poloss_score) }}
              <span v-if="assessment.result.poloss_level"> · {{ sccaLevelLabel(assessment.result.poloss_level, 'POLOSS') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Computed / final
            </dt>
            <dd>
              {{ assessment.result.computed_category || '—' }}
              /
              {{ assessment.result.final_category || '—' }}
            </dd>
          </div>
        </dl>
        <p
          v-if="assessment.override_type"
          class="mt-4 text-sm"
        >
          Override: {{ assessment.override_type }}
          to {{ assessment.override_category }}.
          <span v-if="assessment.cim_ref_no"> · CIM / MKK / RA {{ assessment.cim_ref_no }}</span>
        </p>
        <section
          v-if="assessment.justification"
          class="mt-4 rounded-md border border-warning/40 border-s-4 border-s-warning bg-warning/10 p-4 print:bg-transparent"
          aria-labelledby="report-justification"
        >
          <h3
            id="report-justification"
            class="flex items-center gap-2 text-sm font-semibold text-highlighted"
          >
            <UIcon
              name="i-lucide-wrench"
              class="size-4 text-warning"
            />
            Justification / process workaround / remarks
          </h3>
          <p class="mt-1.5 whitespace-pre-line text-sm text-highlighted">
            {{ assessment.justification }}
          </p>
        </section>
      </UCard>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Criticality matrix
          </h2>
        </template>
        <SccaMatrix
          :cells="formula.matrix"
          :cia-level="assessment.result.cia_level"
          :poloss-level="assessment.result.poloss_level"
        />
      </UCard>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Interdependencies
          </h2>
        </template>
        <p
          v-if="!assessment.interdependencies.length"
          class="text-sm text-muted"
        >
          No upstream or downstream applications recorded.
        </p>
        <table
          v-else
          class="w-full text-sm"
        >
          <thead>
            <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th class="px-3 py-2">
                Direction
              </th>
              <th class="px-3 py-2">
                System
              </th>
              <th class="px-3 py-2">
                SCC
              </th>
              <th class="px-3 py-2">
                Dependency
              </th>
              <th class="px-3 py-2">
                Workaround
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="row in assessment.interdependencies"
              :key="`${row.direction}-${row.seq}-${row.system_name}`"
            >
              <td class="px-3 py-2 capitalize">
                {{ row.direction }}
              </td>
              <td class="px-3 py-2">
                {{ row.system_name }}
              </td>
              <td class="px-3 py-2">
                {{ row.criticality_category || '—' }}
              </td>
              <td class="px-3 py-2">
                {{ row.dependency || '—' }}
              </td>
              <td class="px-3 py-2">
                <span
                  v-if="row.workaround"
                  class="inline-flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 font-medium text-highlighted"
                >
                  <UIcon
                    name="i-lucide-wrench"
                    class="mt-0.5 size-3.5 shrink-0 text-warning"
                  />
                  <span class="whitespace-pre-line">{{ row.workaround }}</span>
                </span>
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Recovery values
          </h2>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-3xl text-sm">
            <thead>
              <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th class="px-3 py-2">
                  Field
                </th>
                <th
                  v-for="kind in SCCA_RECOVERY_KINDS"
                  :key="kind.value"
                  class="px-3 py-2"
                >
                  {{ kind.label }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="field in SCCA_RECOVERY_FIELDS"
                :key="field.key"
              >
                <th class="px-3 py-2 text-left font-medium">
                  {{ field.label }}
                </th>
                <td
                  v-for="kind in SCCA_RECOVERY_KINDS"
                  :key="kind.value"
                  class="px-3 py-2"
                >
                  {{ recovery(kind.value, field.key) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard class="break-inside-avoid">
        <template #header>
          <h2 class="text-lg font-semibold">
            Sign-off
          </h2>
        </template>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th class="px-3 py-2">
                Role
              </th>
              <th class="px-3 py-2">
                Name
              </th>
              <th class="px-3 py-2">
                Designation
              </th>
              <th class="px-3 py-2">
                Sub-directorate
              </th>
              <th class="px-3 py-2">
                Decision
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="role in reportSteps"
              :key="role.value"
            >
              <td class="px-3 py-2">
                {{ role.label }}
              </td>
              <td class="px-3 py-2">
                {{ signoff(role.value)?.name || '—' }}
              </td>
              <td class="px-3 py-2">
                {{ signoff(role.value)?.designation || '—' }}
              </td>
              <td class="px-3 py-2">
                {{ signoff(role.value)?.sub_dir || '—' }}
              </td>
              <td class="px-3 py-2">
                <template v-if="signoff(role.value)?.status">
                  <StatusBadge
                    :scale="sccaSignoffStatus"
                    :value="signoff(role.value)!.status"
                    size="sm"
                  />
                  <span
                    v-if="signoff(role.value)?.decided_at"
                    class="ml-1 text-xs text-muted"
                  >{{ formatDateTime(signoff(role.value)!.decided_at) }}</span>
                </template>
                <span v-else-if="signoff(role.value)?.skipped">Not required</span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </AppPage>
</template>
