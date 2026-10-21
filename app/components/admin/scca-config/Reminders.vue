<script setup lang="ts">
import type { SccaSettings } from '~/composables/useSccaWorkflow'

/**
 * SCCA configuration > Reminders: when BCM Tools reminds approvers, escalates to BCM and warns
 * about renewals. These rules are live for every SCCA, whatever its configuration version.
 */
const toast = useToast()
const { data, status, error, refresh } = useAsyncData('scca-settings', () => sccaSettingsApi.get())

const form = reactive<SccaSettings>({
  reminders_enabled: true,
  reminder_after_days: 3,
  reminder_every_days: 2,
  escalate_after_days: 7,
  extra_escalation_emails: [],
  renewal_notice_days: [90, 30, 7],
  overdue_repeat_days: 30,
  window_start_hour: 8,
  window_end_hour: 17,
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
    const saved = await sccaSettingsApi.save({
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
      <div class="space-y-6">
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
              Counted in working days (Monday to Friday) from when a step becomes pending. A reminder from the BCM board counts as one.
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
              help="Every active user who can use the BCM board already gets them. One address per line, e.g. the BCM team mailbox."
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
              Renewal notices
            </h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Notify before the renewal date"
              name="renewal_notice_days"
              hint="days"
              help="To the assessor, contributor and application owner, until a renewal is started."
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
              help="Also copied to BCM, until a renewal is final."
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
            type="submit"
            label="Save reminder rules"
            :loading="busy"
          />
        </div>
      </div>

      <UCard>
        <div class="space-y-2 text-sm">
          <p class="font-medium text-highlighted">
            How it runs
          </p>
          <p class="text-muted">
            These rules are not part of a configuration version: they apply to every SCCA as soon as they are saved, whichever version is shown above.
          </p>
          <p class="text-muted">
            The server checks every 30 minutes and sends only what is due, so nobody gets the same email twice. Each reminder, escalation and notice is in the email outbox and in Audit log > SCCA activity.
          </p>
          <UButton
            to="/admin/audit?tab=scca"
            variant="link"
            trailing-icon="i-lucide-arrow-right"
            label="Open SCCA activity"
            class="p-0"
          />
        </div>
      </UCard>
    </form>
  </div>
</template>
