<script setup lang="ts">
definePageMeta({ permission: ['masterdata.access', 'masterdata.organization.manage'] })
interface Unit {
  directorate: string
  sub_directorate: string | null
  org_group: string | null
}
const levels = [
  { label: 'Directorate', value: 'directorate' },
  { label: 'Sub directorate', value: 'sub_directorate' },
  { label: 'Group', value: 'org_group' },
] as const
type Level = typeof levels[number]['value']
const { can } = useAuth()
const toast = useToast()
const orgRevision = useBiancaOrgRevision()
const endpoint = '/api/masterdata/organization'
const { data, error, status, refresh } = await useFetch<{ items: Unit[] }>(endpoint)
const units = computed(() => data.value?.items ?? [])
const level = ref<Level>('directorate')
const label = computed(() => levels.find(item => item.value === level.value)!.label)
const columns = computed(() => levels.slice(0, levels.findIndex(item => item.value === level.value) + 1))
const adding = ref(false)
const saving = ref(false)
const failure = ref('')
const name = ref('')
const directorate = ref<string>()
const sub = ref<string>()
const search = ref('')
const dirs = computed(() => [...new Set(units.value.map(unit => unit.directorate))])
const subs = computed(() => [...new Set(units.value.filter(unit => unit.directorate === directorate.value)
  .flatMap(unit => unit.sub_directorate ? [unit.sub_directorate] : []))])
const rows = computed(() => {
  const paths = new Map<string, string[]>()
  for (const unit of units.value) {
    const path = columns.value.map(col => unit[col.value] || '')
    if (path.every(Boolean) && path.some(part => part.toLowerCase().includes(search.value.trim().toLowerCase()))) {
      paths.set(JSON.stringify(path), path)
    }
  }
  return [...paths.values()]
})
function reset() {
  adding.value = false
  name.value = ''
  directorate.value = undefined
  sub.value = undefined
  failure.value = ''
}
watch(level, reset)
watch(directorate, () => { sub.value = undefined })
async function save() {
  if (saving.value) return
  saving.value = true
  failure.value = ''
  const body = {
    directorate: level.value === 'directorate' ? name.value.trim() : directorate.value,
    sub_directorate: level.value === 'sub_directorate' ? name.value.trim() : sub.value || '',
    org_group: level.value === 'org_group' ? name.value.trim() : '',
  }
  try {
    await $fetch(endpoint, { method: 'POST', body })
    orgRevision.value++
    await refresh()
    toast.add({ title: label.value + ' added', color: 'success' })
    reset()
  } catch (err) {
    failure.value = biancaConfigError(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppPage title="Organization structure" icon="i-lucide-network"
    description="Manage the directorates, sub directorates and groups available to BIA."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Organization structure' }]"
  >
    <UTabs v-model="level" :items="levels.map(item => ({ ...item, disabled: saving }))" :content="false" />
    <UAlert
      v-if="error"
      color="error"
      title="Could not load the organization structure"
    >
      <template #actions>
        <UButton label="Try again" @click="refresh()" />
      </template>
    </UAlert>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="search"
          placeholder="Search units"
          aria-label="Search units"
          icon="i-lucide-search"
        />
        <UButton
          v-if="can('masterdata.organization.manage') && !adding"
          :label="'Add ' + label.toLowerCase()"
          icon="i-lucide-plus"
          @click="adding = true"
        />
      </div>
      <UCard v-if="adding">
        <form class="space-y-4" @submit.prevent="save">
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField
              v-if="level !== 'directorate'"
              label="Parent directorate"
              required
            >
              <USelectMenu
                v-model="directorate"
                :items="dirs"
                aria-label="Parent directorate"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="level === 'org_group'"
              label="Parent sub directorate"
              required
            >
              <USelectMenu
                v-model="sub"
                :items="subs"
                :disabled="!directorate"
                aria-label="Parent sub directorate"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="label + ' name'" required>
              <UInput
                v-model="name"
                :aria-label="label + ' name'"
                required
                :maxlength="255"
                class="w-full"
              />
            </UFormField>
          </div>
          <p v-if="failure" role="alert" class="text-sm text-error">{{ failure }}</p>
          <div class="flex gap-2">
            <UButton
              type="submit"
              label="Save unit"
              :loading="saving"
              :disabled="!name.trim() || (level !== 'directorate' && !directorate) || (level === 'org_group' && !sub)"
            />
            <UButton
              type="button"
              label="Cancel"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="reset"
            />
          </div>
        </form>
      </UCard>
      <div class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-left text-sm">
          <thead class="bg-muted">
            <tr>
              <th v-for="col in columns" :key="col.value" scope="col" class="p-3">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="path in rows" :key="JSON.stringify(path)">
              <td v-for="(part, i) in path" :key="i" class="p-3">{{ part }}</td>
            </tr>
            <tr v-if="!rows.length">
              <td :colspan="columns.length" class="p-3 text-muted">{{ status === 'pending' ? 'Loading units…' : 'No matching units.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AppPage>
</template>
