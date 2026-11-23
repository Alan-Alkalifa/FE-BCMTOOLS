<script setup lang="ts">
/**
 * Pick one row of a master table that lives in the database (application systems or office
 * locations), searched by name or code as you type. Nothing is typed in free: what isn't in the
 * list is added in the master (Administration).
 */
interface Row { id: number, label: string, code?: string | null, rto?: string | null, rpo?: string | null, address?: string | null }

const model = defineModel<number | undefined>()
const props = withDefaults(defineProps<{
  kind: 'applications' | 'locations'
  /** How the saved value reads before the list loads. */
  selected?: Row | null
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
}>(), { selected: null, placeholder: 'Search by name or code', ariaLabel: undefined, disabled: false })
const emit = defineEmits<{ pick: [row: Row | null] }>()

const search = ref('')
const found = ref<Row[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function load(term: string) {
  loading.value = true
  try {
    const { items } = props.kind === 'applications' ? await biancaApi.applications(term) : await biancaApi.locations(term)
    found.value = items as Row[]
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
onMounted(() => load(''))
onBeforeUnmount(() => clearTimeout(timer))

const items = computed(() => {
  const rows = [...found.value]
  if (props.selected && !rows.some((row) => row.id === props.selected!.id)) {
    rows.unshift(props.selected)
  }
  return rows.map((row) => ({ label: row.label, value: row.id, row }))
})

function onChange(value: number | null | undefined) {
  model.value = value ?? undefined
  emit('pick', items.value.find((item) => item.value === value)?.row ?? null)
}
</script>

<template>
  <USelectMenu
    v-model:search-term="search"
    :model-value="model"
    :items="items"
    value-key="value"
    label-key="label"
    :loading="loading"
    ignore-filter
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-label="ariaLabel"
    class="w-full"
    @update:model-value="onChange"
  >
    <template #empty>
      {{ kind === 'applications' ? 'No active application matches.' : 'No office location matches.' }}
    </template>
  </USelectMenu>
</template>
