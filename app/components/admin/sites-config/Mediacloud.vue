<script setup lang="ts">
/**
 * Sites configuration > Past disasters. Media Cloud's news archive as the hazard page's history of
 * each incident hazard, since 2016, with a strict rule: each hazard is searched across all of
 * Indonesia (one of its keywords, set on the GDELT card, in the headline, Indonesian), and a story
 * counts for a city only when its headline also names that city (Indonesia's 514 regencies and
 * cities). BCM switches it on or off, sets how often each hazard is read again and, optionally,
 * picks the Media Cloud collections searched by name (as in Media Cloud's own search: "Select
 * collections…" searches its directory, e.g. Indonesia - National, Indonesia - State & Local),
 * and can read everything again. Media Cloud needs a key on
 * the server: without one the card says so.
 */
import type { RaMediacloudCollection, RaMediacloudFound, RaMediacloudInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-mediacloud', () => sitesConfigApi.mediacloud())

const form = reactive({ enabled: true, every_days: 1 })
/** The collections picked, by name. */
const collections = ref<RaMediacloudCollection[]>([])
watch(data, (value) => {
  if (!value) return
  Object.assign(form, { enabled: value.switched_on, every_days: value.every_days })
  collections.value = value.collections.map((item) => ({ ...item }))
}, { immediate: true })

// "Select collections…": Media Cloud's directory searched by name, as its own search does.
const search = ref('')
const found = ref<RaMediacloudFound[]>([])
const searching = ref(false)
const searchError = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (term) => {
  clearTimeout(timer)
  timer = setTimeout(() => findCollections(term), 300)
})
onBeforeUnmount(() => clearTimeout(timer))
async function findCollections(term: string) {
  searchError.value = null
  if (term.trim().length < 2) {
    found.value = []
    return
  }
  searching.value = true
  try {
    found.value = (await sitesConfigApi.findMediacloudCollections(term.trim())).items
  } catch (failure) {
    found.value = []
    searchError.value = adminErrorText(failure)
  } finally {
    searching.value = false
  }
}
const foundItems = computed(() => found.value
  .filter((item) => !collections.value.some((picked) => picked.id === item.id))
  .map((item) => ({
    label: item.name ?? `Collection ${item.id}`,
    value: item.id,
    description: [item.sources !== null ? `${formatNumber(item.sources, 0)} sources` : null, `id ${item.id}`].filter(Boolean).join(' · '),
  })))
function addCollection(id: number | undefined) {
  const item = found.value.find((row) => row.id === id)
  if (item && !collections.value.some((picked) => picked.id === item.id)) {
    collections.value = [...collections.value, { id: item.id, name: item.name }]
  }
  search.value = ''
}
function removeCollection(id: number) {
  collections.value = collections.value.filter((item) => item.id !== id)
}

const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    const body: RaMediacloudInput = { ...form, collections: collections.value.map((item) => ({ ...item })) }
    data.value = await sitesConfigApi.saveMediacloud(body)
    toast.add({ title: 'Media Cloud settings saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}

async function readAgain() {
  reading.value = true
  try {
    data.value = await sitesConfigApi.readMediacloud()
    toast.add({ title: 'Media Cloud will be read again', description: 'Every city over the next runs, from where each stopped.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="mediacloud-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Incident news history from Media Cloud
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read Media Cloud"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the Media Cloud settings"
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

    <form
      v-else-if="data"
      class="space-y-4"
      novalidate
      @submit.prevent="save"
    >
      <UAlert
        v-if="!data.configured"
        color="warning"
        variant="subtle"
        icon="i-lucide-key-round"
        title="The server has no Media Cloud key"
        description="Media Cloud stays off until the administrator sets MEDIACLOUD_API_KEY."
        data-testid="mediacloud-no-key"
      />
      <UAlert
        v-if="errors.form"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errors.form"
      />
      <p class="text-sm text-muted">
        The hazard page's history of each incident hazard, from {{ formatDate(data.history_start) }}. Each hazard is searched across all of Indonesia: the headline must name it (one of its keywords, set on the GDELT card), in Indonesian. A story then counts for each of Indonesia's {{ formatNumber(data.history.cities, 0) }} regencies and cities its headline names, so a building's city has its history as soon as the hazard is read. Headlines naming no city are not counted.
      </p>
      <p
        v-if="data.example_query"
        class="rounded-md bg-elevated px-3 py-2 font-mono text-xs text-muted"
        data-testid="mediacloud-query"
      >
        {{ data.example_query }}
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Read each hazard again every (days)"
          name="every_days"
          :error="errors.every_days"
        >
          <UInputNumber
            v-model="form.every_days"
            :min="1"
            :max="30"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
      </div>
      <fieldset class="space-y-2">
        <legend class="text-sm font-medium text-highlighted">
          Collections and sources
        </legend>
        <ul
          v-if="collections.length"
          class="divide-y divide-default rounded-md border border-default"
          data-testid="mediacloud-collections"
        >
          <li
            v-for="item in collections"
            :key="item.id"
            class="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <a
              :href="`https://search.mediacloud.org/collections/${item.id}`"
              target="_blank"
              rel="noopener"
              class="text-primary hover:underline"
            >{{ item.name ?? `Collection ${item.id}` }}</a>
            <UButton
              v-if="editable"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-circle-minus"
              :aria-label="`Remove ${item.name ?? `collection ${item.id}`}`"
              @click="removeCollection(item.id)"
            />
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          No collection picked: every source in Indonesian is searched.
        </p>
        <USelectMenu
          v-if="editable"
          v-model:search-term="search"
          :model-value="undefined"
          :items="foundItems"
          value-key="value"
          ignore-filter
          :loading="searching"
          :disabled="!data.configured"
          placeholder="Select collections…"
          aria-label="Select Media Cloud collections"
          class="w-full sm:w-80"
          @update:model-value="addCollection"
        >
          <template #empty>
            {{ searchError ?? (search.trim().length < 2 ? 'Type a name, e.g. Indonesia.' : 'No collection has that name.') }}
          </template>
        </USelectMenu>
        <p class="text-xs text-muted">
          Search Media Cloud's collections by name, as in its own search (e.g. Indonesia - National, Indonesia - State &amp; Local). New collections read every hazard again from 2016.
        </p>
        <p
          v-if="errors.collections"
          class="text-sm text-error"
        >
          {{ errors.collections }}
        </p>
      </fieldset>

      <p
        class="text-sm text-muted"
        data-testid="mediacloud-status"
      >
        {{ formatNumber(data.history.hazards, 0) }} incident {{ data.history.hazards === 1 ? 'hazard' : 'hazards' }} across Indonesia: {{ formatNumber(data.history.complete, 0) }} read up to date, {{ formatNumber(data.history.due, 0) }} due{{ data.history.read_until && data.history.complete < data.history.hazards ? ` (history read up to ${formatDate(data.history.read_until)})` : '' }}. {{ formatNumber(data.history.stories, 0) }} stories read, {{ formatNumber(data.history.tagged, 0) }} naming a regency or city{{ data.history.held_from ? `, counted from ${formatDate(data.history.held_from)}` : '' }}.
      </p>
      <UAlert
        v-if="data.history.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The last read had a problem"
        :description="data.history.error"
        :ui="{ description: 'whitespace-pre-line' }"
      />
      <div
        v-if="editable"
        class="flex flex-wrap justify-end gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Read again"
          :loading="reading"
          :disabled="!data.configured"
          @click="readAgain"
        />
        <UButton
          type="submit"
          label="Save Media Cloud settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source: {{ data.source }}.
      </p>
    </form>
  </UCard>
</template>
