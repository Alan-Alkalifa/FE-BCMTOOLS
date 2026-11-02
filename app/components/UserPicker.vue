<script setup lang="ts">
/**
 * Search the BCM Tools users (people who have signed in at least once) and pick one by id.
 * `selected` labels the current value before the first search returns it.
 */
export interface PickedUser {
  id: number
  display_name: string | null
  email: string | null
  job_title: string | null
  department: string | null
  division?: string | null
  directorate?: string | null
  org_level?: string | null
}

const model = defineModel<number | null>()

const props = withDefaults(defineProps<{
  selected?: PickedUser | null
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  /** Only list users holding this permission (e.g. `scca.access` for SCCA participants). */
  permission?: string
  /** Another search with the same answer shape (e.g. the Generate annual review contributors). */
  endpoint?: string
}>(), {
  selected: null,
  placeholder: 'Search by name or email',
  disabled: false,
  ariaLabel: undefined,
  permission: undefined,
  endpoint: '/api/users',
})

const emit = defineEmits<{ pick: [user: PickedUser | null] }>()

const search = ref('')
const found = ref<PickedUser[]>([])
let timer: ReturnType<typeof setTimeout> | undefined

function label(user: PickedUser) {
  return user.display_name || user.email || `User ${user.id}`
}

const items = computed(() => {
  const users = [...found.value]
  if (props.selected && !users.some((user) => user.id === props.selected!.id)) {
    users.unshift(props.selected)
  }
  return users.map((user) => ({
    label: label(user),
    value: user.id,
    // Job Name, organization level and Division (or department), as the HR file has them.
    description: [user.job_title, user.org_level, user.division || user.department, user.email].filter(Boolean).join(' · ') || undefined,
  }))
})

async function load(term: string) {
  try {
    const data = await $fetch<{ items: PickedUser[] }>(props.endpoint, {
      query: { q: term, ...(props.permission ? { permission: props.permission } : {}) },
    })
    found.value = data.items
  } catch {
    found.value = []
  }
}

watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => load(term), 300)
})
onMounted(() => load(''))
onBeforeUnmount(() => clearTimeout(timer))

function onUpdate(value: number | null | undefined) {
  model.value = value ?? null
  const user = [...found.value, ...(props.selected ? [props.selected] : [])].find((row) => row.id === value)
  emit('pick', user ?? null)
}
</script>

<template>
  <USelectMenu
    v-model:search-term="search"
    :model-value="model ?? undefined"
    :items="items"
    value-key="value"
    ignore-filter
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    :clear="!props.disabled && model != null"
    class="w-full"
    @update:model-value="onUpdate"
    @clear="onUpdate(null)"
  />
</template>
