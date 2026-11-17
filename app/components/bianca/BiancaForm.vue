<script setup lang="ts">
import type {
  BiancaAssessment,
  BiancaFunction,
  BiancaHeader,
  BiancaInput,
  BiancaPreview,
} from '~/composables/useBianca'

/**
 * The BIA on the web: Sign Off Page, RA Questionnaire, the business functions (Part 1 to 4) and
 * the notes under the tables. The same content the Excel template carries. A draft can be saved
 * incomplete; Submit needs every required value (the list under "Still to fill" says what).
 * Without `assessment` it is the New BIA form.
 */
const props = defineProps<{ assessment?: BiancaAssessment | null }>()
const emit = defineEmits<{ saved: [assessment: BiancaAssessment] }>()

const toast = useToast()
const confirm = useConfirm()
const { data: lookups } = useBiancaLookups()

const editable = computed(() => !props.assessment || props.assessment.can_edit)
const saved = ref<BiancaAssessment | null>(props.assessment ?? null)
const saving = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const failure = ref<string | null>(null)
const dirty = ref(false)

const tabs = [
  { label: 'Sign off page', value: 'sign', icon: 'i-lucide-signature' },
  { label: 'RA questionnaire', value: 'ra', icon: 'i-lucide-clipboard-list' },
  { label: 'Business functions', value: 'functions', icon: 'i-lucide-workflow' },
  { label: 'Notes', value: 'notes', icon: 'i-lucide-notebook-pen' },
]
const tab = ref('sign')

function blankHeader(): BiancaHeader {
  const header = {} as Record<string, unknown>
  for (const name of BIANCA_HEADER_TEXT) header[name] = undefined
  for (const name of BIANCA_HEADER_BOOL) header[name] = undefined
  for (const name of BIANCA_STAFF) header[name] = undefined
  header.main_location_id = undefined
  header.alt_location_id = undefined
  return header as unknown as BiancaHeader
}

const header = reactive<BiancaHeader>(blankHeader())
const functions = ref<BiancaFunction[]>([])
const selected = ref(0)
const preview = ref<BiancaPreview | null>(null)

function hydrate(source: BiancaAssessment | null) {
  Object.assign(header, blankHeader())
  if (source) {
    for (const name of Object.keys(blankHeader()) as (keyof BiancaHeader)[]) {
      (header as Record<string, unknown>)[name] = nullToUndefined(source[name])
    }
    functions.value = nullToUndefined(structuredClone(toRaw(source.functions))) as BiancaFunction[]
  } else if (!functions.value.length) {
    functions.value = [emptyBiancaFunction(lookups.value?.periods.length ?? 8)]
  }
  selected.value = Math.min(selected.value, Math.max(functions.value.length - 1, 0))
  nextTick(() => {
    dirty.value = false
  })
}
hydrate(props.assessment ?? null)
watch(lookups, () => {
  if (!props.assessment && functions.value.length === 1 && !functions.value[0]!.name) {
    functions.value = [emptyBiancaFunction(lookups.value?.periods.length ?? 8)]
    nextTick(() => {
      dirty.value = false
    })
  }
}, { once: true })

const READ_ONLY = new Set(['category', 'within_suggested_mtd', 'daat_hours', 'daat_warnings', 'rpo_code', 'id', 'seq'])

function clean(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !READ_ONLY.has(key)).map(([key, item]) => [key, clean(item)]),
    )
  }
  return value
}

function blankRow(row: object) {
  return Object.values(row).every((item) => item == null || item === false || item === '')
}

function toInput(): BiancaInput {
  const body = clean({ ...toRaw(header), functions: toRaw(functions.value) }) as BiancaInput
  for (const fn of body.functions ?? []) {
    fn.it_dependencies = fn.it_dependencies.filter((row) => !blankRow(row))
    fn.dependencies = fn.dependencies.filter((row) => !blankRow(row))
  }
  return body
}

