<script setup lang="ts">
import type { BiancaListItems } from '~/composables/useBiancaConfigAdmin'
import { BIANCA_LISTS } from '~/utils/bianca-config'

defineProps<{ disabled: boolean }>()
const model = defineModel<BiancaListItems>({ required: true })
const route = useRoute()
const router = useRouter()

const list = computed(() => BIANCA_LISTS.find(({ key }) => key === route.query.list) ?? BIANCA_LISTS[0]!)
const selected = computed({
  get: () => list.value.key,
  set: (value: string) => router.replace({ query: { ...route.query, list: value } }),
})
const rows = computed(() => model.value[list.value.key])
const menu = computed(() => BIANCA_LISTS.map(({ key, label }) => ({
  value: key,
  label,
  count: model.value[key].filter((item) => item.active).length,
})))

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
  <AdminBiancaConfigSectionLayout
    v-model="selected"
    label="Lists"
    :items="menu"
    flush
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 basis-60">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-highlighted">
              {{ list.label }}
            </h2>
            <UBadge
              v-if="list.locked"
              color="neutral"
              variant="subtle"
              icon="i-lucide-lock"
              label="Fixed codes"
            />
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ list.help }}
          </p>
          <p class="mt-1 text-sm text-muted">
            Code is the workbook value. Label is the display name. Text is optional report wording.
          </p>
        </div>
        <UButton
          v-if="!disabled && !list.locked"
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

    <div class="overflow-x-auto">
      <table
        :key="selected"
        class="w-full min-w-[44rem] text-sm"
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
              Code
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
            <td class="px-3 py-2 align-top">
              <UInput
                v-model="item.code"
                class="w-full min-w-28 font-mono"
                :maxlength="list.maxCode"
                :disabled="disabled || list.locked"
                :aria-label="'Code ' + (index + 1)"
                required
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
              colspan="6"
              class="px-4 py-6 text-center text-muted"
            >
              Add an item before saving this list.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminBiancaConfigSectionLayout>
</template>
