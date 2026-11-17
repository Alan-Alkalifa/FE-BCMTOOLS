<script setup lang="ts">
import { z } from 'zod'
import type { BiancaConfigVersion } from '~/composables/useBiancaConfigAdmin'

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
const form = ref<{ name: string, notes: string | null, payload: BiancaConfigVersion['payload'] } | null>(null)
watch(version, (v) => {
  form.value = v ? { name: v.name, notes: v.notes, payload: structuredClone(toRaw(v.payload)) } : null
}, { immediate: true })
const original = computed(() => version.value ? JSON.stringify({ name: version.value.name, notes: version.value.notes, payload: version.value.payload }) : '')
const dirty = computed(() => !!form.value && JSON.stringify(form.value) !== original.value)
const editable = computed(() => version.value?.status === 'draft' && can('bianca.config.manage'))
const busy = ref(false)
const failure = ref<string | null>(null)
const schema = z.object({ name: z.string().trim().min(1, 'Enter a version name.').max(255) }).passthrough()
const tabs = computed(() => [
  { label: 'Versions', value: 'versions' },
  { label: 'Personnel levels', value: 'personnel' },
  { label: 'Lists', value: 'lists' },
  { label: 'Impact and MTD', value: 'impact' },
  { label: 'Guides and statements', value: 'guides' },
  { label: 'Approval template', value: 'steps' },
  ...(can('bianca.approval.manage')
    ? [{ label: 'Reminders and escalation', value: 'reminders' }]
    : []),
  { label: 'Changes', value: 'changes' },
])
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
async function run(work: () => Promise<unknown>, message: string) {
  busy.value = true
  failure.value = null
  try {
    await work()
    await refresh()
    clearNuxtData((key) => key.startsWith('bianca-lookups'))
    toast.add({ title: message, color: 'success' })
  } catch (err) {
    failure.value = biancaConfigError(err)
  } finally { busy.value = false }
}
async function start() {
  await run(async () => {
    const created = await biancaConfigApi.start()
    await router.replace({ query: { tab: 'personnel', version: created.id } })
  }, 'Draft configuration created')
}
async function save() {
  if (!version.value || !form.value) return
  await run(() => biancaConfigApi.save(version.value!.id, { ...form.value!, revision: version.value!.revision }), 'Draft configuration saved')
}
async function action(operation: 'request-publish' | 'withdraw' | 'publish' | 'discard') {
  if (!version.value) return
  const labels = { 'request-publish': 'Request publication', 'withdraw': 'Withdraw request', 'publish': 'Publish configuration', 'discard': 'Discard draft' }
  const ok = await confirm({ title: `${labels[operation]}?`, description: operation === 'publish' ? 'New BIAs will use this version. Existing BIAs keep their saved configuration version.' : 'Only saved changes are included. Publication needs approval by a different person.', confirmLabel: labels[operation], destructive: operation === 'discard' })
  if (!ok) return
  await run(() => operation === 'discard'
    ? biancaConfigApi.discard(version.value!.id, version.value!.revision)
    : biancaConfigApi.action(version.value!.id, version.value!.revision, operation), labels[operation])
}
</script>

