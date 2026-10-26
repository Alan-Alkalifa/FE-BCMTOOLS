<script setup lang="ts">
import type { SccaApplication } from '~/composables/useScca'

/**
 * Pick an active application from the application master, by code or name. Used by the
 * Application tab (Annual review, System change) and for upstream/downstream applications.
 * There is no free typing: an application that isn't listed is added in Administration >
 * Applications, or assessed with the reason New application.
 */
const model = defineModel<number | null>({ default: null })

const props = withDefaults(defineProps<{
  /** How the current value reads before the list loads, e.g. from the saved SCCA. */
  selected?: { code: string | null, name: string } | null
  /** An application to leave out (the SCCA's own). */
  exclude?: number | null
  /** Applications already used, shown as taken. */
  taken?: number[]
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
}>(), {
  selected: null,
  exclude: null,
  taken: () => [],
  ariaLabel: undefined,
  placeholder: 'Search by application code or name',
  disabled: false,
})
const emit = defineEmits<{ pick: [application: SccaApplication | null] }>()

interface Item {
  label: string
  value: number
  description?: string
  disabled?: boolean
  application?: SccaApplication
}

const search = ref('')
const found = ref<SccaApplication[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function describe(application: SccaApplication) {
  const last = application.last_assessment
  const parts = [application.application_name]
  if (application.category) parts.push(application.category)
  parts.push(last ? `last SCCA ${formatDate(last.assessment_date) ?? ''} · ${sccaStatus[last.status].label}`.trim() : 'no SCCA yet')
  return parts.join(' · ')
}

const items = computed<Item[]>(() => {
  const list: Item[] = found.value
    .filter((application) => application.application_id !== props.exclude)
    .map((application) => ({
      label: application.application_code ?? application.application_name,
      value: application.application_id,
      description: props.taken.includes(application.application_id) && application.application_id !== model.value
        ? `${describe(application)} · already added`
        : describe(application),
      disabled: props.taken.includes(application.application_id) && application.application_id !== model.value,
      application,
    }))
  if (model.value && !list.some((item) => item.value === model.value)) {
    list.unshift({
      label: props.selected?.code ?? props.selected?.name ?? `#${model.value}`,
      value: model.value,
      description: props.selected?.name,
    })
  }
  return list
})

async function load(term: string) {
  loading.value = true
  try {
    found.value = (await sccaApi.applications(term)).items
  } catch {
    found.value = []
  } finally {
    loading.value = false
  }
}

watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => load(term), 300)
})
onMounted(() => load(''))
onBeforeUnmount(() => clearTimeout(timer))

function onUpdate(value: number | null | undefined) {
  const item = items.value.find((row) => row.value === value) ?? null
  model.value = item?.value ?? null
  emit('pick', item?.application ?? null)
}
</script>

<template>
  <USelectMenu
    v-model:search-term="search"
    :model-value="model ?? undefined"
    :items="items"
    value-key="value"
    ignore-filter
    :loading="loading"
    :placeholder="props.placeholder"
    :search-input="{ placeholder: 'Application code or name' }"
    :aria-label="props.ariaLabel"
    :disabled="props.disabled"
    :clear="!!model && !props.disabled"
    class="w-full"
    @update:model-value="onUpdate"
    @clear="onUpdate(null)"
  >
    <template #empty>
      <span class="text-sm text-muted">No active application matches. Ask BCM to add it in Administration &gt; Applications.</span>
    </template>
  </USelectMenu>
</template>
