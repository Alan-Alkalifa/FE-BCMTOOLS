<script setup lang="ts">
import type { BiancaPerson } from '~/composables/useBianca'

/**
 * The person (a user of the directory), searched by name, email or NIP; the people of `group`
 * come first. `pick` fires with the person, or null when cleared. A name typed before (an Excel
 * upload naming someone who isn't a user) shows as `typedName` until someone is picked.
 */
const model = defineModel<number | undefined>()
const props = withDefaults(defineProps<{
  selected?: BiancaPerson | null
  typedName?: string
  group?: string
  disabled?: boolean
  ariaLabel?: string
}>(), {
  selected: null,
  typedName: undefined,
  group: undefined,
  disabled: false,
  ariaLabel: 'Find a person',
})
const emit = defineEmits<{ pick: [person: BiancaPerson | null] }>()

const TYPED = -1
const search = ref('')
const found = ref<BiancaPerson[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function load(term: string) {
  loading.value = true
  try {
    found.value = (await biancaApi.people(term, props.group)).items
  } catch {
    found.value = []
  } finally {
    loading.value = false
  }
}

watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => load(term.trim()), 250)
})
watch(() => props.group, () => load(search.value.trim()))
onMounted(() => load(''))
onBeforeUnmount(() => clearTimeout(timer))

const items = computed(() => {
  const rows = [...found.value]
  if (props.selected && !rows.some((row) => row.id === props.selected!.id)) rows.unshift(props.selected)
  const out = rows.map((person) => ({
    label: person.label,
    value: person.id,
    description: [person.job_title, person.org_group].filter(Boolean).join(' · ') || undefined,
  }))
  if (model.value == null && props.typedName) {
    out.unshift({ label: props.typedName, value: TYPED, description: 'Typed, not from the user directory' })
  }
  return out
})
const value = computed(() => model.value ?? (props.typedName ? TYPED : undefined))

function onChange(id: number | null | undefined) {
  if (id === TYPED) return
  const person = id == null ? null : found.value.find((row) => row.id === id) ?? (props.selected?.id === id ? props.selected : null)
  model.value = person?.id
  emit('pick', person)
}
</script>

<template>
  <div class="flex gap-2">
    <USelectMenu
      v-model:search-term="search"
      :model-value="value"
      :items="items"
      value-key="value"
      label-key="label"
      description-key="description"
      :loading="loading"
      ignore-filter
      icon="i-lucide-user-search"
      placeholder="Find by name, email or NIP"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="w-full"
      @update:model-value="onChange"
    >
      <template #empty>
        Nobody in the user directory matches.
      </template>
    </USelectMenu>
    <UButton
      v-if="!disabled && value != null"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      :aria-label="`Clear ${ariaLabel}`"
      @click="onChange(null)"
    />
  </div>
</template>
