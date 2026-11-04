<script setup lang="ts">
import { z } from 'zod'
import type { RaDivision, RaOccupant } from '~/composables/useRa'

/**
 * A division working in the building (LCP Section C) and its continuity strategy (Section F).
 * The division is picked from the division list in RA configuration, so its MTD and critical
 * rating follow it (read-only here). A division that isn't listed yet can be added from here:
 * its MTD and critical rating are then set once; BCM changes them later in RA configuration.
 */
const props = defineProps<{ occupant?: RaOccupant, directorates: string[] }>()
const emit = defineEmits<{ close: [occupant: RaOccupant | false] }>()
const ra = useRaModule()
const place = computed(() => (ra.value.kind === 'branch' ? 'branch' : 'building'))

const { data: divisionData, status: divisionStatus } = useRaDivisions()
const divisions = computed<RaDivision[]>(() => divisionData.value?.items ?? [])

const source = props.occupant
/** A unit typed before the division list existed: kept as typed until a division is picked. */
const legacyName = source && !source.division_id ? source.unit_name : null

const count = z.number().int('Enter a whole number.').min(0, 'Cannot be negative.').nullable()
type Choice = 'yes' | 'no' | 'unknown'
const choice = z.enum(['yes', 'no', 'unknown'])

const schema = z.object({
  division_id: z.number().nullable(),
  new_division: z.string(),
  new_mtd: z.string(),
  new_rating: z.string(),
  floor: z.string().optional(),
  directorate: z.string().optional(),
  company: z.string().optional(),
  employee_count: count,
  disabled_count: count,
  pregnant_count: count,
  pregnant_due_dates: z.string().optional(),
  shift_work: choice,
  shift_times: z.string().optional(),
  has_bcp: choice,
  alternate_site: choice,
  remarks: z.string().optional(),
}).superRefine((value, context) => {
  if (value.division_id === null && !value.new_division.trim() && !legacyName) {
    context.addIssue({ code: 'custom', path: ['division_id'], message: 'Pick the division, or add it.' })
  }
  if (value.division_id === null && value.new_division.trim()) {
    if (!value.new_mtd) context.addIssue({ code: 'custom', path: ['new_mtd'], message: 'Choose the MTD of the new division.' })
    if (!value.new_rating) context.addIssue({ code: 'custom', path: ['new_rating'], message: 'Choose its critical rating.' })
  }
  for (const field of ['disabled_count', 'pregnant_count'] as const) {
    const number = value[field]
    if (number !== null && value.employee_count !== null && number > value.employee_count) {
      context.addIssue({ code: 'custom', path: [field], message: 'Cannot be more than the number of employees.' })
    }
  }
})
type State = z.infer<typeof schema>

function toChoice(value: boolean | null | undefined): Choice {
  return value === true ? 'yes' : value === false ? 'no' : 'unknown'
}

function fromChoice(value: Choice) {
  return value === 'yes' ? true : value === 'no' ? false : null
}

const state = reactive<State>({
  division_id: source?.division_id ?? null,
  new_division: '',
  new_mtd: '',
  new_rating: '',
  floor: source?.floor ?? '',
  directorate: source?.directorate ?? '',
  company: source?.company ?? 'PT. CIMB Niaga',
  employee_count: source?.employee_count ?? null,
  disabled_count: source?.disabled_count ?? null,
  pregnant_count: source?.pregnant_count ?? null,
  pregnant_due_dates: source?.pregnant_due_dates ?? '',
  shift_work: toChoice(source?.shift_work),
  shift_times: source?.shift_times ?? '',
  has_bcp: toChoice(source?.has_bcp),
  alternate_site: toChoice(source?.alternate_site),
  remarks: source?.remarks ?? '',
})

const choices = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'Not recorded', value: 'unknown' },
]
const mtdItems = RA_MTD_BANDS.map((value): { label: string, value: string } => ({ label: value, value }))
const ratingItems = RA_CRITICAL_RATINGS.map((value): { label: string, value: string } => ({ label: value, value }))

const directorateItems = computed(() => [...new Set(props.directorates.filter(Boolean))].sort())
const divisionItems = computed(() => [
  ...(state.new_division ? [{ label: `${state.new_division} (new)`, value: -1 }] : []),
  ...divisions.value.map((item) => ({ label: item.name, value: item.id })),
])
const picked = computed(() => divisions.value.find((item) => item.id === state.division_id) ?? null)
const isNew = computed(() => state.division_id === null && Boolean(state.new_division))

const divisionModel = computed<number | undefined>({
  get: () => (isNew.value ? -1 : state.division_id ?? undefined),
  set: (value) => {
    if (value === -1) return
    state.division_id = value ?? null
    state.new_division = ''
  },
})

/** "Add …" in the lookup: a division that isn't on the list yet. */
function addDivision(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const existing = divisions.value.find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) {
    divisionModel.value = existing.id
    return
  }
  state.division_id = null
  state.new_division = trimmed
}

watch(() => state.new_rating, (rating) => {
  if (rating && !state.new_mtd) state.new_mtd = RA_RATING_MTD[rating] ?? ''
})

const mtdShown = computed(() => picked.value?.mtd ?? (isNew.value ? null : source?.mtd ?? null))
const ratingShown = computed(() => picked.value?.critical_rating ?? (isNew.value ? null : source?.critical_rating ?? null))

const submitError = ref<string | null>(null)

