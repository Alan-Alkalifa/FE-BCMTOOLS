<script setup lang="ts">
import BiancaReviewDialog from '~/components/bianca/BiancaReviewDialog.vue'
import type {
  BiancaComment,
  BiancaReviewSection,
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
const emit = defineEmits<{ saved: [assessment: BiancaAssessment, tab: string] }>()

const toast = useToast()
const confirm = useConfirm()
const { data: lookups } = useBiancaLookups(() => props.assessment?.id)

provide('bianca-guides', computed(() => lookups.value?.guides))
const editable = computed(() => !props.assessment || props.assessment.can_edit)
const saved = ref<BiancaAssessment | null>(props.assessment ?? null)
const saving = ref(false)
const submitting = ref(false)
const uploading = ref(false)

// --- As SCCA's record: activity, report, PDF, renewal, review comments ------------------------
const activityOpen = ref(false)
const pdf = useBiancaPdf()
const renewing = ref(false)
/** A final BIA: start its renewal (a draft copied from it, for its owner) and open the draft. */
async function startRenewal() {
  if (!saved.value) return
  if (!await confirm({
    title: 'Start the renewal of this BIA?',
    description: 'A new draft is copied from this final BIA (its functions and attachments too) for its owner to review, update and submit. This BIA stays final until the renewal is.',
    confirmLabel: 'Start renewal',
  })) return
  renewing.value = true
  try {
    const draft = await biancaApi.renew(saved.value.id)
    toast.add({ title: `Renewal ${draft.ref_no ?? ''} started`.trim(), color: 'success', icon: 'i-lucide-refresh-cw' })
    await navigateTo(biancaPath(draft.id))
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    toast.add({ title: 'Could not start the renewal', description: details ? Object.values(details).join(' ') : apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    renewing.value = false
  }
}
/** Days until a final BIA is due for review (negative: overdue). */
const renewalDays = computed(() => {
  const due = saved.value?.renewal_due
  if (!due) return null
  return Math.round((Date.parse(`${due}T00:00:00`) - new Date(new Date().toDateString()).getTime()) / 86_400_000)
})
function onComments(rows: BiancaComment[]) {
  if (saved.value) saved.value = { ...saved.value, comments: rows }
}
const failure = ref<string | null>(null)
const dirty = ref(false)
// Asks before leaving with unsaved edits; an in-app tab switch keeps them (docs/tabs.md).
useUnsavedChanges(dirty)

const tabs = [
  { label: 'Sign off page', value: 'sign', icon: 'i-lucide-signature' },
  { label: 'RA questionnaire', value: 'ra', icon: 'i-lucide-clipboard-list' },
  { label: 'Business functions', value: 'functions', icon: 'i-lucide-workflow' },
  { label: 'Appendix', value: 'appendix', icon: 'i-lucide-table-2' },
  { label: 'Approval template', value: 'approval', icon: 'i-lucide-signature' },
]
const route = useRoute()
/** The tab open: the one in the address (?tab=) when the page opens, e.g. right after the first save. */
const tab = ref(tabs.some((item) => item.value === route.query.tab) ? String(route.query.tab) : 'sign')

function blankHeader(): BiancaHeader {
  const header = {} as Record<string, unknown>
  for (const name of BIANCA_HEADER_TEXT) header[name] = undefined
  for (const name of BIANCA_HEADER_BOOL) header[name] = undefined
  for (const name of BIANCA_STAFF) header[name] = undefined
  header.main_location_id = undefined
  header.main_location_mode = undefined
  header.alt_location_id = undefined
  header.alt_location_mode = undefined
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
const locationLabels = computed(() => lookups.value?.office_location_labels ?? { work_from_home: 'Work From Home', hyspace: 'Hyspace' })
let mainLookup = 0
function onMainChoice() {
  mainLookup++
  mainHint.value = null
}
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
// Appendix: each function opens its report; one, some or all can be exported to Excel.
const exporter = useBiancaExport()
const picked = ref<number[]>([])
const allPicked = computed(() => appendixRows.value.length > 0 && picked.value.length === appendixRows.value.length)
function togglePick(index: number, on: boolean) {
  picked.value = on ? [...new Set([...picked.value, index])].sort((a, b) => a - b) : picked.value.filter((item) => item !== index)
}
function toggleAll(on: boolean) {
  picked.value = on ? appendixRows.value.map((row) => row.index) : []
}
/** The report and the export read the saved BIA: save what is typed first. */
async function savedFirst() {
  if (!saved.value) {
    toast.add({ title: 'Save the draft first', description: 'The report and the Excel export are made from the saved BIA.', color: 'warning', icon: 'i-lucide-save' })
    return false
  }
  if (dirty.value && editable.value) {
    if (!await confirm({
      title: 'Save your changes first?',
      description: 'You have changes that are only kept on this device. The report, the PDF and the Excel export are made from what is saved, so save them first to see them there.',
      confirmLabel: 'Save and continue',
    })) return false
    if (!await save(true)) return false
  }
  return true
}
/** The header's View report and PDF: made from the saved BIA, so save what is typed first. */
async function viewReport() {
  if (!await savedFirst()) return
  await navigateTo(biancaReportPath(saved.value!.id))
}
async function downloadPdf() {
  if (!await savedFirst()) return
  await pdf.run(saved.value!.id)
}
async function openReport(index: number) {
  if (!await savedFirst()) return
  await navigateTo(biancaReportPath(saved.value!.id, index + 1))
}
async function exportFunctions(indexes?: number[]) {
  if (!await savedFirst()) return
  await exporter.run(saved.value!.id, indexes?.map((index) => index + 1))
}

async function openFunction(index: number, value: BiancaPart = 'p1') {
  if (!await goTab('functions')) return
  openPart(index, value)
}
// The guidance panel (the workbook's REFERENCE): closed at first; Show Guidance opens it.
const referenceOpen = ref(false)
/** Part 4's sheet has no REFERENCE box. */
const referenceShown = computed(() => referenceOpen.value && part.value !== 'p4')
const referencePart = computed(() => (part.value === 'p4' ? 'p3' : part.value) as 'p1' | 'p2a' | 'p2b' | 'p3')
// A hint at Show Guidance, 2.5 seconds after the Business functions open: "Got it!" keeps it
// quiet for 24 hours on this device.
const HINT_KEY = 'bianca:guidance-hint-until'
const HINT_QUIET_MS = 24 * 60 * 60 * 1000
const guidanceHint = ref(false)
let hintTimer: ReturnType<typeof setTimeout> | undefined
function hintQuiet() {
  try {
    return Number(localStorage.getItem(HINT_KEY) || 0) > Date.now()
  } catch {
    return false
  }
}
function pageLoaded() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'complete') resolve()
    else window.addEventListener('load', () => resolve(), { once: true })
  })
}
const hintWanted = () => tab.value === 'functions' && !referenceOpen.value && part.value !== 'p4' && !hintQuiet()
async function scheduleHint() {
  clearTimeout(hintTimer)
  guidanceHint.value = false
  if (!import.meta.client || !hintWanted()) return
  await pageLoaded()
  hintTimer = setTimeout(() => {
    if (hintWanted()) guidanceHint.value = true
  }, 2500)
}
function quietHint() {
  guidanceHint.value = false
  try {
    localStorage.setItem(HINT_KEY, String(Date.now() + HINT_QUIET_MS))
  } catch { /* shown again next time */ }
}
watch(tab, scheduleHint)
watch(referenceOpen, (open) => {
  if (open) guidanceHint.value = false
})
onMounted(scheduleHint)
onBeforeUnmount(() => clearTimeout(hintTimer))
function toggleReference() {
  referenceOpen.value = !referenceOpen.value
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
  }
  // A draft always shows a function to fill in: a function not named yet isn't saved, so a
  // saved draft can come back with none.
  if (!functions.value.length && (!source || source.can_edit)) {
    functions.value = [emptyBiancaFunction(lookups.value?.periods.length ?? 8)]
  }
  selected.value = Math.min(selected.value, Math.max(functions.value.length - 1, 0))
  nextTick(() => {
    dirty.value = false
  })
}
hydrate(props.assessment ?? null)
/** The form has filled itself in (a saved BIA: at once; a new one: once startNew is done). */
const formReady = ref(!!props.assessment)
/** A new BIA starts with the user's own Group and, from the database, where it works. */
let started = false
async function startNew() {
  if (started || props.assessment || !lookups.value) return
  started = true
  if (functions.value.length === 1 && !functions.value[0]!.name) {
    functions.value = [emptyBiancaFunction(lookups.value.periods.length)]
  }
  // Head counts start at 0, so it's plain they are numbers to type.
  for (const grade of lookups.value.personnel_grades) {
    if (grade.active && header.personnel_counts[grade.code] == null) header.personnel_counts[grade.code] = 0
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
    formReady.value = true
  })
}
watch(lookups, startNew, { immediate: true })

