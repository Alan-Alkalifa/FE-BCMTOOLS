<script setup lang="ts">
/**
 * Sites configuration > Past disasters. GDELT's news. On the building map, incident news only
 * (the hazards set as Incident, shown in the Type column; BMKG, GDACS and NASA FIRMS cover the
 * disasters): the places news of the last 7 days mentions for each incident hazard's GDELT
 * themes (read every hour) whose headline names the hazard and the place, with the buildings
 * within the incident radius. On the hazard page, Indonesian news naming the building's city
 * with each hazard's keywords (each city read again every N days, kept from the first read).
 * BCM switches it on or off, sets the radius, the interval, the themes and keywords per hazard
 * (comma-separated), can go back to the defaults and read everything again.
 */
import type { RaGdeltInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-gdelt', () => sitesConfigApi.gdelt())
const { data: hazardTypes } = useRaHazardTypes()
const hazards = computed(() => hazardTypes.value?.items ?? [])

const form = reactive({ enabled: true, incident_radius_km: 2, every_days: 1 })
/** Per hazard, the themes and keywords as typed (comma-separated). */
const themes = ref<Record<string, string>>({})
const keywords = ref<Record<string, string>>({})
const joined = (lists: Record<string, string[]>) => Object.fromEntries(Object.entries(lists).map(([code, words]) => [code, words.join(', ')]))
function fill(source: { themes: Record<string, string[]>, keywords: Record<string, string[]> }) {
  themes.value = joined(source.themes)
  keywords.value = joined(source.keywords)
}
watch(data, (value) => {
  if (!value) return
  Object.assign(form, { enabled: value.enabled, incident_radius_km: value.incident_radius_km, every_days: value.every_days })
  fill(value)
}, { immediate: true })

function useDefaults() {
  if (data.value) fill({ themes: data.value.default_themes, keywords: data.value.default_keywords })
}
const split = (text: string | undefined) => (text ?? '').split(',').map((word) => word.trim()).filter(Boolean)
function lists(typed: Record<string, string>) {
  return Object.fromEntries(Object.entries(typed).map(([code, text]) => [code, split(text)]).filter(([, words]) => words!.length))
}

const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    const body: RaGdeltInput = { ...form, themes: lists(themes.value), keywords: lists(keywords.value) }
    data.value = await sitesConfigApi.saveGdelt(body)
    toast.add({ title: 'GDELT settings saved', color: 'success', icon: 'i-lucide-circle-check' })
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
    data.value = await sitesConfigApi.readGdelt()
    toast.add({ title: 'GDELT will be read again', description: 'The map within 2 minutes, every city over the next runs.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="gdelt-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Incident news from GDELT
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read GDELT"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the GDELT settings"
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
        v-if="errors.form"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errors.form"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Radius around incident news (km)"
          name="incident_radius_km"
          :error="errors.incident_radius_km"
          help="An incident is local: a building within it is listed with the news."
        >
          <UInputNumber
            v-model="form.incident_radius_km"
            :min="0.2"
            :max="50"
            :step="0.1"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Read each city's news again every (days)"
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

      <div class="max-h-[28rem] overflow-y-auto rounded-md border border-default">
        <table class="w-full text-sm">
          <caption class="sr-only">
            GDELT themes and keywords per hazard
          </caption>
          <thead class="sticky top-0 z-10 bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-56 px-3 py-2">
                Hazard
              </th>
              <th class="w-24 px-3 py-2">
                Type
              </th>
              <th class="px-3 py-2">
                Map themes (GDELT)
              </th>
              <th class="px-3 py-2">
                Keywords (map titles and history)
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="hazard in hazards"
              :key="hazard.code"
            >
              <td class="px-3 py-2 align-top">
                {{ hazard.code }} · {{ hazard.short_name }}
              </td>
              <td class="px-3 py-2 align-top">
                <UBadge
                  :color="data.hazard_types[hazard.code] === 'incident' ? 'warning' : 'neutral'"
                  variant="outline"
                  size="sm"
                  :label="data.hazard_types[hazard.code] === 'incident' ? 'Incident' : 'Disaster'"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UFormField
                  :name="`themes.${hazard.code}`"
                  :error="errors[`themes.${hazard.code}`]"
                >
                  <UInput
                    v-model="themes[hazard.code]"
                    :disabled="!editable"
                    class="w-full"
                    :aria-label="`GDELT themes for ${hazard.code}`"
                  />
                  <p
                    v-if="data.hazard_types[hazard.code] !== 'incident'"
                    class="mt-1 text-xs text-muted"
                  >
                    Not on the map while it is a disaster.
                  </p>
                </UFormField>
              </td>
              <td class="px-3 py-2 align-top">
                <UFormField
                  :name="`keywords.${hazard.code}`"
                  :error="errors[`keywords.${hazard.code}`]"
                >
                  <UInput
                    v-model="keywords[hazard.code]"
                    :disabled="!editable"
                    class="w-full"
                    :aria-label="`Keywords for ${hazard.code}`"
                  />
                </UFormField>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-xs text-muted">
        The map shows incident news only. GDELT tags themes and places from the whole article, so a news place shows only when its article's headline names both the hazard (one of its keywords) and that place.
      </p>
      <p
        class="text-sm text-muted"
        data-testid="gdelt-status"
      >
        <template v-if="data.polled_at">
          Map read {{ formatDateTime(data.polled_at) }}, {{ formatNumber(data.points, 0) }} news places shown.
          Titles: {{ formatNumber(data.titles.kept, 0) }} {{ data.titles.kept === 1 ? 'article' : 'articles' }} kept, {{ formatNumber(data.titles.dropped, 0) }} left out (the hazard or the place only in the body){{ data.titles.waiting ? `, ${formatNumber(data.titles.waiting, 0)} waiting to be checked` : '' }}.
        </template>
        <template v-else>
          Map not read yet.
        </template>
        History of {{ formatNumber(data.history.cities, 0) }} {{ data.history.cities === 1 ? 'city' : 'cities' }}: {{ formatNumber(data.history.read, 0) }} of {{ formatNumber(data.history.pairs, 0) }} city and hazard pairs read, {{ formatNumber(data.history.due, 0) }} due{{ data.history.held_from ? `, counted from ${formatDate(data.history.held_from)}` : '' }}.
      </p>
      <UAlert
        v-if="data.poll_error || data.history.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The last read had a problem"
        :description="[data.poll_error, data.history.error].filter(Boolean).join('\n')"
        :ui="{ description: 'whitespace-pre-line' }"
      />
      <div
        v-if="editable"
        class="flex flex-wrap justify-end gap-2"
      >
        <UButton
          color="neutral"
          variant="ghost"
          label="Use the defaults"
          @click="useDefaults"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Read again"
          :loading="reading"
          @click="readAgain"
        />
        <UButton
          type="submit"
          label="Save GDELT settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source: {{ data.source }} (<a
          :href="data.themes_url"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >GDELT themes</a>).
      </p>
    </form>
  </UCard>
</template>
