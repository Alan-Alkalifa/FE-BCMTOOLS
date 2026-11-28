<script setup lang="ts">
import type { BcpPlan } from '~/composables/useBcp'

/**
 * One BCP, laid out as SCCA's record (SccaRecord.vue): status, Activity and the open tab's Save
 * in the top bar, one form per tab. The tabs follow the production BCP: Summary BIA, then one
 * tab per active workaround condition of the BCP's configuration version, then Workflow History.
 * Submit for approval sits after Save; tab badges count what each tab misses before Submit.
 *
 * - `manage`: the Group's BCM coordinator edits a draft; anyone else allowed in reads it.
 */
defineProps<{ section: BcpSection }>()

const { can, user } = useAuth()
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const id = computed(() => Number(route.params.id))
const { data: plan, status, error, refresh } = useBcpPlan(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !plan.value)

const dirty = ref(false)
const saving = ref(false)
const formKey = ref(0)
provide(bcpDirtyKey, dirty)
provide(bcpSavingKey, saving)

const shortTitle = (title: string) => title.split(':')[0]?.trim() || title
/** The number of things a tab misses before Submit, as a badge (SCCA's `missing`). */
function missingBadge(code: string) {
  const count = plan.value?.status === 'draft' ? plan.value.missing[code]?.length ?? 0 : 0
  return count ? { label: String(count), color: 'error' as const, variant: 'subtle' as const } : undefined
}
const tabs = computed(() => [
  { label: 'Summary BIA', value: 'summary', icon: 'i-lucide-file-text', slot: 'summary', badge: missingBadge('summary') },
  ...(plan.value?.conditions ?? []).map((condition) => ({
    label: shortTitle(condition.title),
    value: condition.code,
    icon: 'i-lucide-route',
    slot: 'condition',
    badge: missingBadge(condition.code),
  })),
  { label: 'Workflow History', value: 'history', icon: 'i-lucide-history', slot: 'history' },
])
const tab = computed(() => {
  const value = route.query.tab
  return typeof value === 'string' && tabs.value.some((item) => item.value === value) ? value : 'summary'
})
const conditionIndex = computed(() => (plan.value?.conditions ?? []).findIndex((c) => c.code === tab.value))
const condition = computed(() => plan.value?.conditions[conditionIndex.value] ?? null)
// "Kondisi 2: …" is condition 2 even when an earlier condition is inactive.
const conditionLabel = computed(() => {
  const number = condition.value ? /\d+/.exec(shortTitle(condition.value.title))?.[0] : undefined
  return `condition ${number ?? conditionIndex.value + 1}`
})
const saveLabel = computed(() => (tab.value === 'summary' ? 'Save summary' : `Save ${conditionLabel.value}`))

useHead(() => ({ title: `${plan.value?.name ?? 'BCP'} · BCM Tools` }))

async function confirmLeave() {
  return confirm({
    title: 'Discard unsaved changes?',
    description: 'Your unsaved edits on this tab will be lost.',
    confirmLabel: 'Discard changes',
    destructive: true,
  })
}
async function selectTab(next: string | number) {
  const value = String(next)
  if (value === tab.value) return
  if (dirty.value && !(await confirmLeave())) return
  dirty.value = false
  formKey.value += 1
  await router.replace({ query: { ...route.query, tab: value === 'summary' ? undefined : value } })
}
useUnsavedChanges(dirty, { confirm: confirmLeave })

const canSave = computed(() => !!plan.value?.permissions.can_edit && tab.value !== 'history')
function onSaved(saved: BcpPlan) {
  plan.value = saved
  dirty.value = false
  formKey.value += 1
}
/** The attachment is saved at once; unsaved edits on the open tab stay. */
function onAttachment(saved: BcpPlan) {
  if (plan.value) plan.value = { ...plan.value, attachment: saved.attachment, events: saved.events }
}

// --- Submit (D36, D46–D48) ---------------------------------------------------------------------
const toast = useToast()
const submitting = ref(false)
const missingItems = computed(() => {
  const value = plan.value
  if (!value) return []
  const labels: Record<string, string> = { summary: 'Summary BIA' }
  for (const item of value.conditions) labels[item.code] = shortTitle(item.title)
  return Object.entries(value.missing).flatMap(([code, items]) => items.map((item) => `${labels[code] ?? code}: ${item}`))
})
const stepTitle = (code: string | null) =>
  plan.value?.signoffs.find((row) => row.code === code)?.title ?? plan.value?.steps.find((row) => row.code === code)?.title ?? 'the next step'
