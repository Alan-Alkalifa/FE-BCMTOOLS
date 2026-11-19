<script setup lang="ts">
import type {
  BiancaAssessment,
  BiancaFunction,
  BiancaHeader,
  BiancaInput,
  BiancaOrg,
  BiancaPerson,
  BiancaPlace,
  BiancaPreview,
} from '~/composables/useBianca'
import type { BiancaNoteKey } from '~/utils/biancaNotes'
import { BIANCA_PARTS, biancaPartDone, type BiancaPart } from '~/utils/biancaParts'

/**
 * The BIA on the web: Sign Off Page, RA Questionnaire, the business functions (Part 1 to 4, as
 * many as the Group has) with the notes under the workbook's tables below them. The same content the Excel template carries. A draft can be saved
 * incomplete; Submit needs every required value (the list under "Still to fill" says what).
 * Without `assessment` it is the New BIA form.
 */
const props = defineProps<{ assessment?: BiancaAssessment | null }>()
const emit = defineEmits<{ saved: [assessment: BiancaAssessment] }>()

const toast = useToast()
const confirm = useConfirm()
const { data: lookups } = useBiancaLookups(() => props.assessment?.id)

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
  { label: 'Appendix', value: 'appendix', icon: 'i-lucide-table-2' },
  { label: 'Approval template', value: 'approval', icon: 'i-lucide-signature' },
]
const tab = ref('sign')

function blankHeader(): BiancaHeader {
  const header = {} as Record<string, unknown>
  for (const name of BIANCA_HEADER_TEXT) header[name] = undefined
  for (const name of BIANCA_HEADER_BOOL) header[name] = undefined
  for (const name of BIANCA_STAFF) header[name] = undefined
  header.main_location_id = undefined
  header.alt_location_id = undefined
  header.bcm_coordinator_id = undefined
  header.bcm_alternate_id = undefined
  header.personnel_counts = {}
  header.personnel_notes = {}
  header.signoff_users = {}
  return header as unknown as BiancaHeader
}

