<script setup lang="ts">
import type { RaConfigVersion } from '~/composables/useRaConfigAdmin'

/**
 * Administration > RA configuration, like the SCCA one. RA and RA Branch each have versions of
 * their hazards and guides, sign-off role titles, statements and notes: one active, at most
 * one draft (a copy of the active one), the rest retired. Only the draft is edited; publishing
 * takes two people (one requests, another approves). Assessments keep their version.
 * The division list, disaster or incident per hazard, the reminder rules, the team diagrams and
 * the access scope are live, not
 * part of a version.
 */
definePageMeta({ permission: 'ra.config.view' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { can } = useAuth()

const TABS = ['versions', 'hazards', 'steps', 'texts', 'divisions', 'hazard-types', 'reminders', 'earthquakes', 'past-disasters', 'diagrams', 'access', 'changes'] as const
type Tab = (typeof TABS)[number]
/** Tabs that edit live rules rather than a version. */
const LIVE: Tab[] = ['divisions', 'hazard-types', 'reminders', 'diagrams', 'access']
const tab = computed<Tab>({
  // ?tab=roles is the older name of the Sign-off steps tab.
  get: () => (route.query.tab === 'roles' ? 'steps' : TABS.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'versions'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'versions' ? undefined : value } }),
})
const tabItems = [
  { label: 'Versions', value: 'versions', icon: 'i-lucide-git-branch', slot: 'versions' },
  { label: 'Hazards and guides', value: 'hazards', icon: 'i-lucide-list-checks', slot: 'hazards' },
  { label: 'Sign-off steps', value: 'steps', icon: 'i-lucide-signature', slot: 'steps' },
  { label: 'Statements and notes', value: 'texts', icon: 'i-lucide-text-quote', slot: 'texts' },
  { label: 'Divisions', value: 'divisions', icon: 'i-lucide-building-2', slot: 'divisions' },
  { label: 'Disaster or incident', value: 'hazard-types', icon: 'i-lucide-split', slot: 'hazard-types' },
  { label: 'Reminders and escalation', value: 'reminders', icon: 'i-lucide-bell-ring', slot: 'reminders' },
  { label: 'Earthquakes', value: 'earthquakes', icon: 'i-lucide-activity', slot: 'earthquakes' },
  { label: 'Past disasters', value: 'past-disasters', icon: 'i-lucide-history', slot: 'past-disasters' },
  { label: 'Team diagrams', value: 'diagrams', icon: 'i-lucide-network', slot: 'diagrams' },
  { label: 'Access scope', value: 'access', icon: 'i-lucide-shield-check', slot: 'access' },
  { label: 'Changes', value: 'changes', icon: 'i-lucide-git-compare', slot: 'changes' },
]

const kind = computed<RaKind>({
  get: () => (route.query.kind === 'branch' ? 'branch' : 'head_office'),
  set: (value) => router.replace({ query: { ...route.query, kind: value === 'head_office' ? undefined : value, version: undefined } }),
})
const kindItems = [
  { label: 'RA (head office)', value: 'head_office' },
  { label: 'RA Branch', value: 'branch' },
]

const versions = useAsyncData('ra-config-versions', () => raConfigApi.versions())
const ofKind = computed(() => (versions.data.value?.items ?? []).filter((row) => row.kind === kind.value))
const draftCode = computed(() => ofKind.value.find((row) => row.status === 'draft')?.code)
const activeCode = computed(() => ofKind.value.find((row) => row.status === 'active')?.code)
const code = computed<string | undefined>({
  get: () => {
    const asked = route.query.version as string | undefined
    if (asked && ofKind.value.some((row) => row.code === asked)) return asked
    return draftCode.value || activeCode.value
  },
  set: (value) => router.replace({ query: { ...route.query, version: value } }),
})
const versionItems = computed(() => ofKind.value.map((row) => ({
  label: `${row.code} · ${sccaVersionStatus[row.status].label.toLowerCase()}`,
  value: row.code,
})))
const canStartDraft = computed(() => versions.data.value?.can_start_draft?.[kind.value] ?? false)

const current = useAsyncData(
  () => `ra-config-version-${kind.value}-${code.value ?? 'none'}`,
  () => (code.value ? raConfigApi.get({ code: code.value, kind: kind.value }) : Promise.resolve(null)),
  { watch: [code, kind] },
)
const version = computed(() => current.data.value ?? null)
const showSkeleton = useDelayedLoading(() =>
  (versions.status.value === 'pending' && !versions.data.value)
  || (current.status.value === 'pending' && !current.data.value),
)

