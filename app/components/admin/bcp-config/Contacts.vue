<script setup lang="ts">
import type { BcpConfigVersion } from '~/composables/useBcpConfigAdmin'

/**
 * Defaults every new BCP starts with: internal contacts (appendix 6), emergency numbers
 * (appendix 13), what the alternate site needs (appendix 11) and the readiness checklist
 * (appendix 12). Each BCP can change its own copy.
 */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'contacts', (saved) => emit('saved', saved), 'Contacts saved')

type Column = { key: string, label: string, wide?: boolean }
const TABLES = [
  {
    key: 'internal', title: 'Internal contacts (appendix 6)', add: 'Add contact', prefix: 'contact',
    columns: [
      { key: 'name', label: 'Name', wide: true }, { key: 'organization', label: 'Division / department', wide: true },
      { key: 'service', label: 'Support given' }, { key: 'phone_mobile', label: 'Mobile' },
      { key: 'phone_office', label: 'Office' }, { key: 'email', label: 'Email' },
    ] as Column[],
  },
  {
    key: 'emergency', title: 'Emergency numbers (appendix 13)', add: 'Add number', prefix: 'e',
    columns: [{ key: 'name', label: 'Public service', wide: true }, { key: 'phone', label: 'Phone' }, { key: 'fax', label: 'Fax' }] as Column[],
  },
  {
    key: 'needs_categories', title: 'Alternate site needs (appendix 11)', add: 'Add category', prefix: 'need',
    columns: [{ key: 'label', label: 'Item' }, { key: 'example', label: 'Example', wide: true }] as Column[],
  },
  {
    key: 'checklist', title: 'Readiness checklist (appendix 12)', add: 'Add item', prefix: 'c',
    columns: [{ key: 'label', label: 'Item', wide: true }] as Column[],
  },
] as const

type Key = (typeof TABLES)[number]['key']
function rows(key: Key) {
  return draft.value[key] as unknown as Record<string, string>[]
}
function add(key: Key, prefix: string, columns: Column[]) {
  const list = rows(key)
  list.push({ code: bcpCodeFrom(prefix, list.map((row) => row.code!)), ...Object.fromEntries(columns.map((column) => [column.key, ''])) })
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Contacts and checklists"
    description="What every new BCP starts with. Each BCP adjusts its own copy to its location and dependencies."
    save-label="Save contacts"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <section
      v-for="table in TABLES"
      :key="table.key"
      class="space-y-3"
    >
      <h3 class="text-sm font-semibold text-highlighted">
        {{ table.title }}
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-sm">
          <caption class="sr-only">
            {{ table.title }}
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th
                v-for="column in table.columns"
                :key="column.key"
                scope="col"
                class="px-3 py-2"
                :class="column.wide ? 'min-w-56' : 'min-w-32'"
              >
                {{ column.label }}
              </th>
              <th class="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(row, index) in rows(table.key)"
              :key="index"
            >
              <td
                v-for="column in table.columns"
                :key="column.key"
                class="px-3 py-2 align-top"
              >
                <UInput
                  v-model="row[column.key]"
                  class="w-full"
                  maxlength="255"
                  :aria-label="`${column.label} of row ${index + 1} in ${table.title}`"
                />
              </td>
              <td class="px-3 py-2 text-right align-top">
                <UButton
                  v-if="version.can.edit"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Remove row ${index + 1} of ${table.title}`"
                  @click="rows(table.key).splice(index, 1)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UButton
        v-if="version.can.edit"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        :label="table.add"
        @click="add(table.key, table.prefix, table.columns)"
      />
    </section>
  </AdminBcpConfigPartForm>
</template>
