<script setup lang="ts">
import RaReturnModal from '~/components/ra/RaReturnModal.vue'
import type { RaAssessment, RaFormula, RaSignoff, RaSignoffEvent, RaSignoffInput, RaUserRef } from '~/composables/useRa'

/**
 * The sign-off workflow. In a draft, each role gets a BCM Tools user and the assessment is
 * submitted; the signers then approve one after another, and the current signer can return it
 * for changes. Rules live in the API; the buttons follow its can_* flags.
 */
const props = defineProps<{ assessment: RaAssessment, formula: RaFormula }>()
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const ra = useRaModule()
const roles = computed(() => ra.value.signoffRoles)
const toast = useToast()
const dirty = useRaDirty()
const { user } = useAuth()
const returnModal = useOverlay().create(RaReturnModal)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const snapshot = ref('')

interface SignerState {
  signer_id: number | null
  signer: RaUserRef | null
  designation: string
}

function fromAssessment(assessment: RaAssessment): Record<string, SignerState> {
  return Object.fromEntries(roles.value.map(({ value }) => {
    const saved = assessment.signoffs.find((row) => row.role === value)
    return [value, {
      signer_id: saved?.signer?.id ?? null,
      signer: saved?.signer ?? null,
      designation: saved?.designation ?? '',
    }]
  }))
}

const state = reactive<Record<string, SignerState>>(fromAssessment(props.assessment))

function key(values: Record<string, SignerState>) {
  return JSON.stringify(Object.fromEntries(Object.entries(values).map(([role, item]) => [role, [item.signer_id, item.designation]])))
}

function reset(assessment: RaAssessment) {
  Object.assign(state, fromAssessment(assessment))
  snapshot.value = key(state)
  fieldErrors.value = {}
  if (dirty) dirty.value = false
}

watch(() => props.assessment, (assessment) => reset(assessment), { immediate: true })
const changed = computed(() => key(state) !== snapshot.value)
watch(changed, (value) => {
  if (dirty) dirty.value = value
})

const editing = computed(() => props.assessment.can_edit)
const missingSigners = computed(() => roles.value.filter(({ value }) => !state[value]?.signer_id))
const canSubmit = computed(() => props.assessment.can_submit && props.assessment.is_complete && !missingSigners.value.length)

/** Picking a signer fills the designation with their job title, unless one was typed. */
function onPicked(role: string, picked: RaUserRef | null) {
  const item = state[role]!
  const previousTitle = item.signer?.job_title ?? ''
  item.signer = picked
  if (!item.designation || item.designation === previousTitle) item.designation = picked?.job_title ?? ''
  fieldErrors.value = Object.fromEntries(
    Object.entries(fieldErrors.value).filter(([field]) => !field.startsWith(`signoffs.${role}`)),
  )
}

function clearSigner(role: string) {
  const item = state[role]!
  if (item.designation === (item.signer?.job_title ?? '')) item.designation = ''
  item.signer_id = null
  item.signer = null
}

function payload(): RaSignoffInput[] {
  return roles.value.map(({ value }) => ({
    role: value,
    signer_id: state[value]!.signer_id,
    designation: state[value]!.designation.trim() || null,
  }))
}

function fail(error: unknown, fallback: string) {
  const details = (error as { data?: { details?: Record<string, string> } } | null)?.data?.details ?? {}
  fieldErrors.value = Object.fromEntries(Object.entries(details).filter(([field]) => field.startsWith('signoffs.')))
  formError.value = raStatusMessage(error) ?? (Object.keys(fieldErrors.value).length ? 'Choose who signs every role.' : null) ?? fallback
}

