<script setup lang="ts">
import type { BiancaMtdOption } from '~/composables/useBiancaConfigAdmin'
import type { MtdMaster, MtdSuggested } from '~/composables/useMtdMaster'

/**
 * Administration › Master data › Master MTD: the MTD choices of the BIA, saved at once (no
 * draft). Each BIA configuration version keeps a copy, so a change reaches new BIAs with the
 * next published BIA configuration version and never changes an existing BIA.
 */
definePageMeta({ permission: ['masterdata.mtd.view', 'masterdata.mtd.manage'] })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can } = useAuth()
const manage = computed(() => can('masterdata.mtd.manage'))
const editBiaConfig = computed(() => can('bianca.config.view'))
const { data, error, status, refresh } = await useFetch<MtdMaster>('/api/masterdata/mtd', { key: 'mtd-master' })

const parts = [
  { label: 'Suggested MTD', value: 'suggested', icon: 'i-lucide-lightbulb' },
  { label: 'Expected & dependency MTD', value: 'options', icon: 'i-lucide-timer' },
] as const
type Part = typeof parts[number]['value']
const part = computed<Part>({
  get: () => route.query.part === 'options' ? 'options' : 'suggested',
  set: (value) => router.replace({ query: { ...route.query, part: value } }),
})

const suggested = ref<MtdSuggested[]>([])
const options = ref<BiancaMtdOption[]>([])
function reset(master = data.value) {
  suggested.value = structuredClone(toRaw(master?.suggested ?? []))
  options.value = structuredClone(toRaw(master?.options ?? []))
}
watch(data, (master) => reset(master), { immediate: true })
const dirtySuggested = computed(() => JSON.stringify(suggested.value) !== JSON.stringify(data.value?.suggested ?? []))
const dirtyOptions = computed(() => JSON.stringify(options.value) !== JSON.stringify(data.value?.options ?? []))
const dirty = computed(() => dirtySuggested.value || dirtyOptions.value)
const dirtyPart = computed(() => part.value === 'suggested' ? dirtySuggested.value : dirtyOptions.value)
useUnsavedChanges(dirty)

const busy = ref(false)
const failure = ref<string | null>(null)
async function save() {
  if (!manage.value || !dirtyPart.value || busy.value) return
  busy.value = true
  failure.value = null
  try {
    const saved = part.value === 'suggested'
      ? await mtdMasterApi.saveSuggested(suggested.value.map((row) => ({ ...row, value: row.value.trim(), description: row.description?.trim() || null })))
      : await mtdMasterApi.saveOptions(options.value.map((row) => ({ ...row, code: row.code.trim(), value: row.value.trim(), description: row.description?.trim() || null })))
    // The reload resets both parts; keep the unsaved edits of the other one.
    const savedPart = part.value
    const kept = structuredClone(toRaw(savedPart === 'suggested' ? options.value : suggested.value))
    data.value = saved
    await nextTick()
    if (savedPart === 'suggested') options.value = kept as BiancaMtdOption[]
    else suggested.value = kept as MtdSuggested[]
    clearNuxtData((key) => key === 'bianca-config-admin')
    toast.add({ title: 'Master MTD saved', description: saved.draft_version ? `Draft BIA configuration ${saved.draft_version} now uses it.` : 'New BIAs use it from the next published BIA configuration version.', color: 'success' })
  } catch (err) {
    failure.value = biancaConfigError(err)
  } finally { busy.value = false }
}
function discard() {
  failure.value = null
  if (part.value === 'suggested') suggested.value = structuredClone(toRaw(data.value?.suggested ?? []))
  else options.value = structuredClone(toRaw(data.value?.options ?? []))
}

function move<T>(rows: T[], index: number, delta: -1 | 1) {
  const [row] = rows.splice(index, 1)
  rows.splice(index + delta, 0, row!)
}
const pinned = (value: string) => data.value?.rule_users[value]
const noDuration = (value: string) => value === 'NA' || value === 'SLA'
function hours(value: string) {
  const result = mtdHours(value, data.value?.hours_per_day ?? 8, data.value?.days_per_week ?? 5)
  return result == null ? '—' : formatNumber(result)
}
function setOptionValue(row: BiancaMtdOption, value: string) {
  row.value = value
  if (noDuration(value.trim())) {
    row.use_it = false
    row.category = null
  }
}
const categories = ['Business Critical', 'Important', 'Others']
const noCategory = '__none__'
const categoryItems = [{ label: 'No category', value: noCategory }, ...categories.map((value) => ({ label: value, value }))]
function addSuggested() {
  suggested.value.push({ value: '', label: '', description: null, active: true })
}
function addOption() {
  options.value.push({ code: '', value: '', label: '', category: 'Others', description: null, use_it: true, use_non_it: true, active: true })
}
</script>

