<script setup lang="ts">
import RaReturnModal from '~/components/ra/RaReturnModal.vue'
import RaChangeSignerModal from '~/components/ra/RaChangeSignerModal.vue'
import RaOnBehalfModal from '~/components/ra/RaOnBehalfModal.vue'
import type { RaAssessment, RaFormula, RaSignoff, RaSignoffEvent, RaSignoffInput, RaUserRef } from '~/composables/useRa'

/**
 * The sign-off workflow. In a draft, each role gets a BCM Tools user and the assessment is
 * submitted; the signers then approve one after another, and the current signer can return it
 * for changes. BCM (ra.manage) can return it too, change the signer of the waiting step, or
 * approve it on the signer's behalf with the evidence. Rules live in the API; the buttons follow
 * its can_* flags.
 */
const props = defineProps<{ assessment: RaAssessment, formula: RaFormula }>()
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const ra = useRaModule()
/** The roles with the labels and titles of the assessment's configuration version. */
const roles = computed(() => raRoleOptions(props.formula, ra.value.signoffRoles))
const toast = useToast()
const dirty = useRaDirty()
const returnModal = useOverlay().create(RaReturnModal)
const changeSignerModal = useOverlay().create(RaChangeSignerModal)
const onBehalfModal = useOverlay().create(RaOnBehalfModal)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const snapshot = ref('')

interface SignerState {
  signer_id: number | null
  signer: RaUserRef | null
}

function fromAssessment(assessment: RaAssessment): Record<string, SignerState> {
  return Object.fromEntries(roles.value.map(({ value }) => {
    const saved = assessment.signoffs.find((row) => row.role === value)
    return [value, {
      signer_id: saved?.signer?.id ?? null,
      signer: saved?.signer ?? null,
    }]
  }))
}

const state = reactive<Record<string, SignerState>>(fromAssessment(props.assessment))

