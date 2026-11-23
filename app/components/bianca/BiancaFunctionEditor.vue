<script setup lang="ts">
import type { BiancaItDependency, BiancaLookups, BiancaPreview, BiancaFunction } from '~/composables/useBianca'
import type { BiancaListKey } from '~/composables/useBiancaConfigAdmin'
import { BIANCA_PARTS, biancaPartInfo, type BiancaPart } from '~/utils/biancaParts'

/**
 * One business function across the workbook's parts: 1 impact, 2a IT dependency, 2b non-IT
 * dependency, 3 recovery strategies, 4 critical timings. What the workbook works out (category,
 * DAAT and its warnings) comes from `preview`, calculated by the API as you type.
 */
const fn = defineModel<BiancaFunction>({ required: true })
const props = defineProps<{
  lookups: BiancaLookups
  preview?: BiancaPreview['functions'][number] | null
  disabled?: boolean
  /** The reference panel beside the form (BiancaForm) is open. */
  referenceOpen?: boolean
}>()
const emit = defineEmits<{ 'toggle-reference': [], 'quiet-hint': [] }>()
/** The hint at Show Guidance ("You can see the details here"), shown by the form. */
const hint = defineModel<boolean>('hint', { default: false })

type Mode = 'master' | 'other' | 'na'

/** The part shown, picked in the function list of the form (BiancaForm). */
const part = defineModel<BiancaPart>('part', { default: 'p1' })
const info = computed(() => biancaPartInfo(part.value))
const partIndex = computed(() => BIANCA_PARTS.findIndex((item) => item.value === part.value))
const previousPart = computed(() => BIANCA_PARTS[partIndex.value - 1] ?? null)
const nextPart = computed(() => BIANCA_PARTS[partIndex.value + 1] ?? null)
const confirm = useConfirm()
defineSlots<{
  /** The notes of the BIA (for every function together) that go with this part. */
  notes?: (props: { part: BiancaPart }) => unknown
}>()

/** On to the next part, once the user confirms (nothing is locked: they can come back). */
// Part 1 is all required: the other parts open once it is filled in.
const toast = useToast()
const p1Tried = ref(false)
const blankValue = (value: unknown) => value == null || value === '' || (typeof value === 'number' && Number.isNaN(value))
function blankCell(name: 'loss' | 'regulatory_scores' | 'customer_scores', index: number) {
  return blankValue(fn.value[name]?.[index])
}
const p1Missing = computed(() => {
  const found: string[] = []
  const rows = [
    ['loss', 'Cumulative financial loss'],
    ['regulatory_scores', 'Regulatory impact (A) score'],
    ['customer_scores', 'Customer service impact (B) score'],
  ] as const
  for (const [name, label] of rows) {
    const empty = periods.value.filter((_, i) => blankCell(name, i))
    if (empty.length) found.push(`${label} (${empty.join(', ')})`)
  }
  if (blankValue(fn.value.suggested_mtd)) found.push('Suggested MTD')
  return found
})
/** Whether Part 1 may be left; if not, says what is empty. */
function part1Done() {
  if (props.disabled || !named.value || !p1Missing.value.length) return true
  p1Tried.value = true
  toast.add({
    id: 'bianca-p1-missing',
    title: 'Fill in Part 1 first',
    description: `Still empty: ${p1Missing.value.join('; ')}.`,
    color: 'error',
    icon: 'i-lucide-circle-alert',
  })
  return false
}
// Picked another part in the function list while Part 1 isn't filled in: back to Part 1.
watch(part, (value, old) => {
  if (old === 'p1' && value !== 'p1' && !part1Done()) part.value = 'p1'
})

async function goNext() {
  const next = nextPart.value
  if (!next) return
  if (part.value === 'p1' && !part1Done()) return
  if (!props.disabled && !await confirm({
    title: `Continue to ${next.label}?`,
    description: 'You can still change this part at any time.',
    confirmLabel: 'Continue',
  })) return
  part.value = next.value
}

const periods = computed(() => props.lookups.periods)
const modes = [
  { label: 'System from the list', value: 'master' },
  { label: 'Others (not in the list)', value: 'other' },
  { label: 'NA (no IT system)', value: 'na' },
]

function modeOf(row: BiancaItDependency): Mode {
  if (row.is_other) return 'other'
  if (!row.application_id && row.application_name === 'NA') return 'na'
  return 'master'
}

function setMode(row: BiancaItDependency, mode: Mode) {
  row.is_other = mode === 'other'
  row.application_id = undefined
  row.application_name = mode === 'na' ? 'NA' : undefined
  row.rto = undefined
  row.rpo = undefined
}

function pickApplication(row: BiancaItDependency, picked: { label: string, rto?: string | null, rpo?: string | null } | null) {
  row.application_name = picked?.label
  row.rto = picked?.rto ?? undefined
  row.rpo = picked?.rpo ?? undefined
}

function addIt() {
  if (fn.value.it_dependencies.length < props.lookups.it_slots) fn.value.it_dependencies.push({})
}

function daat(index: number) {
  return props.preview?.it_dependencies[index]
}