<template>
  <AppPage
    title="Master MTD"
    icon="i-lucide-timer"
    description="The MTD choices of the BIA. Saved at once, without a draft."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Master MTD' }]"
  >
    <template #actions>
      <template v-if="manage && data">
        <UButton
          v-if="dirtyPart"
          label="Discard changes"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="discard"
        />
        <UButton
          icon="i-lucide-save"
          label="Save"
          :loading="busy"
          :disabled="!dirtyPart"
          @click="save"
        />
      </template>
    </template>

    <UAlert
      v-if="error"
      title="Could not load Master MTD"
      color="error"
      :description="adminErrorText(error)"
    >
      <template #actions>
        <UButton
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>
    <template v-else-if="data">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Used from the next BIA configuration version"
      >
        <template #description>
          <p>
            Each BIA configuration version keeps a copy of these choices, so an existing BIA never changes.
            <template v-if="data.draft_version">
              The draft <strong>{{ data.draft_version }}</strong> follows this master; new BIAs use the change once it is published.
            </template>
            <template v-else>
              New BIAs use a change once a new BIA configuration version is published{{ data.active_version ? ` (now ${data.active_version})` : '' }}.
            </template>
          </p>
        </template>
        <template
          v-if="editBiaConfig"
          #actions
        >
          <UButton
            to="/admin/bianca-config"
            color="neutral"
            variant="outline"
            label="Open BIA configuration"
          />
        </template>
      </UAlert>

      <UTabs
        v-model="part"
        :items="[...parts]"
        variant="link"
        :content="false"
      />
      <UAlert
        v-if="failure"
        color="error"
        title="Not saved"
        :description="failure"
      />

      <UCard
        v-if="part === 'suggested'"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1 basis-60">
              <h2 class="font-semibold text-highlighted">
                Suggested MTD
              </h2>
              <p class="mt-1 text-sm text-muted">
                Part 1 choices (workbook MST_MTD Time, Suggested). Use a positive duration such as 4 hours, 1 day or 2 weeks. A choice the Suggested MTD rule uses stays active.
              </p>
            </div>
            <UButton
              v-if="manage"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              label="Add Suggested MTD"
              :disabled="suggested.length >= 256"
              @click="addSuggested"
            />
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[48rem] text-sm">
            <caption class="sr-only">
              Suggested MTD
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
                  Duration
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
                  Description
                </th>
                <th
                  scope="col"
                  class="w-20 px-3 py-2 text-right"
                >
                  Hours
                </th>
                <th
                  scope="col"
                  class="w-28 px-3 py-2"
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
                v-for="(row, index) in suggested"
                :key="index"
              >
                <td class="px-3 py-2 ps-4 align-top">
                  <div class="flex h-8 items-center gap-0.5 tabular-nums">
                    <span class="me-1 min-w-4 text-xs text-muted">{{ index + 1 }}</span>
                    <template v-if="manage">
                      <UButton
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-arrow-up"
                        :disabled="index === 0"
                        :aria-label="`Move ${row.value || 'row ' + (index + 1)} up`"
                        @click="move(suggested, index, -1)"
                      />
                      <UButton
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-arrow-down"
                        :disabled="index === suggested.length - 1"
                        :aria-label="`Move ${row.value || 'row ' + (index + 1)} down`"
                        @click="move(suggested, index, 1)"
                      />
                    </template>
                  </div>
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    v-model="row.value"
                    class="w-full min-w-28 font-mono"
                    :maxlength="16"
                    placeholder="4 hours"
                    :disabled="!manage || !!pinned(row.value)"
                    :aria-label="`Duration ${index + 1}`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    v-model="row.label"
                    class="w-full min-w-28"
                    :maxlength="255"
                    :disabled="!manage"
                    :aria-label="`Label ${index + 1}`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    :model-value="row.description ?? ''"
                    class="w-full min-w-28"
                    :maxlength="255"
                    :disabled="!manage"
                    :aria-label="`Description ${index + 1}`"
                    @update:model-value="row.description = String($event) || null"
                  />
                </td>
                <td class="px-3 py-2 text-right align-top tabular-nums">
                  <span class="inline-block py-1.5">{{ hours(row.value) }}</span>
                </td>
                <td class="px-3 py-2 align-top">
                  <div class="flex flex-col gap-1 pt-1.5">
                    <USwitch
                      v-model="row.active"
                      :disabled="!manage || !!pinned(row.value)"
                      :aria-label="`${row.value || 'Row ' + (index + 1)} active`"
                    />
                    <UBadge
                      v-if="pinned(row.value)"
                      color="neutral"
                      variant="subtle"
                      icon="i-lucide-lock"
                      :label="`Rule ${pinned(row.value)}`"
                      :title="`Used by the Suggested MTD rule of BIA configuration ${pinned(row.value)}`"
                    />
                  </div>
                </td>
                <td class="px-3 py-2 pe-4 text-right align-top">
                  <UButton
                    v-if="manage && !pinned(row.value)"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    :aria-label="`Remove ${row.value || 'row ' + (index + 1)}`"
                    @click="suggested.splice(index, 1)"
                  />
                </td>
              </tr>
              <tr v-if="!suggested.length">
                <td
                  colspan="7"
                  class="px-4 py-6 text-center text-muted"
                >
                  Add a Suggested MTD before saving.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard
        v-else
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1 basis-60">
              <h2 class="font-semibold text-highlighted">
                Expected & dependency MTD
              </h2>
              <p class="mt-1 text-sm text-muted">
                MTD IT is offered as Expected MTD (Part 2a) and sets the business function category. MTD Non IT is offered for upstream and downstream dependencies (Part 2b). NA and SLA have no category or hours and are non-IT only.
              </p>
            </div>
            <UButton
              v-if="manage"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              label="Add MTD"
              :disabled="options.length >= 66"
              @click="addOption"
            />
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[76rem] text-sm">
            <caption class="sr-only">
              Expected and dependency MTD
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
                  Workbook value
                </th>
                <th
                  scope="col"
                  class="px-3 py-2"
                >
                  Name
                </th>
                <th
                  scope="col"
                  class="px-3 py-2"
                >
                  Business function category
                </th>
                <th
                  scope="col"
                  class="w-20 px-3 py-2 text-right"
                >
                  Hours
                </th>
                <th
                  scope="col"
                  class="px-3 py-2"
                >
                  Description
                </th>
                <th
                  scope="col"
                  class="w-20 px-3 py-2"
                >
                  MTD IT
                </th>
                <th
                  scope="col"
                  class="w-20 px-3 py-2"
                >
                  MTD Non IT
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
                v-for="(row, index) in options"
                :key="index"
              >
                <td class="px-3 py-2 ps-4 align-top">
                  <div class="flex h-8 items-center gap-0.5 tabular-nums">
                    <span class="me-1 min-w-4 text-xs text-muted">{{ index + 1 }}</span>
                    <template v-if="manage">
                      <UButton
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-arrow-up"
                        :disabled="index === 0"
                        :aria-label="`Move ${row.value || 'row ' + (index + 1)} up`"
                        @click="move(options, index, -1)"
                      />
                      <UButton
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-arrow-down"
                        :disabled="index === options.length - 1"
                        :aria-label="`Move ${row.value || 'row ' + (index + 1)} down`"
                        @click="move(options, index, 1)"
                      />
                    </template>
                  </div>
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    v-model="row.code"
                    class="w-full min-w-24 font-mono"
                    :maxlength="64"
                    :disabled="!manage"
                    :aria-label="`Code ${index + 1}`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    :model-value="row.value"
                    class="w-full min-w-28 font-mono"
                    :maxlength="16"
                    placeholder="4 hours"
                    :disabled="!manage"
                    :aria-label="`Workbook value ${index + 1}`"
                    @update:model-value="setOptionValue(row, String($event))"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    v-model="row.label"
                    class="w-full min-w-28"
                    :maxlength="255"
                    :disabled="!manage"
                    :aria-label="`Name ${index + 1}`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <USelect
                    :model-value="row.category ?? noCategory"
                    :items="categoryItems"
                    class="w-full min-w-40"
                    :disabled="!manage || noDuration(row.value.trim())"
                    :aria-label="`Business function category ${index + 1}`"
                    @update:model-value="row.category = $event === noCategory ? null : String($event)"
                  />
                </td>
                <td class="px-3 py-2 text-right align-top tabular-nums">
                  <span class="inline-block py-1.5">{{ hours(row.value) }}</span>
                </td>
                <td class="px-3 py-2 align-top">
                  <UInput
                    :model-value="row.description ?? ''"
                    class="w-full min-w-28"
                    :maxlength="2000"
                    :disabled="!manage"
                    :aria-label="`Description ${index + 1}`"
                    @update:model-value="row.description = String($event) || null"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <USwitch
                    v-model="row.use_it"
                    class="pt-1.5"
                    :disabled="!manage || noDuration(row.value.trim())"
                    :aria-label="`${row.value || 'Row ' + (index + 1)} for MTD IT`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <USwitch
                    v-model="row.use_non_it"
                    class="pt-1.5"
                    :disabled="!manage"
                    :aria-label="`${row.value || 'Row ' + (index + 1)} for MTD Non IT`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <USwitch
                    v-model="row.active"
                    class="pt-1.5"
                    :disabled="!manage"
                    :aria-label="`${row.value || 'Row ' + (index + 1)} active`"
                  />
                </td>
                <td class="px-3 py-2 pe-4 text-right align-top">
                  <UButton
                    v-if="manage"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    :aria-label="`Remove ${row.value || 'row ' + (index + 1)}`"
                    @click="options.splice(index, 1)"
                  />
                </td>
              </tr>
              <tr v-if="!options.length">
                <td
                  colspan="11"
                  class="px-4 py-6 text-center text-muted"
                >
                  Add an MTD before saving.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        Loading…
      </p>
    </template>
  </AppPage>
</template>
