<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { RaReportFormat } from '~/composables/useRa'

const TABS = ['details', 'hazards', 'summary', 'signoff'] as const
type Tab = (typeof TABS)[number]

/**
 * One RA cycle, opened from a section: Manage edits a draft, Monitoring reads any assessment,
 * Approval opens on the Sign-off tab for the signer. Locking and permissions still come from the
 * assessment itself (`can_edit`, `can_approve`, ...); Monitoring is read-only on top of that.
 */
const props = withDefaults(defineProps<{ section?: RaSection }>(), { section: 'manage' })

const ra = useRaModule()
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const id = computed(() => Number(route.params.id))
const { data: assessment, status, error, refresh } = useRaAssessment(id)
// The configuration version the assessment was created on: assessments keep their version.
const { data: formula, status: formulaStatus, error: formulaError, refresh: refreshFormula } = useRaFormula(
  () => ra.value.kind,
  () => assessment.value?.formula_version,
)

// A branch assessment opened under /ra (or the reverse): show it in its own module.
watch(() => assessment.value?.kind, (kind) => {
  if (kind && kind !== ra.value.kind) {
    router.replace({ path: raPath(kind, props.section, id.value), query: route.query })
  }
}, { immediate: true })
const ready = computed(() => assessment.value && formula.value && assessment.value.kind === formula.value.kind)

const showSkeleton = useDelayedLoading(() =>
  (status.value === 'pending' && !assessment.value)
  || (formulaStatus.value === 'pending' && !formula.value),
)

const dirty = ref(false)
const formKey = ref(0)
provide(raDirtyKey, dirty)

const tab = computed<Tab>(() => {
  const value = route.query.tab
  if (typeof value === 'string' && TABS.includes(value as Tab)) return value as Tab
  return props.section === 'approval' ? 'signoff' : 'details'
})

/** What this section may do with the assessment: Monitoring only reads it. */
const view = computed(() => {
  const value = assessment.value
  if (!value || props.section !== 'monitoring') return value
  return { ...value, can_edit: false, can_submit: false, can_approve: false, can_return: false, can_delete: false }
})
const section = computed(() => RA_SECTIONS[props.section])
const hazardParam = computed(() => typeof route.query.hazard === 'string' ? route.query.hazard : undefined)

const title = computed(() =>
  assessment.value ? `${assessment.value.location.name} · ${assessment.value.period_year}` : 'Assessment',
)

const tabItems = [
  { label: 'Details', value: 'details', icon: 'i-lucide-file-text', slot: 'details' },
  { label: 'Hazards', value: 'hazards', icon: 'i-lucide-list-checks', slot: 'hazards' },
  { label: 'Risk Summary', value: 'summary', icon: 'i-lucide-grid-3x3', slot: 'summary' },
  { label: 'Sign-off', value: 'signoff', icon: 'i-lucide-badge-check', slot: 'signoff' },
]

async function confirmLeave() {
  return confirm({
    title: 'Discard unsaved changes?',
    description: 'Your unsaved edits on this tab will be lost.',
    confirmLabel: 'Discard changes',
    destructive: true,
  })
}

async function openTab(next: Tab, extra: Record<string, string | undefined> = {}) {
  if (next === tab.value && !extra.hazard) return
  if (dirty.value && !(await confirmLeave())) return
  dirty.value = false
  await router.replace({ query: { ...route.query, tab: next, hazard: undefined, ...extra } })
  formKey.value += 1
}

function selectTab(next: string | number) {
  return openTab(String(next) as Tab)
}

function openHazard(code: string) {
  return openTab('hazards', { hazard: code })
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return
  if (!(await confirmLeave())) return false
})

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

function onSaved(saved: RaAssessment) {
  assessment.value = saved
  dirty.value = false
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
/** Reports are for approved RAs only (the API refuses the others with 409). */
const canDownload = computed(() => assessment.value?.status === 'approved')
const downloadItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'PDF report', description: 'Printable, laid out like the workbook', icon: 'i-lucide-file-text', onSelect: () => download('pdf') },
    { label: 'Excel workbook', description: `The official ${ra.value.kind === 'branch' ? 'Cabang' : 'HO'} RA workbook, filled in`, icon: 'i-lucide-file-spreadsheet', onSelect: () => download('xlsx') },
  ],
])

