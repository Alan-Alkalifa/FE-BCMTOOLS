<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type { BiancaConfigVersion } from '~/composables/useBiancaConfigAdmin'
import { biancaListItems } from '~/utils/bianca-config'

definePageMeta({ permission: 'bianca.config.view' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { can, user } = useAuth()
const { data, status, error, refresh } = await useFetch<{ items: BiancaConfigVersion[] }>('/api/admin/bianca-config/versions', { key: 'bianca-config-admin' })
const version = computed(() => data.value?.items.find((v) => v.id === Number(route.query.version))
  ?? data.value?.items.find((v) => v.status === 'draft')
  ?? data.value?.items.find((v) => v.status === 'active'))
function versionForm(version: BiancaConfigVersion) {
  return { name: version.name, notes: version.notes, payload: toRaw(version.payload), list_items: biancaListItems(version) }
}
const form = ref<ReturnType<typeof versionForm> | null>(null)
watch(version, (v) => {
  form.value = v ? structuredClone(versionForm(v)) : null
}, { immediate: true })
const original = computed(() => version.value ? JSON.stringify(versionForm(version.value)) : '')
const dirty = computed(() => !!form.value && JSON.stringify(form.value) !== original.value)
const editable = computed(() => version.value?.status === 'draft' && can('bianca.config.manage'))
const busy = ref<string | null>(null)
const failure = ref<string | null>(null)
const schema = z.object({ name: z.string().trim().min(1, 'Enter a version name.').max(255) }).passthrough()
const tabs = computed(() => [
  { label: 'Versions', value: 'versions', icon: 'i-lucide-git-branch' },
  { label: 'Personnel levels', value: 'personnel', icon: 'i-lucide-users' },
  { label: 'Lists', value: 'lists', icon: 'i-lucide-list' },
  { label: 'Impact and MTD', value: 'impact', icon: 'i-lucide-calculator' },
  { label: 'Guides and statements', value: 'guides', icon: 'i-lucide-list-checks' },
  { label: 'Approval template', value: 'steps', icon: 'i-lucide-signature' },
  ...(can('bianca.approval.manage')
    ? [{ label: 'Reminders and escalation', value: 'reminders', icon: 'i-lucide-bell-ring' }]
    : []),
  { label: 'Changes', value: 'changes', icon: 'i-lucide-git-compare' },
])
const versionStatus = defineStatusScale<BiancaConfigVersion['status']>({
  draft: { label: 'Draft', color: 'warning', icon: 'i-lucide-pencil' },
  active: { label: 'Active', color: 'success', icon: 'i-lucide-circle-check' },
  retired: { label: 'Retired', color: 'neutral', icon: 'i-lucide-archive' },
})
const draft = computed(() => data.value?.items.find((v) => v.status === 'draft'))
const versionItems = computed(() => (data.value?.items ?? []).map((v) => ({
  value: v.id,
  label: v.code + ' \u00b7 ' + versionStatus[v.status].label.toLowerCase(),
})))
const versionColumns: TableColumn<BiancaConfigVersion>[] = [
  { accessorKey: 'code', header: 'Version' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'used_by', header: 'BIAs', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'published_at', header: 'Published' },
]
const tab = computed({
  get: () => tabs.value.some((t) => t.value === route.query.tab) ? String(route.query.tab) : 'versions',
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
})
async function discardEdits() {
  return !dirty.value || await confirm({ title: 'Discard unsaved changes?', description: 'Your unsaved configuration edits will be lost.', confirmLabel: 'Discard changes', destructive: true })
}
onBeforeRouteLeave(async () => {
  if (!await discardEdits()) return false
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
async function chooseVersion(id: number) {
  if (await discardEdits()) await router.replace({ query: { ...route.query, version: id } })
}
async function run(operation: string, work: () => Promise<unknown>, message: string) {
  busy.value = operation
  failure.value = null
  try {
    await work()
    await refresh()
    clearNuxtData((key) => key.startsWith('bianca-lookups'))
    toast.add({ title: message, color: 'success' })
  } catch (err) {
    failure.value = biancaConfigError(err)
  } finally { busy.value = null }
}
async function start() {
  await run('start', async () => {
    const created = await biancaConfigApi.start()
    await router.replace({ query: { tab: 'personnel', version: created.id } })
  }, 'Draft configuration created')
}
async function save() {
  if (!version.value || !form.value || !editable.value || !dirty.value || busy.value) return
  const { id, revision } = version.value
  const { name, notes, payload, list_items } = form.value
  const activeCodes = Object.fromEntries(Object.entries(list_items).map(([key, items]) => [
    key, items.filter((item) => item.active).map((item) => item.code.trim()),
  ]))
  await run('save', () => biancaConfigApi.save(id, { name, notes, revision, payload: { ...payload, ...activeCodes }, list_items }), 'Draft configuration saved')
}
async function action(operation: 'request-publish' | 'withdraw' | 'publish' | 'discard') {
  const selected = version.value
  if (!selected || busy.value || dirty.value) return
  const { id, code, revision } = selected
  const details = {
    'request-publish': { label: 'Request publish', description: 'Someone else with publish permission must approve. Saving edits to the draft withdraws the request.', success: 'Publish requested' },
    'withdraw': { label: 'Withdraw request', description: 'The draft returns to editing and can be submitted again.', success: 'Request withdrawn' },
    'publish': { label: 'Approve publication', description: 'New BIAs will use this version. Existing BIAs keep their saved configuration version.', success: code + ' is now active' },
    'discard': { label: 'Discard draft', description: 'All saved changes in this draft will be lost.', success: 'Draft discarded' },
  }[operation]
  const ok = await confirm({
    title: details.label + ' for ' + code + '?',
    description: details.description,
    confirmLabel: details.label,
    destructive: operation === 'discard',
  })
  if (!ok) return
  await run(operation, async () => {
    if (operation === 'discard') {
      await biancaConfigApi.discard(id, revision)
      await router.replace({ query: { ...route.query, version: undefined } })
    } else {
      await biancaConfigApi.action(id, revision, operation)
    }
  }, details.success)
}
</script>

<template>
  <AppPage
    title="BIA configuration"
    icon="i-lucide-file-cog"
    description="Personnel levels, assessment parameters, guides, approval template by version, and live reminder rules."
    :crumbs="[{ label: 'Administration' }, { label: 'BIA configuration' }]"
  >
    <template #actions>
      <template v-if="tab !== 'reminders'">
        <USelect
          v-if="versionItems.length"
          :model-value="version?.id"
          :items="versionItems"
          :disabled="!!busy"
          class="w-32"
          aria-label="Configuration version"
          @update:model-value="chooseVersion"
        />
        <UButton
          v-if="can('bianca.config.manage') && !draft"
          label="Start draft version"
          icon="i-lucide-file-plus"
          :loading="busy === 'start'"
          :disabled="!!busy"
          @click="start"
        />
        <UButton
          v-if="editable"
          type="submit"
          form="bianca-config-form"
          icon="i-lucide-save"
          label="Save draft"
          :loading="busy === 'save'"
          :disabled="!dirty || !!busy"
        />
        <template v-if="version?.status === 'draft'">
          <UButton
            v-if="editable && !version.requested_by_id"
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            label="Discard draft"
            :loading="busy === 'discard'"
            :disabled="dirty || !!busy"
            @click="action('discard')"
          />
          <UButton
            v-if="editable && version.requested_by_id"
            color="neutral"
            variant="outline"
            icon="i-lucide-undo-2"
            label="Withdraw request"
            :loading="busy === 'withdraw'"
            :disabled="dirty || !!busy"
            @click="action('withdraw')"
          />
          <UButton
            v-if="editable && !version.requested_by_id"
            icon="i-lucide-send"
            label="Request publish"
            :loading="busy === 'request-publish'"
            :disabled="dirty || !!busy"
            @click="action('request-publish')"
          />
          <UButton
            v-if="version.requested_by_id && can('bianca.config.publish')"
            icon="i-lucide-badge-check"
            label="Approve publication"
            :loading="busy === 'publish'"
            :disabled="dirty || !!busy || version.requested_by_id === user?.id"
            @click="action('publish')"
          />
        </template>
      </template>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load BIA configuration"
      :description="biancaConfigError(error)"
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
    <SkeletonCard
      v-else-if="status === 'pending' && !data"
      :lines="6"
      label="Loading BIA configuration"
    />

    <template v-else-if="version && form">
      <template v-if="tab !== 'reminders'">
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Configuration action failed"
          :description="failure"
        />
        <UAlert
          v-if="version.status === 'draft' && version.requested_by_id"
          color="warning"
          variant="subtle"
          icon="i-lucide-hourglass"
          :title="'Publication requested for ' + version.code"
          :description="version.requested_by_id === user?.id
            ? 'You requested publication. Another person must approve it.'
            : can('bianca.config.publish')
              ? 'Review Changes before approving. Saving changes to this draft withdraws the request.'
              : 'A user with publish permission must review and approve this draft.'"
        />
        <UAlert
          v-else-if="!editable"
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          :title="version.code + ' is read-only'"
          :description="draft && can('bianca.config.manage')
            ? 'Select draft ' + draft.code + ' to edit the configuration.'
            : !draft && can('bianca.config.manage') ? 'Start a draft to edit a copy of the active version.' : undefined"
        />
        <UAlert
          v-if="dirty"
          color="warning"
          variant="subtle"
          icon="i-lucide-pencil"
          title="Unsaved changes"
          description="Save the draft to include these edits in the publication review."
        />
      </template>

      <UTabs
        v-model="tab"
        :items="tabs"
        variant="link"
        class="min-w-0"
        :ui="{ list: 'min-w-0 overflow-x-auto', indicator: 'bottom-0', trigger: 'shrink-0 whitespace-nowrap' }"
      >
        <template #content="{ item }">
          <AdminBiancaConfigReminders
            v-if="item.value === 'reminders'"
            class="mt-4"
          />
          <UForm
            v-else
            id="bianca-config-form"
            :state="form"
            :schema="schema"
            @submit="save"
            @error="tab = 'versions'"
          >
            <div
              v-if="item.value === 'versions'"
              class="mt-4 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]"
            >
              <UCard
                class="min-w-0"
                :ui="{ body: 'p-0 sm:p-0' }"
              >
                <template #header>
                  <h2 class="font-semibold text-highlighted">
                    Versions
                  </h2>
                  <p class="mt-1 text-sm text-muted">
                    New BIAs use the active version. Existing assessments keep their saved version.
                  </p>
                </template>
                <UTable
                  :data="data?.items ?? []"
                  :columns="versionColumns"
                  :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
                >
                  <template #code-cell="{ row }">
                    <UButton
                      type="button"
                      variant="link"
                      class="p-0 font-medium"
                      :label="row.original.code"
                      :aria-current="row.original.id === version.id ? 'true' : undefined"
                      :disabled="!!busy"
                      @click="chooseVersion(row.original.id)"
                    />
                    <p
                      class="max-w-48 truncate text-xs text-muted"
                      :title="row.original.name"
                    >
                      {{ row.original.name }}
                    </p>
                  </template>
                  <template #status-cell="{ row }">
                    <StatusBadge
                      :scale="versionStatus"
                      :value="row.original.status"
                      size="sm"
                    />
                  </template>
                  <template #used_by-cell="{ row }">
                    {{ formatNumber(row.original.used_by) }}
                  </template>
                  <template #published_at-cell="{ row }">
                    {{ row.original.published_at ? formatDate(row.original.published_at) : '—' }}
                  </template>
                </UTable>
              </UCard>
              <UCard>
                <template #header>
                  <h2 class="font-semibold text-highlighted">
                    {{ version.code }}
                  </h2>
                  <p class="mt-1 text-sm text-muted">
                    Revision {{ version.revision }}
                  </p>
                </template>
                <div class="space-y-4">
                  <UFormField
                    label="Version name"
                    name="name"
                    required
                  >
                    <UInput
                      v-model="form.name"
                      :maxlength="255"
                      :disabled="!editable || !!busy"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Notes (optional)">
                    <UTextarea
                      :model-value="form.notes ?? ''"
                      :rows="4"
                      :maxlength="20000"
                      :disabled="!editable || !!busy"
                      class="w-full"
                      @update:model-value="form.notes = $event || null"
                    />
                  </UFormField>
                </div>
              </UCard>
            </div>
            <AdminBiancaConfigChanges
              v-else-if="item.value === 'changes'"
              class="mt-4"
              :version="version"
            />
            <AdminBiancaConfigLists
              v-else-if="item.value === 'lists'"
              v-model="form.list_items"
              class="mt-4"
              :disabled="!editable || !!busy"
              :payload="form.payload"
              :reference-lists="version.reference_lists"
            />
            <AdminBiancaConfigParameters
              v-else
              :key="version.id"
              v-model="form.payload"
              class="mt-4"
              :signers="version.signer_profiles ?? {}"
              :saved-step-codes="version.payload.signoff_steps.map(step => step.code)"
              :version-id="version.id"
              :export-disabled="dirty || !!busy"
              :reference-guides="version.reference_guides ?? {}"
              :section="item.value"
              :disabled="!editable || !!busy"
            />
          </UForm>
        </template>
      </UTabs>
    </template>

    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="No BIA configuration"
      description="An administrator can seed the baseline with flask bianca seed-config."
    />
  </AppPage>
</template>
