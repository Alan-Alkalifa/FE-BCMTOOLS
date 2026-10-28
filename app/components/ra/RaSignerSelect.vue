<script setup lang="ts">
import type { RaUserRef } from '~/composables/useRa'

/**
 * Picks the BCM Tools user who signs a role; the model is their users.id. Only active users who
 * hold `ra.access` (and so can open the assessment to approve it) are listed.
 */
const model = defineModel<number | null>({ required: true })

const props = withDefaults(defineProps<{
  /** The signer already assigned, so their name shows before any search. */
  current?: RaUserRef | null
  disabled?: boolean
  placeholder?: string
}>(), {
  current: null,
  disabled: false,
  placeholder: 'Search by name or email',
})
const emit = defineEmits<{ picked: [user: RaUserRef | null] }>()

interface DirectoryUser {
  id: number
  display_name: string | null
  email: string | null
  job_title: string | null
  department: string | null
  mobile_phone?: string | null
}

interface Item {
  label: string
  value: number
  description?: string
  user: RaUserRef
}

const search = ref('')
const found = ref<Item[]>([])
let timer: ReturnType<typeof setTimeout> | undefined

function toItem(user: RaUserRef & { department?: string | null }): Item {
  return {
    label: user.name || user.email || `User ${user.id}`,
    value: user.id,
    description: [user.job_title, user.department, user.email].filter(Boolean).join(' · ') || undefined,
    user,
  }
}

const items = computed(() => {
  const current = props.current && !found.value.some((item) => item.value === props.current!.id)
    ? [toItem(props.current)]
    : []
  return [...current, ...found.value]
})

async function load(term: string) {
  try {
    const data = await $fetch<{ items: DirectoryUser[] }>('/api/users', { query: { q: term, permission: 'ra.access' } })
    found.value = data.items.map((user) => toItem({
      id: user.id,
      name: user.display_name,
      email: user.email,
      job_title: user.job_title,
      department: user.department,
      mobile_phone: user.mobile_phone ?? null,
    }))
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

const selected = computed({
  get: () => model.value ?? undefined,
  set: (value: number | undefined) => {
    model.value = value ?? null
    emit('picked', items.value.find((item) => item.value === value)?.user ?? null)
  },
})
</script>

<template>
  <USelectMenu
    v-model="selected"
    v-model:search-term="search"
    :items="items"
    value-key="value"
    ignore-filter
    :disabled="disabled"
    :placeholder="placeholder"
    class="w-full"
  />
</template>
