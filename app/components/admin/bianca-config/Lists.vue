<script setup lang="ts">
import type { BiancaConfigPayload, BiancaListItems, BiancaReferenceItem } from '~/composables/useBiancaConfigAdmin'
import { BIANCA_LISTS } from '~/utils/bianca-config'

const props = defineProps<{ disabled: boolean, payload: BiancaConfigPayload, referenceLists?: { expected_mtd: BiancaReferenceItem[], scores: BiancaReferenceItem[] } }>()
const model = defineModel<BiancaListItems>({ required: true })
const recommendations = defineModel<Record<string, string[]>>('recommendations')
const siteOptions = computed(() => model.value.alt_site_strategies.filter(site => site.active && site.code).map(site => site.code))
const { can } = useAuth()
const route = useRoute()
const router = useRouter()

const list = computed(() => BIANCA_LISTS.find(({ key }) => key === route.query.list) ?? BIANCA_LISTS[0]!)
const selected = computed({
  get: () => list.value.key,
  set: (value: string) => router.replace({ query: { ...route.query, list: value } }),
})
const rows = computed(() => model.value[list.value.key])
const menu = computed<{ value: string, label: string, count: number }[]>(() => [...BIANCA_LISTS.map(({ key, label }) => ({
  value: key,
  label,
  count: model.value[key].filter((item) => item.active).length,
})),
{ value: 'expected_mtd', label: 'Expected MTD reference', count: props.payload.expected_mtd.length + 2 },
{ value: 'scores', label: 'Impact scores', count: props.payload.scores.length },
])
const reference = computed(() => route.query.list === 'expected_mtd' || route.query.list === 'scores')
const referenceId = (value: string) => props.referenceLists?.expected_mtd.find((item) => item.value === value)?.id ?? value.replaceAll(' ', '_')
const referenceRows = computed(() => route.query.list === 'scores'
  ? props.payload.scores.map((score) => ({ id: String(score), value: score, type: 'integer', detail: 'See Impact and MTD for score definitions.', active: true }))
  : [...props.payload.expected_mtd.map((item) => ({ id: referenceId(item.value), value: item.value, type: 'string', detail: item.category, active: true })),
      ...['NA', 'SLA'].map((value) => ({ id: referenceId(value), value, type: 'string', detail: 'Workbook reference only: no business function category is defined.', active: false }))])
const sectionSelection = computed({
  get: () => reference.value ? String(route.query.list) : selected.value,
  set: (value: string) => router.replace({ query: { ...route.query, list: value } }),
})

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
  rows.value.push({
    code: '',
    label: '',
    text: null,
    active: rows.value.filter((item) => item.active).length < list.value.maxActive,
  })
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
                {{ reference ? (route.query.list === 'scores' ? 'Impact scores' : 'Expected MTD reference') : list.label }}
              </h2>
              <UBadge
                v-if="list.locked && !reference"
                color="neutral"
                variant="subtle"
                icon="i-lucide-lock"
                label="Fixed codes"
              />
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ reference ? 'Complete workbook reference. Manage durations, categories and scoring guidance under Impact and MTD.' : list.help }}
            </p>
            <p class="mt-1 text-sm text-muted">
              ID identifies an option independently of its order. Value is the stored choice; data type describes it. Code is kept for existing BIA and Excel integrations.
            </p>
          </div>
          <UButton
            v-if="!disabled && !list.locked && !reference"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Add item"
            :disabled="rows.length >= 256"
            @click="add"
          />
        </div>
      </template>

      <div
        v-if="reference"
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[40rem] text-sm">
          <caption class="sr-only">
            {{ route.query.list === 'scores' ? 'Impact scores' : 'Expected MTD reference' }} items
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="p-3">
                ID
              </th><th class="p-3">
                Value
              </th><th class="p-3">
                Data type
              </th><th class="p-3">
                Category / meaning
              </th><th class="p-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="item in referenceRows"
              :key="item.id"
            >
              <td class="p-3 font-mono">
                {{ item.id }}
              </td><td class="p-3">
                {{ item.value }}
              </td><td class="p-3 font-mono">
                {{ item.type }}
              </td><td class="p-3">
                {{ item.detail }}
              </td><td class="p-3">
                {{ item.active ? 'Active' : 'Reference only' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="overflow-x-auto"
      >
        <table
          :key="selected"
          class="w-full min-w-[64rem] text-sm"
        >
          <caption class="sr-only">
            {{ list.label }} items
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th
                scope="col"
                class="w-24 px-3 py-2 ps-4"
              >
                Order
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                ID
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Code
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Value
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Data type
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Label
              </th>
              <th
                scope="col"
                class="px-3 py-2"
              >
                Text
              </th>
              <th
                scope="col"
                class="w-16 px-3 py-2"
              >
                Active
              </th>
              <th
                scope="col"
                class="w-12 px-3 py-2 pe-4"
              >
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
              <td class="max-w-36 px-3 py-2 align-top">
                <span
                  class="block truncate font-mono text-xs text-muted"
                  :title="item.id ?? 'Assigned on save'"
                >{{ item.id ?? 'Assigned on save' }}</span>
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  :model-value="item.code"
                  class="w-full min-w-28 font-mono"
                  :maxlength="list.maxCode"
                  :disabled="disabled || list.locked"
                  :aria-label="'Code ' + (index + 1)"
                  required
                  @update:model-value="setCode(index, $event)"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <span class="inline-block py-1.5 font-mono">{{ item.code || '—' }}</span>
              </td>
              <td class="px-3 py-2 align-top">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  label="string"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="item.label"
                  class="w-full min-w-28"
                  :maxlength="255"
                  :disabled="disabled"
                  :aria-label="'Label ' + (index + 1)"
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
                  :aria-label="'Text ' + (index + 1)"
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
                colspan="9"
                class="px-4 py-6 text-center text-muted"
              >
                Add an item before saving this list.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="list.key === 'alt_site_strategies' && recommendations" class="grid gap-4 border-t border-default p-4">
        <h3 class="font-semibold">Recommended sites by business function category</h3>
        <UFormField v-for="(_, category) in recommendations" :key="category" :label="String(category)">
          <USelectMenu
            v-model="recommendations[category]"
            :items="siteOptions"
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
        The workbook also contains application systems, office locations and organization groups. These follow the existing shared masters instead of being copied into a BIA version.
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
          v-if="can('masterdata.access', 'masterdata.organization.manage')"
          to="/masterdata/organization"
          color="neutral"
          variant="outline"
          label="Organization structure"
        />
        <UButton
          v-if="can('location.master')"
          to="/masterdata/masterbuilding"
          color="neutral"
          variant="outline"
          label="Office locations"
        />
      </div>
    </UCard>
  </div>
</template>