async function removeAssessment() {
  if (!assessment.value) return
  const ok = await confirm({
    title: `Delete '${assessment.value.ref_no ?? title.value}'?`,
    description: `This permanently removes the ${assessment.value.period_year} assessment of ${assessment.value.location.name}, with all of its ratings and sign-offs.`,
    confirmLabel: 'Delete assessment',
    destructive: true,
  })
  if (!ok) return
  try {
    dirty.value = false
    await raApi.remove(assessment.value.id)
    toast.add({ title: 'Assessment deleted', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(raPath(ra.value.kind, 'manage'))
  } catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <AppPage
    :title="title"
    :crumbs="[
      { label: ra.title, to: raPath(ra.kind, 'monitoring') },
      { label: section.label, to: raPath(ra.kind, props.section) },
      ...(assessment ? [{ label: assessment.ref_no ?? title }] : []),
    ]"
  >
    <template #actions>
      <UButton
        v-if="props.section === 'monitoring' && assessment?.status === 'draft' && assessment.can_edit"
        :to="raPath(ra.kind, 'manage', assessment.id)"
        color="neutral"
        variant="outline"
        icon="i-lucide-pencil"
        label="Open in Manage"
      />
      <UButton
        v-else-if="props.section === 'monitoring' && assessment?.can_approve"
        :to="raPath(ra.kind, 'approval', assessment.id)"
        color="neutral"
        variant="outline"
        icon="i-lucide-badge-check"
        label="Open in Approval"
      />
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
        v-if="view?.can_delete"
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        label="Delete assessment"
        @click="removeAssessment"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading assessment"
      class="space-y-6"
    >
      <div class="skeleton h-8 w-80" />
      <SkeletonCard :lines="6" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error?.statusCode === 404"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-help"
      title="Assessment not found"
      description="It may have been deleted."
    />

    <UAlert
      v-else-if="error || formulaError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the assessment"
      :description="apiErrorMessage(error ?? formulaError)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="() => { refresh(); refreshFormula() }"
        />
      </template>
    </UAlert>

    <template v-else-if="ready && assessment && formula">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p class="text-2xl font-semibold text-highlighted">
          {{ title }}
        </p>
        <StatusBadge
          :scale="raStatus"
          :value="raStatusKey(assessment)"
        />
        <StatusBadge
          v-if="assessment.status === 'draft'"
          :scale="raCompletion"
          :value="assessment.is_complete ? 'complete' : 'draft'"
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
          {{ formatNumber(assessment.summary.rated, 0) }} of {{ formatNumber(assessment.summary.total, 0) }} hazards rated
        </span>
      </div>

      <UAlert
        v-if="props.section === 'monitoring'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-eye"
        title="Monitoring is read-only"
        :description="assessment.status === 'draft'
          ? 'Drafts are worked on in Manage.'
          : assessment.status === 'in_signoff' ? 'Signers approve it in Approval.' : undefined"
      />
      <UAlert
        v-else-if="assessment.status !== 'draft' && tab !== 'signoff'"
        color="info"
        variant="subtle"
        :icon="assessment.status === 'approved' ? 'i-lucide-badge-check' : 'i-lucide-lock'"
        :title="assessment.status === 'approved'
          ? 'Final: this assessment can no longer be changed'
          : `In approval: waiting for ${assessment.awaiting_signer?.name ?? 'the next signer'}`"
        :description="assessment.status === 'approved'
          ? undefined
          : 'It can\'t be changed until a signer returns it for changes.'"
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="outline"
            label="Open sign-off"
            @click="selectTab('signoff')"
          />
        </template>
      </UAlert>
      <UAlert
        v-else-if="assessment.status === 'draft' && assessment.returned_comment && tab !== 'signoff'"
        color="warning"
        variant="subtle"
        icon="i-lucide-undo-2"
        :title="`Returned for changes by ${assessment.returned_by ?? 'a signer'}`"
        :description="assessment.returned_comment"
        :ui="{ description: 'whitespace-pre-line' }"
      />

      <UTabs
        :model-value="tab"
        :items="tabItems"
        variant="link"
        :unmount-on-hide="false"
        class="min-w-0"
        @update:model-value="selectTab"
      >
        <template #details>
          <RaHeaderForm
            :key="`details-${formKey}`"
            :assessment="view!"
            @saved="onSaved"
          />
        </template>
        <template #hazards>
          <RaHazardForm
            :key="`hazards-${formKey}`"
            :assessment="view!"
            :formula="formula"
            :initial-hazard="hazardParam"
            @saved="onSaved"
          />
        </template>
        <template #summary>
          <RaRiskSummary
            :assessment="assessment"
            :formula="formula"
            @select="openHazard"
          />
        </template>
        <template #signoff>
          <RaSignoffForm
            :key="`signoff-${formKey}`"
            :assessment="view!"
            :formula="formula"
            @saved="onSaved"
          />
        </template>
      </UTabs>
    </template>
  </AppPage>
</template>