const losses = computed(() => fn.value.loss ?? [])
const nonNumeric = 'tabular-nums'
const sides = [
  {
    key: 'up',
    title: 'Upstream',
    name: 'Upstream',
    description: 'Who triggers the activity. Type NA as the name when there is none.',
  },
  {
    key: 'down',
    title: 'Downstream',
    name: 'Downstream',
    description: 'Who receives or processes your output / instruction. Type NA as the name when there is none.',
  },
] as const
type Side = typeof sides[number]['key']
type DependencyRow = Record<string, string | undefined>

/**
 * Part 2b keeps the workbook's rows: each row holds an upstream and a downstream side by side.
 * The form shows the two as their own lists; an entry is a row whose side has a name (an empty
 * string while it is being typed).
 */
function sideRows(side: Side) {
  return fn.value.dependencies
    .map((data, index) => ({ data: data as DependencyRow, index }))
    .filter((row) => row.data[`${side}_name`] != null)
}
function addSide(side: Side) {
  const free = fn.value.dependencies.findIndex((row) => (row as DependencyRow)[`${side}_name`] == null)
  if (free >= 0) (fn.value.dependencies[free] as DependencyRow)[`${side}_name`] = ''
  else if (fn.value.dependencies.length < props.lookups.dependency_slots) fn.value.dependencies.push({ [`${side}_name`]: '' })
}
const SIDE_FIELDS = ['name', 'capacity', 'mtd', 'sla', 'outsourced', 'material', 'justification'] as const
function removeSide(index: number, side: Side) {
  const row = fn.value.dependencies[index] as DependencyRow
  for (const field of SIDE_FIELDS) row[`${side}_${field}`] = undefined
  const other = side === 'up' ? 'down' : 'up'
  if (row[`${other}_name`] == null) fn.value.dependencies.splice(index, 1)
}
const isNaName = (value: string | undefined) => value?.trim().toUpperCase() === 'NA'
/** Why the entry needs a justification (lower capacity, longer MTD), as the API works it out. */
function justifyReasons(index: number, side: Side) {
  // The preview is worked out without the empty rows (see BiancaForm's toInput).
  const blank = (row: object) => Object.values(row).every((item) => item == null || (typeof item === 'string' && !item.trim()))
  const rows = fn.value.dependencies
  if (!rows[index] || blank(rows[index])) return []
  const at = rows.slice(0, index).filter((row) => !blank(row)).length
  return props.preview?.dependencies?.[at]?.[side] ?? []
}
const long = TEXT_LIMITS.long

/** Part 1's rule for the Suggested MTD, worked out from the impact typed so far. */
const ruleMtd = computed(() => props.preview?.recommended_suggested_mtd ?? null)

const recommendedSites = computed(() => props.lookups.alternate_site_by_category?.[props.preview?.category ?? ''] ?? [])

/** The choices of the BIA configuration, plus the value already chosen when it is no longer offered. */
function withCurrent(items: readonly string[], value: string | null | undefined) {
  return value && !items.includes(value) ? [value, ...items] : [...items]
}
function mtdChoices(items: readonly string[], selected: string | null | undefined) {
  return withCurrent(items, selected).map((value) => ({ value, label: props.lookups.mtd_options?.find((row) => row.value === value)?.label ?? value }))
}
function listChoices(key: BiancaListKey, items: readonly string[], current?: string | null) {
  const metadata = new Map(props.lookups.list_items?.[key]?.map((row) => [row.code, row.label]))
  return withCurrent(items, current).map((value) => ({ value, label: metadata.get(value) || value }))
}

/** The parts whose sheet has a REFERENCE box at the bottom (Part 4's has none). */
const hasReference = (value: string): value is 'p1' | 'p2a' | 'p2b' | 'p3' => ['p1', 'p2a', 'p2b', 'p3'].includes(value)

/** The parts can be filled once the function has a name (typed in Part 1). */
const named = computed(() => !!fn.value.name?.trim())
const off = computed(() => props.disabled || !named.value)

/**
 * What each sheet of the workbook shows from the earlier parts (its formula columns), read only:
 * the name, and e.g. Part 2a's Suggested MTD from Part 1.
 */
const carried = computed(() => {
  const category = props.preview?.category ?? null
  const fields: Record<BiancaPart, { label: string, value: string | null | undefined, from: string }[]> = {
    p1: [],
    p2a: [
      { label: 'Suggested MTD (hours / days)', value: fn.value.suggested_mtd, from: 'Part 1' },
    ],
    p2b: [
      { label: 'Expected MTD (hours / days)', value: fn.value.expected_mtd, from: 'Part 2a' },
    ],
    p3: [
      { label: 'Planned capacity (%) of the function', value: fn.value.planned_capacity, from: 'Part 2b' },
      { label: 'Business function category', value: category, from: 'Part 2a' },
      { label: 'Expected MTD (hours / days)', value: fn.value.expected_mtd, from: 'Part 2a' },
    ],
    p4: [
      { label: 'Business function category', value: category, from: 'Part 2a' },
    ],
  }
  return fields[part.value]
})
/** Part 2b's names offer the Groups of Master data > Organization structure. */
const groupListId = useId()
</script>