async function onSubmit() {
  submitError.value = null
  let divisionId = state.division_id
  let unitName = picked.value?.name ?? legacyName ?? ''
  let mtd = picked.value?.mtd ?? source?.mtd ?? null
  if (isNew.value) {
    try {
      const created = await raApi.createDivision({ name: state.new_division, mtd: state.new_mtd, critical_rating: state.new_rating })
      divisionId = created.id
      unitName = created.name
      mtd = created.mtd
    } catch (error) {
      submitError.value = apiErrorMessage(error)
      return
    }
  }
  const occupant = blankToNull({
    division_id: divisionId,
    floor: state.floor,
    directorate: state.directorate,
    unit_name: unitName,
    company: state.company,
    employee_count: state.employee_count,
    disabled_count: state.disabled_count,
    pregnant_count: state.pregnant_count,
    pregnant_due_dates: state.pregnant_due_dates,
    shift_work: fromChoice(state.shift_work),
    shift_times: state.shift_work === 'yes' ? state.shift_times : null,
    mtd,
    has_bcp: fromChoice(state.has_bcp),
    alternate_site: fromChoice(state.alternate_site),
    remarks: state.remarks,
  }) as RaOccupant
  emit('close', occupant)
}
</script>

<template>
  <UModal
    :title="occupant ? 'Edit division' : 'Add division'"
    :description="`A division working in this ${place}, and how it continues work if the ${place} can't be used.`"
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="(open) => !open && emit('close', false)"
  >
    <template #body>
      <UForm
        id="ra-occupant-form"
        :schema="schema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <UAlert
          v-if="submitError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't add the division"
          :description="submitError"
        />
        <section class="space-y-4">
          <h3 class="font-semibold">
            Division
          </h3>
          <div class="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <UFormField
              label="Floor"
              name="floor"
            >
              <UInput
                v-model="state.floor"
                placeholder="e.g. 5 or TBA"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Division name"
              name="division_id"
              required
              :help="legacyName && !state.division_id && !isNew
                ? `Typed as “${legacyName}” before: pick it from the division list, or add it.`
                : 'Pick it from the division list, or type a new name and add it.'"
            >
              <USelectMenu
                v-model="divisionModel"
                value-key="value"
                :items="divisionItems"
                :loading="divisionStatus === 'pending'"
                create-item
                placeholder="Search or add a division"
                aria-label="Division name"
                class="w-full"
                @create="addDivision"
              />
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Directorate"
              name="directorate"
            >
              <UInputMenu
                v-model="state.directorate"
                :items="directorateItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Company"
              name="company"
            >
              <UInput
                v-model="state.company"
                class="w-full"
              />
            </UFormField>
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="font-semibold">
            People
          </h3>
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField
              label="Employees"
              name="employee_count"
            >
              <UInputNumber
                v-model="state.employee_count"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Employees with a disability"
              name="disabled_count"
            >
              <UInputNumber
                v-model="state.disabled_count"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Pregnant employees"
              name="pregnant_count"
            >
              <UInputNumber
                v-model="state.pregnant_count"
                :min="0"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            v-if="state.pregnant_count"
            label="Due dates"
            name="pregnant_due_dates"
          >
            <UInput
              v-model="state.pregnant_due_dates"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <UFormField
              label="Works in shifts"
              name="shift_work"
            >
              <USelect
                v-model="state.shift_work"
                :items="choices"
                aria-label="Works in shifts"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="state.shift_work === 'yes'"
              label="Shift times"
              name="shift_times"
            >
              <UInput
                v-model="state.shift_times"
                placeholder="e.g. 07.00–15.00, 15.00–23.00"
                class="w-full"
              />
            </UFormField>
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="font-semibold">
            Continuity strategy
          </h3>
          <div
            v-if="isNew"
            class="grid gap-4 sm:grid-cols-2"
          >
            <UFormField
              label="Critical rating"
              name="new_rating"
              required
              help="Set once for the new division."
            >
              <USelect
                v-model="state.new_rating"
                :items="ratingItems"
                placeholder="Choose"
                aria-label="Critical rating"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="MTD"
              name="new_mtd"
              required
              help="Maximum tolerable downtime, from the division's BIA."
            >
              <USelect
                v-model="state.new_mtd"
                :items="mtdItems"
                placeholder="Choose"
                aria-label="MTD"
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            v-else
            class="grid gap-4 sm:grid-cols-2"
          >
            <UFormField
              label="Critical rating"
              help="Follows the division (RA configuration)."
            >
              <UInput
                :model-value="ratingShown ?? '—'"
                disabled
                aria-label="Critical rating"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="MTD"
              help="Follows the division (RA configuration)."
            >
              <UInput
                :model-value="mtdShown ?? '—'"
                disabled
                aria-label="MTD"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Has a BCP"
              name="has_bcp"
            >
              <USelect
                v-model="state.has_bcp"
                :items="choices"
                aria-label="Has a BCP"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Alternate work location"
              name="alternate_site"
            >
              <USelect
                v-model="state.alternate_site"
                :items="choices"
                aria-label="Alternate work location"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Remarks"
            name="remarks"
          >
            <UTextarea
              v-model="state.remarks"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
        </section>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close', false)"
        />
        <UButton
          type="submit"
          form="ra-occupant-form"
          :label="occupant ? 'Save division' : 'Add division'"
          loading-auto
        />
      </div>
    </template>
  </UModal>
</template>
