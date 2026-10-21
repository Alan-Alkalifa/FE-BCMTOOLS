<script setup lang="ts">
import type { SmtpKind, SmtpProvider, SmtpProviderInput } from '~/composables/useAdmin'

/**
 * Add or edit one SMTP provider. Picking Gmail or Resend fills in its server, port, security
 * and username; the password (Gmail app password or Resend API key) is never shown again.
 */
const props = defineProps<{ provider?: SmtpProvider | null, names: string[] }>()
const emit = defineEmits<{ close: [saved?: SmtpProvider] }>()

const toast = useToast()
const editing = computed(() => !!props.provider)
const form = reactive<Omit<SmtpProviderInput, 'password'>>({
  name: props.provider?.name ?? '',
  kind: props.provider?.kind ?? 'resend',
  host: props.provider?.host ?? '',
  port: props.provider?.port ?? 465,
  security: props.provider?.security ?? 'ssl',
  username: props.provider?.username ?? '',
  from_address: props.provider?.from_address ?? '',
  from_name: props.provider?.from_name || 'BCM Tools',
})
const password = ref('')
const changePassword = ref(!props.provider?.password_set)
const busy = ref(false)
const errors = ref<Record<string, string>>({})

const preset = computed(() => SMTP_PRESETS[form.kind])
const kindItems = (Object.keys(SMTP_PRESETS) as SmtpKind[]).map((kind) => ({
  value: kind,
  label: SMTP_PRESETS[kind].label,
  description: SMTP_PRESETS[kind].host || 'Any server',
}))

/** A free name: "Resend", then "Resend 2", ... */
function freeName(base: string) {
  const taken = new Set(props.names.filter((name) => name !== props.provider?.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

function applyPreset(kind: SmtpKind, previous?: SmtpKind) {
  const next = SMTP_PRESETS[kind]
  const before = previous ? SMTP_PRESETS[previous] : null
  if (!form.name.trim() || (before && form.name.startsWith(before.label))) {
    form.name = freeName(kind === 'custom' ? 'SMTP server' : next.label)
  }
  if (kind !== 'custom') {
    Object.assign(form, { host: next.host, port: next.port, security: next.security })
    if (next.username || before?.username === form.username) form.username = next.username
  } else if (before && form.host === before.host) {
    Object.assign(form, { host: '', port: next.port, security: next.security })
    if (before.username === form.username) form.username = ''
  }
}

if (!props.provider) applyPreset(form.kind)
watch(() => form.kind, (kind, previous) => applyPreset(kind, previous))

watch(() => form.security, (security) => {
  if (security === 'ssl' && form.port === 587) form.port = 465
  if (security === 'starttls' && form.port === 465) form.port = 587
})

async function save() {
  errors.value = {}
  busy.value = true
  const body: SmtpProviderInput = {
    ...form,
    name: form.name.trim(),
    host: form.host.trim(),
    username: form.username.trim(),
    from_address: form.from_address.trim(),
    from_name: form.from_name.trim(),
    ...(changePassword.value ? { password: password.value.trim() } : {}),
  }
  try {
    const saved = props.provider
      ? await adminApi.updateProvider(props.provider.id, body)
      : await adminApi.createProvider(body)
    toast.add({
      title: props.provider ? `${saved.name} saved` : `${saved.name} added`,
      description: changePassword.value && body.password ? `The ${preset.value.passwordLabel.toLowerCase()} is stored encrypted.` : undefined,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('close', saved)
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ? { ...details } : { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="editing ? `Edit ${provider!.name}` : 'Add an SMTP provider'"
    :description="editing ? `${provider!.host}:${provider!.port}` : 'Pick the service, then fill in its sign-in and sender.'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        id="smtp-provider-form"
        class="space-y-5"
        novalidate
        @submit.prevent="save"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />

        <UFormField
          label="Service"
          name="kind"
          :error="errors.kind"
        >
          <URadioGroup
            v-model="form.kind"
            :items="kindItems"
            variant="card"
            orientation="horizontal"
            indicator="hidden"
            :ui="{ fieldset: 'grid grid-cols-1 gap-2 sm:grid-cols-3', item: 'w-full' }"
          />
        </UFormField>

        <UFormField
          label="Name"
          name="name"
          required
          help="How admins see it, e.g. Gmail or Resend (bemlanja.com)."
          :error="errors.name"
        >
          <UInput
            v-model="form.name"
            class="w-full"
          />
        </UFormField>

        <fieldset class="space-y-4 rounded-lg border border-default p-4">
          <legend class="px-1 text-sm font-medium text-highlighted">
            Server
          </legend>
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <UFormField
              label="Host"
              name="host"
              required
              :error="errors.host"
            >
              <UInput
                v-model="form.host"
                class="w-full font-mono"
                placeholder="smtp.example.com"
              />
            </UFormField>
            <UFormField
              label="Port"
              name="port"
              required
              :error="errors.port"
            >
              <UInputNumber
                v-model="form.port"
                :min="1"
                :max="65535"
                :format-options="{ useGrouping: false }"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Security"
            name="security"
            :error="errors.security"
          >
            <USelectMenu
              v-model="form.security"
              value-key="value"
              :items="SMTP_SECURITY_ITEMS"
              :search-input="false"
              class="w-full"
            />
          </UFormField>
        </fieldset>

        <fieldset class="space-y-4 rounded-lg border border-default p-4">
          <legend class="px-1 text-sm font-medium text-highlighted">
            Sign-in
          </legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Username"
              name="username"
              :help="preset.usernameHelp"
              :error="errors.username"
            >
              <UInput
                v-model="form.username"
                autocomplete="off"
                class="w-full"
                :class="{ 'font-mono': form.kind === 'resend' }"
              />
            </UFormField>
            <UFormField
              :label="preset.passwordLabel"
              name="password"
              :help="provider?.password_set && !changePassword ? 'Stored encrypted. Never shown again.' : preset.passwordHelp"
              :error="errors.password"
            >
              <div
                v-if="provider?.password_set && !changePassword"
                class="flex h-8 items-center gap-2"
              >
                <UBadge
                  :label="`${preset.passwordLabel} set`"
                  color="success"
                  variant="subtle"
                  icon="i-lucide-lock"
                />
                <UButton
                  variant="link"
                  size="sm"
                  label="Replace"
                  class="p-0"
                  @click="changePassword = true"
                />
              </div>
              <UInput
                v-else
                v-model="password"
                type="password"
                autocomplete="new-password"
                :placeholder="form.kind === 'resend' ? 're_…' : undefined"
                class="w-full font-mono"
              />
            </UFormField>
          </div>
        </fieldset>

        <fieldset class="space-y-4 rounded-lg border border-default p-4">
          <legend class="px-1 text-sm font-medium text-highlighted">
            Sender
          </legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="From address"
              name="from_address"
              required
              :help="preset.fromHelp"
              :error="errors.from_address"
            >
              <UInput
                v-model="form.from_address"
                type="email"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="From name"
              name="from_name"
              :error="errors.from_name"
            >
              <UInput
                v-model="form.from_name"
                class="w-full"
              />
            </UFormField>
          </div>
        </fieldset>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close')"
        />
        <UButton
          type="submit"
          form="smtp-provider-form"
          :label="editing ? 'Save' : 'Add provider'"
          :loading="busy"
          :disabled="!form.name.trim() || !form.host.trim()"
        />
      </div>
    </template>
  </UModal>
</template>