<template>
  <AppPage
    title="BIA configuration"
    icon="i-lucide-file-cog"
    description="BIA parameters, dynamic personnel U levels and the four-role approval template by version, plus live reminder rules."
    :crumbs="[{ label: 'Administration' }, { label: 'BIA configuration' }]"
  >
    <template #actions>
      <template v-if="tab !== 'reminders'">
        <UButton
          v-if="can('bianca.config.manage') && !data?.items.some(v => v.status === 'draft')"
          label="Start draft version"
          icon="i-lucide-plus"
          :loading="busy"
          @click="start"
        />
        <UButton
          v-if="editable"
          type="submit"
          form="bianca-config-form"
          label="Save draft"
          :loading="busy"
          :disabled="!dirty"
        />
      </template>
    </template>
    <UAlert
      v-if="error"
      color="error"
      title="Could not load BIA configuration"
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
    <SkeletonTable
      v-else-if="status === 'pending' && !data"
      :columns="4"
      label="Loading BIA configuration"
    />
    <template v-else-if="version && form">
      <template v-if="tab !== 'reminders'">
        <div class="flex flex-wrap items-center gap-3">
          <USelect
            :model-value="version.id"
            :items="data?.items.map(v => ({ value: v.id, label: `${v.code} · ${v.status}` }))"
            aria-label="Configuration version"
            @update:model-value="chooseVersion(Number($event))"
          />
          <UBadge :color="version.status === 'active' ? 'success' : 'neutral'">
            {{ version.status }}
          </UBadge>
          <UBadge
            v-if="dirty"
            color="warning"
          >
            Unsaved changes
          </UBadge>
          <span class="text-sm text-muted">{{ version.used_by }} BIA(s) · revision {{ version.revision }}</span>
        </div>
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Configuration could not be saved"
          :description="failure"
        />
        <UAlert
          v-if="version.requested_by_id"
          color="info"
          variant="subtle"
          title="Publication requested"
          description="A different user with publish permission must approve. Editing this draft withdraws the request."
        />
      </template>
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full"
      />
      <AdminBiancaConfigReminders v-if="tab === 'reminders'" />
      <template v-else>
        <UForm
          id="bianca-config-form"
          :state="form"
          :schema="schema"
          class="space-y-5"
          @submit="save"
        >
          <UCard v-if="tab === 'versions'">
            <div class="space-y-4">
              <UFormField
                label="Version name"
                name="name"
                required
              >
                <UInput
                  v-model="form.name"
                  :maxlength="255"
                  :disabled="!editable"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Notes (optional)">
                <UTextarea
                  :model-value="form.notes ?? ''"
                  :rows="3"
                  :maxlength="20000"
                  :disabled="!editable"
                  class="w-full"
                  @update:model-value="form.notes = $event || null"
                />
              </UFormField>
              <p class="text-sm text-muted">
                Start from the active version, edit a draft, save, then request publication. Existing assessments and their Excel files keep their configuration version.
              </p>
            </div>
          </UCard>
          <UCard v-else-if="tab === 'changes'">
            <h2 class="mb-4 text-lg font-semibold">
              Saved changes from the source version
            </h2>
            <p
              v-if="!version.changes.length"
              class="text-sm text-muted"
            >
              No saved parameter changes.
            </p>
            <div
              v-for="change in version.changes"
              :key="change.part"
              class="mb-5 space-y-2"
            >
              <h3 class="font-semibold">
                {{ change.part }}
              </h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <p class="text-xs text-muted">
                    Before
                  </p><pre class="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{{ JSON.stringify(change.before, null, 2) }}</pre>
                </div>
                <div>
                  <p class="text-xs text-muted">
                    After
                  </p><pre class="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{{ JSON.stringify(change.after, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </UCard>
          <UCard v-else>
            <AdminBiancaConfigParameters
              v-model="form.payload"
              :signers="version.signer_profiles ?? {}"
              :section="tab"
              :disabled="!editable || busy"
            />
          </UCard>
        </UForm>
        <div
          v-if="version.status === 'draft'"
          class="flex flex-wrap items-center gap-3"
        >
          <UButton
            v-if="editable && !version.requested_by_id"
            color="neutral"
            variant="outline"
            label="Request publication"
            :disabled="dirty || busy"
            @click="action('request-publish')"
          />
          <UButton
            v-if="editable && version.requested_by_id"
            color="neutral"
            variant="outline"
            label="Withdraw request"
            :disabled="busy || dirty"
            @click="action('withdraw')"
          />
          <UButton
            v-if="version.requested_by_id && can('bianca.config.publish')"
            label="Approve publication"
            :disabled="busy || dirty || version.requested_by_id === user?.id"
            @click="action('publish')"
          />
          <UButton
            v-if="editable && !version.requested_by_id"
            color="error"
            variant="soft"
            label="Discard draft"
            :disabled="busy || dirty"
            @click="action('discard')"
          />
          <p
            v-if="version.requested_by_id === user?.id"
            class="text-sm text-muted"
          >
            You requested publication. Another person must approve it.
          </p>
          <p
            v-else-if="dirty"
            class="text-sm text-muted"
          >
            Save the draft before requesting or approving publication.
          </p>
        </div>
      </template>
    </template>
    <UAlert
      v-else
      color="info"
      title="No BIA configuration"
      description="An administrator can seed the baseline with flask bianca seed-config."
    />
  </AppPage>
</template>
