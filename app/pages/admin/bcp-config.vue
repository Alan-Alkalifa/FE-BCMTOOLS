<script setup lang="ts">
import type { BcpConfigVersion } from '~/composables/useBcpConfigAdmin'
import type { BcpConfigTab } from '~/utils/bcp-config'

/**
 * Administration > BCP configuration. The standard text, glossary, crisis teams, level of
 * disruption, workaround conditions, contacts and approval template of every BCP come from a
 * version: one active, at most one draft (a copy of the active one), the rest retired. Only the
 * draft is edited; publishing takes two people (one requests, another approves). Laid out as
 * SCCA configuration.
 */
definePageMeta({ permission: 'bcp.config.view' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const TABS = BCP_CONFIG_TABS.map((item) => item.value)
const tab = computed<BcpConfigTab>({
  get: () => {
    const value = route.query.tab as BcpConfigTab
    return TABS.includes(value) ? value : 'versions'
  },
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'versions' ? undefined : value } }),
})
const tabItems = BCP_CONFIG_TABS.map((item) => ({ label: item.label, value: item.value, icon: item.icon, slot: item.value }))

const versions = useAsyncData('bcp-config-versions', () => bcpConfigApi.versions())
const draftCode = computed(() => versions.data.value?.items.find((row) => row.status === 'draft')?.code)
const activeCode = computed(() => versions.data.value?.items.find((row) => row.status === 'active')?.code)
const code = computed<string | undefined>({
  get: () => (route.query.version as string | undefined) || draftCode.value || activeCode.value,
  set: (value) => router.replace({ query: { ...route.query, version: value } }),
})
const versionItems = computed(() => (versions.data.value?.items ?? []).map((row) => ({
  label: `${row.code} · ${bcpVersionStatus[row.status].label.toLowerCase()}`,
  value: row.code,
})))

const current = useAsyncData(
  () => `bcp-config-version-${code.value ?? 'none'}`,
  () => (code.value ? bcpConfigApi.get(code.value) : Promise.resolve(null)),
  { watch: [code] },
)
const version = computed(() => current.data.value ?? null)
const showSkeleton = useDelayedLoading(() =>
  (versions.status.value === 'pending' && !versions.data.value)
  || (current.status.value === 'pending' && !current.data.value),
)

function onSaved(saved: BcpConfigVersion) {
  current.data.value = saved
  void versions.refresh()
}

const busy = ref<string | null>(null)

async function run(action: string, work: () => Promise<BcpConfigVersion | null | undefined>, message: string) {
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
    description: `The draft starts as a copy of ${activeCode.value}: scope, standard text, glossary, crisis teams, level of disruption, workaround conditions, contacts, approval template and document rules. BCPs keep using ${activeCode.value} until the draft is published.`,
    confirmLabel: 'Start draft',
  })
  if (!ok) return
  await run('start', async () => {
    const draft = await bcpConfigApi.startDraft()
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
  if (ok) await run('request', () => bcpConfigApi.requestPublish(version.value!.code, version.value!.revision), 'Publish requested')
}

async function withdraw() {
  if (version.value) await run('withdraw', () => bcpConfigApi.withdrawRequest(version.value!.code, version.value!.revision), 'Request withdrawn')
}

async function publish() {
  if (!version.value) return
  const ok = await confirm({
    title: `Publish ${version.value.code}?`,
    description: `New BCPs then use ${version.value.code} and ${activeCode.value} retires. Existing BCPs keep their version. Check the Changes tab first.`,
    confirmLabel: `Publish ${version.value.code}`,
  })
  if (ok) await run('publish', () => bcpConfigApi.publish(version.value!.code, version.value!.revision), `${version.value.code} is now active`)
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
    await bcpConfigApi.discard(version.value!.code, version.value!.revision)
    await versions.refresh()
    code.value = activeCode.value
    return null
  }, 'Draft discarded')
}
</script>

<template>
  <AppPage
    title="BCP configuration"
    icon="i-lucide-file-cog"
    description="The standard text, glossary, crisis teams, level of disruption, workaround conditions, contacts and approval template of every BCP, by version."
    :crumbs="[{ label: 'Administration' }, { label: 'BCP configuration' }]"
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
          v-if="!version.requested_by_id && version.can.edit"
          icon="i-lucide-send"
          label="Request publish"
          :disabled="!version.can.request_publish"
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
      label="Loading the BCP configuration"
      class="space-y-6"
    >
      <SkeletonCard :lines="6" />
    </SkeletonGroup>

    <UAlert
      v-else-if="versions.error.value || current.error.value"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the BCP configuration"
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
      <UAlert
        v-if="version.status === 'draft' && version.requested_by_id"
        class="mb-6"
        color="warning"
        variant="subtle"
        icon="i-lucide-hourglass"
        :title="`${version.requested_by ?? 'Someone'} asked to publish ${version.code} on ${formatDateTime(version.requested_at)}.`"
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
        :title="`${version.code} is ${bcpVersionStatus[version.status].label.toLowerCase()}, so it is read-only.`"
        :description="draftCode
          ? `Edit the draft ${draftCode} instead.`
          : versions.data.value?.can_start_draft ? 'Start a draft to change the configuration: it starts as a copy of the active version.' : 'Only the draft version can be changed.'"
      />

      <UTabs
        v-model="tab"
        :items="tabItems"
        variant="link"
        class="min-w-0"
        :ui="{ list: 'overflow-x-auto overflow-y-hidden [scrollbar-width:thin]', indicator: 'bottom-0', trigger: 'shrink-0' }"
      >
        <template #versions>
          <div class="mt-4 space-y-6">
            <AdminBcpConfigVersions
              :versions="versions.data.value?.items ?? []"
              :version="version"
              @open="(value) => (code = value)"
              @saved="onSaved"
            />
            <AdminBcpConfigDocumentMap />
          </div>
        </template>
        <template #scope>
          <AdminBcpConfigScope
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #text>
          <AdminBcpConfigStandardText
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #glossary>
          <AdminBcpConfigGlossary
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #teams>
          <AdminBcpConfigCrisisTeams
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #lod>
          <AdminBcpConfigLod
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #workaround>
          <AdminBcpConfigWorkaround
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #contacts>
          <AdminBcpConfigContacts
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #steps>
          <AdminBcpConfigSteps
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #rules>
          <AdminBcpConfigRules
            class="mt-4"
            :version="version"
            @saved="onSaved"
          />
        </template>
        <template #changes>
          <AdminBcpConfigChanges
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
      title="No BCP configuration yet"
      description="Run the database migrations, or flask bcp seed-config: they create V1 from the BCP template ver.23."
    />
  </AppPage>
</template>
