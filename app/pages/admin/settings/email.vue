<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { SmtpProvider, SmtpProviderList, SmtpTestResult } from '~/composables/useAdmin'
import AdminSmtpProviderForm from '~/components/admin/AdminSmtpProviderForm.vue'

definePageMeta({ permission: 'admin.settings.mail' })

const toast = useToast()
const confirm = useConfirm()
const { user } = useAuth()
const providerForm = useOverlay().create(AdminSmtpProviderForm)
const { data, status, error, refresh } = useFetch<SmtpProviderList>('/api/admin/settings/mail/providers', { key: 'admin-mail-providers' })

const providers = computed(() => data.value?.items ?? [])
const active = computed(() => providers.value.find((row) => row.is_active) ?? null)
const busyId = ref<number | null>(null)

const testTo = ref('')
const testVia = ref<number>()
const testing = ref(false)
const testResult = ref<SmtpTestResult | null>(null)
const testItems = computed(() => providers.value.map((row) => ({
  label: row.is_active ? `${row.name} (active)` : row.name,
  value: row.id,
  icon: SMTP_PRESETS[row.kind].icon,
})))

watch(() => user.value?.email, (email) => {
  if (email && !testTo.value) testTo.value = email
}, { immediate: true })

watch(providers, (rows) => {
  if (!rows.some((row) => row.id === testVia.value)) testVia.value = (rows.find((row) => row.is_active) ?? rows[0])?.id
}, { immediate: true })

/** A provider that signs in needs its password or API key before it can send. */
function missingKey(row: SmtpProvider) {
  return !!row.username && !row.password_set
}

function security(row: SmtpProvider) {
  return SMTP_SECURITY_ITEMS.find((item) => item.value === row.security)?.label.replace(/ \(.*\)$/, '') ?? row.security
}

async function openForm(provider?: SmtpProvider) {
  const saved = await providerForm.open({ provider: provider ?? null, names: providers.value.map((row) => row.name) }).result
  if (saved) await refresh()
}