<template>
  <div class="@container space-y-4">
    <datalist :id="groupListId">
      <option value="NA" />
      <option
        v-for="group in lookups.org_groups ?? []"
        :key="group"
        :value="group"
      />
    </datalist>
    <!-- The sheet's heading in the workbook: title, objective and the instructions -->
    <div class="space-y-2 rounded-md border border-default bg-elevated/40 p-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted">
            Part {{ partIndex + 1 }} of {{ BIANCA_PARTS.length }}
          </p>
          <h3 class="text-sm font-semibold">
            {{ info.title }}
          </h3>
        </div>
        <!-- Open, the guidance panel closes from its own button -->
        <UPopover
          v-if="hasReference(part) && !referenceOpen"
          v-model:open="hint"
          :content="{ side: 'bottom', align: 'end', sideOffset: 4, onOpenAutoFocus: (event: Event) => event.preventDefault() }"
          arrow
        >
          <UButton
            color="neutral"
            variant="link"
            icon="i-lucide-book-open"
            label="Show Guidance"
            class="px-0"
            @click="hint = false; emit('toggle-reference')"
          />
          <template #content>
            <div class="max-w-60 space-y-2 p-3 text-xs">
              <div class="flex items-start gap-2">
                <UIcon
                  name="i-lucide-info"
                  class="mt-px size-4 shrink-0 text-primary"
                />
                <p>You can see the details here: the workbook's guidance for this part.</p>
              </div>
              <div class="flex justify-end">
                <UButton
                  size="xs"
                  label="Got it!"
                  @click="emit('quiet-hint')"
                />
              </div>
            </div>
          </template>
        </UPopover>
      </div>
      <p class="text-sm">
        <span class="font-medium">Objective:</span> {{ info.objective }}
      </p>
      <ul
        v-if="info.notes.length"
        class="list-disc space-y-0.5 ps-5 text-sm text-muted"
      >
        <li
          v-for="line in info.notes"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </div>

    <!-- The name: typed once, in Part 1; the other parts show it, read only, with what the
         workbook's sheet carries over from the earlier parts (its formula columns) -->
    <UFormField
      v-if="part === 'p1'"
      label="Name of business function"
      required
      help="Type it here, in Part 1; the other parts show it."
      class="max-w-2xl"
    >
      <UInput
        v-model="fn.name"
        class="w-full"
        :maxlength="TEXT_LIMITS.name"
        :disabled="disabled"
        placeholder="Name of the business function"
      />
    </UFormField>
    <div
      v-else
      class="rounded-md border border-default bg-elevated/50 px-4 py-3"
    >
      <p class="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted">
        <UIcon
          name="i-lucide-lock"
          class="size-3.5"
        />
        From the earlier parts · read only
      </p>
      <dl class="grid gap-x-6 gap-y-3 @xl:grid-cols-2 @3xl:grid-cols-4">
        <div
          v-for="field in [{ label: 'Name of business function', value: fn.name, from: 'Part 1' }, ...carried]"
          :key="field.label"
          class="min-w-0"
        >
          <dt class="text-xs text-muted">
            {{ field.label }}
          </dt>
          <dd
            v-if="field.value"
            class="mt-0.5 truncate text-sm font-medium text-highlighted"
          >
            {{ field.value }}
          </dd>
          <dd
            v-else
            class="mt-0.5 text-sm text-dimmed italic"
          >
            Not filled in {{ field.from }} yet
          </dd>
          <dd class="text-xs text-dimmed">
            From {{ field.from }}
          </dd>
        </div>
      </dl>
    </div>
    <UAlert
      v-if="!named && !disabled"
      color="warning"
      variant="subtle"
      icon="i-lucide-pencil-line"
      :title="part === 'p1' ? 'Type the name of the business function first' : 'This function has no name yet'"
      :description="part === 'p1' ? 'The parts open once the function has a name.' : 'Go to Part 1 and type its name; the parts open once it has one.'"
      :actions="part === 'p1' ? undefined : [{ label: 'Go to Part 1', color: 'warning', variant: 'outline', onClick: () => { part = 'p1' } }]"
    />

    <!-- Part 1 -->
    <section
      v-show="part === 'p1'"
      class="space-y-4"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[56rem] text-sm">
          <thead>
            <tr class="text-left text-xs text-muted">
              <!-- The row labels stay put while the periods scroll sideways -->
              <th class="sticky left-0 z-10 bg-default shadow-[1px_0_0_var(--ui-border)] w-48 py-1 pe-2 font-medium">
                &nbsp;
              </th>
              <th
                v-for="period in periods"
                :key="period"
                class="px-1 py-1 font-medium"
              >
                {{ period }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th class="sticky left-0 z-10 bg-default shadow-[1px_0_0_var(--ui-border)] w-48 py-1 pe-2 text-left font-medium">
                <span class="inline-flex items-center gap-1.5">
                  <span>Cumulative financial loss (IDR) <span class="text-error">*</span></span>
                  <BiancaNote
                    note="loss"
                    label="Cumulative financial loss (IDR)"
                  />
                </span>
              </th>
              <td
                v-for="(_, i) in periods"
                :key="`loss${i}`"
                class="p-1"
              >
                <UInput
                  v-if="fn.loss"
                  v-model.number="fn.loss[i]"
                  type="number"
                  min="0"
                  size="sm"
                  :disabled="off"
                  :color="p1Tried && blankCell('loss', i) ? 'error' : undefined"
                  :highlight="p1Tried && blankCell('loss', i)"
                  :class="[nonNumeric, lookups.loss_alert_idr < (Number(fn.loss[i]) || 0) ? 'ring-1 ring-error' : '']"
                  :aria-label="`Loss ${periods[i]}`"
                />
              </td>
            </tr>
            <tr>
              <th class="sticky left-0 z-10 bg-default shadow-[1px_0_0_var(--ui-border)] w-48 py-1 pe-2 text-left font-medium">
                <span class="inline-flex items-center gap-1.5">
                  <span>Regulatory impact (A) score (1–3) <span class="text-error">*</span></span>
                  <BiancaNote
                    note="regulatory_score"
                    label="Regulatory score"
                  />
                </span>
              </th>
              <td
                v-for="(_, i) in periods"
                :key="`reg${i}`"
                class="p-1"
              >
                <USelect
                  v-if="fn.regulatory_scores"
                  v-model="fn.regulatory_scores[i]"
                  :items="lookups.scores"
                  size="sm"
                  class="w-full"
                  :ui="fn.regulatory_scores[i] === lookups.score_alert ? { base: 'ring-1 ring-warning' } : undefined"
                  :color="p1Tried && blankCell('regulatory_scores', i) ? 'error' : undefined"
                  :highlight="p1Tried && blankCell('regulatory_scores', i)"
                  :disabled="off"
                  :aria-label="`Regulatory score ${periods[i]}`"
                />
              </td>
            </tr>
            <tr>
              <th class="sticky left-0 z-10 bg-default shadow-[1px_0_0_var(--ui-border)] w-48 py-1 pe-2 text-left font-medium">
                <span class="inline-flex items-center gap-1.5">
                  <span>Customer service impact (B) score (1–3) <span class="text-error">*</span></span>
                  <BiancaNote
                    note="customer_score"
                    label="Customer service score"
                  />
                </span>
              </th>
              <td
                v-for="(_, i) in periods"
                :key="`cust${i}`"
                class="p-1"
              >
                <USelect
                  v-if="fn.customer_scores"
                  v-model="fn.customer_scores[i]"
                  :items="lookups.scores"
                  size="sm"
                  class="w-full"
                  :ui="fn.customer_scores[i] === lookups.score_alert ? { base: 'ring-1 ring-warning' } : undefined"
                  :color="p1Tried && blankCell('customer_scores', i) ? 'error' : undefined"
                  :highlight="p1Tried && blankCell('customer_scores', i)"
                  :disabled="off"
                  :aria-label="`Customer score ${periods[i]}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="p1Tried && p1Missing.some((item) => item !== 'Suggested MTD')"
        class="flex items-center gap-1.5 text-sm text-error"
      >
        <UIcon
          name="i-lucide-circle-alert"
          class="size-4"
        />
        Fill every period: put 0 where there is no loss.
      </p>
      <p
        v-if="losses.some(v => (Number(v) || 0) > lookups.loss_alert_idr)"
        class="flex items-center gap-1.5 text-sm text-warning"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="size-4"
        />
        A loss above IDR {{ formatIdr(lookups.loss_alert_idr) }} is highlighted in the workbook.
      </p>
      <BiancaField
        label="Suggested MTD (hours / days)"
        note="suggested_mtd"
        :note-text="lookups.guides?.suggested_mtd || undefined"
        class="max-w-md"
        required
        :error="p1Tried && blankValue(fn.suggested_mtd) ? 'Pick the Suggested MTD.' : undefined"
      >
        <USelect
          v-model="fn.suggested_mtd"
          :items="listChoices('suggested_mtd', lookups.suggested_mtd, fn.suggested_mtd)"
          class="w-full max-w-xs"
          :disabled="off"
        />
        <template #help>
          <span v-if="!ruleMtd">The maximum tolerable downtime suggested by the impact above.</span>
          <span v-else-if="ruleMtd === fn.suggested_mtd">Matches the workbook's rule for the impact above.</span>
          <span
            v-else
            class="inline-flex flex-wrap items-center gap-x-2"
          >
            By the workbook's rule, the impact above suggests <strong class="text-default">{{ ruleMtd }}</strong>.
            <UButton
              v-if="!off"
              size="xs"
              variant="link"
              label="Use it"
              class="px-0"
              @click="fn.suggested_mtd = ruleMtd"
            />
          </span>
        </template>
      </BiancaField>
    </section>

    <!-- Part 2a -->
    <section
      v-show="part === 'p2a'"
      class="space-y-4"
    >
      <div class="flex flex-wrap items-end gap-4">
        <BiancaField
          label="Expected MTD (hours / days)"
          note="expected_mtd"
          help="Should be equal to or shorter than the Suggested MTD."
          class="w-56"
        >
          <USelect
            v-model="fn.expected_mtd"
            :items="mtdChoices(lookups.expected_mtd.map(item => item.value), fn.expected_mtd)"
            class="w-full"
            :disabled="off"
          />
        </BiancaField>
        <UFormField
          label="Business function category"
          help="Follows the Expected MTD (BIA Category)"
          class="w-64"
        >
          <UInput
            :model-value="preview?.category ?? ''"
            class="w-full"
            disabled
            :ui="{ base: 'disabled:bg-elevated disabled:opacity-100 disabled:text-muted' }"
            placeholder="Pick the Expected MTD"
          />
        </UFormField>
      </div>
      <UAlert
        v-if="preview?.within_suggested_mtd === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The Expected MTD is longer than the Suggested MTD."
      />

      <UCard
        v-for="(row, index) in fn.it_dependencies"
        :key="index"
        :ui="{ body: 'space-y-3' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">IT system {{ index + 1 }}</span>
            <UButton
              v-if="!off && fn.it_dependencies.length > 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :aria-label="`Remove IT system ${index + 1}`"
              @click="fn.it_dependencies.splice(index, 1)"
            />
          </div>
        </template>
        <div class="grid gap-4 @xl:grid-cols-2">
          <BiancaField
            label="Kind of system"
            note="it_system"
          >
            <USelect
              :model-value="modeOf(row)"
              :items="modes"
              class="w-full"
              :disabled="off"
              @update:model-value="setMode(row, $event as Mode)"
            />
          </BiancaField>
          <UFormField
            v-if="modeOf(row) === 'master'"
            label="IT application system"
          >
            <BiancaPicker
              v-model="row.application_id"
              kind="applications"
              :selected="row.application_id && row.application_name ? { id: row.application_id, label: row.application_name } : null"
              :disabled="off"
              aria-label="IT application system"
              @pick="pickApplication(row, $event)"
            />
          </UFormField>
          <UFormField
            v-else-if="modeOf(row) === 'other'"
            label="System name"
          >
            <UInput
              v-model="row.application_name"
              class="w-full"
              :maxlength="TEXT_LIMITS.name"
              :disabled="off"
            />
          </UFormField>
        </div>

        <template v-if="modeOf(row) !== 'na'">
          <div class="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-4">
            <BiancaField
              label="IT committed RTO (hours / days)"
              note="rto"
              :help="modeOf(row) === 'master' ? 'From the application master' : undefined"
            >
              <UInput
                v-model="row.rto"
                class="w-full"
                :readonly="modeOf(row) === 'master'"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="off"
                placeholder="e.g. 6 hrs"
              />
            </BiancaField>
            <BiancaField
              label="IT committed RPO (LDB / LST / LSB)"
              note="rpo"
              :help="modeOf(row) === 'master' ? 'From the application master' : undefined"
            >
              <UInput
                v-model="row.rpo"
                class="w-full"
                :readonly="modeOf(row) === 'master'"
                :maxlength="TEXT_LIMITS.medium"
                :disabled="off"
                placeholder="LDB, LST, LSB or NA"
              />
            </BiancaField>
            <BiancaField
              label="Process workaround in place (Yes / No)"
              note="workaround"
            >
              <USelect
                v-model="row.workaround"
                :items="listChoices('yes_no', lookups.yes_no, row.workaround)"
                class="w-full"
                :disabled="off"
              />
            </BiancaField>
            <BiancaField
              label="Time to clear backlog (hours)"
              note="backlog"
            >
              <UInput
                v-model.number="row.backlog_hours"
                type="number"
                min="0"
                class="w-full"
                :disabled="off"
              />
            </BiancaField>
          </div>
          <div class="grid gap-4 @xl:grid-cols-2">
            <BiancaField
              label="System usage (inquiry / transaction)"
              note="system_usage"
            >
              <USelect
                v-model="row.system_usage"
                :items="listChoices('system_usage', lookups.system_usage, row.system_usage)"
                class="w-full"
                :disabled="off"
              />
            </BiancaField>
            <BiancaField
              label="Workaround critical gaps"
              note="gaps"
              :required="!!daat(index)?.gaps_required"
              :help="daat(index)?.gaps_required ? 'Required: RTO is longer than the MTD, there is no workaround and the system is a full dependency.' : 'Opens only if RTO > MTD, no workaround and full dependency.'"
              :error="daat(index)?.gaps_required && !row.gaps ? 'Required' : undefined"
            >
              <UTextarea
                v-model="row.gaps"
                class="w-full"
                :rows="2"
                :maxlength="long"
                :disabled="off || !daat(index)?.gaps_required"
                :ui="{ base: 'disabled:bg-elevated' }"
                :placeholder="daat(index)?.gaps_required ? 'The critical gaps, since there is no workaround' : 'Not needed for this system'"
              />
            </BiancaField>
          </div>
          <div
            v-if="daat(index)"
            class="rounded-md bg-elevated/50 p-3 text-sm"
          >
            <p class="flex flex-wrap items-center gap-x-1">
              <span class="inline-flex items-center gap-1 font-medium">DAAT <BiancaNote
                note="daat"
                label="DAAT"
              />:</span>
              <span :class="[nonNumeric, (daat(index)?.daat_hours ?? 0) < 0 ? 'font-semibold text-error' : '']">
                {{ daat(index)?.daat_hours == null ? '—' : `${daat(index)?.daat_hours} hours` }}
              </span>
              <span class="ms-1 text-muted">= Expected MTD − RTO − time to clear backlog, shown as worked out.</span>
            </p>
            <ul
              v-if="daat(index)?.warnings.length"
              class="mt-2 space-y-1 text-warning"
            >
              <li
                v-for="warning in daat(index)?.warnings"
                :key="warning"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-triangle-alert"
                  class="mt-0.5 size-4 shrink-0"
                />{{ warning }}
              </li>
            </ul>
            <p
              v-if="daat(index)?.rto_reaches_mtd"
              class="mt-2 text-warning"
            >
              The RTO reaches the Expected MTD: explain it in the Part 2a note (Notes tab).
            </p>
          </div>
        </template>
      </UCard>
      <UButton
        v-if="!off && fn.it_dependencies.length < lookups.it_slots"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add IT system"
        @click="addIt"
      />
    </section>

    <!-- Part 2b: the workbook's columns D (the function's capacity), then the upstreams and the
         downstreams, each a table filled across like SCCA's interdependencies -->
    <section
      v-show="part === 'p2b'"
      class="space-y-4"
    >
      <BiancaField
        label="Planned capacity (%) for the business function"
        note="planned_capacity"
        required
        help="Its upstreams and downstreams are compared with it."
        class="max-w-sm"
      >
        <USelect
          v-model="fn.planned_capacity"
          :items="listChoices('percentages', lookups.percentages, fn.planned_capacity)"
          class="w-full"
          :disabled="off"
        />
      </BiancaField>

      <UCard
        v-for="side in sides"
        :key="side.key"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-1.5 text-sm font-semibold">
                {{ side.title }} <span class="text-error">*</span>
                <BiancaNote
                  :note="side.key === 'up' ? 'upstream' : 'downstream'"
                  :label="side.title"
                />
              </h4>
              <p class="text-xs text-muted">
                {{ side.description }}
              </p>
            </div>
            <UButton
              v-if="!off && sideRows(side.key).length < lookups.dependency_slots"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              :label="`Add ${side.key === 'up' ? 'upstream' : 'downstream'}`"
              @click="addSide(side.key)"
            />
          </div>
        </template>

        <p
          v-if="!sideRows(side.key).length"
          class="p-4 text-sm text-muted"
        >
          None yet. Add one, or type NA as the name when there is none.
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full min-w-[78rem] text-sm">
            <thead>
              <tr class="bg-elevated/50 text-left text-xs font-medium text-muted">
                <th class="sticky left-0 z-10 w-10 bg-elevated px-3 py-2">
                  No.
                </th>
                <th class="sticky left-10 z-10 min-w-56 bg-elevated px-3 py-2">
                  {{ side.name }} <span class="text-error">*</span>
                </th>
                <th class="w-36 px-3 py-2">
                  Planned capacity (%) <span class="text-error">*</span>
                </th>
                <th class="w-40 px-3 py-2">
                  Expected MTD (hours / days) <span class="text-error">*</span>
                </th>
                <th class="w-40 px-3 py-2">
                  SLA (time in the agreement) <span class="text-error">*</span>
                </th>
                <th class="w-32 px-3 py-2">
                  Outsourcing service provider (Yes / No) <span class="text-error">*</span>
                </th>
                <th class="w-32 px-3 py-2">
                  Material services (Yes / No) <span class="text-error">*</span>
                </th>
                <th class="min-w-64 px-3 py-2">
                  <span class="inline-flex items-center gap-1">
                    Justification of a lower capacity or a longer MTD
                    <BiancaNote
                      note="dependency_justification"
                      label="Justification"
                    />
                  </span>
                </th>
                <th class="w-10 px-2 py-2">
                  <span class="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(row, number) in sideRows(side.key)"
                :key="`${side.key}${row.index}`"
                class="align-top"
              >
                <td class="sticky left-0 z-10 bg-default px-3 py-2 tabular-nums text-muted">
                  {{ number + 1 }}
                </td>
                <td class="sticky left-10 z-10 bg-default px-3 py-2">
                  <!-- A Group of Master data, as the workbook's Master Group sheet lists them; or a
                       name typed (a vendor, another party), or NA -->
                  <UInput
                    v-model="row.data[`${side.key}_name`]"
                    class="w-full"
                    :maxlength="TEXT_LIMITS.name"
                    :disabled="off"
                    :list="groupListId"
                    trailing-icon="i-lucide-chevrons-up-down"
                    placeholder="Pick a Group, or type a name"
                    :aria-label="`${side.name} ${number + 1}`"
                  />
                </td>
                <template v-if="isNaName(row.data[`${side.key}_name`])">
                  <td
                    colspan="6"
                    class="px-3 py-2 text-xs text-muted"
                  >
                    NA: no {{ side.key === 'up' ? 'upstream' : 'downstream' }}, nothing more to fill in.
                  </td>
                </template>
                <template v-else>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="row.data[`${side.key}_capacity`]"
                      :items="side.key === 'down' && lookups.downstream_capacity
                        ? listChoices('downstream_capacity', lookups.downstream_capacity, row.data.down_capacity)
                        : listChoices('upstream_capacity', lookups.upstream_capacity, row.data[`${side.key}_capacity`])"
                      class="w-full"
                      :disabled="off"
                      :aria-label="`Planned capacity, ${side.name} ${number + 1}`"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="row.data[`${side.key}_mtd`]"
                      :items="mtdChoices(lookups.dependency_mtd, row.data[`${side.key}_mtd`])"
                      class="w-full"
                      :disabled="off"
                      :aria-label="`Expected MTD, ${side.name} ${number + 1}`"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <UInput
                      v-model="row.data[`${side.key}_sla`]"
                      class="w-full"
                      :maxlength="TEXT_LIMITS.medium"
                      :disabled="off"
                      placeholder="E.g. 1 day, or NA"
                      :aria-label="`SLA, ${side.name} ${number + 1}`"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="row.data[`${side.key}_outsourced`]"
                      :items="listChoices('yes_no', lookups.yes_no, row.data[`${side.key}_outsourced`])"
                      class="w-full"
                      :disabled="off"
                      :aria-label="`Outsourcing service provider, ${side.name} ${number + 1}`"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="row.data[`${side.key}_material`]"
                      :items="listChoices('yes_no', lookups.yes_no, row.data[`${side.key}_material`])"
                      class="w-full"
                      :disabled="off"
                      :aria-label="`Material services, ${side.name} ${number + 1}`"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <UTextarea
                      v-model="row.data[`${side.key}_justification`]"
                      class="w-full"
                      :rows="2"
                      autoresize
                      :maxlength="long"
                      :disabled="off || !justifyReasons(row.index, side.key).length"
                      :color="justifyReasons(row.index, side.key).length && !row.data[`${side.key}_justification`]?.trim() ? 'error' : undefined"
                      :highlight="!!justifyReasons(row.index, side.key).length && !row.data[`${side.key}_justification`]?.trim()"
                      :ui="{ base: 'disabled:bg-elevated' }"
                      :placeholder="justifyReasons(row.index, side.key).length ? 'Why it is acceptable' : 'Not needed'"
                      :aria-label="`Justification, ${side.name} ${number + 1}`"
                    />
                    <p
                      v-for="reason in justifyReasons(row.index, side.key)"
                      :key="reason"
                      class="mt-1 flex items-start gap-1 text-xs text-warning"
                    >
                      <UIcon
                        name="i-lucide-triangle-alert"
                        class="mt-px size-3.5 shrink-0"
                      />{{ reason }}
                    </p>
                  </td>
                </template>
                <td class="px-2 py-2">
                  <UButton
                    v-if="!off"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-trash-2"
                    :aria-label="`Remove ${side.name} ${number + 1}`"
                    @click="removeSide(row.index, side.key)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <!-- Part 3: the workbook's columns, in its order, grouped as the SCCA assessment groups its fields -->
    <section
      v-show="part === 'p3'"
      class="space-y-5"
    >
      <BiancaPartCard
        title="Staff and recovery level"
        description="How many people the function has, how many it needs to run at the planned capacity, and the level it recovers to."
      >
        <div class="grid items-end gap-5 @xl:grid-cols-2 @3xl:grid-cols-3">
          <BiancaField
            label="Total staff strength (no. of staff)"
            note="total_staff"
          >
            <UInput
              v-model.number="fn.total_staff"
              type="number"
              min="0"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
          <BiancaField
            label="Staff required for the planned capacity (no. of staff)"
            note="staff_required"
          >
            <UInput
              v-model.number="fn.staff_required"
              type="number"
              min="0"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
          <BiancaField
            label="Expected recovery level (%)"
            note="recovery_level"
          >
            <USelect
              v-model="fn.recovery_level"
              :items="lookups.expected_support_capacity
                ? listChoices('expected_support_capacity', lookups.expected_support_capacity, fn.recovery_level)
                : listChoices('percentages', lookups.percentages, fn.recovery_level)"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
        </div>
      </BiancaPartCard>

      <BiancaPartCard
        title="Recovery strategies"
        description="Which work comes first when the function recovers, and how the work left over is cleared."
      >
        <div class="grid gap-5 @3xl:grid-cols-2">
          <BiancaField
            label="Prioritization strategy"
            note="prioritization_strategy"
          >
            <UTextarea
              v-model="fn.prioritization_strategy"
              class="w-full"
              :rows="3"
              autoresize
              :maxlength="long"
              :disabled="off"
            />
          </BiancaField>
          <BiancaField
            label="Outstanding strategy"
            note="outstanding_strategy"
          >
            <UTextarea
              v-model="fn.outstanding_strategy"
              class="w-full"
              :rows="3"
              autoresize
              :maxlength="long"
              :disabled="off"
            />
          </BiancaField>
        </div>
      </BiancaPartCard>

      <BiancaPartCard
        title="Alternate site"
        description="Where the function works from when its main location can't be used, and the BCP seats it has there."
      >
        <div class="grid gap-5 @3xl:grid-cols-3">
          <BiancaField
            label="Recommended alternate site strategy"
            note="alt_site_strategy"
            class="@3xl:col-span-3 @3xl:max-w-xl"
          >
            <template #help>
              <span
                v-if="recommendedSites.length"
                :class="fn.alt_site_strategy && !recommendedSites.includes(fn.alt_site_strategy) ? 'text-warning' : ''"
              >
                Recommended for {{ preview?.category }}: {{ recommendedSites.join(' or ') }}.
              </span>
              <span v-else>{{ lookups.guides.alternate_site }}</span>
            </template>
            <USelect
              v-model="fn.alt_site_strategy"
              :items="listChoices('alt_site_strategies', lookups.alt_site_strategies, fn.alt_site_strategy)"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
          <BiancaField
            label="Current BCP seats in place (seats)"
            note="seats_current"
          >
            <UInput
              v-model.number="fn.seats_current"
              type="number"
              min="0"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
          <BiancaField
            label="BCP seats required after the BIA (seats)"
            note="seats_required"
          >
            <UInput
              v-model.number="fn.seats_required"
              type="number"
              min="0"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
        </div>
      </BiancaPartCard>

      <BiancaPartCard
        title="Resources at the alternate site"
        description="What the function needs at the alternate site to meet the planned capacity (excluding work from home)."
        note="resources"
      >
        <div class="space-y-5">
          <div class="grid grid-cols-2 gap-5 @3xl:grid-cols-4">
            <UFormField
              label="PC (units)"
            >
              <UInput
                v-model.number="fn.res_pc"
                type="number"
                min="0"
                class="w-full"
                :disabled="off"
              />
            </UFormField>
            <UFormField
              label="Phone, fixed line (units)"
            >
              <UInput
                v-model.number="fn.res_phone"
                type="number"
                min="0"
                class="w-full"
                :disabled="off"
              />
            </UFormField>
            <UFormField
              label="Fax (units)"
            >
              <UInput
                v-model.number="fn.res_fax"
                type="number"
                min="0"
                class="w-full"
                :disabled="off"
              />
            </UFormField>
            <UFormField
              label="Copier (units)"
            >
              <UInput
                v-model.number="fn.res_copier"
                type="number"
                min="0"
                class="w-full"
                :disabled="off"
              />
            </UFormField>
          </div>
          <BiancaField
            label="Other resources (please specify)"
            note="res_others"
          >
            <UTextarea
              v-model="fn.res_others"
              class="w-full"
              :rows="2"
              autoresize
              :maxlength="long"
              :disabled="off"
            />
          </BiancaField>
        </div>
      </BiancaPartCard>

      <BiancaPartCard
        title="Vital records"
        description="The records the function can't recover without, and where they are kept. Mandatory for a Business Critical function."
      >
        <div class="grid gap-5 @3xl:grid-cols-2">
          <BiancaField
            label="Vital records"
            note="vital_record"
          >
            <UTextarea
              v-model="fn.vital_record"
              class="w-full"
              :rows="3"
              autoresize
              :maxlength="long"
              :disabled="off"
            />
          </BiancaField>
          <UFormField
            label="Vital records location"
          >
            <UTextarea
              v-model="fn.vital_record_location"
              class="w-full"
              :rows="3"
              autoresize
              :maxlength="long"
              :disabled="off"
            />
          </UFormField>
        </div>
      </BiancaPartCard>
    </section>

    <!-- Part 4 -->
    <section
      v-show="part === 'p4'"
      class="space-y-5"
    >
      <BiancaPartCard
        title="About the function"
        description="What the business function does, in a few sentences."
      >
        <BiancaField
          label="Function description"
          note="description"
        >
          <UTextarea
            v-model="fn.description"
            class="w-full"
            :rows="4"
            autoresize
            :maxlength="long"
            :disabled="off"
          />
        </BiancaField>
      </BiancaPartCard>

      <BiancaPartCard
        title="Critical timings"
        description="How often the function runs, when it is most critical, and the activities that must be done at those times."
      >
        <div class="space-y-5">
          <BiancaField
            label="Frequency"
            note="frequency"
            class="@xl:max-w-xs"
          >
            <USelect
              v-model="fn.frequency"
              :items="listChoices('frequencies', lookups.frequencies, fn.frequency)"
              class="w-full"
              :disabled="off"
            />
          </BiancaField>
          <div class="grid gap-5 @3xl:grid-cols-2">
            <BiancaField
              label="Critical timings"
              note="critical_timings"
            >
              <UTextarea
                v-model="fn.critical_timings"
                class="w-full"
                :rows="3"
                autoresize
                :maxlength="long"
                :disabled="off"
              />
            </BiancaField>
            <BiancaField
              label="Activity Performed at Critical Timings"
              note="critical_activity"
            >
              <UTextarea
                v-model="fn.critical_activity"
                class="w-full"
                :rows="3"
                autoresize
                :maxlength="long"
                :disabled="off"
              />
            </BiancaField>
          </div>
        </div>
      </BiancaPartCard>
    </section>

    <slot
      name="notes"
      :part="part"
    />

    <div class="flex flex-wrap justify-between gap-2 border-t border-default pt-4">
      <UButton
        v-if="previousPart"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="previousPart.label"
        @click="part = previousPart.value"
      />
      <span v-else />
      <UButton
        v-if="nextPart"
        color="neutral"
        variant="outline"
        trailing-icon="i-lucide-arrow-right"
        :label="`Next: ${nextPart.label}`"
        :disabled="!named && !disabled"
        @click="goNext"
      />
    </div>
  </div>
</template>