const header = reactive<BiancaHeader>(blankHeader())
const org = ref<BiancaOrg>({ directorate: undefined, sub_directorate: undefined, org_group: undefined })
/** How the main location reads in its picker, also when it was filled from the database. */
const mainPlace = ref<BiancaPlace | null>(null)
const mainHint = ref<{ text: string, color: 'muted' | 'warning' } | null>(null)
type PersonKey = 'bcm_coordinator' | 'bcm_alternate'
/** The picked users, as the directory has them (null: none, or typed before). */
const persons = reactive<Record<PersonKey, BiancaPerson | null>>({ bcm_coordinator: null, bcm_alternate: null })
const functions = ref<BiancaFunction[]>([])
const selected = ref(0)
/** The part of the selected function shown, picked under that function in the list. */
const part = ref<BiancaPart>('p1')
/** The functions opened in the list (each shows its parts). */
const opened = ref(new Set<number>([0]))
function isOpen(index: number) {
  return opened.value.has(index)
}
function toggle(index: number) {
  const next = new Set(opened.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  opened.value = next
}
function openPart(index: number, value: BiancaPart) {
  selected.value = index
  part.value = value
  if (!isOpen(index)) toggle(index)
}
/** Which parts of each function have everything Submit asks of them (the ticks in the list). */
const partsDone = computed(() => functions.value.map((fn, index) => {
  const category = preview.value?.functions[index]?.category ?? fn.category
  return Object.fromEntries(BIANCA_PARTS.map((entry) => [
    entry.value,
    biancaPartDone(fn, entry.value, lookups.value?.periods.length ?? 8, category),
  ])) as Record<BiancaPart, boolean>
}))
function functionDone(index: number) {
  const done = partsDone.value[index]
  return !!done && BIANCA_PARTS.every((entry) => done[entry.value])
}
/** The workbook's Appendix: every function with its category and Expected MTD, filled from Part 1 and 2. */
const appendixRows = computed(() => functions.value.map((fn, index) => ({
  index,
  name: fn.name || `Function ${index + 1}`,
  category: preview.value?.functions[index]?.category ?? fn.category ?? null,
  expected_mtd: fn.expected_mtd ?? null,
})))
function openFunction(index: number, value: BiancaPart = 'p1') {
  tab.value = 'functions'
  openPart(index, value)
}
// The reference panel: open by default, remembered on this browser when someone hides it.
const REFERENCE_KEY = 'bianca:reference-open'
const referenceOpen = ref(true)
onMounted(() => {
  try {
    referenceOpen.value = localStorage.getItem(REFERENCE_KEY) !== '0'
  } catch {
    // Storage blocked: keep it open.
  }
})
/** Part 4's sheet has no REFERENCE box. */
const referenceShown = computed(() => referenceOpen.value && part.value !== 'p4')
const referencePart = computed(() => (part.value === 'p4' ? 'p3' : part.value) as 'p1' | 'p2a' | 'p2b' | 'p3')
function toggleReference() {
  referenceOpen.value = !referenceOpen.value
  try {
    localStorage.setItem(REFERENCE_KEY, referenceOpen.value ? '1' : '0')
  } catch {
    // Storage blocked: it just isn't remembered.
  }
  if (referenceOpen.value) nextTick(() => document.getElementById('bianca-reference')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
}
function pickFunction(index: number) {
  selected.value = index
  if (!isOpen(index)) toggle(index)
}
const preview = ref<BiancaPreview | null>(null)

function hydrate(source: BiancaAssessment | null) {
  Object.assign(header, blankHeader())
  if (source) {
    for (const name of Object.keys(blankHeader()) as (keyof BiancaHeader)[]) {
      (header as Record<string, unknown>)[name] = nullToUndefined(source[name])
    }
    functions.value = nullToUndefined(structuredClone(toRaw(source.functions))) as BiancaFunction[]
    org.value = {
      directorate: source.directorate ?? undefined,
      sub_directorate: source.sub_directorate ?? undefined,
      org_group: source.org_group ?? undefined,
    }
    mainPlace.value = source.main_location
    persons.bcm_coordinator = source.bcm_coordinator_user
    persons.bcm_alternate = source.bcm_alternate_user
  } else if (!functions.value.length) {
    functions.value = [emptyBiancaFunction(lookups.value?.periods.length ?? 8)]
  }
  selected.value = Math.min(selected.value, Math.max(functions.value.length - 1, 0))
  nextTick(() => {
    dirty.value = false
  })
}
hydrate(props.assessment ?? null)
/** A new BIA starts with the user's own Group and, from the database, where it works. */
let started = false
async function startNew() {
  if (started || props.assessment || !lookups.value) return
  started = true
  if (functions.value.length === 1 && !functions.value[0]!.name) {
    functions.value = [emptyBiancaFunction(lookups.value.periods.length)]
  }
  const own = lookups.value.organisation
  if (!org.value.org_group && own.org_group) {
    org.value = {
      directorate: own.directorate ?? undefined,
      sub_directorate: own.sub_directorate ?? undefined,
      org_group: own.org_group ?? undefined,
    }
    await fillMainLocation(org.value)
  }
  nextTick(() => {
    dirty.value = false
  })
}
watch(lookups, startNew, { immediate: true })

/** Main location (and its floor, when the building's occupants list has it) from the database. */
async function fillMainLocation(picked: BiancaOrg) {
  mainHint.value = null
  try {
    const found = await biancaApi.mainLocation(picked)
    if (!found.location) {
      // The location of the Group picked before doesn't belong to this one.
      header.main_location_id = undefined
      header.main_floor = undefined
      mainPlace.value = null
      mainHint.value = { text: `No location is known for ${picked.org_group} yet: pick it below.`, color: 'warning' }
      return
    }
    mainPlace.value = found.location
    header.main_location_id = found.location.id
    if (found.floor) header.main_floor = found.floor
    const from = {
      location: 'the location registered to the Group',
      occupants: 'the building\'s occupant list',
      people: 'where most of the Group\'s people work',
    }[found.source ?? 'location']
    mainHint.value = { text: `Filled from ${from}. Change it if it's wrong.`, color: 'muted' }
  } catch {
    mainHint.value = { text: 'The main location couldn\'t be looked up: pick it below.', color: 'warning' }
  }
}

function onOrgPicked(picked: BiancaOrg) {
  fillMainLocation(picked)
}

/**
 * The BCM Coordinator and Alternate are picked from the user directory. What the directory has
 * (name, NIK, phone, email) is filled in and locked; only what it lacks is typed. The API applies
 * the same rule when it saves.
 */
function onPerson(key: PersonKey, person: BiancaPerson | null) {
  persons[key] = person
  header[`${key}_id`] = person?.id
  header[key] = person?.name
  header[`${key}_nik`] = person?.nik ?? undefined
  header[`${key}_phone`] = person?.phone ?? undefined
  header[`${key}_email`] = person?.email ?? undefined
}

const PERSON_FIELDS = { nik: '_nik', phone: '_phone', email: '_email' } as const

/** From the directory, so not typed: the person was picked and the directory has a value. */
function locked(key: PersonKey, field: keyof typeof PERSON_FIELDS) {
  return !!persons[key]?.[field]
}

function personHelp(key: PersonKey, field: keyof typeof PERSON_FIELDS) {
  if (!persons[key]) return undefined
  return locked(key, field) ? undefined : 'Not in the user directory: type it.'
}

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
  const legacyFields = new Set<string>(BIANCA_STAFF)
  const raw = Object.fromEntries(Object.entries(toRaw(header)).filter(([name]) => !legacyFields.has(name)))
  const body = clean({ ...raw, ...toRaw(org.value), config_version_id: lookups.value?.config_version_id, functions: toRaw(functions.value) }) as BiancaInput
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
let previewSequence = 0
watch([header, org, functions], () => {
  dirty.value = true
  clearTimeout(timer)
  const sequence = ++previewSequence
  timer = setTimeout(async () => {
    try {
      const result = await biancaApi.calculate(previewInput(), saved.value?.id)
      if (sequence === previewSequence) preview.value = result
    } catch {
      // Half-typed values the API refuses: keep the last result until they are valid.
    }
  }, 600)
}, { deep: true })
onMounted(async () => {
  try {
    preview.value = await biancaApi.calculate(previewInput(), saved.value?.id)
  } catch {
    preview.value = null
  }
})
onBeforeUnmount(() => clearTimeout(timer))

// --- unsaved changes kept on this device ----------------------------------------------------
// What is typed is copied to this browser's storage as you go (localStorage, per user and per
// BIA), so a lost connection or a closed tab doesn't lose it: the form offers to bring it back.
// Saving the draft clears it. Nothing leaves the browser until the user saves.
interface Unsaved {
  at: string
  header: BiancaHeader
  org: BiancaOrg
  functions: BiancaFunction[]
  mainPlace: BiancaPlace | null
  persons: Record<PersonKey, BiancaPerson | null>
}
const { user } = useAuth()
function unsavedKey(id: number | 'new' | undefined = saved.value?.id ?? 'new') {
  return user.value ? `bianca:unsaved:${user.value.id}:${id}` : null
}
function readUnsaved(): Unsaved | null {
  const key = unsavedKey()
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as Unsaved : null
  } catch {
    return null
  }
}
function keepUnsaved() {
  const key = unsavedKey()
  if (!key || !editable.value || !dirty.value) return
  const copy: Unsaved = {
    at: new Date().toISOString(),
    header: toRaw(header),
    org: toRaw(org.value),
    functions: toRaw(functions.value),
    mainPlace: toRaw(mainPlace.value),
    persons: toRaw(persons),
  }
  try {
    localStorage.setItem(key, JSON.stringify(copy))
    keptAt.value = copy.at
  } catch {
    // Storage full or blocked (private window): the form still works, without the copy.
  }
}
function dropUnsaved(...ids: (number | 'new')[]) {
  const targets: (number | 'new')[] = ids.length ? ids : [saved.value?.id ?? 'new']
  for (const id of targets) {
    const key = unsavedKey(id)
    if (!key) continue
    try {
      localStorage.removeItem(key)
    } catch {
      // Nothing to clear.
    }
  }
  keptAt.value = null
}
/** When the last copy was kept on this device (shown next to "Unsaved changes"). */
const keptAt = ref<string | null>(null)
const KEPT_TIME = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'Asia/Jakarta' })
function keptTime(value: string) {
  return KEPT_TIME.format(new Date(value))
}
/** A copy newer than what the server has, offered when the form opens. */
const restorable = ref<Unsaved | null>(null)
let keepTimer: ReturnType<typeof setTimeout> | undefined
watch([header, org, functions], () => {
  clearTimeout(keepTimer)
  keepTimer = setTimeout(keepUnsaved, 800)
}, { deep: true })
function keepNow() {
  clearTimeout(keepTimer)
  keepUnsaved()
}
onMounted(() => {
  const copy = readUnsaved()
  if (!copy || !editable.value) return
  const server = saved.value?.updated_at ? Date.parse(saved.value.updated_at) : 0
  if (Date.parse(copy.at) > server) restorable.value = copy
  else dropUnsaved()
  window.addEventListener('pagehide', keepNow)
})
onBeforeUnmount(() => {
  keepNow()
  window.removeEventListener('pagehide', keepNow)
})
function restoreUnsaved() {
  const copy = restorable.value
  if (!copy) return
  Object.assign(header, blankHeader(), copy.header)
  org.value = copy.org
  functions.value = copy.functions.length ? copy.functions : functions.value
  mainPlace.value = copy.mainPlace
  persons.bcm_coordinator = copy.persons?.bcm_coordinator ?? null
  persons.bcm_alternate = copy.persons?.bcm_alternate ?? null
  selected.value = 0
  restorable.value = null
  nextTick(() => {
    dirty.value = true
  })
  toast.add({ title: 'Your unsaved changes are back', description: 'Save the draft to keep them.', color: 'success', icon: 'i-lucide-history' })
}
function discardUnsaved() {
  restorable.value = null
  dropUnsaved()
}

