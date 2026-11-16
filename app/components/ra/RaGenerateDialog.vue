<script setup lang="ts">
import type { PickedUser } from '~/components/UserPicker.vue'
import type { RaGenerateResult, RaMonitorLocation } from '~/composables/useRa'

/**
 * Monitoring > Renewals > Generate annual review, for one row or the selected rows, as SCCA's.
 * The user who generates is the assessor and LIC of every new draft. They pick one LICOM for all
 * of them (SCCA's contributor), a user of the access rules' contributor levels (D-2 by default)
 * from any directorate. The last final's LICOM is suggested when every row has the same one.
 */
const props = defineProps<{ rows: RaMonitorLocation[], levels: string[], kind: RaKind, noun: string }>()
const emit = defineEmits<{ close: [result?: RaGenerateResult] }>()

const { user } = useAuth()
const suggested = computed<PickedUser | null>(() => {
  const ids = new Set(props.rows.map((row) => row.licom_user_id ?? null))
  const first = props.rows[0]
  if (ids.size !== 1 || !first?.licom_user_id || first.licom_user_id === user.value?.id) return null
  return { id: first.licom_user_id, display_name: first.licom ?? null, email: null, job_title: null, department: null }
})
const licomId = ref<number | null>(suggested.value?.id ?? null)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const levelText = computed(() => (props.levels.length ? props.levels.join(' or ') : 'D-2'))

async function generate() {
  errors.value = {}
  if (!licomId.value) {
    errors.value.licom_user_id = 'Pick the LICOM.'
    return
  }
  busy.value = true
  try {
    emit('close', await raApi.generateRenewals(props.rows.map((row) => row.approved!.id), licomId.value))
  } catch (failure) {
    const data = (failure as { data?: { details?: Record<string, string>, message?: string } }).data
    errors.value = data?.details ? { ...data.details } : { form: data?.message ?? apiErrorMessage(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="rows.length === 1 ? 'Generate annual review' : `Generate ${rows.length} annual reviews`"
    :description="rows.length === 1 ? `${rows[0]!.location.name} · from ${rows[0]!.approved?.ref_no ?? 'its last final RA'}` : `One draft per ${noun}, from its last final RA.`"
  >
    <template #body>
      <form
        id="ra-generate-form"
        class="space-y-4"
        novalidate
        @submit.prevent="generate"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />
        <p class="text-sm">
          Each draft copies its last final RA, with its ratings and signers, dated today.
          <span class="font-medium">You are the assessor and LIC.</span> The drafts wait in Manage.
        </p>
        <ul
          v-if="rows.length > 1"
          class="max-h-48 divide-y divide-default overflow-y-auto rounded-md border border-default text-sm"
        >
          <li
            v-for="row in rows"
            :key="row.location.id"
            class="flex items-center justify-between gap-2 px-3 py-2"
          >
            <span class="min-w-0 truncate">{{ row.location.name }}</span>
            <span class="font-mono text-xs text-muted">{{ row.approved?.ref_no }}</span>
          </li>
        </ul>
        <UFormField
          label="LICOM"
          name="licom_user_id"
          required
          :help="`A ${levelText} user from any directorate${rows.length > 1 ? ', for every draft' : ''}.${suggested ? ' Suggested is the last final\'s LICOM.' : ''}`"
          :error="errors.licom_user_id"
        >
          <UserPicker
            v-model="licomId"
            :selected="suggested"
            :endpoint="`/api/ra/monitoring/renewals/contributors?kind=${kind}`"
            :placeholder="`Search ${levelText} users`"
            aria-label="LICOM"
          />
        </UFormField>
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
          form="ra-generate-form"
          icon="i-lucide-file-plus-2"
          :label="rows.length === 1 ? 'Generate' : `Generate ${rows.length}`"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
