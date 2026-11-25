<script setup lang="ts">
import type { BiancaConfigPayload, BiancaListItem, BiancaListItems, BiancaListKey, BiancaReferenceItem } from '~/composables/useBiancaConfigAdmin'
import { BIANCA_CAPACITY_LISTS, BIANCA_LISTS } from '~/utils/bianca-config'

/**
 * BIA configuration > Lists: the workbook's choice lists, as BIANCA's masters showed them
 * (Code | Name | Description | Active). D15 asked for each option's ID, value and data type:
 * they stay visible, under the code. The five planned-capacity lists are one table with a
 * column per use, as BIANCA's Master Planned Capacity; they are still saved as five lists.
 * Expected MTD and the impact scores have one editable home each (Impact and MTD, Master MTD).
 */
defineProps<{ disabled: boolean, payload: BiancaConfigPayload, referenceLists?: { expected_mtd: BiancaReferenceItem[], scores: BiancaReferenceItem[] } }>()
const model = defineModel<BiancaListItems>({ required: true })
const recommendations = defineModel<Record<string, string[]>>('recommendations')
const { can } = useAuth()
const route = useRoute()
const router = useRouter()
const mtdMaster = computed(() => can('masterdata.mtd.view', 'masterdata.mtd.manage'))

const CAPACITY = 'capacity'
const capacityKeys = BIANCA_CAPACITY_LISTS.map((item) => item.key)
const SHOWN: (BiancaListKey | typeof CAPACITY)[] = ['periods', 'suggested_mtd', CAPACITY, 'alt_site_strategies', 'frequencies', 'system_usage', 'yes_no']
const selectedKey = computed(() => {
  const asked = String(route.query.list ?? '')
  if (capacityKeys.includes(asked as BiancaListKey)) return CAPACITY
  return SHOWN.find((key) => key === asked) ?? SHOWN[0]!
})
const capacity = computed(() => selectedKey.value === CAPACITY)
const list = computed(() => BIANCA_LISTS.find(({ key }) => key === selectedKey.value) ?? BIANCA_LISTS[0]!)
// Suggested MTD comes from Master data › Master MTD: shown here, changed there.
const suggestedReference = computed(() => selectedKey.value === 'suggested_mtd')
const editableList = computed(() => !capacity.value && !suggestedReference.value)
const sectionSelection = computed({
  get: () => selectedKey.value,
  set: (value: string) => router.replace({ query: { ...route.query, list: value } }),
})
const rows = computed(() => model.value[list.value.key])
const menu = computed(() => SHOWN.map((key) => key === CAPACITY
  ? { value: CAPACITY, label: 'Planned capacity', count: capacityRows.value.length }
  : { value: key, label: BIANCA_LISTS.find((item) => item.key === key)!.label, count: model.value[key].filter((item) => item.active).length }))

function technical(item: Pick<BiancaListItem, 'id' | 'code'>) {
  return `ID ${item.id ?? 'on save'} · value ${item.code || '—'} · string`
}
function setCode(index: number, value: string | number) {
  const item = rows.value[index]!
  item.code = String(value)
  // Identity and typed value are derived by the server from the canonical stored code.
  delete item.id
  delete item.value
}
function move(index: number, direction: -1 | 1) {
  const [item] = rows.value.splice(index, 1)
  rows.value.splice(index + direction, 0, item!)
}
function add() {
  rows.value.push({ code: '', label: '', text: null, active: rows.value.filter((item) => item.active).length < list.value.maxActive })
}

// --- planned capacity: one row per value, a column per use -----------------------------------

interface CapacityRow { code: string, label: string, text: string | null, id: string | null, original: string | null, uses: Record<string, boolean> }
const capacityRows = ref<CapacityRow[]>([])
let saved: Record<string, Map<string, BiancaListItem>> = {}
let building = false
const PERCENT = /^(?:100|[0-9]{1,2})%$/
const SPECIAL = new Set(['NA', 'SLA'])

