<script setup lang="ts">
import type { RaCrisisType } from '~/composables/useRa'

/**
 * Sites configuration > Disaster or incident: whether each hazard is a disaster or an incident. A
 * crisis follows its hazard: it is declared, monitored and approved in that menu (Disaster or
 * Incident). Live for everyone as soon as it is saved, and audited; a crisis already declared
 * moves with its hazard. By default the Natural disasters (H01-H09) are disasters.
 */
const toast = useToast()
const { data, status, error, refresh } = useRaHazardTypes()

const draft = ref<Record<string, RaCrisisType>>({})
watch(data, (value) => {
  draft.value = Object.fromEntries((value?.items ?? []).map((item) => [item.code, item.type]))
}, { immediate: true })

const editable = computed(() => !!data.value?.can_edit)
const groups = computed(() => {
  const found = new Map<string, { label: string, items: NonNullable<typeof data.value>['items'] }>()
  for (const item of data.value?.items ?? []) {
    const key = item.category?.code ?? ''
    if (!found.has(key)) found.set(key, { label: item.category?.label ?? 'Other', items: [] })
    found.get(key)!.items.push(item)
  }
  return [...found.values()]
})
const changed = computed(() => (data.value?.items ?? []).filter((item) => draft.value[item.code] !== item.type))
const counts = computed(() => {
  const values = Object.values(draft.value)
  return { disaster: values.filter((value) => value === 'disaster').length, incident: values.filter((value) => value === 'incident').length }
})
const typeItems = [
  { label: 'Disaster', value: 'disaster' },
  { label: 'Incident', value: 'incident' },
]

const busy = ref(false)
const failure = ref<string | null>(null)
async function save() {
  failure.value = null
  busy.value = true
  try {
    await sitesConfigApi.saveHazardTypes(Object.fromEntries(changed.value.map((item) => [item.code, draft.value[item.code]!])))
    await refresh()
    refreshNuxtData('ra-map')
    toast.add({ title: 'Saved', description: 'Disasters and incidents follow their hazard from now on.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    failure.value = adminErrorText(err)
  } finally {
    busy.value = false
  }
}

function reset() {
  draft.value = Object.fromEntries((data.value?.items ?? []).map((item) => [item.code, item.type]))
}
</script>

<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the hazards"
      :description="adminErrorText(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>

    <SkeletonCard
      v-else-if="status === 'pending' && !data"
      :lines="8"
    />

    <div v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-semibold text-highlighted">
                Disaster or incident
              </h2>
              <p class="text-sm text-muted">
                {{ counts.disaster }} disaster {{ counts.disaster === 1 ? 'hazard' : 'hazards' }}, {{ counts.incident }} incident {{ counts.incident === 1 ? 'hazard' : 'hazards' }}.
              </p>
            </div>
            <div
              v-if="editable"
              class="flex gap-2"
            >
              <UButton
                color="neutral"
                variant="outline"
                label="Undo changes"
                :disabled="!changed.length || busy"
                @click="reset"
              />
              <UButton
                icon="i-lucide-save"
                :label="changed.length ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'Save'"
                :disabled="!changed.length"
                :loading="busy"
                @click="save"
              />
            </div>
          </div>
        </template>

        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failure"
          class="m-4"
        />

        <section
          v-for="group in groups"
          :key="group.label"
          :aria-label="group.label"
        >
          <h3 class="bg-muted px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
            {{ group.label }}
          </h3>
          <ul class="divide-y divide-default">
            <li
              v-for="item in group.items"
              :key="item.code"
              class="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
            >
              <div class="min-w-0">
                <p class="font-medium">
                  <span class="text-muted tabular-nums">{{ item.code }}</span> {{ item.short_name }}
                </p>
                <p
                  v-if="draft[item.code] !== item.default_type"
                  class="text-xs text-muted"
                >
                  Default: {{ RA_CRISIS_TYPES[item.default_type].label }}
                </p>
              </div>
              <URadioGroup
                v-model="draft[item.code]"
                :items="typeItems"
                orientation="horizontal"
                :disabled="!editable"
                :aria-label="`${item.code} ${item.short_name}`"
              />
            </li>
          </ul>
        </section>
      </UCard>
    </div>
  </div>
</template>