async function use(row: SmtpProvider) {
  const from = active.value
  const ok = await confirm({
    title: `Send every email through ${row.name}?`,
    description: from
      ? `${from.name} stops sending. Approvals, invitations and password resets will come from ${row.from_address}.`
      : `Approvals, invitations and password resets will come from ${row.from_address}.`,
    confirmLabel: `Use ${row.name}`,
  })
  if (!ok) return
  busyId.value = row.id
  try {
    data.value = await adminApi.activateProvider(row.id)
    toast.add({ title: `Emails now go through ${row.name}`, color: 'success', icon: 'i-lucide-send' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busyId.value = null
  }
}

async function turnOff(row: SmtpProvider) {
  const ok = await confirm({
    title: 'Turn email sending off?',
    description: 'No email is sent until you choose a provider again. Each one is logged as failed and can be sent again from the outbox.',
    confirmLabel: 'Turn off',
    destructive: true,
  })
  if (!ok) return
  busyId.value = row.id
  try {
    data.value = await adminApi.deactivateProvider(row.id)
    toast.add({ title: 'Email sending is off', color: 'warning', icon: 'i-lucide-pause' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busyId.value = null
  }
}

async function remove(row: SmtpProvider) {
  const ok = await confirm({
    title: `Delete ${row.name}?`,
    description: 'Its settings and stored password or API key are removed. Emails already sent keep its name in the outbox.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await adminApi.deleteProvider(row.id)
    await refresh()
    toast.add({ title: `${row.name} deleted`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

function menuItems(row: SmtpProvider): DropdownMenuItem[] {
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openForm(row) },
    { label: 'Send a test email', icon: 'i-lucide-mail-check', disabled: missingKey(row), onSelect: () => sendTest(row.id) },
    row.is_active
      ? { label: 'Turn sending off', icon: 'i-lucide-pause', color: 'warning', onSelect: () => turnOff(row) }
      : { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(row) },
  ]
}

async function sendTest(id = testVia.value) {
  if (id === undefined) return
  testVia.value = id
  testing.value = true
  testResult.value = null
  const name = providers.value.find((row) => row.id === id)?.name ?? ''
  try {
    testResult.value = await adminApi.testProvider(id, testTo.value.trim() || undefined)
  } catch (failure) {
    testResult.value = { sent: false, to: testTo.value, provider: name, error: adminErrorText(failure) }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <AppPage
    title="Email settings"
    icon="i-lucide-mail"
    description="The SMTP providers BCM Tools can send through: SCCA approvals, invitations and password resets. One is active at a time."
    :crumbs="[{ label: 'Administration' }, { label: 'Email settings' }]"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Add provider"
        @click="openForm()"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the email settings"
      :description="adminErrorText(error)"
    />

    <SkeletonCard
      v-else-if="status === 'pending' && !data"
      fields
      :lines="6"
    />

    <div
      v-else
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <section
        class="space-y-4"
        aria-labelledby="smtp-providers"
      >
        <h2
          id="smtp-providers"
          class="sr-only"
        >
          SMTP providers
        </h2>
        <UAlert
          v-if="active"
          color="success"
          variant="subtle"
          :icon="SMTP_PRESETS[active.kind].icon"
          :title="`Emails go through ${active.name}`"
          :description="`Sent from ${active.from_name ? `${active.from_name} <${active.from_address}>` : active.from_address}.`"
        />
        <UAlert
          v-else
          color="warning"
          variant="subtle"
          icon="i-lucide-mail-warning"
          title="Email sending is off"
          :description="providers.length ? 'Choose a provider below with Use this provider. Until then, emails are logged as failed.' : 'Add an SMTP provider to send approvals, invitations and password resets.'"
        />

        <div
          v-if="providers.length"
          class="grid gap-4 2xl:grid-cols-2"
        >
          <UCard
            v-for="row in providers"
            :key="row.id"
            :class="row.is_active ? 'ring-2 ring-primary' : ''"
            :ui="{ body: 'space-y-4' }"
            :aria-label="row.name"
            role="group"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-lg"
                :class="row.is_active ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
              >
                <UIcon
                  :name="SMTP_PRESETS[row.kind].icon"
                  class="size-5"
                />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="truncate font-semibold text-highlighted">
                    {{ row.name }}
                  </h3>
                  <UBadge
                    v-if="row.is_active"
                    label="Active"
                    color="success"
                    variant="subtle"
                    icon="i-lucide-circle-check"
                    size="sm"
                  />
                </div>
                <p
                  v-if="row.name !== SMTP_PRESETS[row.kind].label"
                  class="text-xs text-muted"
                >
                  {{ SMTP_PRESETS[row.kind].label }}
                </p>
              </div>
              <UDropdownMenu
                :items="menuItems(row)"
                :content="{ align: 'end' }"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-ellipsis-vertical"
                  :aria-label="`More for ${row.name}`"
                />
              </UDropdownMenu>
            </div>

            <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,1fr)]">
              <dt class="text-muted">
                Server
              </dt>
              <dd class="truncate font-mono text-xs/5">
                {{ row.host }}:{{ row.port }}
              </dd>
              <dt class="text-muted">
                Security
              </dt>
              <dd class="truncate">
                {{ security(row) }}
              </dd>
              <dt class="text-muted">
                Username
              </dt>
              <dd class="truncate">
                {{ row.username || '—' }}
              </dd>
              <dt class="text-muted">
                {{ SMTP_PRESETS[row.kind].passwordLabel }}
              </dt>
              <dd>
                <UBadge
                  v-if="row.password_set"
                  label="Stored encrypted"
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-lock"
                  size="sm"
                />
                <UBadge
                  v-else-if="row.username"
                  label="Not set"
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-key-round"
                  size="sm"
                />
                <span
                  v-else
                  class="text-muted"
                >Not needed</span>
              </dd>
              <dt class="text-muted">
                From
              </dt>
              <dd class="truncate">
                {{ row.from_address }}
              </dd>
            </dl>

            <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3">
              <p class="text-xs text-muted">
                <template v-if="row.updated_by">
                  Changed by {{ row.updated_by }}
                </template>
                <template v-else-if="row.updated_at">
                  Changed {{ formatDateTime(row.updated_at) }}
                </template>
              </p>
              <UButton
                v-if="missingKey(row)"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-key-round"
                :label="SMTP_PRESETS[row.kind].addPasswordLabel"
                @click="openForm(row)"
              />
              <UButton
                v-else-if="!row.is_active"
                size="sm"
                icon="i-lucide-send"
                label="Use this provider"
                :loading="busyId === row.id"
                @click="use(row)"
              />
            </div>
          </UCard>
        </div>
      </section>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Send a test email
            </h2>
          </template>
          <form
            class="space-y-3"
            @submit.prevent="sendTest()"
          >
            <UFormField
              label="Through"
              name="via"
              help="Test a provider before you switch to it."
            >
              <USelectMenu
                v-model="testVia"
                value-key="value"
                :items="testItems"
                :search-input="false"
                :disabled="!providers.length"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="To"
              name="to"
            >
              <UInput
                v-model="testTo"
                type="email"
                class="w-full"
              />
            </UFormField>
            <UButton
              type="submit"
              color="neutral"
              variant="outline"
              icon="i-lucide-send"
              label="Send test email"
              :loading="testing"
              :disabled="testVia === undefined"
              block
            />
            <UAlert
              v-if="testResult"
              :color="testResult.sent ? 'success' : 'error'"
              variant="subtle"
              :icon="testResult.sent ? 'i-lucide-mail-check' : 'i-lucide-mail-x'"
              :title="testResult.sent ? `Sent to ${testResult.to} via ${testResult.provider}` : `Not sent via ${testResult.provider}`"
              :description="testResult.error ?? 'Check the inbox (and spam folder).'"
              :ui="{ description: 'break-words' }"
            />
          </form>
        </UCard>
        <UCard>
          <div class="space-y-2 text-sm">
            <p class="font-medium text-highlighted">
              Every email is logged
            </p>
            <p class="text-muted">
              The outbox keeps each email, the provider it went through, its status and the SMTP error. Failed emails can be sent again.
            </p>
            <UButton
              to="/admin/audit?tab=emails"
              variant="link"
              trailing-icon="i-lucide-arrow-right"
              label="Open the email outbox"
              class="p-0"
            />
          </div>
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
