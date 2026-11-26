<script setup lang="ts">
import type { RaCrisis, RaCrisisPlace, RaCrisisType, RaMapMarker } from '~/composables/useRa'
import RaCrisisModal from '~/components/ra/RaCrisisModal.vue'
import RaCrisisNoteModal from '~/components/ra/RaCrisisNoteModal.vue'

/**
 * One disaster (or incident, `type`): where and what, the affected area on the map, and for
 * every affected building or branch what to do — BCM's guidebook steps, its own RA for the
 * hazard, its contacts, call tree and recovery team, and the nearest places outside the area.
 * The history is kept beside it.
 *
 * While the disaster is open or waiting for approval, "Update disaster" (top bar) and "Add
 * update" (under the history) open the update dialog for whoever may manage it: the radius and
 * the rest, with the update itself (required). Anyone else adds an update as a note.
 * Opened under the other type's path (its hazard's type changed), it moves to its own.
 */
const props = defineProps<{ type: RaCrisisType }>()

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data: crisis, status, error, refresh } = useRaCrisis(id)
const { data: map } = useRaMap()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !crisis.value)
const toast = useToast()
const crisisModal = useOverlay().create(RaCrisisModal)
const noteModal = useOverlay().create(RaCrisisNoteModal)
const actionError = ref<string | null>(null)

/** Its own type once loaded: Disaster or Incident, in the words and the crumbs. */
const t = computed(() => RA_CRISIS_TYPES[crisis.value?.type ?? props.type])
watch(() => crisis.value?.type, (type) => {
  if (type && type !== props.type) navigateTo({ path: crisisPath(id.value, type), query: route.query }, { replace: true })
}, { immediate: true })

const place = computed(() => (crisis.value ? raCrisisPlaceName(crisis.value) : ''))
const title = computed(() => (crisis.value ? `${crisis.value.hazard.short_name} at ${place.value}` : t.value.label))
const markers = computed(() => (crisis.value ? raCrisisMarkers(crisis.value) : []))
const circles = computed(() => (crisis.value ? raCrisisCircles(crisis.value) : []))

const openPlaces = ref<string[]>([])
watch(() => crisis.value?.affected[0]?.location.id, (first) => {
  if (first && !openPlaces.value.length) openPlaces.value = [String(first)]
}, { immediate: true })
const accordionItems = computed(() => (crisis.value?.affected ?? []).map((row) => ({
  value: String(row.location.id),
  label: row.location.name,
  row,
})))