/** The preview doesn't need a name, which the API insists on for a saved function. */
function previewInput(): BiancaInput {
  const body = toInput()
  body.functions?.forEach((fn, index) => {
    fn.name ||= `Function ${index + 1}`
  })
  return body
}

let timer: ReturnType<typeof setTimeout> | undefined
watch([header, functions], () => {
  dirty.value = true
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      preview.value = await biancaApi.calculate(previewInput())
    } catch {
      // Half-typed values the API refuses: keep the last result until they are valid.
    }
  }, 600)
}, { deep: true })
onMounted(async () => {
  try {
    preview.value = await biancaApi.calculate(previewInput())
  } catch {
    preview.value = null
  }
})
onBeforeUnmount(() => clearTimeout(timer))

const totalStaff = computed(() => preview.value?.total_staff ?? BIANCA_STAFF.reduce((sum, name) => sum + (Number(header[name]) || 0), 0))
const organisation = computed(() => saved.value ?? lookups.value?.organisation ?? null)

function addFunction() {
  if (!lookups.value || functions.value.length >= lookups.value.max_functions) return
  functions.value.push(emptyBiancaFunction(lookups.value.periods.length))
  selected.value = functions.value.length - 1
}

async function removeFunction(index: number) {
  const fn = functions.value[index]
  if (!await confirm({
    title: `Remove ${fn?.name || `function ${index + 1}`}?`,
    description: 'Its impact, dependencies and recovery details are removed from this draft when you save.',
    confirmLabel: 'Remove',
    destructive: true,
  })) return
  functions.value.splice(index, 1)
  selected.value = Math.max(0, Math.min(selected.value, functions.value.length - 1))
}

function formError(error: unknown) {
  const { data } = (error ?? {}) as { data?: { details?: Record<string, string> } }
  return data?.details ? Object.values(data.details).join(' ') : apiErrorMessage(error)
}