function buildCapacity() {
  saved = Object.fromEntries(capacityKeys.map((key) => [key, new Map(model.value[key].map((item) => [item.code, item]))]))
  // Generic values hold every value; the other lists add theirs after, in their own order.
  const order = [...new Set(['generic_values', ...capacityKeys].flatMap((key) => model.value[key as BiancaListKey].map((item) => item.code)))]
  building = true
  capacityRows.value = order.map((code) => {
    const first = capacityKeys.map((key) => saved[key]!.get(code)).find(Boolean)!
    return {
      code,
      label: first.label,
      text: first.text ?? null,
      id: first.id ?? null,
      original: code,
      uses: Object.fromEntries(capacityKeys.map((key) => [key, !!saved[key]!.get(code)?.active])),
    }
  })
  building = false
}
// A saved or reloaded draft is a new list object: rebuild then, never while editing.
watch(() => model.value, buildCapacity, { immediate: true })
watch(capacityRows, () => {
  if (building) return
  for (const key of capacityKeys) {
    model.value[key] = capacityRows.value
      // A value keeps its place in a list it was in (inactive); otherwise only where used.
      .filter((row) => row.uses[key] || (row.original != null && saved[key]!.has(row.original)))
      .map((row) => {
        const before = row.original != null ? saved[key]!.get(row.original) : undefined
        const item: BiancaListItem = { ...before, code: row.code, label: row.label, text: row.text, active: !!row.uses[key] }
        if (!before || row.code !== row.original) {
          delete item.id
          delete item.value
        }
        return item
      })
  }
}, { deep: true, flush: 'sync' })

function capacityProblem(row: CapacityRow, index: number) {
  const code = row.code.trim()
  if (!code) return 'Enter a value.'
  if (!PERCENT.test(code) && !SPECIAL.has(code)) return 'Use a percentage from 0% to 100%, NA or SLA.'
  if (capacityRows.value.findIndex((other) => other.code.trim() === code) !== index) return 'This value is already listed.'
  return null
}
// The server takes upstream, downstream, support and generic values only from the function's
// percentages (or NA/SLA): a percentage not used for the function can't be used elsewhere.
function canUse(row: CapacityRow, key: string) {
  const code = row.code.trim()
  if (key === 'percentages') return PERCENT.test(code)
  return SPECIAL.has(code) || (PERCENT.test(code) && row.uses.percentages)
}
function setUse(row: CapacityRow, key: string, value: boolean) {
  row.uses[key] = value
  if (key === 'percentages' && !value && !SPECIAL.has(row.code.trim())) {
    for (const other of capacityKeys) row.uses[other] = false
  }
}
function moveCapacity(index: number, direction: -1 | 1) {
  const [row] = capacityRows.value.splice(index, 1)
  capacityRows.value.splice(index + direction, 0, row!)
}
function addCapacity() {
  capacityRows.value.push({ code: '', label: '', text: null, id: null, original: null, uses: Object.fromEntries(capacityKeys.map((key) => [key, false])) })
}
</script>