const totalStaff = computed(() => Object.values(header.personnel_counts).reduce<number>((sum, count) => sum + (Number(count) || 0), 0))
const grades = computed(() => lookups.value?.personnel_grades.filter((g) => g.active || (header.personnel_counts[g.code] ?? 0) > 0) ?? [])
/** The RA Questionnaire's two headings: Executive – Management (up to U9) and Non-executive. */
const gradeSections = computed(() => {
  const executive = grades.value.filter((g) => g.max_level != null && g.max_level <= 9)
  const others = grades.value.filter((g) => !executive.includes(g))
  return [
    { title: 'Executive – Management', grades: executive },
    { title: 'Non-executive', grades: others },
  ].filter((section) => section.grades.length)
})
/** The titles the workbook's notes give for each grade at CIMB Niaga. */
const GRADE_TITLES: Record<string, string> = {
  staff_senior: 'First VP, Senior VP, Executive VP',
  staff_middle: 'AVP, VP',
  staff_manager: 'Officer, AM, Manager, Senior Manager',
  staff_others: 'karyawan kontrak (contract) or karyawan outsource (outsourced)',
}
/** The workbook's note on a personnel grade, when it has one. */
function gradeNote(code: string) {
  return code in BIANCA_NOTES ? code as BiancaNoteKey : undefined
}

