<script setup lang="ts">
const model = defineModel<string>()

const props = withDefaults(defineProps<{ placeholder?: string }>(), {
  placeholder: 'Search by name or email',
})

interface DirectoryUser {
  display_name: string | null
  email: string | null
  job_title: string | null
  department: string | null
}

const search = ref('')
const items = ref<{ label: string, value: string, description?: string }[]>([])
let timer: ReturnType<typeof setTimeout> | undefined

function withCurrent(next: { label: string, value: string, description?: string }[]) {
  if (model.value && !next.some((item) => item.value === model.value)) {
    return [{ label: model.value, value: model.value }, ...next]
  }
  return next
}

async function load(term: string) {
  let data: { items: DirectoryUser[] }
  try {
    data = await $fetch<{ items: DirectoryUser[] }>('/api/users', { query: { q: term } })
  } catch {
    items.value = withCurrent([])
    return
  }
  items.value = withCurrent(
    data.items.flatMap((user) => {
      const value = user.display_name || user.email
      if (!value) return []
      return [{
        label: value,
        value,
        description: [user.job_title, user.department, user.email].filter(Boolean).join(' · ') || undefined,
      }]
    }),
  )
}

watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => load(term), 300)
})
onMounted(() => load(''))
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <USelectMenu
    v-model="model"
    v-model:search-term="search"
    :items="items"
    value-key="value"
    ignore-filter
    :placeholder="props.placeholder"
    class="w-full"
  />
</template>
