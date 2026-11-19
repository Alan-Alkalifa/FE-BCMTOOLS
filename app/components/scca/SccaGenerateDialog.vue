<script setup lang="ts">
import type { PickedUser } from '~/components/UserPicker.vue'
import type { SccaGenerateResult, SccaRenewalRow } from '~/composables/useSccaWorkflow'

/**
 * Monitoring > Renewals > Generate annual review, for one row or the selected rows. The user
 * who generates is the assessor of every new draft; they may pick one contributor for all of
 * them (a user of the access rules' contributor levels, D-2 by default, from any directorate),
 * or none: the contributor is set later in the draft. The last final's contributor is suggested
 * when every row has the same one.
 */
const props = defineProps<{ rows: SccaRenewalRow[], levels: string[] }>()
const emit = defineEmits<{ close: [result?: SccaGenerateResult] }>()

const { user } = useAuth()
const suggested = computed<PickedUser | null>(() => {
  const ids = new Set(props.rows.map((row) => row.contributor_id))
  const first = props.rows[0]
  if (ids.size !== 1 || !first?.contributor_id || first.contributor_id === user.value?.id) return null
  return { id: first.contributor_id, display_name: first.contributor, email: null, job_title: null, department: null }
})
const contributorId = ref<number | null>(suggested.value?.id ?? null)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const levelText = computed(() => (props.levels.length ? props.levels.join(' or ') : 'D-2'))

async function generate() {
  errors.value = {}
  busy.value = true
  try {
    emit('close', await sccaRenewalsApi.generate(props.rows.map((row) => row.last_final.id), contributorId.value))
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
    :description="rows.length === 1 ? `${rows[0]!.application_name} · from ${rows[0]!.last_final.ref_no}` : 'One draft per application, from its last final SCCA.'"
  >
    <template #body>
      <form
        id="scca-generate-form"
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
          Each draft copies its last final SCCA: ratings, interdependencies, recovery values and
          sign-off users. <span class="font-medium">You are the assessor</span>; you get an email
          (and the contributor, if you pick one), and the drafts wait in Manage.
        </p>
        <ul
          v-if="rows.length > 1"
          class="max-h-48 divide-y divide-default overflow-y-auto rounded-md border border-default text-sm"
        >
          <li
            v-for="row in rows"
            :key="row.key"
            class="flex items-center justify-between gap-2 px-3 py-2"
          >
            <span class="min-w-0 truncate">{{ row.application_name }} <span class="text-muted">· {{ row.application_code }}</span></span>
            <span class="font-mono text-xs text-muted">{{ row.last_final.ref_no }}</span>
          </li>
        </ul>
        <UFormField
          label="Contributor (optional)"
          name="contributor_id"
          :help="`A ${levelText} user from any directorate${rows.length > 1 ? ', for every draft' : ''}. Leave it empty to set it later in the draft. ${suggested ? 'Suggested: the last final\'s contributor; clear it with the × to generate without one.' : ''}`"
          :error="errors.contributor_id"
        >
          <UserPicker
            v-model="contributorId"
            :selected="suggested"
            endpoint="/api/scca/monitoring/renewals/contributors"
            :placeholder="`Search ${levelText} users`"
            aria-label="Contributor"
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
          form="scca-generate-form"
          icon="i-lucide-file-plus-2"
          :label="rows.length === 1 ? 'Generate' : `Generate ${rows.length}`"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