function key(values: Record<string, SignerState>) {
  return JSON.stringify(Object.fromEntries(Object.entries(values).map(([role, item]) => [role, item.signer_id])))
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
/** A building waiting for approval (or rejected) can't have its RA submitted yet. */
const locationApproved = computed(() => props.assessment.location_approved !== false)
const canSubmit = computed(() => props.assessment.can_submit && props.assessment.is_complete && locationApproved.value && !missingSigners.value.length)

/** The designation is the picked signer's job title in the user directory. */
function onPicked(role: string, picked: RaUserRef | null) {
  state[role]!.signer = picked
  fieldErrors.value = Object.fromEntries(
    Object.entries(fieldErrors.value).filter(([field]) => !field.startsWith(`signoffs.${role}`)),
  )
}

function clearSigner(role: string) {
  const item = state[role]!
  item.signer_id = null
  item.signer = null
}

/** Prepared by is the LIC and Reviewed by the LICOM, both picked on the Details tab. */
function teamMember(role: string) {
  const member = RA_TEAM_SIGNOFF_ROLES[role]
  return member ? member.toUpperCase() : null
}

function payload(): RaSignoffInput[] {
  return roles.value
    .filter(({ value }) => !teamMember(value))
    .map(({ value }) => ({ role: value, signer_id: state[value]!.signer_id }))
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

/** BCM: change the signer of the waiting step, or approve it on their behalf. */
function waitingStep() {
  const assessment = props.assessment
  return {
    id: assessment.id,
    ref: assessment.ref_no ?? `#${assessment.id}`,
    location: assessment.location?.name ?? '',
    step: currentRole.value ? raSignoffRoleName(currentRole.value.value, roles.value) : 'The waiting step',
    signer: assessment.awaiting_signer?.name ?? null,
  }
}

async function actForSigner(dialog: 'change' | 'on_behalf') {
  formError.value = null
  const modal = dialog === 'change' ? changeSignerModal : onBehalfModal
  const saved = await modal.open({ step: waitingStep() }).result
  if (!saved) return
  reset(saved)
  emit('saved', saved)
}

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

const ACTIONS: Record<RaSignoffEvent['action'] | 'on_behalf', { label: string, icon: string, class: string }> = {
  submitted: { label: 'Submitted for approval', icon: 'i-lucide-send', class: 'text-info' },
  approved: { label: 'Approved', icon: 'i-lucide-badge-check', class: 'text-success' },
  on_behalf: { label: 'Approved on behalf', icon: 'i-lucide-badge-check', class: 'text-success' },
  returned: { label: 'Returned for changes', icon: 'i-lucide-undo-2', class: 'text-warning' },
  reassigned: { label: 'Signer changed', icon: 'i-lucide-user-round-cog', class: 'text-warning' },
}

function eventKind(event: RaSignoffEvent) {
  return event.on_behalf ? 'on_behalf' : event.action
}

/** "Rina → Stand In" for a signer change, "for Alan" for an approval on his behalf. */
function eventFor(event: RaSignoffEvent) {
  if (event.action === 'reassigned') return `${event.for_user ?? 'Nobody'} → ${event.to_user ?? '—'}`
  if (event.on_behalf) return `for ${event.for_user ?? 'the signer'}`
  return null
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
      v-if="assessment.status === 'draft' && !locationApproved"
      color="warning"
      variant="subtle"
      icon="i-lucide-hourglass"
      :title="`The ${ra.location.lower} isn't approved yet`"
      :description="`Someone else approves a new ${ra.location.lower} first. You can rate the hazards and choose the signers now, and submit once it is approved.`"
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
          By approving you agree to the sign-off statement below for this assessment.
        </p>
      </template>
      <UFormField
        label="Comment"
        help="Optional. Kept with your approval."
      >
        <template #hint>
          <FieldCount
            :value="approvalComment"
            :max="TEXT_LIMITS.long"
          />
        </template>
        <UTextarea
          v-model="approvalComment"
          :maxlength="TEXT_LIMITS.long"
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
            label="Approve"
            loading-auto
            @click="approve"
          />
        </div>
      </template>
    </UCard>

    <UCard
      v-else-if="assessment.can_act_for_signer && currentRole"
      data-testid="ra-act-for-signer"
    >
      <template #header>
        <h2 class="text-lg font-semibold">
          Act for the signer: {{ currentRole.label }} ({{ currentRole.hint }})
        </h2>
        <p class="text-sm text-muted">
          {{ assessment.awaiting_signer?.name ?? 'The signer' }} signs this step. As BCM you can give it to someone else, or approve it on their behalf when they approved outside BCM Tools.
        </p>
      </template>
      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          v-if="assessment.can_return"
          color="error"
          variant="outline"
          icon="i-lucide-undo-2"
          label="Return for changes"
          @click="sendBack"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-user-round-cog"
          label="Change the signer"
          @click="actForSigner('change')"
        />
        <UButton
          icon="i-lucide-badge-check"
          label="Approve on behalf"
          @click="actForSigner('on_behalf')"
        />
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Risk assessment sign-off
        </h2>
        <p class="text-sm text-muted">
          The statement or conditions that each signer is required to review and formally acknowledge their agreement to before signing the document.
        </p>
      </template>
      <blockquote
        v-if="formula.signoff_statement_en"
        lang="en"
        class="border-l-2 border-accented pl-4 text-sm whitespace-pre-line text-default"
        data-testid="signoff-statement-en"
      >
        {{ formula.signoff_statement_en }}
      </blockquote>
    </UCard>

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
            :name="ACTIONS[eventKind(event)].icon"
            class="mt-0.5 size-4 shrink-0"
            :class="ACTIONS[eventKind(event)].class"
          />
          <div class="min-w-0 text-sm">
            <p class="text-highlighted">
              <span class="font-medium">{{ ACTIONS[eventKind(event)].label }}</span>
              <template v-if="event.role">
                · {{ roleLabel(event.role) }}
              </template>
              <template v-if="eventFor(event)">
                · {{ eventFor(event) }}
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
            <ULink
              v-if="event.attachment"
              :href="event.attachment.url"
              external
              class="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
            >
              <UIcon
                name="i-lucide-paperclip"
                class="size-3.5"
              />
              {{ event.attachment.filename }}
            </ULink>
          </div>
        </li>
      </ol>
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
                v-if="teamMember(role.value)"
                label="Signer"
                :name="`signoffs.${role.value}`"
                :help="`The ${teamMember(role.value)}: change them on the Details tab.`"
                :error="fieldErrors[`signoffs.${role.value}`]"
                required
              >
                <UInput
                  :model-value="state[role.value]!.signer?.name ?? ''"
                  :placeholder="`Pick the ${teamMember(role.value)} on the Details tab`"
                  :aria-label="`Signer: ${role.label}`"
                  icon="i-lucide-lock"
                  readonly
                  disabled
                  class="w-full"
                />
              </UFormField>
              <UFormField
                v-else
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
                help="The signer's job title in the user directory."
              >
                <UInput
                  :model-value="state[role.value]!.signer?.job_title ?? ''"
                  :placeholder="state[role.value]!.signer ? 'No job title in their profile' : 'Pick a signer first'"
                  :aria-label="`Designation: ${role.label}`"
                  readonly
                  disabled
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
                <dd v-if="saved(role.value)?.evidence">
                  <ULink
                    :href="saved(role.value)?.evidence?.url"
                    external
                    class="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <UIcon
                      name="i-lucide-paperclip"
                      class="size-3.5"
                    />
                    Evidence: {{ saved(role.value)?.evidence?.filename }}
                  </ULink>
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
        label="Submit for approval"
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
  </div>
</template>
