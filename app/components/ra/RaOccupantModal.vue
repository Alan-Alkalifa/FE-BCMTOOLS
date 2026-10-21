<script setup lang="ts">
import { z } from 'zod'
import type { RaOccupant } from '~/composables/useRa'

const props = defineProps<{ occupant?: RaOccupant, directorates: string[] }>()
const emit = defineEmits<{ close: [occupant: RaOccupant | false] }>()

const count = z.number().int('Enter a whole number.').min(0, 'Cannot be negative.').nullable()

const schema = z.object({
  floor: z.string().optional(),
  directorate: z.string().optional(),
  unit_name: z.string().trim().min(1, 'Enter the unit name.'),
  company: z.string().optional(),
  employee_count: count,
  disabled_count: count,
  pregnant_count: count,
  pregnant_due_dates: z.string().optional(),
  shift_work: z.enum(['yes', 'no', 'unknown']),
  shift_times: z.string().optional(),
  mtd: z.string().optional(),
  has_bcp: z.enum(['yes', 'no', 'unknown']),
  alternate_site: z.enum(['yes', 'no', 'unknown']),
  remarks: z.string().optional(),
}).superRefine((value, context) => {
  for (const field of ['disabled_count', 'pregnant_count'] as const) {
    const number = value[field]
    if (number !== null && value.employee_count !== null && number > value.employee_count) {
      context.addIssue({ code: 'custom', path: [field], message: 'Cannot be more than the number of employees.' })
    }
  }
})
type State = z.infer<typeof schema>
type Choice = 'yes' | 'no' | 'unknown'

function toChoice(value: boolean | null | undefined): Choice {
  return value === true ? 'yes' : value === false ? 'no' : 'unknown'
}

function fromChoice(value: Choice) {
  return value === 'yes' ? true : value === 'no' ? false : null
}

const source = props.occupant
const state = reactive<State>({
  floor: source?.floor ?? '',
  directorate: source?.directorate ?? '',
  unit_name: source?.unit_name ?? '',
  company: source?.company ?? 'PT. CIMB Niaga',
  employee_count: source?.employee_count ?? null,
  disabled_count: source?.disabled_count ?? null,
  pregnant_count: source?.pregnant_count ?? null,
  pregnant_due_dates: source?.pregnant_due_dates ?? '',
  shift_work: toChoice(source?.shift_work),
  shift_times: source?.shift_times ?? '',
  mtd: source?.mtd ?? '',
  has_bcp: toChoice(source?.has_bcp),
  alternate_site: toChoice(source?.alternate_site),
  remarks: source?.remarks ?? '',
})

const choices = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'Not recorded', value: 'unknown' },
]

const directorateItems = computed(() => [...new Set(props.directorates.filter(Boolean))].sort())

function onSubmit() {
  const occupant = blankToNull({
    floor: state.floor,
    directorate: state.directorate,
    unit_name: state.unit_name.trim(),
    company: state.company,
    employee_count: state.employee_count,
    disabled_count: state.disabled_count,
    pregnant_count: state.pregnant_count,
    pregnant_due_dates: state.pregnant_due_dates,
    shift_work: fromChoice(state.shift_work),
    shift_times: state.shift_work === 'yes' ? state.shift_times : null,
    mtd: state.mtd,
    has_bcp: fromChoice(state.has_bcp),
    alternate_site: fromChoice(state.alternate_site),
    remarks: state.remarks,
  }) as RaOccupant
  emit('close', occupant)
}
</script>

<template>
  <UModal
    :title="occupant ? 'Edit unit' : 'Add unit'"
    description="A unit working in this building, and how it continues work if the building can't be used."
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
        <section class="space-y-4">
          <h3 class="font-semibold">
            Unit
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
              label="Unit name"
              name="unit_name"
              required
            >
              <UInput
                v-model="state.unit_name"
                class="w-full"
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
          <UFormField
            label="Works in shifts"
            name="shift_work"
          >
            <URadioGroup
              v-model="state.shift_work"
              orientation="horizontal"
              :items="choices"
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
        </section>

        <section class="space-y-4">
          <h3 class="font-semibold">
            Continuity strategy
          </h3>
          <div class="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <UFormField
              label="MTD"
              name="mtd"
              help="From the unit's BIA."
            >
              <UInput
                v-model="state.mtd"
                placeholder="e.g. 4 hours"
                class="w-full"
              />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Has a BCP"
                name="has_bcp"
              >
                <URadioGroup
                  v-model="state.has_bcp"
                  :items="choices"
                />
              </UFormField>
              <UFormField
                label="Alternate work location"
                name="alternate_site"
              >
                <URadioGroup
                  v-model="state.alternate_site"
                  :items="choices"
                />
              </UFormField>
            </div>
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
          :label="occupant ? 'Save unit' : 'Add unit'"
        />
      </div>
    </template>
  </UModal>
</template>
