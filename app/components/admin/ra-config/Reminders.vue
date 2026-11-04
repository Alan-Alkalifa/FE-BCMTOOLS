<script setup lang="ts">
import type { RaSettings } from '~/composables/useRaConfigAdmin'

/**
 * RA configuration > Reminders and escalation, like SCCA's: when BCM Tools reminds the signer
 * whose step waits, escalates to BCM and warns about renewals, and reminds the approvers of
 * buildings and incidents waiting on Task Management. These rules are live for every RA and RA
 * Branch assessment, whatever its configuration version.
 */
const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('ra.config.manage'))
const { data, status, error, refresh } = useAsyncData('ra-config-settings', () => raConfigApi.settings())

const form = reactive<RaSettings>({
  reminders_enabled: true,
  reminder_after_days: 3,
  reminder_every_days: 2,
  escalate_after_days: 7,
  extra_escalation_emails: [],
  renewal_notice_days: [90, 30, 7],
  overdue_repeat_days: 30,
  window_start_hour: 8,
  window_end_hour: 17,
  incident_reminder_hours: 1,
  incident_escalate_hours: 4,
})
const emails = ref('')
const noticeDays = ref('')
const busy = ref(false)
const errors = ref<Record<string, string>>({})

watch(data, (value) => {
  if (!value) return
  Object.assign(form, value)
  emails.value = value.extra_escalation_emails.join('\n')
  noticeDays.value = value.renewal_notice_days.join(', ')
}, { immediate: true })

const hours = Array.from({ length: 25 }, (_, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, value: hour }))

const example = computed(() => {
  const repeats = [form.reminder_after_days]
  while (repeats.length < 4) repeats.push(repeats.at(-1)! + form.reminder_every_days)
  return `Reminders on working days ${repeats.join(', ')}, …; escalation on day ${form.escalate_after_days}.`
})

async function save() {
  errors.value = {}
  const days = noticeDays.value.split(/[\s,]+/).filter(Boolean).map(Number)
  if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 365)) {
    errors.value.renewal_notice_days = 'Whole numbers of days from 0 to 365, separated by commas.'
    return
  }
  busy.value = true
  try {
    const saved = await raConfigApi.saveSettings({
      ...form,
      extra_escalation_emails: emails.value.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean),
      renewal_notice_days: days,
    })
    data.value = saved
    toast.add({ title: 'Reminder rules saved', description: 'They apply from the next reminder run.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details
      ? Object.fromEntries(Object.entries(details).map(([key, value]) => [key.split('.')[0]!, value]))
      : { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the reminder rules"
      :description="adminErrorText(error)"
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
      fields
      :lines="8"
    />

    <form
      v-else
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      novalidate
      @submit.prevent="save"
    >
      <fieldset
        :disabled="!editable"
        class="min-w-0 space-y-6"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted">
                Approval reminders and escalation
              </h2>
              <USwitch
                v-model="form.reminders_enabled"
                label="Send reminders"
              />
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              Counted in working days (Monday to Friday) from the submission or the last approval. A reminder sent from the BCM board counts as one.
            </p>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField
                label="First reminder after"
                name="reminder_after_days"
                hint="working days"
                :error="errors.reminder_after_days"
              >
                <UInputNumber
                  v-model="form.reminder_after_days"
                  :min="1"
                  :max="60"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Then every"
                name="reminder_every_days"
                hint="working days"
                :error="errors.reminder_every_days"
              >
                <UInputNumber
                  v-model="form.reminder_every_days"
                  :min="1"
                  :max="30"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Escalate to BCM after"
                name="escalate_after_days"
                hint="working days"
                :error="errors.escalate_after_days"
              >
                <UInputNumber
                  v-model="form.escalate_after_days"
                  :min="1"
                  :max="90"
                  class="w-full"
                />
              </UFormField>
            </div>
            <p class="text-sm">
              {{ example }}
            </p>
            <UFormField
              label="Also send escalations to"
              name="extra_escalation_emails"
              help="Everyone who can use the RA BCM board already gets them, with the signer. One address per line, e.g. the BCM team mailbox."
              :error="errors.extra_escalation_emails"
            >
              <UTextarea
                v-model="emails"
                :rows="3"
                class="w-full font-mono"
                placeholder="bcm.team@cimbniaga.co.id"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Buildings and incidents waiting for approval
            </h2>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              The approvers (everyone who may approve buildings and incidents, but not who asked) are emailed when something starts waiting on Task Management. A new or deactivated building is then reminded and escalated like a sign-off step above. An incident can't wait for office hours: it is reminded at any hour.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Remind about an incident every"
                name="incident_reminder_hours"
                hint="hours"
                :error="errors.incident_reminder_hours"
              >
                <UInputNumber
                  v-model="form.incident_reminder_hours"
                  :min="1"
                  :max="24"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Escalate an incident to BCM after"
                name="incident_escalate_hours"
                hint="hours"
                help="Also to the addresses above."
                :error="errors.incident_escalate_hours"
              >
                <UInputNumber
                  v-model="form.incident_escalate_hours"
                  :min="1"
                  :max="72"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Renewal notices
            </h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Notify before the renewal date"
              name="renewal_notice_days"
              hint="days"
              help="To the LIC, the LICOM and whoever created the RA, until a new assessment of the building is started."
              :error="errors.renewal_notice_days"
            >
              <UInput
                v-model="noticeDays"
                class="w-full"
                placeholder="90, 30, 7"
              />
            </UFormField>
            <UFormField
              label="Repeat the overdue notice every"
              name="overdue_repeat_days"
              hint="days"
              help="Also copied to BCM and the addresses above, until a renewal is approved."
              :error="errors.overdue_repeat_days"
            >
              <UInputNumber
                v-model="form.overdue_repeat_days"
                :min="1"
                :max="365"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Sending window
            </h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="From"
              name="window_start_hour"
              hint="WIB, weekdays"
              :error="errors.window_start_hour"
            >
              <USelectMenu
                v-model="form.window_start_hour"
                value-key="value"
                :items="hours.slice(0, 24)"
                :search-input="false"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Until"
              name="window_end_hour"
              hint="WIB"
              :error="errors.window_end_hour"
            >
              <USelectMenu
                v-model="form.window_end_hour"
                value-key="value"
                :items="hours.slice(1)"
                :search-input="false"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p
            v-if="data?.updated_at"
            class="text-xs text-muted"
          >
            Last changed {{ formatDateTime(data.updated_at) }}{{ data.updated_by ? ` by ${data.updated_by}` : '' }}
          </p>
          <span v-else />
          <UButton
            v-if="editable"
            type="submit"
            label="Save reminder rules"
            :loading="busy"
          />
        </div>
      </fieldset>

      <UCard>
        <div class="space-y-2 text-sm">
          <p class="font-medium text-highlighted">
            How it runs
          </p>
          <p class="text-muted">
            These rules are not part of a configuration version: they apply to every RA and RA Branch assessment as soon as they are saved.
          </p>
          <p class="text-muted">
            The server checks every 30 minutes (<code>flask ra run-reminders</code>) and sends only what is due, so nobody gets the same email twice. Each email is in the email outbox; Monitoring and the BCM board show the reminders sent and escalations.
          </p>
        </div>
      </UCard>
    </form>
  </div>
</template>
