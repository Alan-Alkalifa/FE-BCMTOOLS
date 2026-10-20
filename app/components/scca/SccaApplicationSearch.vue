<script setup lang="ts">
import type { SccaApplication } from '~/composables/useScca'

/**
 * Application name on a new assessment: search the applications already assessed in SCCA by
 * name or code, or type a new name. Picking one emits `pick` so the form can copy its header.
 */
const model = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{ ariaLabel?: string }>(), { ariaLabel: undefined })
const emit = defineEmits<{ pick: [application: SccaApplication | null] }>()

interface Item {
  label: string
  value: string
  description?: string
  application?: SccaApplication
}

const search = ref('')
const found = ref<SccaApplication[]>([])
/** The chosen item stays listed while later searches return other applications. */
const chosen = ref<Item | null>(model.value ? newItem(model.value) : null)
let timer: ReturnType<typeof setTimeout> | undefined

function newItem(name: string): Item {
  return { label: name, value: `new:${name}`, description: 'New application' }
}

function keyOf(application: SccaApplication) {
  return `app:${application.application_code ?? ''}:${application.application_name}`
}

function describe(application: SccaApplication) {
  const last = application.last_assessment
  const when = last.assessment_date ? `last SCCA ${formatDate(last.assessment_date)}` : 'last SCCA'
  return [application.application_code, `${when} · ${sccaStatus[last.status].label}`]
    .filter(Boolean)
    .join(' · ')
}

const items = computed<Item[]>(() => {
  const list: Item[] = found.value.map((application) => ({
    label: application.application_name,
    value: keyOf(application),
    description: describe(application),
    application,
  }))
  if (chosen.value && !list.some((item) => item.value === chosen.value!.value)) {
    list.unshift(chosen.value)
  }
  return list
})

async function load(term: string) {
  try {
    found.value = (await sccaApi.applications(term)).items
  } catch {
    found.value = []
  }
}

watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => load(term), 300)
})
watch(model, (value) => {
  if (!value) chosen.value = null
})
onMounted(() => load(''))
onBeforeUnmount(() => clearTimeout(timer))

function onUpdate(value: string | null | undefined) {
  const item = items.value.find((row) => row.value === value) ?? null
  chosen.value = item
  model.value = item?.label ?? ''
  emit('pick', item?.application ?? null)
}

function onCreate(term: string) {
  const name = term.trim()
  if (!name) return
  chosen.value = newItem(name)
  model.value = name
  emit('pick', null)
}
</script>

<template>
  <USelectMenu
    v-model:search-term="search"
    :model-value="chosen?.value"
    :items="items"
    value-key="value"
    ignore-filter
    :create-item="{ when: 'always', position: 'bottom' }"
    placeholder="Search an application or type a new name"
    :search-input="{ placeholder: 'Application name or code' }"
    :aria-label="props.ariaLabel"
    :clear="!!model"
    class="w-full"
    @update:model-value="onUpdate"
    @create="onCreate"
    @clear="onUpdate(null)"
  />
</template>
