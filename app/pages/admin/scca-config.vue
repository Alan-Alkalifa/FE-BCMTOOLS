<script setup lang="ts">
import type { SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/**
 * Administration > SCCA configuration. Every chooser on the SCCA forms, the questions and
 * guides, the sign-off steps, the formula and the rating notes come from a version:
 * one active, at most one draft (a copy of the active one), the rest retired. Only the draft
 * is edited; publishing takes two people (one requests, another approves).
 */
definePageMeta({ permission: 'scca.config.view' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { can } = useAuth()

const TABS = ['versions', 'lists', 'questions', 'steps', 'formula', 'dr', 'notes', 'reminders', 'access', 'changes'] as const
type Tab = (typeof TABS)[number]
const tab = computed<Tab>({
  get: () => {
    const value = route.query.tab as Tab
    if (!TABS.includes(value) || (value === 'reminders' && !can('scca.settings.manage'))) return 'versions'
    return value
  },
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'versions' ? undefined : value } }),
})
// Reminders and Access scope: live settings (not part of a version).
const tabItems = computed(() => [
  { label: 'Versions', value: 'versions', icon: 'i-lucide-git-branch', slot: 'versions' },
  { label: 'Lists', value: 'lists', icon: 'i-lucide-list', slot: 'lists' },
  { label: 'Questions and guides', value: 'questions', icon: 'i-lucide-list-checks', slot: 'questions' },
  { label: 'Sign-off steps', value: 'steps', icon: 'i-lucide-signature', slot: 'steps' },
  { label: 'Formula', value: 'formula', icon: 'i-lucide-calculator', slot: 'formula' },
  { label: 'DR decision', value: 'dr', icon: 'i-lucide-shield-check', slot: 'dr' },
  { label: 'Rating notes', value: 'notes', icon: 'i-lucide-message-square-warning', slot: 'notes' },
  ...(can('scca.settings.manage')
    ? [{ label: 'Reminders and escalation', value: 'reminders', icon: 'i-lucide-bell-ring', slot: 'reminders' }]
    : []),
  { label: 'Access scope', value: 'access', icon: 'i-lucide-shield-user', slot: 'access' },
  { label: 'Changes', value: 'changes', icon: 'i-lucide-git-compare', slot: 'changes' },
])

const versions = useAsyncData('scca-config-versions', () => sccaConfigApi.versions())
const draftCode = computed(() => versions.data.value?.items.find((row) => row.status === 'draft')?.code)
const activeCode = computed(() => versions.data.value?.items.find((row) => row.status === 'active')?.code)
const code = computed<string | undefined>({
  get: () => (route.query.version as string | undefined) || draftCode.value || activeCode.value,
  set: (value) => router.replace({ query: { ...route.query, version: value } }),
})
const versionItems = computed(() => (versions.data.value?.items ?? []).map((row) => ({
  label: `${row.code} · ${sccaVersionStatus[row.status].label.toLowerCase()}`,
  value: row.code,
})))

const current = useAsyncData(
  () => `scca-config-version-${code.value ?? 'none'}`,
  () => (code.value ? sccaConfigApi.get(code.value) : Promise.resolve(null)),
  { watch: [code] },
)
const version = computed(() => current.data.value ?? null)
const showSkeleton = useDelayedLoading(() =>
  (versions.status.value === 'pending' && !versions.data.value)
  || (current.status.value === 'pending' && !current.data.value),
)

function onSaved(saved: SccaConfigVersion) {
  current.data.value = saved
  void versions.refresh()
  // Forms on other pages read the configuration: drop their cached copy of this version.
  clearNuxtData((key) => key.startsWith('scca-config-') && !key.startsWith('scca-config-version'))
}

const busy = ref<string | null>(null)

async function run(action: string, work: () => Promise<SccaConfigVersion | null | undefined>, message: string) {
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

async function startDraft() {
  const ok = await confirm({
    title: 'Start a draft version?',
    description: `The draft starts as a copy of ${activeCode.value}: lists, questions and guides, sign-off steps, formula and rating notes. SCCAs keep using ${activeCode.value} until the draft is published.`,
    confirmLabel: 'Start draft',
  })
  if (!ok) return
  await run('start', async () => {
    const draft = await sccaConfigApi.startDraft()
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
  if (ok) await run('request', () => sccaConfigApi.requestPublish(version.value!.code), 'Publish requested')
}

async function withdraw() {
  if (version.value) await run('withdraw', () => sccaConfigApi.withdrawRequest(version.value!.code), 'Request withdrawn')
}

async function publish() {
  if (!version.value) return
  const ok = await confirm({
    title: `Publish ${version.value.code}?`,
    description: `New SCCAs then use ${version.value.code} and ${activeCode.value} retires. Existing SCCAs keep their version; their assessors can move a draft. Check the Changes tab first.`,
    confirmLabel: `Publish ${version.value.code}`,
  })
  if (ok) await run('publish', () => sccaConfigApi.publish(version.value!.code), `${version.value.code} is now active`)
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
    await sccaConfigApi.discard(version.value!.code)
    await versions.refresh()
    code.value = activeCode.value
    return null
  }, 'Draft discarded')
}
</script>

<template>
  <AppPage
    title="SCCA configuration"
    icon="i-lucide-file-cog"
    description="The SCCA choice lists, questions and guides, sign-off steps and signers, formula and rating notes by version, and the reminder rules."
    :crumbs="[{ label: 'Administration' }, { label: 'SCCA configuration' }]"
  >
    <template #actions>
      <USelect
        v-if="versionItems.length"
        v-model="code"
        :items="versionItems"
        class="w-44"
        aria-label="Version"
      />
      <UButton
        v-if="versions.data.value?.can_start_draft"
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
          label="Discard"
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

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the SCCA configuration"
      class="space-y-6"
    >
      <SkeletonCard :lines="6" />
    </SkeletonGroup>

    <UAlert
      v-else-if="versions.error.value || current.error.value"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the SCCA configuration"
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
      <template v-if="tab !== 'reminders' && tab !== 'access'">
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
            : can('scca.config.manage') ? 'Start a draft to change the configuration: it starts as a copy of the active version.' : 'Only the draft version can be changed.'"
        />
      </template>

      <UTabs
        v-model="tab"
        :items="tabItems"
        variant="link"
        class="min-w-0"
        :ui="{ list: 'overflow-x-auto overflow-y-hidden [scrollbar-width:thin]', indicator: 'bottom-0', trigger: 'shrink-0' }"
      >
        <template #versions>
          <AdminSccaConfigVersions
            class="mt-4"
            :versions="versions.data.value?.items ?? []"
            :version="version"
            @open="(value) => (code = value)"
            @saved="onSaved"
          />
        </template>
        <template #lists>
          <AdminSccaConfigLists
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #questions>
          <AdminSccaConfigQuestions
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #steps>
          <AdminSccaConfigSteps
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #formula>
          <AdminSccaConfigFormula
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #dr>
          <AdminSccaConfigDrDecision
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #notes>
          <AdminSccaConfigNotes
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #reminders>
          <AdminSccaConfigReminders class="mt-4" />
        </template>
        <template #access>
          <AdminSccaConfigAccess class="mt-4" />
        </template>
        <template #changes>
          <AdminSccaConfigChanges
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
      title="No SCCA configuration yet"
      description="Run the database migrations: they create the V4.2 version."
    />
  </AppPage>
</template>