function addFunction() {
  if (!lookups.value) return
  functions.value.push(emptyBiancaFunction(lookups.value.periods.length))
  selected.value = functions.value.length - 1
  part.value = 'p1'
  opened.value = new Set([selected.value])
}

async function removeFunction(index: number) {
  const fn = functions.value[index]
  if (!await confirm({
    title: `Remove ${fn?.name || `Function ${index + 1}`}?`,
    description: 'Are you sure wants to remove?',
    confirmLabel: 'Remove',
    destructive: true,
  })) return
  functions.value.splice(index, 1)
  selected.value = Math.max(0, Math.min(selected.value, functions.value.length - 1))
  opened.value = new Set([selected.value])
}

function formError(error: unknown) {
  const { data } = (error ?? {}) as { data?: { details?: Record<string, string> } }
  return data?.details ? Object.values(data.details).join(' ') : apiErrorMessage(error)
}

/** The organisation structure picked before the draft existed, attached once it does. */
const pendingOrgStructure = ref<File | null>(null)
async function attachPending(result: BiancaAssessment) {
  const file = pendingOrgStructure.value
  if (!file) return result
  try {
    const attached = await biancaApi.uploadOrgStructure(result.id, file)
    pendingOrgStructure.value = null
    return attached
  } catch (error) {
    toast.add({ title: 'The draft is saved, but the organisation structure isn\'t attached', description: apiErrorMessage(error), color: 'warning', icon: 'i-lucide-paperclip' })
    return result
  }
}
/** An attach or remove answers with the BIA: take its file and warnings, keep what is typed. */
function onOrgStructure(result: BiancaAssessment) {
  if (!saved.value) return
  saved.value = { ...saved.value, org_structure: result.org_structure, warnings: result.warnings, updated_at: result.updated_at }
}