/** Main location (and its floor, when the building's occupants list has it) from the database. */
async function fillMainLocation(picked: BiancaOrg) {
  mainHint.value = null
  const request = ++mainLookup
  if (header.main_location_mode) return
  try {
    const found = await biancaApi.mainLocation(picked)
    if (request !== mainLookup) return
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
    // The floor is a number from 1 (none known: typed by the user).
    header.main_floor = String(found.floor ?? '').match(/[1-9]\d*/)?.[0] ?? undefined
    const from = {
      location: 'the location registered to the Group',
      occupants: 'the building\'s occupant list',
      people: 'where most of the Group\'s people work',
    }[found.source ?? 'location']
    mainHint.value = { text: `Filled from ${from}. Change it if it's wrong.`, color: 'muted' }
  } catch {
    if (request === mainLookup) mainHint.value = { text: 'The main location couldn\'t be looked up: pick it below.', color: 'warning' }
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
const PERSON_DETAILS = [['nik', 'NIK'], ['phone', 'Phone'], ['email', 'Email']] as const
/** The other role (a person can't be both). */
function otherRole(key: PersonKey): PersonKey {
  return key === 'bcm_coordinator' ? 'bcm_alternate' : 'bcm_coordinator'
}
const samePerson = computed(() => header.bcm_coordinator_id != null && header.bcm_coordinator_id === header.bcm_alternate_id)
/** What the box under a detail says when it's empty. */
function missingDetail(key: PersonKey, field: keyof typeof PERSON_FIELDS) {
  if (!header[`${key}_id`]) return 'Pick the person to fill it in.'
  return field === 'phone' ? 'Not in the user directory: give it as the additional phone.' : 'Not in the user directory: ask an admin to add it in Users.'
}

// Sign Off Page, risk assessment: Yes / No as cards, and what the answers ask for next.
type RaKey = 'ra_considers_bc' | 'ra_controls_included'
const YES_NO = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
]
function yesNo(key: RaKey) {
  return header[key] == null ? undefined : header[key] ? 'Yes' : 'No'
}
function setYesNo(key: RaKey, value: unknown) {
  header[key] = value === 'Yes'
}
const raNeedsJustification = computed(() => header.ra_considers_bc === false && header.ra_controls_included === false)
const signRaStatus = computed(() => {
  const considers = header.ra_considers_bc
  const controls = header.ra_controls_included
  if (considers == null || controls == null) {
    return { tone: 'neutral', icon: 'i-lucide-info', title: 'Answer both questions', lines: ['Yes to the first: name the risk assessment tools.', 'No to both: justify it.'] }
  }
  if (raNeedsJustification.value) {
    return { tone: 'warning', icon: 'i-lucide-triangle-alert', title: 'Business continuity isn\'t in your risk assessment', lines: ['Justify why it is neither considered in the risk assessment process nor included in the risk score cards / profiling.'] }
  }
  return { tone: 'success', icon: 'i-lucide-circle-check', title: 'Business continuity is part of your risk assessment', lines: [
    considers
      ? (header.ra_tools?.trim() ? `Tools: ${header.ra_tools.trim()}` : 'Name the risk assessment tools used (e.g. ShARP, ORMS).')
      : 'Not considered in the risk assessment process yet.',
    controls ? 'Business continuity controls are in the risk score cards / profiling.' : 'Business continuity controls aren\'t in the risk score cards / profiling yet.',
  ] }
})
const TONE = {
  neutral: { box: 'border-default bg-elevated/40', text: 'text-highlighted' },
  success: { box: 'border-success/40 bg-success/5', text: 'text-success' },
  warning: { box: 'border-warning/40 bg-warning/5', text: 'text-warning' },
} as const

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
  // A function not named yet is still empty (its parts open once it has a name): not sent.
  const named = toRaw(functions.value).filter((fn) => fn.name?.trim())
  const body = clean({ ...raw, ...toRaw(org.value), config_version_id: lookups.value?.config_version_id, functions: named }) as BiancaInput
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
  if (!key || !unsavedChecked || !editable.value || !dirty.value) return
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
/** When a copy kept on this device was brought back as the form opened (shown with Discard). */
const restoredAt = ref<string | null>(null)
/** Copies are kept only once the form has checked for one: the form filling itself in as it
 * opens (the Group, its location) must not overwrite what was kept before a refresh. */
let unsavedChecked = false
let keepTimer: ReturnType<typeof setTimeout> | undefined
watch([header, org, functions], () => {
  clearTimeout(keepTimer)
  keepTimer = setTimeout(keepUnsaved, 800)
}, { deep: true })
function keepNow() {
  clearTimeout(keepTimer)
  keepUnsaved()
}
/** A copy newer than what the server has is brought back by itself (a refresh, a lost
 * connection); an older one is dropped. Runs once, when the form has filled itself in. */
function checkUnsaved() {
  if (unsavedChecked || !user.value || !editable.value || !formReady.value) return
  unsavedChecked = true
  const copy = readUnsaved()
  if (!copy) return
  const server = saved.value?.updated_at ? Date.parse(saved.value.updated_at) : 0
  if (Date.parse(copy.at) <= server) {
    dropUnsaved()
    return
  }
  Object.assign(header, blankHeader(), copy.header)
  org.value = copy.org
  functions.value = copy.functions.length ? copy.functions : functions.value
  mainPlace.value = copy.mainPlace
  persons.bcm_coordinator = copy.persons?.bcm_coordinator ?? null
  persons.bcm_alternate = copy.persons?.bcm_alternate ?? null
  selected.value = 0
  restoredAt.value = copy.at
  keptAt.value = copy.at
  nextTick(() => nextTick(() => {
    dirty.value = true
  }))
}
watch([user, formReady], checkUnsaved)
onMounted(() => {
  checkUnsaved()
  window.addEventListener('pagehide', keepNow)
})
onBeforeUnmount(() => {
  keepNow()
  window.removeEventListener('pagehide', keepNow)
})
/** Back to what is saved (or a blank new BIA): the copy on this device is dropped. */
function discardUnsaved() {
  restoredAt.value = null
  dropUnsaved()
  if (saved.value) {
    hydrate(saved.value)
  } else {
    functions.value = []
    hydrate(null)
    started = false
    formReady.value = false
    startNew()
  }
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
/** RA Questionnaire, risk assessment: the two answers, and what each one means. */
const RA_ANSWERS = [
  { label: 'Yes', value: 'Yes', description: 'Completed for our location' },
  { label: 'No', value: 'No', description: 'Not completed yet' },
]
const raStatus = computed(() => {
  if (header.ra_completed === true) {
    return {
      box: 'border-success/40 bg-success/5',
      text: 'text-success',
      icon: 'i-lucide-circle-check',
      title: 'Risk assessment: completed',
      lines: ['The Business Continuity Risk Assessment of your location is done. Nothing more to do here.'],
    }
  }
  if (header.ra_completed === false) {
    return {
      box: 'border-warning/40 bg-warning/5',
      text: 'text-warning',
      icon: 'i-lucide-triangle-alert',
      title: 'Risk assessment: not completed yet',
      lines: [
        'The Head of Sub Directorate coordinates completing the Business Continuity Risk Assessment for your location.',
        'Not sure who handles it? Check with BCM.',
      ],
    }
  }
  return {
    box: 'border-default bg-elevated/40',
    text: 'text-highlighted',
    icon: 'i-lucide-info',
    title: 'Not answered yet',
    lines: [
      'Yes: the Business Continuity Risk Assessment of your location is done.',
      'No: the Head of Sub Directorate coordinates completing it, or check with BCM.',
    ],
  }
})
/** Sign Off Page: what each part asks for (the workbook's own notes, in short). */
const SIGN_GUIDE = [
  { title: 'Section A · the Group', text: 'Directorate, Sub Directorate and Group come from the organisation in the system. Describe what the Group does.' },
  { title: 'Work locations', text: 'The building and floor the Group works from, and where it works when that one can\'t be used. The address comes from the building master.' },
  { title: 'Recovery strategy', text: 'Write the Group\'s recovery strategy at a high level.' },
  { title: 'BCM Coordinator and Alternate', text: 'Two different people, picked from the user directory: their NIK, phone and email are filled in and locked. Give an additional phone only when the one there is no longer active.' },
  { title: 'Risk assessment', text: 'Yes to the first question: name the tools (e.g. ShARP, ORMS). No to both: justify it.' },
]
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

/** The API's refusal: each field it names with what is wrong, e.g. "Function 1 · Part 1 · ...: ...". */
function formError(error: unknown) {
  const { data } = (error ?? {}) as { data?: { details?: Record<string, string> } }
  return data?.details ? biancaFieldErrors(data.details).join('\n') : apiErrorMessage(error)
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
  saved.value = { ...saved.value, org_structure: result.org_structure, problems: result.problems, warnings: result.warnings, updated_at: result.updated_at }
}

// The RA Questionnaire is all required: the next tabs open once it is filled in.
const TAB_ORDER = tabs.map((item) => item.value)
const raTried = ref(false)
function blankCount(code: string) {
  const value = header.personnel_counts[code] as number | string | null | undefined
  return value == null || value === '' || Number.isNaN(Number(value)) || Number(value) < 0
}
function noteMissing(grade: { code: string, requires_note: boolean }) {
  return grade.requires_note && (Number(header.personnel_counts[grade.code]) || 0) > 0
    && !header.personnel_notes[grade.code]?.trim()
}
const orgStructureMissing = computed(() => !saved.value?.org_structure && !pendingOrgStructure.value)
const raMissing = computed(() => {
  const found: string[] = []
  for (const grade of grades.value) {
    if (blankCount(grade.code)) found.push(`Number of personnel: ${grade.label}`)
    else if (noteMissing(grade)) found.push(`${grade.label}: please specify`)
  }
  if (!grades.value.some((grade) => blankCount(grade.code)) && totalStaff.value <= 0) {
    found.push('Number of personnel: the total is 0')
  }
  if (orgStructureMissing.value) found.push('Organisation structure')
  if (header.ra_completed == null) found.push('Risk assessment')
  return found
})
// --- "Is this correct?" before going on -----------------------------------------------------
const reviewDialog = useOverlay().create(BiancaReviewDialog)
/** The building picked on each side, by name (the form keeps only its id). */
const placeLabel = reactive<{ main: string | null, alt: string | null }>({ main: null, alt: null })
const answer = (value: boolean | null | undefined) => (value == null ? null : value ? 'Yes' : 'No')
function locationText(side: 'main' | 'alt') {
  const mode = header[`${side}_location_mode`]
  const id = header[`${side}_location_id`]
  const known = side === 'main' ? mainPlace.value : saved.value?.alt_location
  const name = placeLabel[side] ?? (known?.id === id ? known?.label : null) ?? (id ? `Building #${id}` : null)
  if (mode === 'work_from_home') return locationLabels.value.work_from_home
  if (mode === 'hyspace') return name ? `${locationLabels.value.hyspace}: ${name}` : locationLabels.value.hyspace
  const floor = header[`${side}_floor`]
  return name ? `${name}${floor ? `, floor ${floor}` : ''}` : null
}
function personText(key: PersonKey) {
  const phone = [header[`${key}_phone`], header[`${key}_phone_2`]].filter(Boolean).join(' / ')
  return [header[key], header[`${key}_nik`] && `NIK ${header[`${key}_nik`]}`, phone, header[`${key}_email`]].filter(Boolean).join('\n') || null
}
function signReview(): BiancaReviewSection {
  return {
    title: 'Sign off page',
    rows: [
      { label: 'Directorate', value: org.value.directorate },
      { label: 'Sub directorate', value: org.value.sub_directorate },
      { label: 'Group', value: org.value.org_group },
      { label: 'Group description', value: header.group_description },
      { label: 'Main location', value: locationText('main') },
      { label: 'Alternate location', value: locationText('alt') },
      { label: 'Group recovery strategy', value: header.recovery_strategy },
      { label: 'BCM Coordinator', value: personText('bcm_coordinator') },
      { label: 'Alternate BCM Coordinator', value: personText('bcm_alternate') },
      { label: 'Business continuity in the risk assessment', value: answer(header.ra_considers_bc) },
      ...(header.ra_considers_bc ? [{ label: 'Risk assessment tools', value: header.ra_tools }] : []),
      { label: 'Business continuity controls in the risk score cards', value: answer(header.ra_controls_included) },
      ...(raNeedsJustification.value ? [{ label: 'Justification', value: header.ra_justification }] : []),
    ],
  }
}
function raReview(): BiancaReviewSection {
  return {
    title: 'RA questionnaire',
    rows: [
      ...grades.value.map((grade) => ({ label: grade.label, value: String(header.personnel_counts[grade.code] ?? 0) })),
      ...grades.value
        .filter((grade) => grade.requires_note && (Number(header.personnel_counts[grade.code]) || 0) > 0)
        .map((grade) => ({ label: `${grade.label}: please specify`, value: header.personnel_notes[grade.code] })),
      { label: 'Total personnel', value: String(totalStaff.value) },
      { label: 'Organisation structure', value: saved.value?.org_structure?.filename ?? pendingOrgStructure.value?.name },
      { label: 'Risk assessment completed for the location', value: answer(header.ra_completed) },
    ],
  }
}

/** A floor is a whole number from 1 (null: missing or not one). */
function floorOk(value: string | undefined) {
  return value && /^[1-9]\d*$/.test(value.trim()) ? value : null
}

// The Sign off page is all required too, as Submit asks.
const signTried = ref(false)
const signMissing = computed(() => {
  const found: { key: string, label: string }[] = []
  const need = (key: string, label: string, ok: unknown) => {
    if (ok == null || ok === '' || (typeof ok === 'string' && !ok.trim())) found.push({ key, label })
  }
  need('org', 'Directorate, Sub Directorate and Group', org.value.org_group)
  need('group_description', 'Group description', header.group_description)
  if (!header.main_location_mode) {
    need('main_location_id', 'Main location building', header.main_location_id)
    need('main_floor', 'Main location floor', floorOk(header.main_floor))
  }
  if (!header.alt_location_mode) {
    need('alt_location_id', 'Alternate location building', header.alt_location_id)
    need('alt_floor', 'Alternate location floor', floorOk(header.alt_floor))
  }
  need('recovery_strategy', 'Group recovery strategy', header.recovery_strategy)
  for (const person of people) {
    need(`${person.key}_id`, person.title, header[`${person.key}_id`])
    if (header[`${person.key}_id`] && !header[`${person.key}_phone`]) {
      need(`${person.key}_phone_2`, `${person.title}: additional phone (the directory has no phone)`, header[`${person.key}_phone_2`])
    }
  }
  if (samePerson.value) found.push({ key: 'bcm_alternate_id', label: 'Alternate BCM Coordinator: another person' })
  need('ra_considers_bc', 'Risk assessment question 1', header.ra_considers_bc)
  if (header.ra_considers_bc) need('ra_tools', 'Risk assessment tools used', header.ra_tools)
  need('ra_controls_included', 'Risk assessment question 2', header.ra_controls_included)
  if (raNeedsJustification.value) need('ra_justification', 'Risk assessment justification', header.ra_justification)
  return found
})
const signMissingKeys = computed(() => new Set(signMissing.value.map((item) => item.key)))
/** The error under a required Sign off field, once Next was tried. */
function signError(key: string, text = 'Required.') {
  return signTried.value && signMissingKeys.value.has(key) ? text : undefined
}

/** The tabs to be filled in, in order, before the ones after them open. */
const gates = computed(() => [
  { tab: 'sign', tried: signTried, missing: signMissing.value.map((item) => item.label), title: 'Fill in the sign off page first', at: '#bianca-sign' },
  { tab: 'ra', tried: raTried, missing: raMissing.value, title: 'Fill in the RA questionnaire first', at: '#bianca-ra' },
])
/** Opens a tab: past the Sign off page and the RA questionnaire only once they are filled in, and
 * into the Business functions once the draft is saved. */
async function goTab(value: string | number) {
  const target = String(value)
  const to = TAB_ORDER.indexOf(target)
  if (editable.value) {
    for (const gate of gates.value) {
      if (to <= TAB_ORDER.indexOf(gate.tab) || !gate.missing.length) continue
      gate.tried.value = true
      tab.value = gate.tab
      toast.add({
        id: 'bianca-tab-missing',
        title: gate.title,
        description: `Still empty: ${gate.missing.join(', ')}.`,
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
      nextTick(() => document.querySelector(`${gate.at} [data-missing="true"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return false
    }
    // Going on from the Sign off page or the RA questionnaire: is what was filled in correct?
    // Into the Business functions, it is saved as a draft first.
    const current = tab.value
    const from = TAB_ORDER.indexOf(current)
    if (from < to && (current === 'sign' || current === 'ra')) {
      const sections: BiancaReviewSection[] = []
      if (current === 'sign') sections.push(signReview())
      if (to > TAB_ORDER.indexOf('ra')) sections.push(raReview())
      const saveToo = to >= TAB_ORDER.indexOf('functions') && (dirty.value || !saved.value)
      const ok = (await reviewDialog.open({
        title: 'Is this correct?',
        description: saveToo
          ? 'Check what you filled in. It is saved as a draft, then the Business functions open; you can still change it later.'
          : 'Check what you filled in before going on; you can still change it later.',
        sections,
        confirmLabel: saveToo ? 'Yes, save and continue' : 'Yes, continue',
      }).result) === true
      if (!ok) return false
      if (saveToo) {
        tab.value = target
        if (!await save()) {
          tab.value = current
          return false
        }
        return true
      }
    }
  }
  tab.value = target
  return true
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
    // Saved: not dirty any more before the page moves on (a new BIA opens at its address), or
    // leaving would ask to discard changes that are saved.
    await nextTick()
    dirty.value = false
    clearTimeout(keepTimer)
    dropUnsaved('new', result.id)
    if (!quiet) toast.add({ title: wasNew ? `Draft ${result.ref_no} created` : 'Draft saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved.value, tab.value)
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
    // Pages that read this BIA (the report, its tab here) now show it locked for approval.
    refreshNuxtData(`bianca-assessment-${result.id}`)
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
  emit('saved', result, tab.value)
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
      { key: 'loss_formula', label: 'Formula for Calculating Potential Financial Loss' },
      { key: 'justification_regulatory', label: 'Justification of the regulatory scores' },
      { key: 'justification_customer', label: 'Justification of the customer scores' },
    ],
  },
  {
    part: 'p2a',
    notes: [{ key: 'justification_rto', label: 'Justification when an RTO reaches the Expected MTD' }],
  },
]
function notesOf(value: BiancaPart) {
  // Part 2b's justification is asked on each upstream / downstream; the sheet's one box shows
  // only when an Excel upload filled it.
  if (value === 'p2b') {
    return header.justification_dependency?.trim()
      ? [{ key: 'justification_dependency' as const, label: 'Justification of a lower capacity or a longer MTD (from the Excel upload)' }]
      : []
  }
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
      <div class="flex flex-wrap gap-2">
        <template v-if="saved">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-history"
            label="Activity"
            @click="activityOpen = true"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-file-text"
            label="View report"
            @click="viewReport"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-file-down"
            label="PDF"
            :loading="pdf.busy.value"
            @click="downloadPdf"
          />
          <UButton
            v-if="saved.can_renew && !saved.renewal"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="Start renewal"
            :loading="renewing"
            @click="startRenewal"
          />
        </template>
      </div>
      <div
        v-if="editable"
        class="flex w-full flex-wrap justify-end gap-2 sm:w-auto"
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
      v-if="restoredAt && editable"
      color="info"
      variant="subtle"
      icon="i-lucide-history"
      title="Your unsaved changes are back"
      :description="`Kept on this device at ${formatDateTime(restoredAt)} (e.g. before a refresh or a lost connection). Save the draft to keep them, or discard them to go back to what is saved.`"
      :close="{ color: 'neutral', variant: 'link' }"
      @update:open="restoredAt = null"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Discard"
          @click="discardUnsaved"
        />
      </template>
    </UAlert>
    <!-- Whose it is, and its renewal -->
    <UAlert
      v-if="saved && saved.my_role === 'group' && saved.status === 'draft'"
      color="neutral"
      variant="subtle"
      icon="i-lucide-eye"
      title="Your Group's draft (read only)"
      :description="`${saved.created_by ?? 'Its owner'} is filling it in; you can read it and follow its activity.`"
    />
    <UAlert
      v-if="saved?.renewal_of"
      color="info"
      variant="subtle"
      icon="i-lucide-refresh-cw"
      :title="`This draft renews ${saved.renewal_of.ref_no ?? 'a final BIA'}`"
      description="It started as a copy of the final BIA: review every tab, update what changed, and submit it."
      :actions="[{ label: `Open ${saved.renewal_of.ref_no ?? 'the final BIA'}`, color: 'info', variant: 'outline', to: biancaPath(saved.renewal_of.id) }]"
    />
    <UAlert
      v-if="saved?.status === 'final' && saved.renewal"
      color="info"
      variant="subtle"
      icon="i-lucide-refresh-cw"
      :title="`Its renewal ${saved.renewal.ref_no ?? ''} is ${saved.renewal.status === 'in_approval' ? 'in approval' : 'in progress'}`.replace('  ', ' ')"
      :actions="[{ label: 'Open the renewal', color: 'info', variant: 'outline', to: biancaPath(saved.renewal.id) }]"
    />
    <UAlert
      v-else-if="saved?.status === 'final' && renewalDays !== null && renewalDays <= 90"
      :color="renewalDays < 0 ? 'error' : 'warning'"
      variant="subtle"
      icon="i-lucide-calendar-clock"
      :title="renewalDays < 0 ? `Review overdue by ${-renewalDays} days` : `Due for review in ${renewalDays} days`"
      :description="`Valid until ${formatDate(saved.renewal_due)}. Start its renewal to review it.`"
    />

    <BiancaActivityDialog
      v-if="saved"
      v-model:open="activityOpen"
      :events="saved.events"
      :ref-no="saved.ref_no"
    />

    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="failure.includes('\n') ? 'Check these fields:' : failure"
      :description="failure.includes('\n') ? failure : undefined"
      :ui="{ description: 'whitespace-pre-line' }"
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
      :model-value="tab"
      :items="tabs"
      :content="false"
      variant="link"
      class="overflow-x-auto"
      @update:model-value="goTab"
    />

    <BiancaTabComments
      v-show="tab === 'sign'"
      :assessment-id="saved?.id"
      tab="sign"
      :comments="saved?.comments"
      :can-comment="saved?.can_comment"
      @changed="onComments"
    />
    <!-- Sign Off Page: the workbook's sheet, top to bottom, with what to fill in beside it -->
    <div
      v-show="tab === 'sign'"
      id="bianca-sign"
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div class="min-w-0 space-y-6">
        <!-- Section A -->
        <UCard>
          <template #header>
            <h2 class="flex items-center gap-1.5 text-sm font-semibold">
              Section A · General information of the Group
              <BiancaNote
                note="group"
                label="Section A"
              />
            </h2>
            <p class="text-xs text-muted">
              Informasi umum unit kerja / Group
            </p>
          </template>
          <div class="space-y-5">
            <BiancaOrgPicker
              v-model="org"
              :disabled="!editable"
              :locked="editable && lookups.can_pick_group === false"
              help="From the organisation in the system. Picking a Group fills the main location."
              :data-missing="!!signError('org')"
              @picked="onOrgPicked"
            />
            <p
              v-if="signError('org')"
              class="text-sm text-error"
            >
              Pick the Directorate, Sub Directorate and Group.
            </p>
            <BiancaField
              label="Group description"
              note="group_description"
              help="Describe the main functions of the Group."
              required
              :error="signError('group_description')"
              :data-missing="!!signError('group_description')"
            >
              <UTextarea
                v-model="header.group_description"
                class="w-full"
                :rows="3"
                :maxlength="long"
                :disabled="!editable"
                placeholder="What the Group does"
              />
            </BiancaField>
          </div>
        </UCard>

        <!-- Work locations -->
        <UCard>
          <template #header>
            <h2 class="text-sm font-semibold">
              Work locations
            </h2>
            <p class="text-xs text-muted">
              Lokasi kerja utama dan alternatif: building and floor
            </p>
          </template>
          <div class="grid gap-6 sm:grid-cols-2">
            <BiancaLocationField
              v-model:mode="header.main_location_mode"
              v-model:site="header.main_location_id"
              v-model:floor="header.main_floor"
              label="Main location"
              note="main_location"
              :labels="locationLabels"
              :selected="mainPlace"
              :disabled="!editable"
              :building-error="signError('main_location_id')"
              :floor-error="signError('main_floor', 'Type the floor: a number from 1.')"
              class="rounded-md border border-default p-3"
              @place="placeLabel.main = $event"
              @change="onMainChoice"
            >
              <p
                v-if="mainHint && editable"
                class="mt-1 text-xs"
                :class="mainHint.color === 'warning' ? 'text-warning' : 'text-muted'"
              >
                {{ mainHint.text }}
              </p>
            </BiancaLocationField>
            <BiancaLocationField
              v-model:mode="header.alt_location_mode"
              v-model:site="header.alt_location_id"
              v-model:floor="header.alt_floor"
              label="Alternate location"
              note="alt_location"
              :labels="locationLabels"
              :selected="saved?.alt_location"
              :disabled="!editable"
              :building-error="signError('alt_location_id')"
              :floor-error="signError('alt_floor', 'Type the floor: a number from 1.')"
              class="rounded-md border border-default p-3"
              @place="placeLabel.alt = $event"
            />
          </div>
        </UCard>

        <!-- Recovery strategy -->
        <UCard>
          <template #header>
            <h2 class="flex items-center gap-1.5 text-sm font-semibold">
              Group recovery strategy
              <BiancaNote
                note="recovery_strategy"
                label="Recovery strategy"
              />
            </h2>
            <p class="text-xs text-muted">
              Strategi pemulihan dari Group
            </p>
          </template>
          <BiancaField
            label="High-level recovery strategy"
            help="Write the Group's high-level recovery strategy."
            required
            :error="signError('recovery_strategy')"
            :data-missing="!!signError('recovery_strategy')"
          >
            <UTextarea
              v-model="header.recovery_strategy"
              class="w-full"
              :rows="3"
              :maxlength="long"
              :disabled="!editable"
              placeholder="How the Group recovers, at a high level"
            />
          </BiancaField>
        </UCard>

        <!-- BCM Coordinator and Alternate -->
        <UCard>
          <template #header>
            <h2 class="flex items-center gap-1.5 text-sm font-semibold">
              BCM Coordinator and Alternate BCM Coordinator
              <BiancaNote
                note="bcm_person"
                label="BCM Coordinator"
              />
            </h2>
            <p class="text-xs text-muted">
              Two different people, picked from the user directory. Their NIK, phone and email come from it.
            </p>
          </template>
          <UAlert
            v-if="samePerson"
            color="error"
            variant="subtle"
            icon="i-lucide-users"
            title="The same person is picked twice"
            description="The BCM Coordinator and the Alternate BCM Coordinator must be two different people. Pick another Alternate."
            class="mb-4"
          />
          <div class="grid gap-6 sm:grid-cols-2">
            <section
              v-for="person in people"
              :key="person.key"
              class="space-y-3"
            >
              <h3 class="flex items-center gap-2 text-sm font-medium">
                <UIcon
                  :name="person.key === 'bcm_coordinator' ? 'i-lucide-user-round-check' : 'i-lucide-user-round'"
                  class="size-4 text-muted"
                />
                {{ person.title }}
              </h3>
              <UFormField
                label="Name"
                required
                :error="person.key === 'bcm_alternate' && samePerson ? 'Pick someone other than the BCM Coordinator.' : signError(`${person.key}_id`, 'Pick the person.')"
                :data-missing="!!signError(`${person.key}_id`)"
              >
                <BiancaPersonPicker
                  v-model="header[`${person.key}_id`]"
                  :selected="persons[person.key]"
                  :typed-name="header[`${person.key}_id`] ? undefined : header[person.key]"
                  :group="org.org_group"
                  :exclude-id="header[`${otherRole(person.key)}_id`]"
                  :disabled="!editable"
                  :aria-label="person.title"
                  @pick="onPerson(person.key, $event)"
                />
              </UFormField>
              <p
                v-if="!header[`${person.key}_id`] && header[person.key]"
                class="text-xs text-warning"
              >
                Typed in an Excel upload, not from the user directory: pick the person to confirm.
              </p>
              <dl class="divide-y divide-default rounded-md border border-default bg-elevated/30 text-sm">
                <div
                  v-for="field in PERSON_DETAILS"
                  :key="field[0]"
                  class="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <dt class="flex shrink-0 items-center gap-1 text-muted">
                    <UIcon
                      name="i-lucide-lock"
                      class="size-3"
                    />
                    {{ field[1] }}
                  </dt>
                  <dd class="min-w-0 text-right">
                    <span
                      v-if="header[`${person.key}${PERSON_FIELDS[field[0]]}`]"
                      class="break-all"
                    >{{ header[`${person.key}${PERSON_FIELDS[field[0]]}`] }}</span>
                    <span
                      v-else
                      class="text-xs text-dimmed"
                    >{{ missingDetail(person.key, field[0]) }}</span>
                  </dd>
                </div>
              </dl>
              <BiancaField
                label="Additional phone number"
                note-text="Only when the number in Phone is no longer active (or the directory has none). Leave it empty when that number still works."
                :help="header[`${person.key}_id`] && !header[`${person.key}_phone`] ? 'Required: the directory has no phone for this person.' : 'Only when the phone above is no longer active.'"
                :required="!!header[`${person.key}_id`] && !header[`${person.key}_phone`]"
                :error="signError(`${person.key}_phone_2`, 'Give a phone number.')"
                :data-missing="!!signError(`${person.key}_phone_2`)"
              >
                <UInput
                  v-model="header[`${person.key}_phone_2`]"
                  class="w-full"
                  :maxlength="TEXT_LIMITS.medium"
                  :disabled="!editable"
                  icon="i-lucide-phone"
                  placeholder="E.g. 0813-xxxx-xxxx"
                />
              </BiancaField>
            </section>
          </div>
        </UCard>

        <!-- Risk assessment -->
        <UCard>
          <template #header>
            <h2 class="text-sm font-semibold">
              Risk assessment
            </h2>
            <p class="text-xs text-muted">
              Is business continuity part of your risk assessment?
            </p>
          </template>
          <div class="space-y-6">
            <section class="space-y-3">
              <BiancaField
                label="1. Have you considered business continuity in your risk assessment process?"
                note="ra_considers_bc"
                required
                :error="signError('ra_considers_bc', 'Answer Yes or No.')"
                :data-missing="!!signError('ra_considers_bc')"
              >
                <URadioGroup
                  :model-value="yesNo('ra_considers_bc')"
                  :items="YES_NO"
                  variant="card"
                  orientation="horizontal"
                  :disabled="!editable"
                  :ui="{ item: 'flex-1' }"
                  @update:model-value="setYesNo('ra_considers_bc', $event)"
                />
              </BiancaField>
              <BiancaField
                v-if="header.ra_considers_bc"
                label="Risk assessment tools used"
                note="ra_tools"
                help="Name the tools used to identify and assess risk."
                class="border-s-2 border-primary/40 ps-3"
                required
                :error="signError('ra_tools')"
                :data-missing="!!signError('ra_tools')"
              >
                <UTextarea
                  v-model="header.ra_tools"
                  class="w-full"
                  :rows="2"
                  :maxlength="long"
                  :disabled="!editable"
                  placeholder="E.g. ShARP, ORMS"
                />
              </BiancaField>
            </section>
            <section class="space-y-3">
              <BiancaField
                label="2. Have you included business continuity controls in the risk score cards / profiling?"
                note="ra_controls_included"
                required
                :error="signError('ra_controls_included', 'Answer Yes or No.')"
                :data-missing="!!signError('ra_controls_included')"
              >
                <URadioGroup
                  :model-value="yesNo('ra_controls_included')"
                  :items="YES_NO"
                  variant="card"
                  orientation="horizontal"
                  :disabled="!editable"
                  :ui="{ item: 'flex-1' }"
                  @update:model-value="setYesNo('ra_controls_included', $event)"
                />
              </BiancaField>
            </section>
            <BiancaField
              v-if="raNeedsJustification || header.ra_justification"
              label="Justification"
              note="ra_justification"
              :help="raNeedsJustification ? 'Required: both answers are No.' : 'Only needed when both answers are No.'"
              :required="raNeedsJustification"
              :error="signError('ra_justification')"
              :data-missing="!!signError('ra_justification')"
            >
              <UTextarea
                v-model="header.ra_justification"
                class="w-full"
                :rows="3"
                :maxlength="long"
                :disabled="!editable"
                placeholder="Why business continuity isn't considered or included yet, and what is planned"
              />
            </BiancaField>
            <div
              class="rounded-md border p-3"
              :class="TONE[signRaStatus.tone as keyof typeof TONE].box"
              role="status"
            >
              <p
                class="flex items-center gap-2 text-sm font-medium"
                :class="TONE[signRaStatus.tone as keyof typeof TONE].text"
              >
                <UIcon
                  :name="signRaStatus.icon"
                  class="size-4"
                />
                {{ signRaStatus.title }}
              </p>
              <ul class="mt-2 list-disc space-y-0.5 ps-5 text-sm text-muted">
                <li
                  v-for="line in signRaStatus.lines"
                  :key="line"
                >
                  {{ line }}
                </li>
              </ul>
            </div>
          </div>
        </UCard>

        <!-- Business Function Criticality: filled in by itself from Part 1 & 2, as the workbook does -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <h2 class="text-sm font-semibold">
              Business function criticality
            </h2>
            <p class="text-xs text-muted">
              Filled in by itself once Part 1 and Part 2 are done (read only).
            </p>
          </template>
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
                    MTD
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="row in appendixRows.filter((item) => functions[item.index]?.name?.trim())"
                  :key="row.index"
                >
                  <td class="px-4 py-2 tabular-nums text-muted">
                    {{ row.index + 1 }}
                  </td>
                  <td class="px-4 py-2">
                    {{ row.name }}
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
                    {{ row.expected_mtd ?? '—' }}
                  </td>
                </tr>
                <tr v-if="!functions.some((fn) => fn.name?.trim())">
                  <td
                    colspan="4"
                    class="px-4 py-3 text-muted"
                  >
                    No business function yet: they show here once added in Business functions.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <div
          v-if="editable"
          class="flex flex-wrap items-center justify-between gap-3"
        >
          <p
            class="text-xs"
            :class="signMissing.length ? 'text-muted' : 'text-success'"
          >
            <template v-if="signMissing.length">
              <span class="text-error">*</span> Required. The RA questionnaire opens once all is filled in.
            </template>
            <template v-else>
              All filled in.
            </template>
          </p>
          <UButton
            trailing-icon="i-lucide-arrow-right"
            label="Next: RA questionnaire"
            @click="goTab('ra')"
          />
        </div>
      </div>

      <!-- What to fill in, beside the form -->
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
          <li
            v-for="(item, i) in SIGN_GUIDE"
            :key="item.title"
            class="flex gap-2"
          >
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{{ i + 1 }}</span>
            <div class="space-y-1">
              <p class="font-medium">
                {{ item.title }}
              </p>
              <p class="text-muted">
                {{ item.text }}
              </p>
            </div>
          </li>
        </ol>
        <template #footer>
          <p class="text-xs text-muted">
            The BIA helps the Directorate / Sub Directorate / Group set the Maximum Tolerable Downtime (MTD) of its business functions, the recovery priorities and the resources recovery needs.
          </p>
        </template>
      </UCard>
    </div>

    <!-- RA Questionnaire -->
    <BiancaTabComments
      v-show="tab === 'ra'"
      :assessment-id="saved?.id"
      tab="ra"
      :comments="saved?.comments"
      :can-comment="saved?.can_comment"
      @changed="onComments"
    />
    <!-- RA Questionnaire: the workbook's sheet, top to bottom -->
    <div
      v-show="tab === 'ra'"
      id="bianca-ra"
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <UCard>
        <template #header>
          <h2 class="text-sm font-semibold">
            Summary of the Group's total persoanel and Risk Assessment questionnaire
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
                Number of personel
                <span class="text-error">*</span>
              </h3>
              <p class="text-xs text-muted">
                Fill every grade; put 0 where the Group has none.
              </p>
            </div>
            <div class="overflow-hidden rounded-md border border-default">
              <table class="w-full text-sm">
                <thead class="bg-elevated/60 text-xs text-muted">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">
                      Grade / ranking
                    </th>
                    <th class="w-32 px-3 py-2 text-right font-medium">
                      # of personnel <span class="text-error">*</span>
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
                            step="1"
                            inputmode="numeric"
                            placeholder="0"
                            class="w-full"
                            :ui="{ base: 'text-right tabular-nums placeholder:text-default' }"
                            :color="raTried && blankCount(grade.code) ? 'error' : undefined"
                            :highlight="raTried && blankCount(grade.code)"
                            :data-missing="raTried && blankCount(grade.code)"
                            :disabled="!editable"
                            :aria-label="`Number of personnel, ${grade.label}`"
                          />
                        </td>
                      </tr>
                      <!-- Asked only when there are any (e.g. Others) -->
                      <tr
                        v-if="grade.requires_note && (Number(header.personnel_counts[grade.code]) || 0) > 0"
                        class="align-top"
                      >
                        <td
                          colspan="2"
                          class="px-3 pb-3"
                        >
                          <UFormField
                            :label="`${grade.label}: please specify`"
                            required
                            help="Who they are, e.g. contract or outsourced staff."
                            :error="raTried && noteMissing(grade) ? 'Say who they are.' : undefined"
                            :data-missing="raTried && noteMissing(grade)"
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
            <p
              v-if="raTried && totalStaff <= 0 && !grades.some((grade) => blankCount(grade.code))"
              class="text-sm text-error"
              data-missing="true"
            >
              The total can't be 0: give the Group's personnel by grade.
            </p>
          </section>

          <!-- 2. Organisation structure -->
          <section class="space-y-2">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
              <span class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">2</span>
              Organisation structure
              <span class="text-error">*</span>
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
            <p
              v-if="raTried && orgStructureMissing"
              class="text-sm text-error"
              data-missing="true"
            >
              Attach the Group's organisation structure.
            </p>
          </section>

          <!-- 3. Risk assessment -->
          <section class="space-y-3">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
              <span class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">3</span>
              Risk assessment
              <span class="text-error">*</span>
            </h3>
            <BiancaField
              label="Has the Business Continuity Risk Assessment been completed for your location?"
              note="ra_completed"
              required
              :error="raTried && header.ra_completed == null ? 'Answer Yes or No.' : undefined"
              :data-missing="raTried && header.ra_completed == null"
            >
              <URadioGroup
                :model-value="header.ra_completed == null ? undefined : header.ra_completed ? 'Yes' : 'No'"
                :items="RA_ANSWERS"
                variant="card"
                orientation="horizontal"
                :disabled="!editable"
                :ui="{ item: 'flex-1' }"
                @update:model-value="header.ra_completed = $event === 'Yes'"
              />
            </BiancaField>
            <!-- What the answer means, in the way SCCA's gap check reads -->
            <div
              class="rounded-md border p-3"
              :class="raStatus.box"
              role="status"
            >
              <p
                class="flex items-center gap-2 text-sm font-medium"
                :class="raStatus.text"
              >
                <UIcon
                  :name="raStatus.icon"
                  class="size-4"
                />
                {{ raStatus.title }}
              </p>
              <ul class="mt-2 list-disc space-y-0.5 ps-5 text-sm text-muted">
                <li
                  v-for="line in raStatus.lines"
                  :key="line"
                >
                  {{ line }}
                </li>
              </ul>
              <p
                v-if="header.ra_completed === false"
                class="mt-2 text-xs text-muted"
              >
                This doesn't block Submit: BCM sees the answer on the BIA. Change it to Yes once the assessment is done.
              </p>
            </div>
          </section>
        </div>

        <template
          v-if="editable"
          #footer
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p
              class="text-xs"
              :class="raMissing.length ? 'text-muted' : 'text-success'"
            >
              <template v-if="raMissing.length">
                <span class="text-error">*</span> Required. Business functions opens once all is filled in.
              </template>
              <template v-else>
                All filled in.
              </template>
            </p>
            <UButton
              trailing-icon="i-lucide-arrow-right"
              label="Next: Business functions"
              @click="goTab('functions')"
            />
          </div>
        </template>
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
                Number of personel
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

    <BiancaTabComments
      v-show="tab === 'functions'"
      :assessment-id="saved?.id"
      tab="functions"
      :comments="saved?.comments"
      :can-comment="saved?.can_comment"
      @changed="onComments"
    />
    <!-- Business functions: whose they are, as each sheet of the workbook heads it (read only) -->
    <dl
      v-show="tab === 'functions'"
      class="grid gap-3 rounded-md border border-default bg-elevated/50 px-4 py-3 text-sm sm:grid-cols-3"
    >
      <div
        v-for="item in [
          { label: 'Directorate', value: org.directorate },
          { label: 'Sub directorate', value: org.sub_directorate },
          { label: 'Group', value: org.org_group },
        ]"
        :key="item.label"
      >
        <dt class="text-xs text-muted">
          {{ item.label }}
        </dt>
        <dd class="font-medium">
          {{ item.value || 'Pick it on the Sign off page' }}
        </dd>
      </div>
    </dl>

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
          <BiancaFunctionEditor
            :key="selected"
            v-model="currentFunction"
            v-model:part="part"
            v-model:hint="guidanceHint"
            :reference-open="referenceShown"
            :lookups="lookups"
            :preview="preview?.functions[selected] ?? null"
            :disabled="!editable"
            @toggle-reference="toggleReference"
            @quiet-hint="quietHint"
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
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-6"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <aside
          v-if="referenceShown"
          class="lg:col-span-2 xl:sticky xl:top-4 xl:col-span-1 xl:max-h-[calc(100vh-9.5rem)] xl:overflow-y-auto"
        >
          <BiancaReference
            :part="referencePart"
            :lookups="lookups"
            @close="toggleReference"
          />
        </aside>
      </Transition>
    </div>

    <BiancaTabComments
      v-show="tab === 'appendix'"
      :assessment-id="saved?.id"
      tab="appendix"
      :comments="saved?.comments"
      :can-comment="saved?.can_comment"
      @changed="onComments"
    />
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
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-2 text-sm">
        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <span><span class="text-muted">Sub directorate:</span> {{ org.sub_directorate || '—' }}</span>
          <span><span class="text-muted">Group:</span> {{ org.org_group || '—' }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-file-spreadsheet"
            :label="picked.length ? `Export ${picked.length} selected to Excel` : 'Export selected to Excel'"
            :disabled="!picked.length"
            :loading="exporter.busy.value"
            @click="exportFunctions(picked)"
          />
          <UButton
            size="sm"
            icon="i-lucide-file-spreadsheet"
            label="Export all to Excel"
            :disabled="!appendixRows.length"
            :loading="exporter.busy.value"
            @click="exportFunctions()"
          />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-elevated/60 text-xs text-muted">
            <tr>
              <th class="w-10 px-4 py-2">
                <UCheckbox
                  :model-value="allPicked ? true : picked.length ? 'indeterminate' : false"
                  aria-label="Select every function"
                  :disabled="!appendixRows.length"
                  @update:model-value="toggleAll($event === true)"
                />
              </th>
              <th class="w-12 px-2 py-2 font-medium">
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
              <th class="w-48 px-4 py-2 font-medium">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="row in appendixRows"
              :key="row.index"
              :class="picked.includes(row.index) ? 'bg-primary/5' : ''"
            >
              <td class="px-4 py-2">
                <UCheckbox
                  :model-value="picked.includes(row.index)"
                  :aria-label="`Select ${row.name}`"
                  @update:model-value="togglePick(row.index, $event === true)"
                />
              </td>
              <td class="px-2 py-2 tabular-nums text-muted">
                {{ row.index + 1 }}
              </td>
              <td class="px-4 py-2">
                <button
                  type="button"
                  class="text-left font-medium text-primary hover:underline"
                  :title="`Open the report of ${row.name}`"
                  @click="openReport(row.index)"
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
                <span v-if="row.expected_mtd">{{ row.expected_mtd }}</span>
                <span
                  v-else
                  class="text-muted"
                >Not picked yet (Part 2a)</span>
              </td>
              <td class="px-4 py-2">
                <div class="flex justify-end gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-file-spreadsheet"
                    label="Excel"
                    :aria-label="`Export ${row.name} to Excel`"
                    :disabled="exporter.busy.value"
                    @click="exportFunctions([row.index])"
                  />
                  <UButton
                    v-if="editable"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-pencil"
                    :aria-label="`Edit ${row.name} in the form`"
                    @click="openFunction(row.index)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <p class="text-xs text-muted">
          Click a function for its report. The Excel export is the BIA workbook (Template BIA Ver 2.4), filled in with the saved BIA.
        </p>
      </template>
    </UCard>

    <BiancaTabComments
      v-show="tab === 'approval'"
      :assessment-id="saved?.id"
      tab="approval"
      :comments="saved?.comments"
      :can-comment="saved?.can_comment"
      @changed="onComments"
    />
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
          :help="step.signer_mode === 'creator' ? 'The creator signs by submitting.' : step.bcm_role ? `Eligible signers: active ${bcmRoleLabel(step.bcm_role)} assignments with BIA access.` : step.signer_mode === 'fixed' ? 'Assigned by the configuration.' : 'Choose an active BIANCA user before submitting.'"
        >
          <p
            v-if="step.signer_mode === 'creator'"
            class="text-sm"
          >
            {{ saved?.created_by ?? 'Current user' }}
          </p>
          <UserPicker
            v-else
            :endpoint="bcmSignerEndpoint(step.bcm_role)"
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
