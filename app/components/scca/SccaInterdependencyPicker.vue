<script setup lang="ts">
import type { Application } from '~/composables/useApplications'

/**
 * A3 Interdependency > Add applications: the application list as a table, to tick several
 * applications at once (across pages and searches). Each row shows what the interdependency
 * will take from the application's current final SCCA: category, RTO, RPO and DR capacity.
 */
const props = defineProps<{
  /** 'upstream' | 'downstream', for the title. */
  directionLabel: string
  /** The SCCA's own application: not listed. */
  exclude: number | null
  /** Already listed in this direction: shown, but can't be ticked again. */
  taken: number[]
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ add: [applications: Application[]] }>()

const PER_PAGE = 10
const q = ref('')
const search = ref('')
let typing: ReturnType<typeof setTimeout> | undefined
watch(q, (value) => {
  clearTimeout(typing)
  typing = setTimeout(() => {
    search.value = value
  }, 300)
})
onBeforeUnmount(() => clearTimeout(typing))
const page = ref(1)
const loading = ref(false)
const failed = ref<string | null>(null)
const items = ref<Application[]>([])
const total = ref(0)
const picked = ref(new Map<number, Application>())

async function load() {
  loading.value = true
  failed.value = null
  try {
    const result = await applicationsApi.list({
      q: search.value.trim() || undefined,
      active: '1',
      characteristics: '1',
      exclude: props.exclude ?? undefined,
      page: page.value,
      per_page: PER_PAGE,
    })
    items.value = result.items
    total.value = result.total
  } catch (error) {
    failed.value = apiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(search, () => {
  page.value = 1
})
watch([open, search, page], () => {
  if (open.value) load()
}, { immediate: true })
watch(open, (value) => {
  if (value) {
    picked.value = new Map()
    q.value = ''
    search.value = ''
  }
})

const takenIds = computed(() => new Set(props.taken))
const selectable = computed(() => items.value.filter((row) => !takenIds.value.has(row.id)))
const allOnPage = computed(() =>
  selectable.value.length > 0 && selectable.value.every((row) => picked.value.has(row.id)),
)

function toggle(row: Application, value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  if (value === true) next.set(row.id, row)
  else next.delete(row.id)
  picked.value = next
}

function togglePage(value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  for (const row of selectable.value) {
    if (value === true) next.set(row.id, row)
    else next.delete(row.id)
  }
  picked.value = next
}

function add() {
  emit('add', [...picked.value.values()])
  open.value = false
}

function finalOf(row: Application) {
  const final = row.characteristics?.final
  if (!final) return null
  return `${final.ref_no}${final.finalised_at ? ` · ${formatDate(final.finalised_at)}` : ''}`
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Add ${directionLabel.toLowerCase()}`"
    description="Tick the applications to add. Category, RTO, RPO and DR capacity come from each application's current final SCCA."
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Search by code or name"
          class="w-full"
          aria-label="Search applications"
          autofocus
        />
        <UAlert
          v-if="failed"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failed"
        />
        <div class="overflow-x-auto rounded-md border border-default">
          <table class="w-full min-w-3xl text-sm">
            <caption class="sr-only">
              Applications
            </caption>
            <thead>
              <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th class="w-10 px-3 py-2">
                  <UCheckbox
                    :model-value="allOnPage"
                    :disabled="!selectable.length"
                    aria-label="Tick every application on this page"
                    @update:model-value="togglePage"
                  />
                </th>
                <th class="px-3 py-2">
                  Application
                </th>
                <th class="px-3 py-2">
                  Category
                </th>
                <th class="px-3 py-2">
                  RTO (hours)
                </th>
                <th class="px-3 py-2">
                  RPO
                </th>
                <th class="px-3 py-2">
                  DR capacity (%)
                </th>
                <th class="px-3 py-2">
                  Current SCCA
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="row in items"
                :key="row.id"
                :class="takenIds.has(row.id) ? 'opacity-60' : 'cursor-pointer hover:bg-elevated/50'"
                @click="!takenIds.has(row.id) && toggle(row, !picked.has(row.id))"
              >
                <td
                  class="px-3 py-2 align-top"
                  @click.stop
                >
                  <UCheckbox
                    :model-value="takenIds.has(row.id) || picked.has(row.id)"
                    :disabled="takenIds.has(row.id)"
                    :aria-label="`Add ${row.application_name}`"
                    @update:model-value="toggle(row, $event)"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <p class="font-medium">
                    {{ row.application_name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ row.application_code }}<template v-if="takenIds.has(row.id)">
                      · already listed
                    </template>
                  </p>
                </td>
                <td class="px-3 py-2 align-top">
                  <StatusBadge
                    v-if="row.characteristics?.criticality_category"
                    :scale="sccaCategory"
                    :value="row.characteristics.criticality_category as SccaCategory"
                    size="sm"
                  />
                  <span
                    v-else
                    class="text-muted"
                  >—</span>
                </td>
                <td class="px-3 py-2 align-top tabular-nums">
                  {{ row.characteristics?.rto || '—' }}
                </td>
                <td class="px-3 py-2 align-top">
                  {{ row.characteristics?.rpo || '—' }}
                </td>
                <td class="px-3 py-2 align-top tabular-nums">
                  {{ row.characteristics?.dr_capacity || '—' }}
                </td>
                <td class="px-3 py-2 align-top text-xs">
                  <span
                    v-if="finalOf(row)"
                    class="font-mono"
                  >{{ finalOf(row) }}</span>
                  <span
                    v-else
                    class="text-warning"
                  >No final SCCA: enter the values</span>
                </td>
              </tr>
              <tr v-if="!loading && !items.length">
                <td
                  colspan="7"
                  class="px-3 py-6 text-center text-muted"
                >
                  {{ search ? 'No active application matches.' : 'No active applications.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-muted">
            {{ formatNumber(picked.size, 0) }} selected
          </p>
          <UPagination
            v-if="total > PER_PAGE"
            v-model:page="page"
            :total="total"
            :items-per-page="PER_PAGE"
            size="sm"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          icon="i-lucide-plus"
          :label="picked.size ? `Add ${picked.size} application${picked.size === 1 ? '' : 's'}` : 'Add applications'"
          :disabled="!picked.size"
          @click="add"
        />
      </div>
    </template>
  </UModal>
</template>
