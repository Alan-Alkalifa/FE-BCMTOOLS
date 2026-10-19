<script setup lang="ts">
import type { SccaPreview } from '~/composables/useScca'

const TABS = ['details', 'rating', 'interdependencies', 'recovery', 'result'] as const
type Tab = (typeof TABS)[number]

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const id = computed(() => Number(route.params.id))
const { data: assessment, status, error, refresh } = useSccaAssessment(id)
const { data: formula, status: formulaStatus, error: formulaError, refresh: refreshFormula } = useSccaFormula()
const { data: standards } = useSccaRecoveryStandards()

const showSkeleton = useDelayedLoading(() =>
  (status.value === 'pending' && !assessment.value)
  || (formulaStatus.value === 'pending' && !formula.value),
)

const dirty = ref(false)
const livePreview = ref<SccaPreview | null>(null)
const formKey = ref(0)
provide(sccaDirtyKey, dirty)
provide(sccaLivePreviewKey, livePreview)

const tab = computed<Tab>(() => {
  const value = route.query.tab
  return typeof value === 'string' && TABS.includes(value as Tab) ? value as Tab : 'details'
})

useHead(() => ({
  title: `${assessment.value?.application_name ?? 'Assessment'} · BCM Tools`,
}))

const tabItems = [
  { label: 'Application', value: 'details', icon: 'i-lucide-file-text', slot: 'details' },
  { label: 'Rating', value: 'rating', icon: 'i-lucide-list-checks', slot: 'rating' },
  { label: 'Interdependencies', value: 'interdependencies', icon: 'i-lucide-git-fork', slot: 'interdependencies' },
  { label: 'Recovery', value: 'recovery', icon: 'i-lucide-life-buoy', slot: 'recovery' },
  { label: 'Result and sign-off', value: 'result', icon: 'i-lucide-badge-check', slot: 'result' },
]

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

function onSaved(saved: SccaAssessment) {
  assessment.value = saved
  dirty.value = false
  livePreview.value = null
}

async function removeAssessment() {
  if (!assessment.value) return
  const name = assessment.value.application_name
  const ok = await confirm({
    title: `Delete '${name}'?`,
    description: 'This permanently removes the assessment and all of its answers.',
    confirmLabel: 'Delete assessment',
    destructive: true,
  })
  if (!ok) return
  try {
    dirty.value = false
    await sccaApi.remove(assessment.value.id)
    toast.add({ title: 'Assessment deleted', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo('/scca')
  } catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <AppPage
    :title="assessment?.application_name ?? 'Assessment'"
    :crumbs="[
      { label: 'SCCA', to: '/scca' },
      ...(assessment ? [{ label: assessment.application_name }] : []),
    ]"
  >
    <template #actions>
      <UButton
        v-if="assessment"
        :to="`/scca/${assessment.id}/report`"
        color="neutral"
        variant="outline"
        icon="i-lucide-file-text"
        label="View report"
      />
      <SccaReportDownloads
        v-if="assessment"
        :assessment-id="assessment.id"
      />
      <UButton
        v-if="assessment?.can_delete"
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

    <template v-else-if="assessment && formula">
      <UTabs
        :model-value="tab"
        :items="tabItems"
        variant="link"
        :unmount-on-hide="false"
        class="min-w-0"
        @update:model-value="selectTab"
      >
        <template #details>
          <SccaDetailsForm
            :key="`details-${formKey}`"
            :assessment="assessment"
            @saved="onSaved"
          />
        </template>
        <template #rating>
          <SccaRatingForm
            :key="`rating-${formKey}`"
            :assessment="assessment"
            :formula="formula"
            @saved="onSaved"
          />
        </template>
        <template #interdependencies>
          <SccaInterdependencyForm
            :key="`inter-${formKey}`"
            :assessment="assessment"
            @saved="onSaved"
          />
        </template>
        <template #recovery>
          <SccaRecoveryForm
            :key="`recovery-${formKey}`"
            :assessment="assessment"
            :standards="standards?.items ?? []"
            @saved="onSaved"
          />
        </template>
        <template #result>
          <SccaResultForm
            :key="`result-${formKey}`"
            :assessment="assessment"
            :formula="formula"
            :standards="standards?.items ?? []"
            @saved="onSaved"
          />
        </template>
      </UTabs>
    </template>
  </AppPage>
</template>
