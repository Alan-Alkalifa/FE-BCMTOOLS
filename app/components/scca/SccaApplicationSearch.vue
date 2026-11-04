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
  /** The SCCA's reason: an Annual review or a System change lists only what the user's access
   * scope opens, and greys out what the reason rules refuse (no final SCCA, an open SCCA, a
   * System change while the renewal is overdue). */
  reason?: string | null
  /** The draft being edited (its own open SCCA doesn't count). */
  assessmentId?: number | null
}>(), {
  reason: null,
  assessmentId: null,
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
const scopeMessage = ref<string | null>(null)
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const RENEWAL: Record<string, string> = {
  overdue: 'renewal overdue',
  due_30: 'renewal due in 30 days',
  due_90: 'renewal due in 31–90 days',
  active: 'renewal active',
}

function describe(application: SccaApplication) {
  if (application.available === false && application.problem) {
    return `${application.application_name} · ${application.problem}`
  }
  const last = application.last_assessment
  const parts = [application.application_name]
  if (application.category) parts.push(application.category)
  if (application.last_final) {
    parts.push(`last final ${application.last_final.ref_no ?? ''}`.trim())
    if (application.renewal_status) parts.push(RENEWAL[application.renewal_status] ?? application.renewal_status)
  } else {
    parts.push(last ? `last SCCA ${formatDate(last.assessment_date) ?? ''} · ${sccaStatus[last.status].label}`.trim() : 'no SCCA yet')
  }
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
      disabled: (props.taken.includes(application.application_id) || application.available === false)
        && application.application_id !== model.value,
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
    const data = await sccaApi.applications(term, props.reason, props.assessmentId)
    found.value = data.items
    scopeMessage.value = data.scope_message ?? null
  } catch {
    found.value = []
    scopeMessage.value = null
  } finally {
    loading.value = false
  }
}

watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => load(term), 300)
})
onMounted(() => load(''))
watch(() => props.reason, () => load(search.value))
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
      <span
        v-if="scopeMessage"
        class="text-sm text-muted"
      >{{ scopeMessage }}</span>
      <span
        v-else
        class="text-sm text-muted"
      >No active application matches. Ask BCM to add it in Administration &gt; Applications.</span>
    </template>
  </USelectMenu>
</template>
