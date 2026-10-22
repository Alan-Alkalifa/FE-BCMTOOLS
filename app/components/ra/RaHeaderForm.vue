<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaAssessment, RaUserRef } from '~/composables/useRa'

const props = defineProps<{ assessment: RaAssessment }>()
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const ra = useRaModule()
/** In sign-off or approved: shown, not edited. */
const locked = computed(() => !props.assessment.can_edit)
/** The location's pin, shown for reference; it is edited on the location's Map tab. */
const locationPin = computed(() => raPin(props.assessment.location))
const toast = useToast()
const form = useTemplateRef('form')
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const schema = z.object({
  period_year: z.number('Enter the RA period.').int().min(2000).max(2100),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  due_date: z.string().nullable(),
  lic_user_id: z.number('Choose the LIC.'),
  lic_phone: z.string().trim().min(1, 'Enter the LIC mobile number.'),
  licom_user_id: z.number('Choose the LICOM.'),
  licom_phone: z.string().trim().min(1, 'Enter the LICOM mobile number.'),
}).refine((value) => !value.due_date || value.due_date >= value.assessment_date, {
  path: ['due_date'],
  message: 'Cannot be before the assessment date.',
})
type State = Omit<z.infer<typeof schema>, 'lic_user_id' | 'licom_user_id'> & {
  lic_user_id: number | null
  licom_user_id: number | null
}
type Member = 'lic' | 'licom'
const MEMBERS: Member[] = ['lic', 'licom']

function fromAssessment(assessment: RaAssessment): State {
  return {
    period_year: assessment.period_year,
    assessment_date: assessment.assessment_date ?? '',
    due_date: assessment.due_date,
    lic_user_id: assessment.lic_user?.id ?? null,
    lic_phone: assessment.lic_phone ?? '',
    licom_user_id: assessment.licom_user?.id ?? null,
    licom_phone: assessment.licom_phone ?? '',
  }
}

const state = reactive<State>(fromAssessment(props.assessment))
/** The picked users, for the pickers' labels and their mobile numbers. */
const users = reactive<Record<Member, RaUserRef | null>>({
  lic: props.assessment.lic_user,
  licom: props.assessment.licom_user,
})

const assessmentDate = computed({
  get: () => state.assessment_date ? parseDate(state.assessment_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.assessment_date = value ? value.toString() : ''
  },
})

const dueDate = computed({
  get: () => state.due_date ? parseDate(state.due_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.due_date = value ? value.toString() : null
  },
})

function reset(assessment: RaAssessment) {
  Object.assign(state, fromAssessment(assessment))
  Object.assign(users, { lic: assessment.lic_user, licom: assessment.licom_user })
  snapshot.value = JSON.stringify(state)
  if (dirty) dirty.value = false
}

watch(() => props.assessment, (assessment) => reset(assessment), { immediate: true })
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state) !== snapshot.value
}, { deep: true })

async function onSubmit() {
  formError.value = null
  try {
    const { lic_user_id, licom_user_id, ...fields } = state
    // An assessment from before users were picked keeps its typed names until someone is picked.
    const saved = await raApi.update(props.assessment.id, {
      ...blankToNull({ ...fields }),
      ...(lic_user_id ? { lic_user_id } : {}),
      ...(licom_user_id ? { licom_user_id } : {}),
    })
    reset(saved)
    toast.add({ title: 'Assessment saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    form.value?.setErrors(apiFieldErrors(error))
    formError.value = apiErrorMessage(error)
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="schema"
    :state="state"
    class="space-y-6"
    @submit="onSubmit"
  >
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the assessment"
      :description="formError"
    />

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Assessment
            </h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="RA ref. no."
              name="ref_no"
            >
              <UInput
                :model-value="assessment.ref_no ?? ''"
                disabled
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="RA period"
              name="period_year"
              required
            >
              <UInputNumber
                v-model="state.period_year"
                :disabled="locked"
                :min="2000"
                :max="2100"
                :format-options="{ useGrouping: false }"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Assessment date"
              name="assessment_date"
              required
            >
              <DatePicker
                v-model="assessmentDate"
                :disabled="locked"
              />
            </UFormField>
            <UFormField
              label="Renewal due"
              name="due_date"
              help="Defaults to one year after the assessment date."
            >
              <DatePicker
                v-model="dueDate"
                :min="assessmentDate"
                :disabled="locked"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Location incident team
            </h2>
            <p class="text-sm text-muted">
              Section A of the LRP scorecard. Both are required.
            </p>
          </template>
          <div class="space-y-4">
            <RaTeamMember
              v-for="member in MEMBERS"
              :key="member"
              v-model:user-id="state[`${member}_user_id`]"
              v-model:user="users[member]"
              v-model:phone="state[`${member}_phone`]"
              :member="member"
              :label="ra[member].label"
              :hint="ra[member].hint"
              :legacy-name="assessment[`${member}_name`]"
              :name-label="ra[member].label"
              :phone-label="`${member.toUpperCase()} mobile number`"
              :disabled="locked"
            />
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            {{ ra.location.single }}
          </h2>
        </template>
        <div class="mb-4">
          <RaMap
            v-if="locationPin"
            :markers="[{ id: assessment.location.id, label: assessment.location.name, level: assessment.summary.highest_residual_level ?? 'none', ...locationPin }]"
            :label="`Map of ${assessment.location.name}`"
            height-class="h-48"
          />
          <p
            v-else
            class="flex items-start gap-2 rounded-md bg-elevated p-3 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-map-pin-off"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>
              No map pin yet.
              <NuxtLink
                :to="locationPath(assessment.location.id, 'map')"
                class="text-primary hover:underline"
              >Add it on the {{ ra.location.lower }}'s Map tab</NuxtLink>.
            </span>
          </p>
        </div>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-muted">
              {{ ra.kind === 'branch' ? 'Branch' : 'Building' }}
            </dt>
            <dd class="font-medium text-highlighted">
              {{ assessment.location.name }}
            </dd>
          </div>
          <div v-if="ra.hasRegion">
            <dt class="text-muted">
              Region
            </dt>
            <dd>{{ assessment.location.region || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Address
            </dt>
            <dd>{{ assessment.location.address || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Formula version
            </dt>
            <dd>{{ assessment.formula_version }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-sm text-muted">
          {{ ra.hasLcp
            ? 'Emergency contacts, occupants, the recovery team and the call tree are kept on the location and shared by every RA cycle.'
            : 'Emergency contacts are kept on the branch and shared by every RA cycle.' }}
        </p>
        <template #footer>
          <UButton
            :to="locationPath(assessment.location.id)"
            variant="link"
            trailing-icon="i-lucide-arrow-right"
            :label="`Open ${ra.location.lower} profile`"
            class="px-0"
          />
        </template>
      </UCard>
    </div>

    <div
      v-if="!locked"
      class="flex justify-end"
    >
      <UButton
        type="submit"
        label="Save assessment"
        loading-auto
      />
    </div>
  </UForm>
</template>