async function save(quiet = false) {
  saving.value = true
  failure.value = null
  try {
    const result = saved.value
      ? await biancaApi.update(saved.value.id, toInput())
      : await biancaApi.create(toInput())
    const wasNew = !saved.value
    saved.value = await attachPending(result)
    hydrate(saved.value)
    clearTimeout(keepTimer)
    dropUnsaved('new', result.id)
    if (!quiet) toast.add({ title: wasNew ? `Draft ${result.ref_no} created` : 'Draft saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', result)
    return result
  } catch (error) {
    keepNow()
    const offline = !(error as { statusCode?: number }).statusCode
    failure.value = offline
      ? 'Could not reach the server. Your changes are kept on this device: save again when you are back online.'
      : formError(error)
    return null
  } finally {
    saving.value = false
  }
}

async function submit() {
  if (!await confirm({
    title: 'Submit this BIA for approval?',
    description: 'This records the assigned signers and locks the draft. Each signer then approves it in turn in BIANCA > Approval, or returns it to you for changes.',
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
const problems = computed(() => (dirty.value ? [] : [...(saved.value?.problems ?? []), ...(saved.value?.approval_problems ?? [])]))
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

/** The notes under the workbook's tables: one per Part, for every function together. */
type NoteKey = 'loss_formula' | 'justification_regulatory' | 'justification_customer' | 'justification_rto' | 'justification_dependency'
const noteGroups: { part: BiancaPart, notes: readonly { key: NoteKey, label: string }[] }[] = [
  {
    part: 'p1',
    notes: [
      { key: 'loss_formula', label: 'How the financial loss is worked out' },
      { key: 'justification_regulatory', label: 'Justification of the regulatory scores' },
      { key: 'justification_customer', label: 'Justification of the customer scores' },
    ],
  },
  {
    part: 'p2a',
    notes: [{ key: 'justification_rto', label: 'Justification when an RTO reaches the Expected MTD' }],
  },
  {
    part: 'p2b',
    notes: [{ key: 'justification_dependency', label: 'Justification of a lower capacity or a longer MTD' }],
  },
]
function notesOf(value: BiancaPart) {
  return noteGroups.find((group) => group.part === value)?.notes ?? []
}
/** "1 function", "2 of 3 functions": where you are among the functions. */
const functionCount = computed(() => {
  const total = functions.value.length
  if (total <= 1) return `${total} function`
  return `${Math.min(selected.value + 1, total)} of ${total} functions`
})
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
        <span
          v-if="dirty && editable && keptAt"
          class="flex items-center gap-1 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-hard-drive-download"
            class="size-3.5"
          />
          Kept on this device at {{ keptTime(keptAt) }}
        </span>
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
      v-if="restorable"
      color="info"
      variant="subtle"
      icon="i-lucide-history"
      title="You have unsaved changes on this device"
      :description="`Kept on ${formatDateTime(restorable.at)}, after the last save. Bring them back, or discard them to keep what is saved.`"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Discard"
          @click="discardUnsaved"
        />
        <UButton
          icon="i-lucide-history"
          label="Restore"
          @click="restoreUnsaved"
        />
      </template>
    </UAlert>
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
          <h2 class="flex items-center gap-1.5 text-sm font-semibold">
            Section A · Group (general information about the work unit)
            <BiancaNote
              note="group"
              label="Section A"
            />
          </h2>
        </template>
        <div class="space-y-4">
          <BiancaOrgPicker
            v-model="org"
            :disabled="!editable"
            help="From the organisation in the system. Picking a Group fills the main location."
            @picked="onOrgPicked"
          />
          <BiancaField
            label="Group description"
            note="group_description"
          >
            <UTextarea
              v-model="header.group_description"
              class="w-full"
              :rows="3"
              :maxlength="long"
              :disabled="!editable"
            />
          </BiancaField>
          <div class="grid gap-4 sm:grid-cols-2">
            <BiancaField
              label="Main location"
              note="main_location"
            >
              <BiancaPicker
                v-model="header.main_location_id"
                kind="locations"
                :selected="mainPlace"
                :disabled="!editable"
                aria-label="Main location"
                @pick="mainHint = null"
              />
              <p
                v-if="mainHint && editable"
                class="mt-1 text-xs"
                :class="mainHint.color === 'warning' ? 'text-warning' : 'text-muted'"
              >
                {{ mainHint.text }}
              </p>
            </BiancaField>
            <UFormField label="Main location floor">
              <UInput
                v-model="header.main_floor"
                class="w-full"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="!editable"
              />
            </UFormField>
            <BiancaField
              label="Alternate location"
              note="alt_location"
            >
              <BiancaPicker
                v-model="header.alt_location_id"
                kind="locations"
                :selected="saved?.alt_location ?? null"
                :disabled="!editable"
                aria-label="Alternate location"
              />
            </BiancaField>
            <UFormField label="Alternate location floor">
              <UInput
                v-model="header.alt_floor"
                class="w-full"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="!editable"
              />
            </UFormField>
          </div>
          <BiancaField
            label="Recovery strategy"
            note="recovery_strategy"
          >
            <UTextarea
              v-model="header.recovery_strategy"
              class="w-full"
              :rows="3"
              :maxlength="long"
              :disabled="!editable"
            />
          </BiancaField>
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
          <BiancaField
            label="Name"
            note="bcm_person"
            class="sm:col-span-2"
            :help="!header[`${person.key}_id`] && header[person.key]
              ? 'Typed, not from the user directory. Pick the person to fill the rest from it.'
              : 'Pick from the user directory; the people of the chosen Group come first.'"
          >
            <BiancaPersonPicker
              v-model="header[`${person.key}_id`]"
              :selected="persons[person.key]"
              :typed-name="header[`${person.key}_id`] ? undefined : header[person.key]"
              :group="org.org_group"
              :disabled="!editable"
              :aria-label="person.title"
              @pick="onPerson(person.key, $event)"
            />
          </BiancaField>
          <UFormField
            v-for="field in ([['nik', 'NIK'], ['phone', 'Phone'], ['email', 'Email']] as const)"
            :key="field[0]"
            :label="field[1]"
            :help="personHelp(person.key, field[0])"
          >
            <UInput
              v-model="header[`${person.key}${PERSON_FIELDS[field[0]]}`]"
              :type="field[0] === 'email' ? 'email' : 'text'"
              class="w-full"
              :maxlength="field[0] === 'email' ? TEXT_LIMITS.name : TEXT_LIMITS.medium"
              :disabled="!editable || locked(person.key, field[0])"
              :trailing-icon="locked(person.key, field[0]) ? 'i-lucide-lock' : undefined"
            />
          </UFormField>
          <BiancaField
            v-if="person.key === 'bcm_coordinator'"
            label="Additional phone number"
            note-text="Only when the number in Phone is no longer active. Leave it empty when that number still works."
            help="Fill this only when the number in Phone is no longer active."
          >
            <UInput
              v-model="header.bcm_coordinator_phone_2"
              class="w-full"
              :maxlength="TEXT_LIMITS.medium"
              :disabled="!editable"
              placeholder="E.g. 0813-xxxx-xxxx"
            />
          </BiancaField>
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
            <BiancaField
              label="Does the risk assessment consider business continuity?"
              note="ra_considers_bc"
            >
              <USelect
                :model-value="header.ra_considers_bc == null ? undefined : header.ra_considers_bc ? 'Yes' : 'No'"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="!editable"
                @update:model-value="header.ra_considers_bc = $event === 'Yes'"
              />
            </BiancaField>
            <BiancaField
              label="Are the controls included in the risk assessment?"
              note="ra_controls_included"
            >
              <USelect
                :model-value="header.ra_controls_included == null ? undefined : header.ra_controls_included ? 'Yes' : 'No'"
                :items="lookups.yes_no"
                class="w-full"
                :disabled="!editable"
                @update:model-value="header.ra_controls_included = $event === 'Yes'"
              />
            </BiancaField>
          </div>
          <BiancaField
            label="Risk assessment tools"
            note="ra_tools"
          >
            <UTextarea
              v-model="header.ra_tools"
              class="w-full"
              :rows="2"
              :maxlength="long"
              :disabled="!editable"
            />
          </BiancaField>
          <BiancaField
            label="Justification"
            note="ra_justification"
            help="Needed when neither answer above is Yes."
          >
            <UTextarea
              v-model="header.ra_justification"
              class="w-full"
              :rows="2"
              :maxlength="long"
              :disabled="!editable"
            />
          </BiancaField>
        </div>
      </UCard>
    </div>

    <!-- RA Questionnaire -->
    <!-- RA Questionnaire: the workbook's sheet, top to bottom -->
    <div
      v-show="tab === 'ra'"
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <UCard>
        <template #header>
          <h2 class="text-sm font-semibold">
            Summary of the Group's total personnel and Risk Assessment questionnaire
          </h2>
        </template>

        <div class="max-w-2xl space-y-8">
          <!-- Whose -->
          <dl class="grid gap-3 rounded-md bg-elevated/50 p-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted">
                Sub directorate
              </dt>
              <dd class="font-medium">
                {{ org.sub_directorate || 'Pick it on the Sign off page' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Group
              </dt>
              <dd class="font-medium">
                {{ org.org_group || 'Pick it on the Sign off page' }}
              </dd>
            </div>
          </dl>

          <!-- 1. Number of personnel -->
          <section class="space-y-3">
            <div>
              <h3 class="flex items-center gap-1.5 text-sm font-semibold">
                <span class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">1</span>
                Number of personnel
              </h3>
            </div>
            <div class="overflow-hidden rounded-md border border-default">
              <table class="w-full text-sm">
                <thead class="bg-elevated/60 text-xs text-muted">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">
                      Grade / ranking
                    </th>
                    <th class="w-32 px-3 py-2 text-right font-medium">
                      # of personnel
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="section in gradeSections"
                    :key="section.title"
                  >
                    <tr class="border-t border-default bg-elevated/30">
                      <th
                        colspan="2"
                        class="px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-muted uppercase"
                      >
                        {{ section.title }}
                      </th>
                    </tr>
                    <template
                      v-for="grade in section.grades"
                      :key="grade.code"
                    >
                      <tr class="border-t border-default align-top">
                        <td class="px-3 py-2">
                          <span class="flex items-center gap-1.5 font-medium">
                            {{ biancaGradeLabel(grade) }}
                            <BiancaNote
                              v-if="gradeNote(grade.code)"
                              :note="gradeNote(grade.code)"
                              :label="grade.label"
                            />
                          </span>
                          <span
                            v-if="GRADE_TITLES[grade.code]"
                            class="text-xs text-muted"
                          >At CIMB Niaga: {{ GRADE_TITLES[grade.code] }}</span>
                        </td>
                        <td class="px-3 py-1.5">
                          <UInput
                            v-model.number="header.personnel_counts[grade.code]"
                            type="number"
                            min="0"
                            class="w-full"
                            :ui="{ base: 'text-right tabular-nums' }"
                            :disabled="!editable"
                            :aria-label="`Number of personnel, ${grade.label}`"
                          />
                        </td>
                      </tr>
                      <tr
                        v-if="grade.requires_note"
                        class="align-top"
                      >
                        <td
                          colspan="2"
                          class="px-3 pb-3"
                        >
                          <UFormField
                            :label="`${grade.label}: please specify`"
                            :help="(header.personnel_counts[grade.code] ?? 0) > 0 ? 'Required when there are any.' : undefined"
                          >
                            <UInput
                              v-model="header.personnel_notes[grade.code]"
                              class="w-full"
                              :maxlength="TEXT_LIMITS.name"
                              :disabled="!editable"
                              placeholder="E.g. 3 contract employees, 2 outsourced (vendor name)"
                            />
                          </UFormField>
                        </td>
                      </tr>
                    </template>
                  </template>
                </tbody>
                <tfoot>
                  <tr class="border-t-2 border-default bg-elevated/40">
                    <th class="px-3 py-2 text-left font-semibold">
                      <span class="flex items-center gap-1.5">
                        Total
                        <BiancaNote
                          note="staff_total"
                          label="Total staff"
                        />
                      </span>
                    </th>
                    <td class="px-3 py-2 text-right font-semibold tabular-nums">
                      {{ totalStaff }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <!-- 2. Organisation structure -->
          <section class="space-y-2">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
              <span class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">2</span>
              Organisation structure
            </h3>
            <p class="text-sm text-muted">
              The Group's current organisation structure (the one in force now).
            </p>
            <BiancaOrgStructure
              v-model:pending="pendingOrgStructure"
              :attachment="saved?.org_structure ?? null"
              :assessment-id="saved?.id"
              :disabled="!editable"
              @changed="onOrgStructure"
            />
          </section>

          <!-- 3. Risk assessment -->
          <section class="space-y-3">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
              <span class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">3</span>
              Risk assessment
            </h3>
            <BiancaField
              label="Has the Business Continuity Risk Assessment been completed for your location?"
              note="ra_completed"
            >
              <URadioGroup
                :model-value="header.ra_completed == null ? undefined : header.ra_completed ? 'Yes' : 'No'"
                :items="lookups.yes_no"
                orientation="horizontal"
                :disabled="!editable"
                @update:model-value="header.ra_completed = $event === 'Yes'"
              />
            </BiancaField>
            <UAlert
              v-if="header.ra_completed === false"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Not completed yet"
              description="The Head of Sub Directorate coordinates completing the Business Continuity Risk Assessment for your location, or check with BCM."
            />
          </section>
        </div>
      </UCard>

      <!-- What to fill in, beside the form (as SCCA's "How SCCA works") -->
      <UCard class="lg:sticky lg:top-4">
        <template #header>
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <UIcon
              name="i-lucide-lightbulb"
              class="size-4 text-primary"
            />
            What to fill in here
          </h2>
        </template>
        <ol class="space-y-4 text-sm">
          <li class="flex gap-2">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">1</span>
            <div class="space-y-1">
              <p class="font-medium">
                Number of personnel
              </p>
              <p class="text-muted">
                How many people of the Group are in each grade / ranking. Not sure of a grade? The CIMB Niaga titles under each one tell which, and ⓘ has the workbook's note.
              </p>
              <p class="text-muted">
                Others: contract (karyawan kontrak) or outsourced (karyawan outsource) staff, and say who they are.
              </p>
              <p class="text-muted">
                The total should match the Group's current organisation chart.
              </p>
            </div>
          </li>
          <li class="flex gap-2">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">2</span>
            <div class="space-y-1">
              <p class="font-medium">
                Organisation structure
              </p>
              <p class="text-muted">
                Attach the Group's organisation chart in force now (PDF, image, PowerPoint, Word, Excel or Visio, up to 10 MB). Attaching another replaces it.
              </p>
            </div>
          </li>
          <li class="flex gap-2">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">3</span>
            <div class="space-y-1">
              <p class="font-medium">
                Risk assessment
              </p>
              <p class="text-muted">
                Yes when the Business Continuity Risk Assessment of your location is done. If No, the Head of Sub Directorate coordinates completing it, or check with BCM.
              </p>
            </div>
          </li>
        </ol>
        <template #footer>
          <p class="text-xs text-muted">
            The grade list comes from BIA configuration {{ lookups.config_version }}; BCM keeps it.
          </p>
        </template>
      </UCard>
    </div>

    <!-- Business functions -->
    <div
      v-show="tab === 'functions'"
      class="grid items-start gap-6"
      :class="referenceShown
        ? 'lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_22rem]'
        : 'lg:grid-cols-[18rem_minmax(0,1fr)]'"
    >
      <UCard
        class="self-start lg:sticky lg:top-4"
        :ui="{ body: 'p-2 sm:p-2' }"
      >
        <p class="px-2 pb-2 text-xs text-muted">
          {{ functionCount }}
        </p>
        <ul class="space-y-1">
          <li
            v-for="item in functionItems"
            :key="item.value"
          >
            <div class="flex items-center gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="isOpen(item.value) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                :aria-label="`${isOpen(item.value) ? 'Hide' : 'Show'} the parts of ${item.label}`"
                :aria-expanded="isOpen(item.value)"
                @click="toggle(item.value)"
              />
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-elevated"
                :class="item.value === selected ? 'bg-elevated font-medium text-primary' : ''"
                @click="pickFunction(item.value)"
              >
                <span class="truncate">{{ item.label }}</span>
                <UIcon
                  v-if="functionDone(item.value)"
                  name="i-lucide-circle-check-big"
                  class="size-4 shrink-0 text-success"
                  aria-label="Every part filled"
                />
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
            </div>
            <ul
              v-if="isOpen(item.value)"
              class="mt-0.5 mb-1 ms-7 space-y-0.5 border-s border-default ps-2"
            >
              <li
                v-for="entry in BIANCA_PARTS"
                :key="entry.value"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-elevated"
                  :class="item.value === selected && entry.value === part ? 'bg-primary/10 font-medium text-primary' : 'text-muted'"
                  :aria-current="item.value === selected && entry.value === part ? 'step' : undefined"
                  @click="openPart(item.value, entry.value)"
                >
                  <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
                  <UIcon
                    :name="partsDone[item.value]?.[entry.value] ? 'i-lucide-check' : 'i-lucide-circle-dashed'"
                    class="size-3.5 shrink-0"
                    :class="partsDone[item.value]?.[entry.value] ? 'text-success' : 'text-dimmed'"
                    :aria-label="partsDone[item.value]?.[entry.value] ? 'Filled' : 'Not filled yet'"
                  />
                </button>
              </li>
            </ul>
          </li>
        </ul>
        <UButton
          v-if="editable"
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
            v-model:part="part"
            :reference-open="referenceShown"
            :lookups="lookups"
            :preview="preview?.functions[selected] ?? null"
            :disabled="!editable"
            @toggle-reference="toggleReference"
          >
            <template #notes="{ part: shown }">
              <div
                v-if="notesOf(shown).length"
                class="space-y-3 rounded-md border border-dashed border-default p-3"
              >
                <div>
                  <h4 class="text-sm font-semibold">
                    Notes under the table
                  </h4>
                  <p class="text-xs text-muted">
                    As at the bottom of the sheet in the workbook: one for every function together, so it shows the same under each function.
                  </p>
                </div>
                <UFormField
                  v-for="note in notesOf(shown)"
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
            </template>
          </BiancaFunctionEditor>
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

      <!-- The workbook's REFERENCE for the part being filled, beside the form (below it on a
           narrower screen) -->
      <aside
        v-if="referenceShown"
        class="lg:col-span-2 xl:sticky xl:top-4 xl:col-span-1 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto"
      >
        <BiancaReference
          :part="referencePart"
          :category-by-mtd="lookups.expected_mtd"
          @close="toggleReference"
        />
      </aside>
    </div>

    <!-- Appendix: the workbook's summary for BCM -->
    <UCard
      v-show="tab === 'appendix'"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <h2 class="text-sm font-semibold">
          Appendix · Business function criticality
        </h2>
        <p class="text-xs text-muted">
          For BCM: an overview of the business functions' criticality and their MTD. Filled in from Part 1 and Part 2a, nothing to type here.
        </p>
      </template>
      <div class="flex flex-wrap gap-x-6 gap-y-1 border-b border-default px-4 py-2 text-sm">
        <span><span class="text-muted">Sub directorate:</span> {{ org.sub_directorate || '—' }}</span>
        <span><span class="text-muted">Group:</span> {{ org.org_group || '—' }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-elevated/60 text-xs text-muted">
            <tr>
              <th class="w-12 px-4 py-2 font-medium">
                No.
              </th>
              <th class="px-4 py-2 font-medium">
                Business function
              </th>
              <th class="px-4 py-2 font-medium">
                Business function category
              </th>
              <th class="px-4 py-2 font-medium">
                Expected MTD
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="row in appendixRows"
              :key="row.index"
            >
              <td class="px-4 py-2 tabular-nums text-muted">
                {{ row.index + 1 }}
              </td>
              <td class="px-4 py-2">
                <button
                  type="button"
                  class="text-left font-medium text-primary hover:underline"
                  @click="openFunction(row.index)"
                >
                  {{ row.name }}
                </button>
              </td>
              <td class="px-4 py-2">
                <StatusBadge
                  v-if="row.category"
                  :scale="BIANCA_CATEGORY"
                  :value="row.category as keyof typeof BIANCA_CATEGORY"
                  size="sm"
                />
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </td>
              <td class="px-4 py-2">
                <button
                  v-if="row.expected_mtd"
                  type="button"
                  class="hover:underline"
                  @click="openFunction(row.index, 'p2a')"
                >
                  {{ row.expected_mtd }}
                </button>
                <span
                  v-else
                  class="text-muted"
                >Not picked yet (Part 2a)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard v-show="tab === 'approval'">
      <template #header>
        <h2 class="text-sm font-semibold">
          Approval template · {{ lookups.config_version }}
        </h2>
      </template>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          {{ lookups.guides.attestation }}
        </p>
        <UFormField
          v-for="(step, i) in lookups.signoff_steps"
          :key="step.code"
          :label="`${i + 1}. ${step.title}${step.required ? '' : ' (optional)'}`"
          :help="step.signer_mode === 'creator' ? 'The creator signs by submitting.' : step.signer_mode === 'fixed' ? 'Assigned by the configuration.' : 'Choose an active BIANCA user before submitting.'"
        >
          <p
            v-if="step.signer_mode === 'creator'"
            class="text-sm"
          >
            {{ saved?.created_by ?? 'Current user' }}
          </p>
          <UserPicker
            v-else
            :model-value="step.signer_mode === 'fixed' ? step.user_id : header.signoff_users[step.code] ?? step.user_id"
            :selected="lookups.signer_profiles?.[String(step.signer_mode === 'fixed' ? step.user_id : header.signoff_users[step.code] ?? step.user_id)] ?? null"
            permission="bianca.access"
            :disabled="!editable || step.signer_mode === 'fixed'"
            @update:model-value="header.signoff_users[step.code] = $event ?? null"
          />
        </UFormField>
        <template v-if="saved?.signoffs?.length">
          <USeparator />
          <h3 class="text-sm font-semibold">
            Where the sign-off stands
          </h3>
          <BiancaSignoffSteps :steps="saved.signoffs" />
          <UButton
            v-if="saved.status === 'in_approval'"
            :to="biancaApprovalPath(saved.id)"
            color="neutral"
            variant="outline"
            icon="i-lucide-badge-check"
            :label="saved.can_decide ? 'Open it in Approval to decide' : 'Open it in Approval'"
          />
        </template>
        <p
          v-else
          class="text-sm text-muted"
        >
          After Submit, each signer approves the BIA in turn (BIANCA > Approval), or returns it to you for changes.
        </p>
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