function onMarker(markerId: number, variant: RaMapMarker['variant']) {
  if (variant === 'crisis') return
  const key = String(markerId)
  if (!openPlaces.value.includes(key)) openPlaces.value = [...openPlaces.value, key]
  nextTick(() => document.getElementById(`place-${markerId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function assessmentUrl(row: RaCrisisPlace) {
  return raRecordPath(row.assessment!.kind, row.assessment!)
}
/** Without RA access the RA is named, not linked. */
const canOpenRa = useCanOpenRa()

/** A building's page is in Master building: linked only for who may open it. */
const { can } = useAuth()
function locationUrl(location: { id: number, kind: string }) {
  return can('sites.master') ? masterBuildingPath(location.id) : undefined
}

function set(next: RaCrisis) {
  crisis.value = next
  // The building map shows open and pending disasters and incidents: let it follow the
  // approval, rejection, update or closing straight away.
  refreshNuxtData('ra-map')
}

async function edit() {
  if (!crisis.value) return
  const saved = await crisisModal.open({ places: map.value?.places ?? [], crisis: crisis.value }).result
  if (saved) {
    set(saved)
    toast.add({ title: `${t.value.label} updated`, color: 'success', icon: 'i-lucide-circle-check' })
  }
}

/** Open or waiting for approval: it can still get updates. */
const updatable = computed(() => crisis.value?.status === 'open' || crisis.value?.status === 'pending')

/** Add update: the update dialog for whoever may manage it; a note for anyone else. */
async function addUpdate() {
  if (!crisis.value) return
  if (crisis.value.can_manage) return edit()
  const note = await noteModal.open({
    title: `Add an update to ${crisis.value.ref_no}`,
    description: `Seen by everyone following this ${t.value.lower}.`,
    confirmLabel: 'Add update',
    noteLabel: 'Update',
    help: 'What is happening now, e.g. who has been evacuated.',
    required: true,
    requiredMessage: 'Write the update first.',
  }).result
  if (note === false) return
  await act(() => raCrisisApi.addNote(id.value, note), 'Update added')
}

async function close() {
  if (!crisis.value) return
  const note = await noteModal.open({
    title: `Close ${crisis.value.ref_no}?`,
    description: `It leaves the building map. The ${t.value.lower} and its history stay in ${t.value.label} › Manage.`,
    confirmLabel: `Close ${t.value.lower}`,
    noteLabel: 'How it ended',
  }).result
  if (note === false) return
  await act(() => raCrisisApi.close(crisis.value!.id, note || null), `${t.value.label} closed`)
}

async function reopen() {
  if (!crisis.value) return
  const note = await noteModal.open({
    title: `Reopen ${crisis.value.ref_no}?`,
    description: 'It shows on the building map again until it is closed.',
    confirmLabel: `Reopen ${t.value.lower}`,
    noteLabel: 'Why it is reopened',
  }).result
  if (note === false) return
  await act(() => raCrisisApi.reopen(crisis.value!.id, note || null), `${t.value.label} reopened`)
}

async function act(call: () => Promise<RaCrisis>, message: string) {
  actionError.value = null
  try {
    set(await call())
    toast.add({ title: message, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    actionError.value = apiFieldErrors(err).find((item) => item.name === 'status')?.message ?? apiErrorMessage(err)
  }
}

const historyIcon: Record<string, string> = {
  declared: 'i-lucide-siren',
  approved: 'i-lucide-badge-check',
  rejected: 'i-lucide-circle-x',
  updated: 'i-lucide-pencil',
  note: 'i-lucide-message-square',
  closed: 'i-lucide-circle-check',
  reopened: 'i-lucide-rotate-ccw',
}
</script>

<template>
  <AppPage
    :title="crisis?.ref_no ?? t.label"
    :crumbs="[
      { label: BUILDINGS_GROUP },
      { label: t.label },
      { label: 'Manage', to: t.path },
      ...(crisis ? [{ label: crisis.ref_no }] : []),
    ]"
  >
    <template #actions>
      <UButton
        v-if="crisis"
        color="neutral"
        variant="outline"
        icon="i-lucide-printer"
        label="Print view"
        :to="crisisReportPath(crisis.id, crisis.type)"
      />
      <template v-if="crisis?.can_manage">
        <template v-if="updatable">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            :label="`Update ${t.lower}`"
            @click="edit"
          />
          <UButton
            v-if="crisis.status === 'open'"
            icon="i-lucide-circle-check"
            :label="`Close ${t.lower}`"
            @click="close"
          />
        </template>
        <UButton
          v-else-if="crisis.status === 'closed'"
          color="neutral"
          variant="outline"
          icon="i-lucide-rotate-ccw"
          :label="`Reopen ${t.lower}`"
          @click="reopen"
        />
      </template>
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      :label="`Loading the ${t.lower}`"
      class="space-y-6"
    >
      <div class="skeleton h-8 w-96" />
      <SkeletonCard :lines="4" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error?.statusCode === 404"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-help"
      :title="`${t.label} not found`"
      description="It may have been deleted."
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`Could not load the ${t.lower}`"
      :description="apiErrorMessage(error)"
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

    <template v-else-if="crisis">
      <UAlert
        v-if="actionError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="That didn't work"
        :description="actionError"
      />

      <RaApprovalBanner
        :noun="t.lower"
        :status="crisis.status === 'pending' || crisis.status === 'rejected' ? crisis.status : 'approved'"
        :requested-by="crisis.declared_by"
        :requested-at="crisis.history[0]?.at ?? null"
        :decided-by="crisis.decided_by"
        :decided-at="crisis.decided_at"
        :note="crisis.decision_note"
        :can="crisis.approval_can"
        :approve="async (note) => set(await raCrisisApi.approve(crisis!.id, note))"
        :reject="async (note) => set(await raCrisisApi.reject(crisis!.id, note))"
      />

      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            class="text-2xl font-semibold text-highlighted"
          >
            {{ title }}
          </h2>
          <StatusBadge
            :scale="raCrisisStatus"
            :value="crisis.status"
          />
        </div>
        <p class="text-sm text-muted">
          {{ crisis.hazard.category?.label }} · {{ raFormatDistance(crisis.radius_m) }} radius ·
          since {{ formatDateTime(crisis.started_at) }}
          <template v-if="crisis.declared_by">
            · declared by {{ crisis.declared_by }}
          </template>
        </p>
        <p
          v-if="crisis.description"
          class="whitespace-pre-line"
        >
          {{ crisis.description }}
        </p>
        <p
          v-if="crisis.earthquake"
          class="flex items-center gap-1.5 text-sm text-muted"
          data-testid="crisis-earthquake"
        >
          <UIcon
            name="i-lucide-activity"
            class="size-4 shrink-0 text-warning"
          />
          <span>Declared from the BMKG earthquake M{{ raFormatMagnitude(crisis.earthquake.magnitude) }} on {{ formatDateTime(crisis.earthquake.occurred_at) }}<template v-if="crisis.earthquake.region">
            ({{ crisis.earthquake.region }})</template>. <NuxtLink
            :to="`/sites/map?quake=${crisis.earthquake.id}`"
            class="text-primary hover:underline"
          >See it on the map</NuxtLink>. Source: {{ crisis.earthquake.source }}.</span>
        </p>
        <p
          v-if="crisis.status === 'closed'"
          class="text-sm text-muted"
        >
          Closed {{ formatDateTime(crisis.closed_at) }}<template v-if="crisis.closed_by">
            by {{ crisis.closed_by }}
          </template><template v-if="crisis.closing_note">
            : {{ crisis.closing_note }}
          </template>
        </p>
      </div>

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="min-w-0 space-y-6">
          <UCard>
            <RaMap
              :markers="markers"
              :circles="circles"
              :label="`Map of the ${t.lower} at ${place} and the ${crisis.affected.length} affected places.`"
              height-class="h-80"
              scroll-zoom
              @select="onMarker"
            />
            <RaMapLegend
              class="mt-3"
              :items="['building', 'branch', crisis.status === 'pending' ? 'crisis_pending' : 'crisis']"
              :labels="{ building: 'Affected head office building', branch: 'Affected branch', crisis: `${t.label} and its affected area`, crisis_pending: `${t.label} waiting for approval (dashed area)` }"
              :residual="`Residual risk for ${crisis.hazard.short_name}`"
            />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 class="text-lg font-semibold">
                    What to do
                  </h2>
                  <p class="text-sm text-muted">
                    Guidebook for {{ crisis.hazard.short_name }}, for every affected place.
                  </p>
                </div>
                <StatusBadge
                  :scale="raPlaybookReview"
                  :value="crisis.playbook.reviewed ? 'reviewed' : 'starter'"
                  size="sm"
                />
              </div>
            </template>
            <UAlert
              v-if="!crisis.playbook.reviewed"
              class="mb-4"
              color="warning"
              variant="subtle"
              icon="i-lucide-file-pen"
              title="These are the starter steps"
              description="BCM hasn't reviewed them for this hazard yet. Follow the building's emergency procedures where they differ."
            />
            <div class="grid gap-4 md:grid-cols-3">
              <section
                v-for="phase in RA_PLAYBOOK_PHASES"
                :key="phase.value"
              >
                <h3 class="font-medium text-highlighted">
                  {{ phase.label }}
                </h3>
                <ol
                  v-if="crisis.playbook.steps[phase.value].length"
                  class="mt-2 list-decimal space-y-1.5 ps-5 text-sm"
                >
                  <li
                    v-for="(step, index) in crisis.playbook.steps[phase.value]"
                    :key="index"
                  >
                    {{ step }}
                  </li>
                </ol>
                <p
                  v-else
                  class="mt-2 text-sm text-muted"
                >
                  No steps.
                </p>
              </section>
            </div>
            <template #footer>
              <UButton
                :to="guidebookPath(crisis.type, crisis.hazard_code)"
                variant="link"
                trailing-icon="i-lucide-arrow-right"
                label="Guidebook"
                class="px-0"
              />
            </template>
          </UCard>

          <section aria-labelledby="affected-heading">
            <h2
              id="affected-heading"
              class="mb-3 text-lg font-semibold"
            >
              Affected places ({{ crisis.affected.length }})
            </h2>
            <UAccordion
              v-model="openPlaces"
              type="multiple"
              :items="accordionItems"
              :ui="{ item: 'rounded-md border border-default bg-default px-4 mb-3 last:mb-0' }"
            >
              <template #default="{ item }">
                <span
                  :id="`place-${item.row.location.id}`"
                  class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 scroll-mt-20"
                >
                  <UIcon
                    :name="item.row.location.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2'"
                    class="size-4 shrink-0 text-muted"
                  />
                  <span class="font-medium text-highlighted">{{ item.row.location.name }}</span>
                  <span class="text-sm text-muted">
                    {{ RA_PLACE_KIND_LABEL[item.row.location.kind] }} ·
                    {{ item.row.distance_m ? `${raFormatDistance(item.row.distance_m)} from the ${t.lower} point` : `at the ${t.lower} point` }}
                  </span>
                  <StatusBadge
                    v-if="item.row.assessment?.rating?.residual_level"
                    :scale="raRiskLevel"
                    :value="item.row.assessment.rating.residual_level"
                    size="sm"
                  />
                </span>
              </template>
              <template #content="{ item }">
                <div class="grid gap-6 pb-4 lg:grid-cols-2">
                  <section>
                    <h3 class="font-medium text-highlighted">
                      RA for this hazard
                    </h3>
                    <template v-if="item.row.assessment">
                      <p class="mt-1 text-sm text-muted">
                        <NuxtLink
                          v-if="canOpenRa(item.row.assessment.kind, item.row.assessment)"
                          :to="assessmentUrl(item.row)"
                          class="text-primary hover:underline"
                        >
                          {{ item.row.assessment.ref_no ?? item.row.assessment.period_year }}
                        </NuxtLink>
                        <span v-else>{{ item.row.assessment.ref_no ?? item.row.assessment.period_year }}</span>
                        · <StatusBadge
                          :scale="raStatus"
                          :value="item.row.assessment.status"
                          size="sm"
                        />
                      </p>
                      <dl
                        v-if="item.row.assessment.rating"
                        class="mt-2 space-y-2 text-sm"
                      >
                        <div>
                          <dt class="text-muted">
                            Residual risk
                          </dt>
                          <dd>
                            <StatusBadge
                              v-if="item.row.assessment.rating.residual_level"
                              :scale="raRiskLevel"
                              :value="item.row.assessment.rating.residual_level"
                              size="sm"
                            />
                            <template v-else>
                              Not rated
                            </template>
                            <span
                              v-if="item.row.assessment.rating.residual_probability"
                              class="ms-2 text-muted tabular-nums"
                            >P{{ item.row.assessment.rating.residual_probability }} × I{{ item.row.assessment.rating.residual_impact }}</span>
                          </dd>
                        </div>
                        <div>
                          <dt class="text-muted">
                            Existing mitigation
                          </dt>
                          <dd
                            class="whitespace-pre-line"
                            lang="id"
                          >
                            {{ item.row.assessment.rating.mitigation || '—' }}
                          </dd>
                        </div>
                        <div>
                          <dt class="text-muted">
                            Action plan
                          </dt>
                          <dd
                            class="whitespace-pre-line"
                            lang="id"
                          >
                            {{ item.row.assessment.rating.action_plan || '—' }}
                          </dd>
                        </div>
                      </dl>
                      <p
                        v-else
                        class="mt-2 text-sm text-muted"
                      >
                        This hazard isn't rated in it yet.
                      </p>
                    </template>
                    <p
                      v-else
                      class="mt-1 text-sm text-muted"
                    >
                      No RA for this place yet.
                    </p>
                  </section>

                  <section>
                    <h3 class="font-medium text-highlighted">
                      Nearest places outside the area
                    </h3>
                    <ul
                      v-if="item.row.alternates.length"
                      class="mt-2 divide-y divide-default rounded-md border border-default text-sm"
                    >
                      <li
                        v-for="alternate in item.row.alternates"
                        :key="alternate.location.id"
                        class="flex items-center gap-2 px-3 py-2"
                      >
                        <UIcon
                          :name="alternate.location.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2'"
                          class="size-4 shrink-0 text-muted"
                        />
                        <NuxtLink
                          v-if="locationUrl(alternate.location)"
                          :to="locationUrl(alternate.location)"
                          class="min-w-0 flex-1 truncate text-primary hover:underline"
                        >
                          {{ alternate.location.name }}
                        </NuxtLink>
                        <span
                          v-else
                          class="min-w-0 flex-1 truncate"
                        >{{ alternate.location.name }}</span>
                        <span class="text-muted tabular-nums">{{ raFormatDistance(alternate.distance_m) }}</span>
                        <UTooltip text="Road route in Google Maps">
                          <UButton
                            :to="raDirectionsUrl({ lat: item.row.location.latitude, lng: item.row.location.longitude }, { lat: alternate.location.latitude, lng: alternate.location.longitude })"
                            target="_blank"
                            rel="noopener"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            icon="i-lucide-route"
                            :aria-label="`Route to ${alternate.location.name} in Google Maps`"
                          />
                        </UTooltip>
                      </li>
                    </ul>
                    <p
                      v-else
                      class="mt-2 text-sm text-muted"
                    >
                      No other place on the map is outside the area.
                    </p>
                  </section>

                  <RaCrisisContacts
                    :place="item.row"
                    class="lg:col-span-2"
                  />
                </div>
              </template>
            </UAccordion>
          </section>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              History
            </h2>
          </template>
          <ol class="space-y-4">
            <li
              v-for="(entry, index) in [...crisis.history].reverse()"
              :key="index"
              class="flex gap-3"
            >
              <UIcon
                :name="historyIcon[entry.action] ?? 'i-lucide-circle'"
                class="mt-0.5 size-4 shrink-0 text-muted"
              />
              <div class="min-w-0 text-sm">
                <p>
                  <span class="font-medium text-highlighted">{{ RA_CRISIS_ACTION_LABEL[entry.action] ?? entry.action }}</span>
                  <span class="text-muted"> · {{ entry.user ?? 'Someone' }}</span>
                </p>
                <p class="text-xs text-muted">
                  {{ formatDateTime(entry.at) }}
                </p>
                <p
                  v-if="entry.note"
                  class="mt-1 whitespace-pre-line"
                >
                  {{ entry.note }}
                </p>
              </div>
            </li>
          </ol>
          <template
            v-if="updatable"
            #footer
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-muted">
                {{ crisis.can_manage ? 'Change the radius or anything else, with what is happening now.' : `Seen by everyone following this ${t.lower}.` }}
              </p>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-message-square-plus"
                label="Add update"
                class="shrink-0"
                @click="addUpdate"
              />
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </AppPage>
</template>