<template>
  <div class="min-w-0 space-y-4">
    <AdminBiancaConfigSectionLayout
      v-model="sectionSelection"
      label="Lists"
      :items="menu"
      flush
    >
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 basis-60">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-semibold text-highlighted">
                {{ capacity ? 'Planned capacity' : list.label }}
              </h2>
              <UBadge
                v-if="!capacity && list.locked"
                color="neutral"
                variant="subtle"
                icon="i-lucide-lock"
                label="Fixed: used by BIA rules"
              />
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ capacity
                ? 'One row per value. Tick where the value can be chosen. Business function is MST_Generic Value column I; the others follow columns F, G, H and E.'
                : list.help }}
            </p>
            <p
              v-if="!capacity && list.usedIn"
              class="mt-1 text-xs text-muted"
            >
              Used in {{ list.usedIn }}.
            </p>
          </div>
          <UButton
            v-if="!disabled && capacity"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Add value"
            :disabled="capacityRows.length >= 103"
            @click="addCapacity"
          />
          <UButton
            v-else-if="!disabled && editableList && !list.locked"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Add item"
            :disabled="rows.length >= 256"
            @click="add"
          />
          <UButton
            v-else-if="suggestedReference && mtdMaster"
            :to="{ path: MASTER_MTD_PATH, query: { part: 'suggested' } }"
            color="neutral"
            variant="outline"
            icon="i-lucide-timer"
            :label="can('masterdata.mtd.manage') ? 'Edit in Master MTD' : 'Open Master MTD'"
          />
        </div>
      </template>

      <!-- Planned capacity -->
      <div
        v-if="capacity"
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[52rem] text-sm">
          <caption class="sr-only">
            Planned capacity values and where each is used
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-24 px-3 py-2 ps-4">
                Order
              </th>
              <th class="w-32 px-3 py-2">
                Value
              </th>
              <th class="px-3 py-2">
                Name
              </th>
              <th
                v-for="use in BIANCA_CAPACITY_LISTS"
                :key="use.key"
                class="w-24 px-1 py-2 text-center normal-case"
                :title="use.help"
              >
                <span class="block text-xs font-semibold uppercase">{{ use.short }}</span>
                <span class="block text-[11px] font-normal text-dimmed">{{ use.column }}</span>
              </th>
              <th class="w-12 px-3 py-2 pe-4">
                <span class="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(row, index) in capacityRows"
              :key="index"
            >
              <td class="px-3 py-2 ps-4 align-top">
                <div class="flex h-8 items-center gap-0.5 tabular-nums">
                  <span class="me-1 min-w-4 text-xs text-muted">{{ index + 1 }}</span>
                  <template v-if="!disabled">
                    <UButton
                      type="button"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-arrow-up"
                      :disabled="index === 0"
                      :aria-label="'Move value ' + (index + 1) + ' up'"
                      @click="moveCapacity(index, -1)"
                    />
                    <UButton
                      type="button"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-arrow-down"
                      :disabled="index === capacityRows.length - 1"
                      :aria-label="'Move value ' + (index + 1) + ' down'"
                      @click="moveCapacity(index, 1)"
                    />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="row.code"
                  class="w-full font-mono"
                  :maxlength="8"
                  :disabled="disabled"
                  :color="capacityProblem(row, index) ? 'error' : undefined"
                  :aria-label="'Value ' + (index + 1)"
                />
                <p
                  v-if="capacityProblem(row, index)"
                  class="mt-1 text-xs text-error"
                >
                  {{ capacityProblem(row, index) }}
                </p>
                <p
                  v-else
                  class="mt-1 font-mono text-[11px] text-dimmed"
                >
                  {{ technical({ id: row.code === row.original ? row.id : null, code: row.code }) }}
                </p>
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="row.label"
                  class="w-full min-w-20"
                  :maxlength="255"
                  :disabled="disabled"
                  :aria-label="'Name ' + (index + 1)"
                />
              </td>
              <td
                v-for="use in BIANCA_CAPACITY_LISTS"
                :key="use.key"
                class="px-2 py-2 text-center align-top"
              >
                <UCheckbox
                  :model-value="row.uses[use.key]"
                  class="inline-flex pt-1.5"
                  :disabled="disabled || !canUse(row, use.key)"
                  :aria-label="(row.code || 'Value ' + (index + 1)) + ' for ' + use.short"
                  @update:model-value="setUse(row, use.key, !!$event)"
                />
              </td>
              <td class="px-3 py-2 pe-4 text-right align-top">
                <UButton
                  v-if="!disabled"
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  :aria-label="'Remove value ' + (row.code || index + 1)"
                  @click="capacityRows.splice(index, 1)"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p class="border-t border-default px-4 py-3 text-xs text-muted">
          A percentage must be ticked for Business function before the other uses can take it. NA and SLA are never a business function's capacity.
        </p>
      </div>

      <!-- Suggested MTD: a copy of Master MTD -->
      <div
        v-else-if="suggestedReference"
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[36rem] text-sm">
          <caption class="sr-only">
            Suggested MTD items
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-16 px-3 py-2 ps-4">
                Order
              </th>
              <th class="px-3 py-2">
                Code
              </th>
              <th class="px-3 py-2">
                Name
              </th>
              <th class="px-3 py-2">
                Description
              </th>
              <th class="px-3 py-2 pe-4">
                Active
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(item, index) in rows"
              :key="item.code"
            >
              <td class="px-3 py-2 ps-4 tabular-nums text-muted">
                {{ index + 1 }}
              </td>
              <td class="px-3 py-2">
                <p class="font-mono">
                  {{ item.code }}
                </p>
                <p class="font-mono text-[11px] text-dimmed">
                  {{ technical(item) }}
                </p>
              </td>
              <td class="px-3 py-2">
                {{ item.label }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ item.text || '—' }}
              </td>
              <td class="px-3 py-2 pe-4">
                {{ item.active ? 'Yes' : 'No' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Any other list -->
      <div
        v-else
        class="overflow-x-auto"
      >
        <table
          :key="list.key"
          class="w-full min-w-[48rem] text-sm"
        >
          <caption class="sr-only">
            {{ list.label }} items
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-24 px-3 py-2 ps-4">
                Order
              </th>
              <th class="w-56 px-3 py-2">
                Code
              </th>
              <th class="px-3 py-2">
                Name
              </th>
              <th class="px-3 py-2">
                Description (optional)
              </th>
              <th class="w-16 px-3 py-2">
                Active
              </th>
              <th class="w-12 px-3 py-2 pe-4">
                <span class="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(item, index) in rows"
              :key="index"
            >
              <td class="px-3 py-2 ps-4 align-top">
                <div class="flex h-8 items-center gap-0.5 tabular-nums">
                  <span class="me-1 min-w-4 text-xs text-muted">{{ index + 1 }}</span>
                  <template v-if="!disabled && !list.locked">
                    <UButton
                      type="button"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-arrow-up"
                      :disabled="index === 0"
                      :aria-label="'Move item ' + (index + 1) + ' up'"
                      @click="move(index, -1)"
                    />
                    <UButton
                      type="button"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-arrow-down"
                      :disabled="index === rows.length - 1"
                      :aria-label="'Move item ' + (index + 1) + ' down'"
                      @click="move(index, 1)"
                    />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 align-top">
                <span
                  v-if="list.locked"
                  class="inline-block py-1.5 font-mono"
                >{{ item.code }}</span>
                <UInput
                  v-else
                  :model-value="item.code"
                  class="w-full font-mono"
                  :maxlength="list.maxCode"
                  :disabled="disabled"
                  :aria-label="'Code ' + (index + 1)"
                  required
                  @update:model-value="setCode(index, $event)"
                />
                <p class="mt-1 font-mono text-[11px] text-dimmed">
                  {{ technical(item) }}
                </p>
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="item.label"
                  class="w-full min-w-28"
                  :maxlength="255"
                  :disabled="disabled"
                  :aria-label="'Name ' + (index + 1)"
                  required
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  :model-value="item.text ?? ''"
                  :placeholder="item.label"
                  class="w-full min-w-28"
                  :maxlength="255"
                  :disabled="disabled"
                  :aria-label="'Description ' + (index + 1)"
                  @update:model-value="item.text = $event || null"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USwitch
                  v-model="item.active"
                  class="pt-1.5"
                  :disabled="disabled || list.locked"
                  :aria-label="'Item ' + (index + 1) + ' active'"
                />
              </td>
              <td class="px-3 py-2 pe-4 text-right align-top">
                <UButton
                  v-if="!disabled && !list.locked"
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  :aria-label="'Remove item ' + (index + 1)"
                  @click="rows.splice(index, 1)"
                />
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td
                colspan="6"
                class="px-4 py-6 text-center text-muted"
              >
                Add an item before saving this list.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="list.key === 'alt_site_strategies' && !capacity && recommendations"
        class="grid gap-4 border-t border-default p-4"
      >
        <h3 class="font-semibold">
          Recommended sites by business function category
        </h3>
        <UFormField
          v-for="(_, category) in recommendations"
          :key="category"
          :label="String(category)"
        >
          <USelectMenu
            v-model="recommendations[category]"
            :items="model.alt_site_strategies.filter((site) => site.active && site.code).map((site) => site.code)"
            :disabled="disabled"
            multiple
            class="w-full"
            :aria-label="'Recommended sites for ' + category"
          />
        </UFormField>
      </div>
    </AdminBiancaConfigSectionLayout>
    <UCard>
      <h3 class="text-sm font-semibold">
        Shared master data
      </h3>
      <p class="mt-1 text-sm text-muted">
        The workbook also contains application systems, office locations and organization groups. These follow the shared masters instead of being copied into a BIA version. Expected MTD and the dependency MTD choices are in Master MTD (each version keeps a copy, shown under Impact and MTD); the impact scores are under Impact and MTD › Impact thresholds.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          v-if="can('scca.application.view', 'scca.application.manage')"
          to="/admin/applications"
          color="neutral"
          variant="outline"
          label="Application systems"
        />
        <UButton
          v-if="mtdMaster"
          :to="MASTER_MTD_PATH"
          color="neutral"
          variant="outline"
          label="Master MTD"
        />
        <UButton
          v-if="can('masterdata.access', 'masterdata.organization.manage')"
          to="/masterdata/organization"
          color="neutral"
          variant="outline"
          label="Organization structure"
        />
        <UButton
          v-if="can('sites.master')"
          :to="MASTER_BUILDINGS_PATH"
          color="neutral"
          variant="outline"
          label="Office locations"
        />
      </div>
    </UCard>
  </div>
</template>
