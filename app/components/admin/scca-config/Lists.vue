<script setup lang="ts">
import type { SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/**
 * The choice lists of a version. An item has a code (stored on the SCCA), a label (on the
 * form), a report text (printed in the Excel cell and the PDF) and, for some lists, rules.
 * Codes already published are retired (inactive), never removed; category codes are fixed.
 */
const props = defineProps<{ version: SccaConfigVersion }>()
const emit = defineEmits<{ saved: [version: SccaConfigVersion] }>()

const route = useRoute()
const router = useRouter()

const name = computed<SccaListName>({
  get: () => (SCCA_LIST_NAMES.includes(route.query.list as SccaListName) ? route.query.list as SccaListName : 'assessment_reason'),
  set: (value) => router.replace({ query: { ...route.query, list: value } }),
})

type Rule = { key: string, label: string, kind: 'bool' | 'int' | 'number' | 'color', help?: string }
const RULES: Partial<Record<SccaListName, Rule[]>> = {
  assessment_reason: [
    { key: 'renewal', label: 'Renewal reason', kind: 'bool', help: 'Start renewal uses it. Exactly one.' },
    { key: 'custom_due_date', label: 'Custom due date', kind: 'bool', help: 'The assessor picks a sooner renewal date.' },
  ],
  category: [
    { key: 'rank', label: 'Rank', kind: 'int', help: '5 is the most critical.' },
    { key: 'a3_rating', label: 'A3 rating', kind: 'int', help: 'The A3 note suggests this rating.' },
    { key: 'color', label: 'Colour', kind: 'color' },
  ],
  hours: [{ key: 'hours', label: 'Hours', kind: 'number', help: 'Empty for NA. Gap checks compare these.' }],
  rpo: [{ key: 'rank', label: 'Rank', kind: 'int', help: '1 is the tightest. Empty: not a commitment.' }],
  ha: [{ key: 'counts_as_ha', label: 'Counts as HA', kind: 'bool' }],
  dr_capacity: [{ key: 'percent', label: 'Percent', kind: 'number' }],
  dependency: [
    { key: 'counts_for_a3', label: 'Counts for A3', kind: 'bool', help: 'The A3 note uses these systems.' },
    { key: 'needs_workaround', label: 'Needs a workaround', kind: 'bool' },
  ],
}
const COLORS = ['error', 'warning', 'info', 'success', 'primary', 'neutral'].map((value) => ({ label: value, value }))

const listItems = computed(() => SCCA_LIST_NAMES.map((value) => ({
  label: props.version.list_labels[value] ?? value,
  value,
  count: props.version.lists[value]?.filter((item) => item.active).length ?? 0,
})))

const version = computed(() => props.version)
const parts = Object.fromEntries(SCCA_LIST_NAMES.map((list) => [list, useConfigPart(
  version,
  (value) => value.lists[list] ?? [],
  (code, items) => sccaConfigApi.setList(code, list, items.map((item) => ({ ...item, report_text: item.report_text?.trim() || null }))),
  (saved) => emit('saved', saved),
  `${props.version.list_labels[list] ?? list} saved`,
)])) as Record<SccaListName, ReturnType<typeof useConfigPart<SccaConfigItem[]>>>
const part = computed(() => parts[name.value])
const items = computed(() => part.value.draft.value)
const fixedCodes = computed(() => name.value === 'category')
const rules = computed(() => RULES[name.value] ?? [])

function move(index: number, by: -1 | 1) {
  const rows = items.value
  const target = index + by
  if (target < 0 || target >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row!)
}

function add() {
  items.value.push({ code: '', label: '', report_text: null, active: true, attrs: {} })
}

function remove(index: number) {
  items.value.splice(index, 1)
}

function setNumber(item: SccaConfigItem, key: string, value: number | null | undefined) {
  item.attrs = { ...item.attrs, [key]: value ?? null }
}

function setBool(item: SccaConfigItem, key: string, value: boolean | 'indeterminate') {
  item.attrs = Object.fromEntries(
    [...Object.entries(item.attrs).filter(([name]) => name !== key), ...(value === true ? [[key, true]] : [])],
  )
}

const isDirty = (list: SccaListName) => parts[list].dirty.value
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <UCard :ui="{ body: 'p-2 sm:p-2' }">
      <nav aria-label="Lists">
        <ul class="space-y-0.5">
          <li
            v-for="item in listItems"
            :key="item.value"
          >
            <UButton
              block
              color="neutral"
              :variant="item.value === name ? 'soft' : 'ghost'"
              class="justify-between"
              :aria-current="item.value === name ? 'page' : undefined"
              @click="name = item.value"
            >
              <span class="truncate">{{ item.label }}</span>
              <span class="flex items-center gap-1 text-xs text-muted tabular-nums">
                <UIcon
                  v-if="isDirty(item.value)"
                  name="i-lucide-circle-dot"
                  class="size-3 text-warning"
                  aria-label="Unsaved changes"
                />
                {{ item.count }}
              </span>
            </UButton>
          </li>
        </ul>
      </nav>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              {{ version.list_labels[name] }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              <template v-if="fixedCodes">
                The five category codes are fixed (the formula's matrix uses them). Change their labels, colours and order.
              </template>
              <template v-else>
                The code is stored on each SCCA. Report text prints in the Excel cell and the PDF (default: the label). Retire an item with Active off: SCCAs that use it keep it.
              </template>
            </p>
          </div>
          <div
            v-if="version.can.edit"
            class="flex gap-2"
          >
            <UButton
              v-if="!fixedCodes"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              label="Add item"
              @click="add"
            />
            <UButton
              icon="i-lucide-save"
              label="Save list"
              :disabled="!part.dirty.value"
              :loading="part.busy.value"
              @click="part.submit()"
            />
          </div>
        </div>
      </template>
      <UAlert
        v-if="part.error.value"
        class="m-4"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't save the list"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="part.error.value"
      />
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">
            {{ version.list_labels[name] }} items
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="px-3 py-2 ps-4">
                Order
              </th>
              <th class="px-3 py-2">
                Code
              </th>
              <th class="px-3 py-2">
                Label
              </th>
              <th class="px-3 py-2">
                Report text
              </th>
              <th
                v-for="rule in rules"
                :key="rule.key"
                class="px-3 py-2"
              >
                <span :title="rule.help">{{ rule.label }}</span>
              </th>
              <th class="px-3 py-2">
                Active
              </th>
              <th class="px-3 py-2 pe-4">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(item, index) in items"
              :key="index"
            >
              <td class="px-3 py-2 ps-4 align-top">
                <div class="flex gap-0.5">
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-arrow-up"
                    :disabled="!version.can.edit || index === 0"
                    :aria-label="`Move ${item.label || 'item'} up`"
                    @click="move(index, -1)"
                  />
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-arrow-down"
                    :disabled="!version.can.edit || index === items.length - 1"
                    :aria-label="`Move ${item.label || 'item'} down`"
                    @click="move(index, 1)"
                  />
                </div>
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="item.code"
                  class="min-w-40 font-mono"
                  :disabled="!version.can.edit || fixedCodes"
                  :aria-label="`Code ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="item.label"
                  class="min-w-40"
                  :disabled="!version.can.edit"
                  :aria-label="`Label ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  :model-value="item.report_text ?? ''"
                  class="min-w-36"
                  :placeholder="item.label"
                  :disabled="!version.can.edit"
                  :aria-label="`Report text ${index + 1}`"
                  @update:model-value="item.report_text = String($event)"
                />
              </td>
              <td
                v-for="rule in rules"
                :key="rule.key"
                class="px-3 py-2 align-top"
              >
                <UCheckbox
                  v-if="rule.kind === 'bool'"
                  :model-value="item.attrs[rule.key] === true"
                  :disabled="!version.can.edit"
                  :aria-label="`${rule.label} ${index + 1}`"
                  @update:model-value="setBool(item, rule.key, $event)"
                />
                <USelect
                  v-else-if="rule.kind === 'color'"
                  :model-value="String(item.attrs[rule.key] ?? 'neutral')"
                  :items="COLORS"
                  class="min-w-28"
                  :disabled="!version.can.edit"
                  :aria-label="`${rule.label} ${index + 1}`"
                  @update:model-value="item.attrs = { ...item.attrs, [rule.key]: $event }"
                />
                <UInputNumber
                  v-else
                  :model-value="item.attrs[rule.key] == null ? undefined : Number(item.attrs[rule.key])"
                  :step="rule.kind === 'int' ? 1 : 0.5"
                  :min="0"
                  class="w-24"
                  :disabled="!version.can.edit"
                  :aria-label="`${rule.label} ${index + 1}`"
                  @update:model-value="setNumber(item, rule.key, $event)"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USwitch
                  v-model="item.active"
                  :disabled="!version.can.edit || fixedCodes"
                  :aria-label="`${item.label || 'Item'} active`"
                />
              </td>
              <td class="px-3 py-2 pe-4 text-right align-top">
                <UButton
                  v-if="version.can.edit && !fixedCodes"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  :aria-label="`Remove ${item.label || 'item'}`"
                  @click="remove(index)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template
        v-if="version.can.edit && part.dirty.value"
        #footer
      >
        <div class="flex justify-end">
          <UButton
            color="neutral"
            variant="outline"
            label="Undo changes"
            @click="part.reset()"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
