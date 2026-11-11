<script setup lang="ts">
import type { SccaPreview } from '~/composables/useScca'

/**
 * One SCCA, as its section shows it (see utils/scca-sections.ts):
 *
 * - `manage`: the assessor's or contributor's draft. Every tab is a form; Submit is on Result
 *   and sign-off.
 * - `approval`: in approval, for the people who act on it. Read-only tabs; the decision panel
 *   sits above them, and review comments on each tab.
 * - `monitoring`: read-only, for everyone else (and for the assessor once submitted), with
 *   Start renewal. Comments are shown, never written here.
 *
 * PDF and Excel downloads are on the report page only (View report), not on the record.
 *
 * Opened in the wrong section (a submitted SCCA in Manage, a final one in Approval, your own
 * draft in Monitoring), it moves to the right one and keeps the tab.
 */
const props = defineProps<{ section: SccaSection }>()

const { can } = useAuth()

const TABS = ['details', 'rating', 'interdependencies', 'recovery', 'result'] as const
type Tab = (typeof TABS)[number]

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const id = computed(() => Number(route.params.id))
const { data: assessment, status, error, refresh } = useSccaAssessment(id)
// Each SCCA is shown with its own configuration version (lists, steps, notes, formula).
const version = computed(() => assessment.value?.formula_version)
const { data: formula, status: formulaStatus, error: formulaError, refresh: refreshFormula } = useSccaFormula(version)
const { data: standards } = useSccaRecoveryStandards(version)
const { data: config, status: configStatus } = useSccaConfig(version)
provide(sccaConfigKey, config)

const home = computed(() => (assessment.value ? sccaSectionFor(assessment.value, can('scca.approval.manage')) : null))
const misplaced = computed(() => {
  if (!home.value || home.value === props.section) return false
  // An approver browsing Monitoring may stay there (read-only); a banner offers Approval.
  return !(props.section === 'monitoring' && home.value === 'approval')
})

watch([home, misplaced], ([section, wrong]) => {
  if (section && wrong && assessment.value) {
    void navigateTo({ path: sccaPath(section, assessment.value.id), query: route.query }, { replace: true })
  }
}, { immediate: true })

const showSkeleton = useDelayedLoading(() =>
  misplaced.value
  || (status.value === 'pending' && !assessment.value)
  || (formulaStatus.value === 'pending' && !formula.value)
  || (configStatus.value === 'pending' && !config.value),
)

const dirty = ref(false)
const livePreview = ref<SccaPreview | null>(null)
const formKey = ref(0)
const saving = ref(false)
provide(sccaDirtyKey, dirty)
provide(sccaLivePreviewKey, livePreview)
provide(sccaSavingKey, saving)

const tab = computed<Tab>(() => {
  const value = route.query.tab
  return typeof value === 'string' && TABS.includes(value as Tab) ? value as Tab : 'details'
})

useHead(() => ({
  title: `${assessment.value?.application_name ?? 'Assessment'} · BCM Tools`,
}))

/** Manage, a draft: each tab shows how many mandatory fields are still empty. */
const missing = computed(() =>
  props.section === 'manage' && assessment.value?.status === 'draft' && assessment.value.permissions.can_edit
    ? sccaMissing(assessment.value, config.value)
    : null,
)
const TAB_ITEMS = [
  { label: 'Application', value: 'details', icon: 'i-lucide-file-text', slot: 'details' },
  { label: 'Rating', value: 'rating', icon: 'i-lucide-list-checks', slot: 'rating' },
  { label: 'Interdependencies', value: 'interdependencies', icon: 'i-lucide-git-fork', slot: 'interdependencies' },
  { label: 'Recovery', value: 'recovery', icon: 'i-lucide-life-buoy', slot: 'recovery' },
  { label: 'Result and sign-off', value: 'result', icon: 'i-lucide-badge-check', slot: 'result' },
] as const
const tabItems = computed(() => TAB_ITEMS.map((item) => {
  const count = missing.value?.[item.value].length ?? 0
  return count
    ? { ...item, badge: { label: String(count), color: 'error' as const, variant: 'subtle' as const } }
    : { ...item }
}))

async function confirmLeave() {
  return confirm({
    title: 'Discard unsaved changes?',
    description: 'Your unsaved edits on this tab will be lost.',
    confirmLabel: 'Discard changes',
    destructive: true,
  })
}