async function saveSigners() {
  formError.value = null
  try {
    const saved = await raApi.update(props.assessment.id, { signoffs: payload() })
    reset(saved)
    toast.add({ title: 'Signers saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    fail(error, apiErrorMessage(error))
  }
}

async function submit() {
  formError.value = null
  try {
    if (changed.value) reset(await raApi.update(props.assessment.id, { signoffs: payload() }))
    const saved = await raApi.submit(props.assessment.id)
    reset(saved)
    toast.add({ title: 'Submitted for sign-off', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    fail(error, apiErrorMessage(error))
  }
}

const approvalComment = ref('')

async function approve() {
  formError.value = null
  try {
    const saved = await raApi.approve(props.assessment.id, approvalComment.value.trim() || null)
    approvalComment.value = ''
    reset(saved)
    toast.add({
      title: saved.status === 'approved' ? 'Assessment approved' : 'Approval recorded',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('saved', saved)
  } catch (error) {
    fail(error, apiErrorMessage(error))
  }
}

async function sendBack() {
  formError.value = null
  const comment = await returnModal.open({ reopen: props.assessment.status === 'approved' }).result
  if (!comment) return
  try {
    const saved = await raApi.returnToDraft(props.assessment.id, comment)
    reset(saved)
    toast.add({ title: 'Returned to draft', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    fail(error, apiErrorMessage(error))
  }
}

const currentRole = computed(() => roles.value.find((role) => role.value === props.assessment.current_signoff_role))
/** Someone with ra.manage approving another person's step. */
const onBehalf = computed(() => {
  const signer = props.assessment.awaiting_signer
  return Boolean(signer && user.value && signer.id !== user.value.id)
})

const raSignoffStep = defineStatusScale({
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-badge-check' },
  current: { label: 'Waiting for approval', color: 'info', icon: 'i-lucide-hourglass' },
  waiting: { label: 'Not yet', color: 'neutral', icon: 'i-lucide-circle-dashed' },
  unassigned: { label: 'Signer needed', color: 'warning', icon: 'i-lucide-user-x' },
})

function saved(role: string): RaSignoff | undefined {
  return props.assessment.signoffs.find((row) => row.role === role)
}

function stepKey(role: string) {
  const row = saved(role)
  if (row?.approved_at) return 'approved'
  if (props.assessment.status === 'in_signoff') return role === props.assessment.current_signoff_role ? 'current' : 'waiting'
  return state[role]?.signer_id ? null : 'unassigned'
}

const ACTIONS: Record<RaSignoffEvent['action'], { label: string, icon: string, class: string }> = {
  submitted: { label: 'Submitted for sign-off', icon: 'i-lucide-send', class: 'text-info' },
  approved: { label: 'Approved', icon: 'i-lucide-badge-check', class: 'text-success' },
  returned: { label: 'Returned for changes', icon: 'i-lucide-undo-2', class: 'text-warning' },
}

function roleLabel(role: RaSignoffEvent['role']) {
  return role ? raSignoffRoleName(role, roles.value) : ''
}

const history = computed(() => [...props.assessment.signoff_history].reverse())
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't complete the sign-off step"
      :description="formError"
    />

    <UAlert
      v-if="assessment.status === 'draft' && assessment.returned_comment"
      color="warning"
      variant="subtle"
      icon="i-lucide-undo-2"
      :title="`Returned for changes by ${assessment.returned_by ?? 'a signer'} on ${formatDateTime(assessment.returned_at)}`"
      :description="assessment.returned_comment"
      :ui="{ description: 'whitespace-pre-line' }"
    />
    <UAlert
      v-if="assessment.status === 'draft' && !assessment.is_complete"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Complete the hazards before submitting"
      :description="`${assessment.summary.rated} of ${assessment.summary.total} hazards are rated, and every rated hazard needs its open issues resolved. You can choose the signers now.`"
    />
    <UAlert
      v-else-if="assessment.status === 'in_signoff'"
      color="info"
      variant="subtle"
      icon="i-lucide-hourglass"
      :title="`Waiting for ${currentRole ? raSignoffRoleName(currentRole.value, roles) : 'the next signer'}`"
      :description="`${assessment.awaiting_signer?.name ?? 'The signer'} approves next. The assessment can't be changed while it is in sign-off.`"
    />
    <UAlert
      v-else-if="assessment.status === 'approved'"
      color="success"
      variant="subtle"
      icon="i-lucide-badge-check"
      title="Approved"
      :description="`Every signer approved this assessment; the last approval was on ${formatDateTime(assessment.approved_at)}. It can no longer be changed.`"
    />

    <UCard v-if="assessment.can_approve && currentRole">
      <template #header>
        <h2 class="text-lg font-semibold">
          Your approval: {{ currentRole.label }} ({{ currentRole.hint }})
        </h2>
        <p class="text-sm text-muted">
          {{ onBehalf
            ? `You are approving on behalf of ${assessment.awaiting_signer?.name}, as a BCM administrator.`
            : 'By approving you agree to the sign-off statement below for this assessment.' }}
        </p>
      </template>
      <UFormField
        label="Comment"
        help="Optional. Kept with your approval."
      >
        <UTextarea
          v-model="approvalComment"
          :rows="3"
          autoresize
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-undo-2"
            label="Return for changes"
            @click="sendBack"
          />
          <UButton
            icon="i-lucide-badge-check"
            :label="onBehalf ? 'Approve on their behalf' : 'Approve'"
            loading-auto
            @click="approve"
          />
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Risk assessment sign-off
        </h2>
        <p class="text-sm text-muted">
          The statement each signer agrees to, from the LRP scorecard.
        </p>
      </template>
      <blockquote
        lang="id"
        class="border-l-2 border-accented pl-4 text-sm whitespace-pre-line text-default"
      >
        {{ formula.signoff_statement }}
      </blockquote>
    </UCard>

    <section
      aria-labelledby="ra-signers"
      class="space-y-3"
    >
      <div>
        <h2
          id="ra-signers"
          class="text-lg font-semibold"
        >
          Signers
        </h2>
        <p class="text-sm text-muted">
          They approve in this order. Only BCM Tools users can sign; ask a signer to sign in once if you can't find them.
        </p>
      </div>
      <ol
        class="grid gap-6 md:grid-cols-2"
        :class="{ 'xl:grid-cols-3': roles.length === 3 }"
      >
        <li
          v-for="(role, index) in roles"
          :key="role.value"
        >
          <UCard
            class="h-full"
            :class="{ 'ring-2 ring-info': assessment.status === 'in_signoff' && role.value === assessment.current_signoff_role }"
          >
            <template #header>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs text-muted">
                    Step {{ index + 1 }} of {{ roles.length }}
                  </p>
                  <h3 class="font-semibold">
                    {{ role.label }}
                  </h3>
                  <p class="text-sm text-muted">
                    {{ role.hint }}
                  </p>
                </div>
                <StatusBadge
                  v-if="stepKey(role.value)"
                  :scale="raSignoffStep"
                  :value="stepKey(role.value)"
                  size="sm"
                />
              </div>
            </template>

            <div
              v-if="editing"
              class="space-y-4"
            >
              <UFormField
                label="Signer"
                :name="`signoffs.${role.value}`"
                :error="fieldErrors[`signoffs.${role.value}`] ?? fieldErrors[`signoffs.${role.value}.signer_id`]"
                required
              >
                <div class="flex gap-2">
                  <RaSignerSelect
                    v-model="state[role.value]!.signer_id"
                    :current="state[role.value]!.signer"
                    :aria-label="`Signer: ${role.label}`"
                    class="min-w-0 flex-1"
                    @picked="(picked) => onPicked(role.value, picked)"
                  />
                  <UTooltip
                    v-if="state[role.value]!.signer_id"
                    text="Remove signer"
                  >
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-x"
                      :aria-label="`Remove the signer of ${role.label}`"
                      @click="clearSigner(role.value)"
                    />
                  </UTooltip>
                </div>
              </UFormField>
              <UFormField
                label="Designation"
                help="Their job title, unless you change it."
              >
                <UInput
                  v-model="state[role.value]!.designation"
                  class="w-full"
                />
              </UFormField>
            </div>

            <dl
              v-else
              class="space-y-3 text-sm"
            >
              <div>
                <dt class="text-muted">
                  Signer
                </dt>
                <dd class="font-medium text-highlighted">
                  {{ saved(role.value)?.name ?? '—' }}
                </dd>
                <dd
                  v-if="saved(role.value)?.signer?.email"
                  class="text-muted"
                >
                  {{ saved(role.value)?.signer?.email }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">
                  Designation
                </dt>
                <dd>{{ saved(role.value)?.designation || '—' }}</dd>
              </div>
              <div v-if="saved(role.value)?.approved_at">
                <dt class="text-muted">
                  Approved
                </dt>
                <dd>
                  {{ formatDateTime(saved(role.value)?.approved_at) }}
                  <span
                    v-if="saved(role.value)?.approved_by && saved(role.value)?.approved_by !== saved(role.value)?.name"
                    class="text-muted"
                  >· by {{ saved(role.value)?.approved_by }} on their behalf</span>
                </dd>
              </div>
              <div v-if="saved(role.value)?.comment">
                <dt class="text-muted">
                  Comment
                </dt>
                <dd class="whitespace-pre-line">
                  {{ saved(role.value)?.comment }}
                </dd>
              </div>
            </dl>
          </UCard>
        </li>
      </ol>
    </section>

    <div
      v-if="editing"
      class="flex flex-wrap items-center justify-end gap-3"
    >
      <p
        v-if="missingSigners.length"
        class="text-sm text-muted"
      >
        {{ missingSigners.length === 1 ? '1 role still needs a signer.' : `${missingSigners.length} roles still need a signer.` }}
      </p>
      <UButton
        color="neutral"
        variant="outline"
        label="Save signers"
        :disabled="!changed"
        loading-auto
        @click="saveSigners"
      />
      <UButton
        icon="i-lucide-send"
        label="Submit for sign-off"
        :disabled="!canSubmit"
        loading-auto
        @click="submit"
      />
    </div>
    <div
      v-else-if="assessment.status === 'approved' && assessment.can_return"
      class="flex justify-end"
    >
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-undo-2"
        label="Reopen assessment"
        @click="sendBack"
      />
    </div>

    <UCard v-if="history.length">
      <template #header>
        <h2 class="text-lg font-semibold">
          Sign-off history
        </h2>
      </template>
      <ol class="space-y-4">
        <li
          v-for="(event, index) in history"
          :key="index"
          class="flex gap-3"
        >
          <UIcon
            :name="ACTIONS[event.action].icon"
            class="mt-0.5 size-4 shrink-0"
            :class="ACTIONS[event.action].class"
          />
          <div class="min-w-0 text-sm">
            <p class="text-highlighted">
              <span class="font-medium">{{ ACTIONS[event.action].label }}</span>
              <template v-if="event.role">
                · {{ roleLabel(event.role) }}
              </template>
            </p>
            <p class="text-muted">
              {{ event.user ?? 'Someone' }} · {{ formatDateTime(event.at) }}
            </p>
            <p
              v-if="event.comment"
              class="mt-1 whitespace-pre-line"
            >
              {{ event.comment }}
            </p>
          </div>
        </li>
      </ol>
    </UCard>
  </div>
</template>