function onSaved(saved: RaConfigVersion) {
  current.data.value = saved
  void versions.refresh()
  // The draft's code was changed (e.g. to V.05): follow it.
  if (saved.code !== code.value) code.value = saved.code
  // The assessment pages read the configuration: drop their cached copy.
  clearNuxtData((key) => key.startsWith('ra-formula-') || key === 'ra-building-types')
}

const busy = ref<string | null>(null)

async function run(action: string, work: () => Promise<RaConfigVersion | null | undefined>, message: string) {
  busy.value = action
  try {
    const result = await work()
    if (result) onSaved(result)
    toast.add({ title: message, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: configErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert', duration: 10000 })
  } finally {
    busy.value = null
  }
}

const kindTitle = computed(() => (kind.value === 'branch' ? 'RA Branch' : 'RA HO'))

async function startDraft() {
  const ok = await confirm({
    title: `Start a draft ${kindTitle.value} version?`,
    description: `The draft starts as a copy of ${activeCode.value}: hazards and guides, sign-off steps, statements and notes. Assessments keep using ${activeCode.value} until the draft is published.`,
    confirmLabel: 'Start draft',
  })
  if (!ok) return
  await run('start', async () => {
    const draft = await raConfigApi.startDraft(kind.value)
    await versions.refresh()
    code.value = draft.code
    return draft
  }, 'Draft version started')
}

async function requestPublish() {
  if (!version.value) return
  const ok = await confirm({
    title: `Request the publish of ${version.value.code}?`,
    description: 'Someone else with the publish permission then approves it. Any edit before that withdraws the request.',
    confirmLabel: 'Request publish',
  })
  if (ok) await run('request', () => raConfigApi.requestPublish(version.value!), 'Publish requested')
}

async function withdraw() {
  if (version.value) await run('withdraw', () => raConfigApi.withdrawRequest(version.value!), 'Request withdrawn')
}

async function publish() {
  if (!version.value) return
  const ok = await confirm({
    title: `Publish ${version.value.code}?`,
    description: `New ${kindTitle.value} assessments then use ${version.value.code} and ${activeCode.value} retires. Existing assessments keep their version. Check the Changes tab first.`,
    confirmLabel: `Publish ${version.value.code}`,
  })
  if (ok) await run('publish', () => raConfigApi.publish(version.value!), `${version.value.code} is now active`)
}

async function discard() {
  if (!version.value) return
  const ok = await confirm({
    title: `Discard ${version.value.code}?`,
    description: 'Every change in this draft is lost. The active version stays as it is.',
    confirmLabel: 'Discard draft',
    destructive: true,
  })
  if (!ok) return
  await run('discard', async () => {
    await raConfigApi.discard(version.value!)
    await versions.refresh()
    code.value = activeCode.value
    return null
  }, 'Draft discarded')
}
</script>

<template>
  <AppPage
    title="RA configuration"
    icon="i-lucide-file-cog"
    description="The RA and RA Branch hazards and guides, sign-off steps, statements and notes by version. Also the default and fixed signers, the division list, the reminder rules, the team diagrams and the access scope."
    :crumbs="[{ label: 'Administration' }, { label: 'RA configuration' }]"
  >
    <template #actions>
      <USelect
        v-model="kind"
        :items="kindItems"
        class="w-44"
        aria-label="Module"
      />
      <USelect
        v-if="versionItems.length && !LIVE.includes(tab)"
        v-model="code"
        :items="versionItems"
        class="w-40"
        aria-label="Version"
      />
      <template v-if="!LIVE.includes(tab)">
        <UButton
          v-if="canStartDraft"
          icon="i-lucide-file-plus"
          label="Start draft"
          :loading="busy === 'start'"
          @click="startDraft"
        />
        <template v-if="version?.status === 'draft'">
          <UButton
            v-if="version.can.discard"
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            label="Discard draft"
            :loading="busy === 'discard'"
            @click="discard"
          />
          <UButton
            v-if="version.can.withdraw_request"
            color="neutral"
            variant="outline"
            icon="i-lucide-undo-2"
            label="Withdraw request"
            :loading="busy === 'withdraw'"
            @click="withdraw"
          />
          <UButton
            v-if="version.can.request_publish"
            icon="i-lucide-send"
            label="Request publish"
            :disabled="version.problems.length > 0"
            :loading="busy === 'request'"
            @click="requestPublish"
          />
          <UButton
            v-if="version.can.publish"
            icon="i-lucide-badge-check"
            :label="`Publish ${version.code}`"
            :loading="busy === 'publish'"
            @click="publish"
          />
        </template>
      </template>
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the RA configuration"
      class="space-y-6"
    >
      <SkeletonCard :lines="6" />
    </SkeletonGroup>

    <UAlert
      v-else-if="versions.error.value || current.error.value"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the RA configuration"
      :description="configErrorText(versions.error.value ?? current.error.value)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="() => { versions.refresh(); current.refresh() }"
        />
      </template>
    </UAlert>

    <template v-else-if="version">
      <template v-if="!LIVE.includes(tab)">
        <UAlert
          v-if="version.status === 'draft' && version.requested_by"
          class="mb-6"
          color="warning"
          variant="subtle"
          icon="i-lucide-hourglass"
          :title="`${version.requested_by} asked to publish ${version.code} on ${formatDateTime(version.requested_at)}.`"
          :description="version.can.publish
            ? 'Check the Changes tab, then publish it. Someone other than the requester approves.'
            : 'Someone else with the publish permission approves it. Any edit withdraws the request.'"
        />
        <UAlert
          v-else-if="version.status === 'draft' && version.problems.length"
          class="mb-6"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Fix these before requesting the publish"
          :ui="{ description: 'whitespace-pre-line' }"
          :description="version.problems.map((line) => `• ${line}`).join('\n')"
        />
        <UAlert
          v-else-if="version.status !== 'draft'"
          class="mb-6"
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          :title="`${version.code} is ${sccaVersionStatus[version.status].label.toLowerCase()}, so it is read-only.`"
          :description="draftCode
            ? `Edit the draft ${draftCode} instead.`
            : can('ra.config.manage') ? 'Start a draft to change the configuration: it starts as a copy of the active version.' : 'Only the draft version can be changed.'"
        />
      </template>

      <!-- Eleven tabs: they keep their full labels and scroll sideways when they don't fit. -->
      <UTabs
        v-model="tab"
        :items="tabItems"
        variant="link"
        class="min-w-0"
        :ui="{ list: 'overflow-x-auto overflow-y-hidden [scrollbar-width:thin]', indicator: 'bottom-0', trigger: 'shrink-0' }"
      >
        <template #versions>
          <AdminRaConfigVersions
            class="mt-4"
            :versions="ofKind"
            :version="version"
            @open="(value) => (code = value)"
            @saved="onSaved"
          />
        </template>
        <template #hazards>
          <div class="mt-4 space-y-6">
            <AdminRaConfigHazards
              :version="version"
              @saved="onSaved"
            />
            <AdminRaConfigGuides
              :version="version"
              @saved="onSaved"
            />
          </div>
        </template>
        <template #steps>
          <AdminRaConfigSteps
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #texts>
          <AdminRaConfigTexts
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #divisions>
          <AdminRaConfigDivisions class="mt-4" />
        </template>
        <template #hazard-types>
          <AdminRaConfigHazardTypes class="mt-4" />
        </template>
        <template #reminders>
          <AdminRaConfigReminders class="mt-4" />
        </template>
        <template #earthquakes>
          <AdminRaConfigEarthquakes class="mt-4" />
        </template>
        <template #past-disasters>
          <AdminRaConfigPastDisasters class="mt-4" />
          <div class="mt-6 grid items-start gap-6 lg:grid-cols-2">
            <AdminRaConfigOutbreakNews />
            <AdminRaConfigAirQuality />
          </div>
        </template>
        <template #diagrams>
          <AdminRaConfigDiagrams
            class="mt-4"
            :kind="kind"
          />
        </template>
        <template #access>
          <AdminRaConfigAccess class="mt-4" />
        </template>
        <template #changes>
          <AdminRaConfigChanges
            class="mt-4"
            :version="version"
          />
        </template>
      </UTabs>
    </template>

    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="No RA configuration yet"
      description="Run the database migrations: they create the 2025 r4 versions."
    />
  </AppPage>
</template>