async function selectTab(next: string | number) {
  const value = String(next) as Tab
  if (value === tab.value) return
  if (dirty.value && !(await confirmLeave())) return
  dirty.value = false
  formKey.value += 1
  livePreview.value = null
  await router.replace({ query: { ...route.query, tab: value } })
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

/** Forms are read-only unless this user is the assessor or contributor and it is a draft. */
const locked = computed(() => props.section !== 'manage' || !assessment.value?.permissions.can_edit)
/** Manage: the open tab's Save is in the top bar, next to View report. */
const canSave = computed(() => props.section === 'manage' && !!assessment.value?.permissions.can_edit)
// Replace this draft from Excel: the forms start again from what the workbook saved.
const uploading = ref(false)
function onReplaced() {
  dirty.value = false
  reloadNuxtApp({ force: true })
}
const SAVE_LABELS: Record<Tab, string> = {
  details: 'Save application',
  rating: 'Save ratings',
  interdependencies: 'Save interdependencies',
  recovery: 'Save recovery',
  result: 'Save result',
}
/** Approval: the decision sits above the tabs. Elsewhere it is on Result and sign-off. */
const panelOnTop = computed(() => props.section === 'approval')
const readonlyComments = computed(() => props.section === 'monitoring')

const lockMessage = computed(() => {
  const value = assessment.value
  if (!value || !locked.value) return null
  if (value.status === 'in_approval') {
    const step = signoffRoleLabel(value.pending_role)
    if (props.section === 'approval' && value.permissions.can_decide) {
      return { title: `Your turn: ${step}`, description: 'Review every tab, then approve or reject above. Comments go on the tab they are about.' }
    }
    if (value.my_role) {
      return { title: `Submitted: waiting for ${step}`, description: 'You can\'t change or recall it now. If it needs changes, an approver rejects it back to draft and it returns to Manage.' }
    }
    return { title: `In approval: waiting for ${step}`, description: 'Read-only while it is in approval.' }
  }
  if (value.status === 'final') {
    return { title: 'Final', description: 'All sign-off steps approved this SCCA. It can no longer be edited.' }
  }
  return { title: 'Draft, read only', description: 'Only the assessor and the contributor can edit a draft.' }
})

/** The renewal alerts, worded by where each SCCA is now. */
const renewalOfNote = computed(() => {
  const value = assessment.value
  const source = value?.renewal_of
  if (!value || !source) return null
  if (value.status === 'draft') {
    return { title: `This SCCA renews ${source.ref_no}.`, description: 'It started as a copy of that final SCCA. Review every tab, update what changed, then submit.' }
  }
  if (value.status === 'in_approval') {
    return { title: `This SCCA renews ${source.ref_no}.`, description: `It is in approval. When it is final, it replaces ${source.ref_no} and sets a new renewal date.` }
  }
  return { title: `This SCCA replaced ${source.ref_no}.`, description: 'It is the final SCCA that renewed it; its renewal date counts from this one.' }
})
const renewalNote = computed(() => {
  const renewal = assessment.value?.renewal
  if (!renewal) return null
  if (renewal.status === 'final') {
    return { title: `Replaced by ${renewal.ref_no}.`, description: `${renewal.ref_no} is final: it is the application's current SCCA and set a new renewal date.` }
  }
  if (renewal.status === 'in_approval') {
    return { title: `Its renewal ${renewal.ref_no} is in approval.`, description: 'When the renewal is final, it replaces this SCCA in Monitoring and sets a new renewal date.' }
  }
  return { title: `Its renewal ${renewal.ref_no} is a draft.`, description: 'The assessor is updating it in Manage. When it is final, it replaces this SCCA and sets a new renewal date.' }
})

const toast = useToast()
const renewing = ref(false)

async function startRenewal() {
  if (!assessment.value) return
  const ok = await confirm({
    title: 'Start the renewal?',
    description: 'A new draft copies this SCCA: application, ratings, interdependencies, recovery values, contributor and sign-off users. It opens in Manage: review and update it, then submit.',
    confirmLabel: 'Start renewal',
  })
  if (!ok) return
  renewing.value = true
  try {
    const renewal = await sccaApi.renew(assessment.value.id)
    toast.add({ title: `Renewal ${renewal.ref_no} created`, color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(sccaPath('manage', renewal.id))
  } catch (failure) {
    const data = (failure as { data?: { message?: string, open_id?: number } }).data
    if (data?.open_id) {
      toast.add({ title: data.message ?? 'This application already has an open SCCA.', description: 'Opening it.', color: 'warning', icon: 'i-lucide-info' })
      await navigateTo(`/scca/${data.open_id}`)
      return
    }
    toast.add({ title: data?.message ?? apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    renewing.value = false
  }
}

const moving = ref(false)

/** A draft on an older configuration version moves to the active one. */
async function moveVersion() {
  const value = assessment.value
  if (!value?.can_move_version) return
  const ok = await confirm({
    title: `Move this draft to ${value.latest_version}?`,
    description: `Its tabs then use the ${value.latest_version} lists, questions, sign-off steps and formula. Ratings and choices ${value.latest_version} no longer has are cleared, and you are told which.`,
    confirmLabel: `Move to ${value.latest_version}`,
  })
  if (!ok) return
  moving.value = true
  try {
    const moved = await sccaApi.moveVersion(value.id)
    onSaved(moved)
    formKey.value += 1
    toast.add({
      title: `Now on ${moved.formula_version}`,
      description: moved.cleared.length ? `Redo: ${moved.cleared.join(', ')}.` : 'Nothing had to be cleared.',
      color: moved.cleared.length ? 'warning' : 'success',
      icon: 'i-lucide-circle-check',
      duration: moved.cleared.length ? 12000 : 5000,
    })
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    moving.value = false
  }
}

function onSaved(saved: SccaAssessment) {
  assessment.value = saved
  dirty.value = false
  livePreview.value = null
}
</script>

<template>
  <AppPage
    icon="i-lucide-shield-check"
    :title="assessment?.application_name ?? 'Assessment'"
    :crumbs="[
      { label: 'SCCA' },
      { label: SCCA_SECTIONS[section].label, to: SCCA_SECTIONS[section].to },
      ...(assessment ? [{ label: assessment.application_name }] : []),
    ]"
  >
    <template #actions>
      <StatusBadge
        v-if="assessment"
        :scale="sccaStatus"
        :value="sccaStatusKey(assessment)"
      />
      <UBadge
        v-if="assessment?.migrated"
        :label="assessment.migrated.record_only ? 'Migrated record' : 'Migrated'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-file-up"
      />
      <UButton
        v-if="canSave"
        color="neutral"
        variant="ghost"
        icon="i-lucide-file-spreadsheet"
        label="Upload Excel"
        @click="uploading = true"
      />
      <UButton
        v-if="section === 'monitoring' && assessment?.can_renew"
        icon="i-lucide-refresh-cw"
        label="Start renewal"
        :loading="renewing"
        @click="startRenewal"
      />
      <UButton
        v-if="assessment && can('admin.audit.view')"
        :to="`/admin/audit?tab=scca&assessment=${assessment.id}`"
        color="neutral"
        variant="ghost"
        icon="i-lucide-history"
        label="Activity"
      />
      <UButton
        v-if="assessment"
        :to="sccaPath(section, assessment.id, 'report')"
        color="neutral"
        variant="outline"
        icon="i-lucide-file-text"
        label="View report"
      />
      <!-- Manage: one Save in the top bar for the open tab. It submits that tab's form by id. -->
      <UBadge
        v-if="canSave && dirty"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-dot"
        label="Unsaved changes"
      />
      <UButton
        v-if="canSave"
        type="submit"
        :form="`scca-form-${tab}`"
        icon="i-lucide-save"
        :label="SAVE_LABELS[tab]"
        :loading="saving"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading assessment"
      class="space-y-6"
    >
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
      v-else-if="error?.statusCode === 403"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="You don't have access to this assessment"
      description="Only the assessor, the contributor, the sign-off users and BCM admins can open it."
    />

    <UAlert
      v-else-if="error || formulaError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the assessment"
      :description="error?.message ?? formulaError?.message"
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

    <template v-else-if="assessment && formula && !misplaced">
      <SccaUploadDialog
        v-if="canSave"
        v-model:open="uploading"
        :assessment="assessment"
        @saved="onReplaced"
      />
      <UAlert
        v-if="assessment.migrated"
        class="mb-6"
        color="neutral"
        variant="subtle"
        icon="i-lucide-file-up"
        :title="assessment.migrated.record_only
          ? 'A record of an older SCCA form, brought in from its signed workbook'
          : assessment.status === 'final'
            ? 'Brought in from the signed workbook'
            : 'Brought in from a workbook as a draft'"
        :description="[
          assessment.migrated.approved_outside_on && assessment.status === 'final' ? `Approved outside BCM Tools on ${formatDate(assessment.migrated.approved_outside_on)}.` : null,
          assessment.migrated.record_only ? 'It has no ratings: the category, RTO and RPO are the ones recorded.' : null,
          `Migrated on ${formatDate(assessment.migrated.at)}.`,
        ].filter(Boolean).join(' ')"
      >
        <template
          v-if="assessment.migrated.workbook"
          #actions
        >
          <UButton
            :to="`/api/scca/assessments/${assessment.id}/attachments/${assessment.migrated.workbook.id}`"
            external
            download
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            label="Original workbook"
          />
        </template>
      </UAlert>
      <UAlert
        v-if="section === 'monitoring' && home === 'approval'"
        class="mb-6"
        color="warning"
        variant="subtle"
        icon="i-lucide-badge-check"
        :title="assessment.permissions.can_decide ? 'It is your turn to approve this SCCA.' : 'You take part in this approval.'"
        description="Monitoring is read-only. Open it in Approval to decide or comment."
      >
        <template #actions>
          <UButton
            :to="{ path: sccaPath('approval', assessment.id), query: { tab: 'result' } }"
            size="sm"
            label="Open in Approval"
          />
        </template>
      </UAlert>
      <UAlert
        v-if="lockMessage"
        class="mb-6"
        :color="assessment.status === 'final' ? 'success' : assessment.status === 'in_approval' ? 'warning' : 'info'"
        variant="subtle"
        :icon="assessment.status === 'final' ? 'i-lucide-badge-check' : 'i-lucide-lock'"
        :title="lockMessage.title"
        :description="lockMessage.description"
      />
      <UAlert
        v-if="section === 'manage' && assessment.can_move_version"
        class="mb-6"
        color="info"
        variant="subtle"
        icon="i-lucide-file-cog"
        :title="`This draft uses ${assessment.formula_version}. ${assessment.latest_version} is the active version.`"
        description="It can stay on its version and be submitted as it is, or move to the active version's lists, questions, sign-off steps and formula."
      >
        <template #actions>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            :loading="moving"
            :label="`Move to ${assessment.latest_version}`"
            @click="moveVersion"
          />
        </template>
      </UAlert>
      <UAlert
        v-if="renewalOfNote"
        class="mb-6"
        color="neutral"
        variant="subtle"
        icon="i-lucide-refresh-cw"
        :title="renewalOfNote.title"
        :description="renewalOfNote.description"
      >
        <template #actions>
          <UButton
            :to="sccaPath(section, assessment.renewal_of!.id)"
            color="neutral"
            variant="outline"
            size="sm"
            :label="`Open ${assessment.renewal_of!.ref_no}`"
          />
        </template>
      </UAlert>
      <UAlert
        v-if="renewalNote"
        class="mb-6"
        color="neutral"
        variant="subtle"
        icon="i-lucide-refresh-cw"
        :title="renewalNote.title"
        :description="renewalNote.description"
      >
        <template #actions>
          <UButton
            :to="sccaPath(section, assessment.renewal!.id)"
            color="neutral"
            variant="outline"
            size="sm"
            :label="`Open ${assessment.renewal!.ref_no}`"
          />
        </template>
      </UAlert>
      <SccaApprovalPanel
        v-if="panelOnTop"
        class="mb-6"
        :assessment="assessment"
        :standards="standards?.items ?? []"
        @saved="onSaved"
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
          <div class="space-y-6">
            <SccaTabComments
              :assessment="assessment"
              tab="details"
              :readonly="readonlyComments"
              @saved="onSaved"
            />
            <fieldset
              :disabled="locked"
              class="min-w-0"
            >
              <SccaDetailsForm
                :key="`details-${formKey}`"
                :assessment="assessment"
                @saved="onSaved"
              />
            </fieldset>
          </div>
        </template>
        <template #rating>
          <div class="space-y-6">
            <SccaTabComments
              :assessment="assessment"
              tab="rating"
              :readonly="readonlyComments"
              @saved="onSaved"
            />
            <SccaRatingForm
              :key="`rating-${formKey}`"
              :assessment="assessment"
              :formula="formula"
              :locked="locked"
              @saved="onSaved"
            />
          </div>
        </template>
        <template #interdependencies>
          <div class="space-y-6">
            <SccaTabComments
              :assessment="assessment"
              tab="interdependencies"
              :readonly="readonlyComments"
              @saved="onSaved"
            />
            <fieldset
              :disabled="locked"
              class="min-w-0"
            >
              <SccaInterdependencyForm
                :key="`inter-${formKey}`"
                :assessment="assessment"
                @saved="onSaved"
              />
            </fieldset>
          </div>
        </template>
        <template #recovery>
          <div class="space-y-6">
            <SccaTabComments
              :assessment="assessment"
              tab="recovery"
              :readonly="readonlyComments"
              @saved="onSaved"
            />
            <fieldset
              :disabled="locked"
              class="min-w-0"
            >
              <SccaRecoveryForm
                :key="`recovery-${formKey}`"
                :assessment="assessment"
                :standards="standards?.items ?? []"
                @saved="onSaved"
              />
            </fieldset>
          </div>
        </template>
        <template #result>
          <div class="space-y-6">
            <SccaApprovalPanel
              v-if="!panelOnTop"
              :assessment="assessment"
              :actions="section === 'manage'"
              :standards="standards?.items ?? []"
              @saved="onSaved"
            />
            <SccaTabComments
              :assessment="assessment"
              tab="result"
              :readonly="readonlyComments"
              @saved="onSaved"
            />
            <fieldset
              :disabled="locked"
              class="min-w-0"
            >
              <SccaResultForm
                :key="`result-${formKey}`"
                :assessment="assessment"
                :formula="formula"
                :standards="standards?.items ?? []"
                @saved="onSaved"
              />
            </fieldset>
          </div>
        </template>
      </UTabs>
    </template>
  </AppPage>
</template>
