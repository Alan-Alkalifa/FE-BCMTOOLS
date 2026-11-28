<script setup lang="ts">
import type { PickedUser } from '~/components/UserPicker.vue'
import type { BcpPerson, BcpPlan, BcpSignoff } from '~/composables/useBcp'

/**
 * The Summary BIA tab, as the production BCP: Reference (BIA), Request information (the BCP name
 * is the one field to fill), General information with the BCM coordinators, and the business
 * functions of the BIA with their category. Saved with "Save summary" (form `bcp-form-summary`).
 * It also holds the optional attachment (saved at once) and the Sign-off steps, whose signers the
 * coordinator picks before Submit (D46).
 */
const props = defineProps<{ plan: BcpPlan }>()
const emit = defineEmits<{ saved: [plan: BcpPlan], attachment: [plan: BcpPlan] }>()
const dirty = inject(bcpDirtyKey, ref(false))
const saving = inject(bcpSavingKey, ref(false))
const toast = useToast()

type Signers = Record<string, number | null>
function signersOf(plan: BcpPlan): Signers {
  return Object.fromEntries(plan.steps.filter((step) => step.pickable).map((step) => [step.code, step.user?.id ?? null]))
}
function peopleOf(plan: BcpPlan): Record<string, PickedUser | null> {
  return Object.fromEntries(plan.steps.filter((step) => step.pickable).map((step) => [
    step.code,
    step.user ? { id: step.user.id, display_name: step.user.display_name, email: step.user.email, job_title: step.user.job_title, department: null } : null,
  ]))
}
const name = ref(props.plan.name)
const signers = ref<Signers>(signersOf(props.plan))
const people = ref(peopleOf(props.plan))
// Only a save (a new revision) resets the form: an uploaded attachment keeps unsaved edits.
watch(() => props.plan.revision, () => {
  name.value = props.plan.name
  signers.value = signersOf(props.plan)
  people.value = peopleOf(props.plan)
})
const changed = computed(() =>
  name.value !== props.plan.name || JSON.stringify(signers.value) !== JSON.stringify(signersOf(props.plan)),
)
watch(changed, (value) => {
  dirty.value = value
}, { immediate: true })
const submitted = computed<BcpSignoff[]>(() => props.plan.signoffs)
const signoffStatus: Record<string, { label: string, color: 'neutral' | 'warning' | 'success' | 'error' }> = {
  pending: { label: 'Pending', color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
  closed: { label: 'Closed', color: 'neutral' },
}
const error = ref<string | null>(null)

const nameError = ref<string | null>(null)
async function submit() {
  if (!props.plan.permissions.can_edit) return
  nameError.value = name.value.trim() ? null : 'Enter the BCP name.'
  if (nameError.value) return
  error.value = null
  saving.value = true
  try {
    const saved = await bcpApi.saveSummary(props.plan.id, { revision: props.plan.revision, name: name.value.trim(), signoff_users: signers.value })
    emit('saved', saved)
    toast.add({ title: 'Summary saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    error.value = bcpErrorText(failure)
  } finally {
    saving.value = false
  }
}

const coordinators = computed(() => [
  { title: 'BCM coordinator', person: props.plan.coordinator },
  { title: 'Alt. BCM coordinator', person: props.plan.alternate },
] as { title: string, person: BcpPerson | null }[])
const category = (value: string | null) => (value && value in biaCategory ? value : 'na') as keyof typeof biaCategory
</script>

<template>
  <form
    id="bcp-form-summary"
    class="space-y-6"
    novalidate
    @submit.prevent="submit"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the summary"
      :description="error"
    />
    <div class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Reference (BIA)
          </h2>
        </template>
        <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">
            Refer BIA
          </dt>
          <dd class="font-mono text-xs">
            {{ plan.bia.ref_no || '—' }}
          </dd>
          <dt class="text-muted">
            BIA version
          </dt>
          <dd>{{ plan.bia.version ?? '—' }}</dd>
          <dt class="text-muted">
            Final on
          </dt>
          <dd>{{ formatDate(plan.bia.finalised_at) || '—' }}</dd>
        </dl>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Request information
          </h2>
        </template>
        <fieldset
          :disabled="!plan.permissions.can_edit"
          class="space-y-4"
        >
          <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted">
              BCP ID
            </dt>
            <dd class="font-mono text-xs">
              {{ plan.ref_no }}
            </dd>
            <dt class="text-muted">
              BCP version
            </dt>
            <dd>{{ plan.doc_version }}</dd>
            <dt class="text-muted">
              Configuration
            </dt>
            <dd>{{ plan.config.code }}</dd>
          </dl>
          <UFormField
            label="BCP name"
            name="name"
            required
            :error="nameError ?? undefined"
          >
            <UInput
              v-model="name"
              class="w-full"
              maxlength="255"
              aria-label="BCP name"
            />
            <template #hint>
              <FieldCount
                :value="name"
                :max="255"
              />
            </template>
          </UFormField>
        </fieldset>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">
          General information
        </h2>
      </template>
      <div class="grid gap-6 lg:grid-cols-2">
        <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">
            Directorate
          </dt>
          <dd>{{ plan.group.directorate || '—' }}</dd>
          <dt class="text-muted">
            Sub directorate
          </dt>
          <dd>{{ plan.group.sub_directorate || '—' }}</dd>
          <dt class="text-muted">
            Group
          </dt>
          <dd>{{ plan.group.org_group || '—' }}</dd>
        </dl>
        <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">
            Group description
          </dt>
          <dd class="whitespace-pre-line">
            {{ plan.group.description || '—' }}
          </dd>
        </dl>
        <div
          v-for="block in coordinators"
          :key="block.title"
        >
          <h3 class="mb-2 text-sm font-semibold text-highlighted">
            {{ block.title }}
          </h3>
          <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted">
              NIK
            </dt>
            <dd>{{ block.person?.nik || '—' }}</dd>
            <dt class="text-muted">
              Name
            </dt>
            <dd>{{ block.person?.name || '—' }}</dd>
            <dt class="text-muted">
              Phone
            </dt>
            <dd>{{ block.person?.phone || '—' }}</dd>
            <dt class="text-muted">
              Email
            </dt>
            <dd>{{ block.person?.email || '—' }}</dd>
          </dl>
        </div>
      </div>
    </UCard>

    <BcpAttachmentCard
      :plan="plan"
      @changed="(next) => emit('attachment', next)"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Sign-off
        </h2>
        <p class="mt-1 text-sm text-muted">
          <template v-if="submitted.length">
            As submitted{{ plan.submitted_at ? ` on ${formatDateTime(plan.submitted_at)}` : '' }}. The steps approve the BCP in order.
          </template>
          <template v-else>
            The approval steps of BCP configuration {{ plan.config.code }}. Pick the signer of each Ketua RTF, Ketua IMT and chosen step before you submit.
          </template>
        </p>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-sm">
          <caption class="sr-only">
            Sign-off steps
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-12 px-4 py-2">
                No
              </th>
              <th class="px-3 py-2">
                Step
              </th>
              <th class="w-96 px-4 py-2">
                Signer
              </th>
            </tr>
          </thead>
          <tbody
            v-if="submitted.length"
            class="divide-y divide-default"
          >
            <tr
              v-for="(row, index) in submitted"
              :key="row.code"
            >
              <td class="px-4 py-2 align-top tabular-nums">
                {{ index + 1 }}
              </td>
              <td class="px-3 py-2 align-top">
                {{ row.title }}
                <UBadge
                  v-if="row.status"
                  class="ms-1"
                  :color="signoffStatus[row.status]?.color ?? 'neutral'"
                  variant="subtle"
                  size="sm"
                  :label="signoffStatus[row.status]?.label ?? row.status"
                />
              </td>
              <td class="px-4 py-2 align-top">
                <p>{{ row.name || '—' }}</p>
                <p
                  v-if="row.position"
                  class="text-xs text-muted"
                >
                  {{ row.position }}
                </p>
              </td>
            </tr>
          </tbody>
          <tbody
            v-else
            class="divide-y divide-default"
          >
            <tr
              v-for="(step, index) in plan.steps"
              :key="step.code"
            >
              <td class="px-4 py-2 align-top tabular-nums">
                {{ index + 1 }}
              </td>
              <td class="px-3 py-2 align-top">
                {{ step.title }}
                <span
                  v-if="!step.required"
                  class="text-xs text-muted"
                >(optional)</span>
              </td>
              <td class="px-4 py-2 align-top">
                <UserPicker
                  v-if="step.pickable"
                  v-model="signers[step.code]"
                  :selected="people[step.code]"
                  :disabled="!plan.permissions.can_edit"
                  :aria-label="`Signer of ${step.title}`"
                  @pick="(user) => (people[step.code] = user)"
                />
                <template v-else>
                  <p>{{ step.name || '—' }}</p>
                  <p class="text-xs text-muted">
                    {{ step.position ? `${step.position} · ` : '' }}Fixed signer, set by BCM in the BCP configuration.
                  </p>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Business functions
        </h2>
        <p class="mt-1 text-sm text-muted">
          From {{ plan.bia.ref_no || 'the BIA' }}, as copied when this BCP was made. RTO comes from the application's final SCCA.
        </p>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[48rem] text-sm">
          <caption class="sr-only">
            Business functions of the BIA
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-12 px-4 py-2">
                No
              </th>
              <th class="px-3 py-2">
                Business function
              </th>
              <th class="px-3 py-2">
                Applications (RTO)
              </th>
              <th class="w-32 px-3 py-2">
                Expected MTD
              </th>
              <th class="w-48 px-4 py-2">
                Category
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="fn in plan.functions"
              :key="fn.id"
            >
              <td class="px-4 py-2 tabular-nums">
                {{ fn.seq }}
              </td>
              <td class="px-3 py-2">
                {{ fn.name }}
                <UBadge
                  v-if="!fn.in_bia"
                  class="ms-1"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  label="Not in the latest BIA"
                />
              </td>
              <td class="px-3 py-2">
                <span v-if="!fn.apps.length">—</span>
                <span
                  v-for="(app, index) in fn.apps"
                  :key="index"
                  class="block"
                >{{ app.name }} <span class="text-muted">({{ app.rto || '—' }})</span></span>
                <UBadge
                  v-if="fn.rto_over_mtd"
                  class="mt-1"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-triangle-alert"
                  label="RTO > MTD"
                />
              </td>
              <td class="px-3 py-2">
                {{ fn.expected_mtd || '—' }}
              </td>
              <td class="px-4 py-2">
                <StatusBadge
                  :scale="biaCategory"
                  :value="category(fn.category)"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </form>
</template>