async function submitPlan() {
  const value = plan.value
  if (!value) return
  if (missingItems.value.length) {
    const shown = missingItems.value.slice(0, 4)
    const more = missingItems.value.length - shown.length
    toast.add({
      title: 'Not ready yet',
      description: [...shown, ...(more > 0 ? [`and ${more} more`] : [])].join('\n'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
      duration: 10000,
    })
    return
  }
  const ok = await confirm({
    title: 'Submit for approval?',
    description: 'The BCP is locked while the sign-off steps approve it in order. You can\'t recall it: to change it, an approver must return it to draft.',
    confirmLabel: 'Submit for approval',
  })
  if (!ok) return
  submitting.value = true
  try {
    const saved = await bcpApi.submit(value.id, value.revision)
    onSaved(saved)
    toast.add({ title: 'Submitted for approval', description: `Waiting for ${stepTitle(saved.pending_step)}.`, color: 'success', icon: 'i-lucide-send' })
  } catch (failure) {
    if ((failure as { statusCode?: number })?.statusCode === 409) {
      // Someone saved (or the status changed) meanwhile: load the latest so a retry can work.
      await refresh()
      formKey.value += 1
      toast.add({ title: 'This BCP changed', description: `${bcpErrorText(failure)} It was reloaded with the latest changes: check it, then submit again.`, color: 'warning', icon: 'i-lucide-refresh-cw', duration: 10000 })
    } else {
      toast.add({ title: 'Couldn\'t submit the BCP', description: bcpErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert', duration: 10000 })
    }
  } finally {
    submitting.value = false
  }
}

/** What the BCP's status means, above the tabs (SCCA's lock message). */
const statusMessage = computed(() => {
  const value = plan.value
  if (!value) return null
  if (value.status === 'in_approval') {
    return value.permissions.can_view && (value.coordinator?.id === user.value?.id || value.alternate?.id === user.value?.id)
      ? { color: 'info' as const, icon: 'i-lucide-hourglass', title: `Submitted: waiting for ${stepTitle(value.pending_step)}`, description: 'You can\'t change or recall it now. If it needs changes, an approver returns it to draft and it opens here again.' }
      : { color: 'info' as const, icon: 'i-lucide-hourglass', title: `In approval: waiting for ${stepTitle(value.pending_step)}`, description: 'Read-only while it is in approval.' }
  }
  if (value.status === 'invalid') {
    return { color: 'error' as const, icon: 'i-lucide-octagon-x', title: 'Invalid', description: `${value.invalid_reason ?? 'The Group changed.'} It stays read-only for reference; make a new BCP for the Group from Waiting to start.` }
  }
  if (value.status === 'draft' && !value.permissions.can_edit) {
    return { color: 'neutral' as const, icon: 'i-lucide-eye', title: 'Read-only', description: 'Only the Group\'s BCM coordinator and alternate can change this BCP.' }
  }
  return null
})
</script>

<template>
  <AppPage
    icon="i-lucide-life-buoy"
    :title="plan?.name ?? 'BCP'"
    :tab-title="plan ? [plan.ref_no, plan.name].join(' · ') : undefined"
    :crumbs="[
      { label: 'BCP' },
      { label: BCP_SECTIONS[section].label, to: BCP_SECTIONS[section].to },
      ...(plan ? [{ label: plan.name }] : []),
    ]"
  >
    <template #actions>
      <StatusBadge
        v-if="plan"
        :scale="bcpStatus"
        :value="plan.status"
      />
      <UButton
        v-if="plan && can('admin.audit.view')"
        :to="`/admin/audit?q=${encodeURIComponent(plan.ref_no)}`"
        color="neutral"
        variant="ghost"
        icon="i-lucide-history"
        label="Activity"
      />
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
        :form="`bcp-form-${tab}`"
        icon="i-lucide-save"
        :label="saveLabel"
        :loading="saving"
      />
      <UButton
        v-if="plan?.can_submit"
        color="primary"
        variant="outline"
        icon="i-lucide-send"
        label="Submit for approval"
        :disabled="dirty || saving"
        :title="dirty ? 'Save your changes first' : undefined"
        :loading="submitting"
        @click="submitPlan"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the BCP"
      class="space-y-6"
    >
      <SkeletonCard :lines="6" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error?.statusCode === 404"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-help"
      title="BCP not found"
      description="It may have been removed."
    />

    <UAlert
      v-else-if="error?.statusCode === 403"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="You don't have access to this BCP"
      description="Only the Group's BCM coordinators and BCM can open it."
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the BCP"
      :description="error.message"
    />

    <template v-else-if="plan">
      <UAlert
        v-if="statusMessage"
        class="mb-6"
        :color="statusMessage.color"
        variant="subtle"
        :icon="statusMessage.icon"
        :title="statusMessage.title"
        :description="statusMessage.description"
      />
      <UAlert
        v-if="plan.no_longer_required"
        class="mb-6"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="No longer required"
        :description="`${plan.no_longer_required.bia_ref_no ?? 'The latest final BIA'} has no business critical function. This BCP stays for reference.`"
      />
      <UTabs
        :model-value="tab"
        :items="tabs"
        variant="link"
        class="min-w-0"
        :ui="{ list: 'overflow-x-auto overflow-y-hidden [scrollbar-width:thin]', indicator: 'bottom-0', trigger: 'shrink-0' }"
        @update:model-value="selectTab"
      >
        <template #summary>
          <BcpSummaryForm
            :key="`summary-${formKey}`"
            class="mt-4"
            :plan="plan"
            @saved="onSaved"
            @attachment="onAttachment"
          />
        </template>
        <template #history>
          <BcpWorkflowHistory
            class="mt-4"
            :plan="plan"
          />
        </template>
        <template #condition>
          <BcpConditionForm
            v-if="condition"
            :key="`${condition.code}-${formKey}`"
            class="mt-4"
            :plan="plan"
            :condition="condition"
            :label="conditionLabel"
            @saved="onSaved"
          />
        </template>
      </UTabs>
    </template>
  </AppPage>
</template>