async function save(quiet = false) {
  saving.value = true
  failure.value = null
  try {
    const result = saved.value
      ? await biancaApi.update(saved.value.id, toInput())
      : await biancaApi.create(toInput())
    const wasNew = !saved.value
    saved.value = result
    hydrate(result)
    if (!quiet) toast.add({ title: wasNew ? `Draft ${result.ref_no} created` : 'Draft saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', result)
    return result
  } catch (error) {
    failure.value = formError(error)
    return null
  } finally {
    saving.value = false
  }
}

async function submit() {
  if (!await confirm({
    title: 'Submit this BIA for approval?',
    description: 'It leaves your drafts and can no longer be edited. The approvers sign off in turn.',
    confirmLabel: 'Submit',
  })) return
  submitting.value = true
  failure.value = null
  try {
    const result = await save(true)
    if (!result) return
    const sent = await biancaApi.submit(result.id)
    toast.add({ title: `${sent.ref_no} submitted for approval`, color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo('/bianca/manage')
  } catch (error) {
    failure.value = formError(error)
  } finally {
    submitting.value = false
  }
}

async function remove() {
  if (!saved.value || !await confirm({
    title: `Delete ${saved.value.ref_no}?`,
    description: 'This draft is deleted for good.',
    confirmLabel: 'Delete',
    destructive: true,
  })) return
  try {
    await biancaApi.remove(saved.value.id)
    toast.add({ title: 'Draft deleted', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo('/bianca/manage')
  } catch (error) {
    failure.value = formError(error)
  }
}

function onImported(result: BiancaAssessment) {
  saved.value = result
  hydrate(result)
  emit('saved', result)
}

/** What still blocks Submit, as the API counted it at the last save. */
const problems = computed(() => (dirty.value ? [] : saved.value?.problems ?? []))
const warnings = computed(() => saved.value?.warnings ?? [])
const canSubmit = computed(() => !!saved.value && !dirty.value && !problems.value.length)

const currentFunction = computed({
  get: () => functions.value[selected.value]!,
  set: (value) => {
    functions.value[selected.value] = value
  },
})
const functionItems = computed(() => functions.value.map((fn, index) => ({ label: fn.name || `Function ${index + 1}`, value: index })))
const long = TEXT_LIMITS.long

const notes = [
  { key: 'loss_formula', label: 'Part 1: how the financial loss is worked out' },
  { key: 'justification_regulatory', label: 'Part 1: justification of the regulatory scores' },
  { key: 'justification_customer', label: 'Part 1: justification of the customer scores' },
  { key: 'justification_rto', label: 'Part 2a: justification when an RTO reaches the Expected MTD' },
  { key: 'justification_dependency', label: 'Part 2b: justification of a lower capacity or longer MTD' },
] as const
const people = [
  { key: 'bcm_coordinator', title: 'BCM Coordinator' },
  { key: 'bcm_alternate', title: 'Alternate BCM Coordinator' },
] as const
</script>

<template>
  <div
    v-if="lookups"
    class="space-y-6"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <StatusBadge
          v-if="saved"
          :scale="biancaStatus"
          :value="biancaStatusKey(saved)"
        />
        <span
          v-if="saved?.ref_no"
          class="font-mono text-sm"
        >{{ saved.ref_no }}</span>
        <UBadge
          v-if="dirty && editable"
          label="Unsaved changes"
          color="warning"
          variant="subtle"
          size="sm"
        />
      </div>
      <div
        v-if="editable"
        class="flex flex-wrap gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-file-spreadsheet"
          label="Upload Excel"
          @click="uploading = true"
        />
        <UButton
          v-if="saved?.can_delete"
          color="error"
          variant="outline"
          icon="i-lucide-trash-2"
          label="Delete"
          @click="remove"
        />
        <UButton
          icon="i-lucide-save"
          :label="saved ? 'Save draft' : 'Create draft'"
          :loading="saving"
          :disabled="submitting"
          @click="save()"
        />
        <UButton
          v-if="saved"
          color="success"
          icon="i-lucide-send"
          label="Submit"
          :disabled="!canSubmit"
          :loading="submitting"
          @click="submit"
        />
      </div>
    </div>

    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="failure"
    />
    <UAlert
      v-if="!editable && saved"
      color="neutral"
      variant="subtle"
      icon="i-lucide-lock"
      title="This BIA can't be edited"
      description="Only a draft you created can be edited."
    />

    <UCard v-if="saved && editable && (problems.length || warnings.length)">
      <details :open="problems.length > 0 && problems.length <= 8">
        <summary class="cursor-pointer text-sm font-medium">
          <span v-if="problems.length">Still to fill before you can submit: {{ problems.length }}</span>
          <span v-else>Ready to submit</span>
          <span
            v-if="warnings.length"
            class="ms-2 text-warning"
          >· {{ warnings.length }} to check</span>
        </summary>
        <ul class="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
          <li
            v-for="message in problems"
            :key="message"
            class="flex gap-2"
          >
            <UIcon
              name="i-lucide-circle-dashed"
              class="mt-0.5 size-4 shrink-0 text-error"
            />{{ message }}
          </li>
          <li
            v-for="message in warnings"
            :key="message"
            class="flex gap-2 text-warning"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 size-4 shrink-0"
            />{{ message }}
          </li>
        </ul>
      </details>
    </UCard>

    <UTabs
      v-model="tab"
      :items="tabs"
      :content="false"
      variant="link"
      class="overflow-x-auto"
    />

    <!-- Sign Off Page -->
    <div
      v-show="tab === 'sign'"
      class="space-y-6"
    >
      <UCard>
        <template #header>
          <h2 class="text-sm font-semibold">
            Section A · Group
          </h2>
        </template>
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField
              label="Directorate"
              help="From your profile"
            >
              <UInput
                :model-value="organisation?.directorate ?? ''"
                readonly
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Sub directorate"
              help="From your profile"
            >
              <UInput
                :model-value="organisation?.sub_directorate ?? ''"
                readonly
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Group"
              help="From your profile"
            >
              <UInput
                :model-value="organisation?.org_group ?? ''"
                readonly
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Group description">
            <UTextarea
              v-model="header.group_description"
              class="w-full"
              :rows="3"
              :maxlength="long"
              :disabled="!editable"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Main location">
              <BiancaPicker
                v-model="header.main_location_id"
                kind="locations"
                :selected="saved?.main_location ?? null"
                :disabled="!editable"
                aria-label="Main location"
              />
            </UFormField>
            <UFormField label="Main location floor">
              <UInput
                v-model="header.main_floor"
                class="w-full"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="!editable"
              />
            </UFormField>
            <UFormField label="Alternate location">
              <BiancaPicker
                v-model="header.alt_location_id"
                kind="locations"
                :selected="saved?.alt_location ?? null"
                :disabled="!editable"
                aria-label="Alternate location"
              />
            </UFormField>
            <UFormField label="Alternate location floor">
              <UInput
                v-model="header.alt_floor"
                class="w-full"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="!editable"
              />
            </UFormField>
          </div>
          <UFormField label="Recovery strategy">
            <UTextarea
              v-model="header.recovery_strategy"
              class="w-full"
              :rows="3"
              :maxlength="long"
              :disabled="!editable"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard
        v-for="person in people"
        :key="person.key"
      >
        <template #header>
          <h2 class="text-sm font-semibold">
            {{ person.title }}
          </h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Name">
            <UInput
              v-model="header[person.key]"
              class="w-full"
              :maxlength="TEXT_LIMITS.name"
              :disabled="!editable"
            />
          </UFormField>
          <UFormField label="NIK">
            <UInput
              v-model="header[`${person.key}_nik`]"
              class="w-full"
              :maxlength="TEXT_LIMITS.medium"
              :disabled="!editable"
            />
          </UFormField>
          <UFormField label="Phone">
            <UInput
              v-model="header[`${person.key}_phone`]"
              class="w-full"
              :maxlength="TEXT_LIMITS.medium"
              :disabled="!editable"
            />
          </UFormField>
          <UFormField label="Email">
            <UInput
              v-model="header[`${person.key}_email`]"
              type="email"
              class="w-full"
              :maxlength="TEXT_LIMITS.name"
              :disabled="!editable"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-sm font-semibold">
            Risk assessment
          </h2>
        </template>
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Does the risk assessment consider business continuity?">
              <USelect
                :model-value="header.ra_considers_bc == null ? undefined : header.ra_considers_bc ? 'Yes' : 'No'"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="!editable"
                @update:model-value="header.ra_considers_bc = $event === 'Yes'"
              />
            </UFormField>
            <UFormField label="Are the controls included in the risk assessment?">
              <USelect
                :model-value="header.ra_controls_included == null ? undefined : header.ra_controls_included ? 'Yes' : 'No'"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="!editable"
                @update:model-value="header.ra_controls_included = $event === 'Yes'"
              />
            </UFormField>
          </div>
          <UFormField label="Risk assessment tools">
            <UTextarea
              v-model="header.ra_tools"
              class="w-full"
              :rows="2"
              :maxlength="long"
              :disabled="!editable"
            />
          </UFormField>
          <UFormField
            label="Justification"
            help="Needed when neither answer above is Yes."
          >
            <UTextarea
              v-model="header.ra_justification"
              class="w-full"
              :rows="2"
              :maxlength="long"
              :disabled="!editable"
            />
          </UFormField>
        </div>
      </UCard>
    </div>

    <!-- RA Questionnaire -->
    <UCard v-show="tab === 'ra'">
      <template #header>
        <h2 class="text-sm font-semibold">
          Head count of the Group
        </h2>
      </template>
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UFormField
            v-for="name in BIANCA_STAFF"
            :key="name"
            :label="lookups.staff_grades[name]"
          >
            <UInput
              v-model.number="header[name]"
              type="number"
              min="0"
              class="w-full"
              :disabled="!editable"
            />
          </UFormField>
        </div>
        <UFormField
          label="Others: please specify"
          class="max-w-md"
        >
          <UInput
            v-model="header.staff_others_note"
            class="w-full"
            :maxlength="TEXT_LIMITS.name"
            :disabled="!editable"
          />
        </UFormField>
        <p class="text-sm">
          <span class="font-medium">Total staff:</span> <span class="tabular-nums">{{ totalStaff }}</span>
          <span class="ms-1 text-muted">(the five grades added)</span>
        </p>
        <UFormField
          label="Is the Business Continuity Risk Assessment of the location done?"
          class="max-w-md"
        >
          <USelect
            :model-value="header.ra_completed == null ? undefined : header.ra_completed ? 'Yes' : 'No'"
            :items="lookups.yes_no"
            class="w-full"
            :disabled="!editable"
            @update:model-value="header.ra_completed = $event === 'Yes'"
          />
        </UFormField>
      </div>
    </UCard>

    <!-- Business functions -->
    <div
      v-show="tab === 'functions'"
      class="grid gap-6 lg:grid-cols-[16rem_1fr]"
    >
      <UCard :ui="{ body: 'p-2 sm:p-2' }">
        <p class="px-2 pb-2 text-xs text-muted">
          {{ functions.length }} of {{ lookups.max_functions }} functions
        </p>
        <ul class="space-y-1">
          <li
            v-for="item in functionItems"
            :key="item.value"
            class="flex items-center gap-1"
          >
            <button
              type="button"
              class="flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-elevated"
              :class="item.value === selected ? 'bg-elevated font-medium text-primary' : ''"
              @click="selected = item.value"
            >
              {{ item.label }}
            </button>
            <UButton
              v-if="editable && functions.length > 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :aria-label="`Remove ${item.label}`"
              @click="removeFunction(item.value)"
            />
          </li>
        </ul>
        <UButton
          v-if="editable && functions.length < lookups.max_functions"
          class="mt-2"
          block
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add function"
          @click="addFunction"
        />
      </UCard>

      <UCard v-if="currentFunction">
        <div class="space-y-4">
          <UFormField label="Business function">
            <UInput
              v-model="currentFunction.name"
              class="w-full"
              :maxlength="TEXT_LIMITS.name"
              :disabled="!editable"
              placeholder="Name of the business function"
            />
          </UFormField>
          <BiancaFunctionEditor
            :key="selected"
            v-model="currentFunction"
            :lookups="lookups"
            :preview="preview?.functions[selected] ?? null"
            :disabled="!editable"
          />
        </div>
        <template
          v-if="preview"
          #footer
        >
          <p class="text-xs text-muted">
            Cumulative loss, all functions (IDR):
            <span
              v-for="(total, i) in preview.loss_totals"
              :key="i"
              class="ms-2 tabular-nums"
              :class="preview.loss_alerts[i] ? 'font-semibold text-error' : ''"
            >{{ lookups.periods[i] }} {{ formatIdr(total) }}</span>
          </p>
        </template>
      </UCard>
    </div>

    <!-- Notes -->
    <UCard v-show="tab === 'notes'">
      <template #header>
        <h2 class="text-sm font-semibold">
          Notes under the tables
        </h2>
      </template>
      <div class="space-y-4">
        <UFormField
          v-for="note in notes"
          :key="note.key"
          :label="note.label"
        >
          <UTextarea
            v-model="header[note.key]"
            class="w-full"
            :rows="3"
            :maxlength="long"
            :disabled="!editable"
          />
        </UFormField>
      </div>
    </UCard>

    <BiancaUploadDialog
      v-model:open="uploading"
      :assessment="saved"
      @saved="onImported"
    />
  </div>
  <SkeletonTable
    v-else
    :columns="3"
    label="Loading the form"
  />
</template>
