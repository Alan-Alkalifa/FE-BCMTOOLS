<script setup lang="ts">
import type { RaCrisis, RaCrisisPlace, RaMapMarker } from '~/composables/useRa'
import RaCrisisModal from '~/components/ra/RaCrisisModal.vue'
import RaCrisisNoteModal from '~/components/ra/RaCrisisNoteModal.vue'

/**
 * One incident: where and what, the affected area on the map, and for every affected building or
 * branch what to do — BCM's guidebook steps, its own RA for the hazard, its contacts, call tree
 * and recovery team, and the nearest places outside the area. The history is kept beside it.
 */
definePageMeta({ permission: 'ra.access' })

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data: crisis, status, error, refresh } = useRaCrisis(id)
const { data: map } = useRaMap()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !crisis.value)
const toast = useToast()
const confirm = useConfirm()
const crisisModal = useOverlay().create(RaCrisisModal)
const noteModal = useOverlay().create(RaCrisisNoteModal)
const actionError = ref<string | null>(null)

const place = computed(() => crisis.value?.location?.name
  ?? (crisis.value ? raFormatCoordinates({ lat: crisis.value.latitude, lng: crisis.value.longitude }) : ''))
const title = computed(() => (crisis.value ? `${crisis.value.hazard.short_name} at ${place.value}` : 'Incident'))

const markers = computed<RaMapMarker[]>(() => {
  if (!crisis.value) return []
  const atPin = crisis.value.affected.some((row) => row.distance_m === 0)
  return [
    // An incident at a building's pin is shown by its ring; the pin stays visible.
    ...(atPin
      ? []
      : [{
          id: crisis.value.id,
          lat: crisis.value.latitude,
          lng: crisis.value.longitude,
          label: `Incident point: ${place.value}`,
          variant: 'crisis' as const,
        }]),
    ...crisis.value.affected.map((row) => ({
      id: row.location.id,
      lat: row.location.latitude,
      lng: row.location.longitude,
      label: `${row.location.name} (${RA_PLACE_KIND_LABEL[row.location.kind]}), affected`,
      level: row.assessment?.rating?.residual_level ?? (row.assessment ? 'na' as const : 'none' as const),
      variant: row.location.kind === 'branch' ? 'branch' as const : 'location' as const,
    })),
  ]
})
const circles = computed(() => (crisis.value
  ? [{ id: crisis.value.id, lat: crisis.value.latitude, lng: crisis.value.longitude, radiusM: crisis.value.radius_m, crisis: true }]
  : []))

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

function contactsByKind(row: RaCrisisPlace) {
  return RA_CONTACT_KINDS
    .map((kind) => ({ ...kind, rows: row.contacts.filter((contact) => contact.kind === kind.value) }))
    .filter((group) => group.rows.length)
}

function teamLabel(team: string) {
  return RA_RECOVERY_TEAMS.find((item) => item.value === team)?.label ?? team
}

function assessmentUrl(row: RaCrisisPlace) {
  return raRecordPath(row.assessment!.kind, row.assessment!)
}

function locationUrl(location: { id: number, kind: string }) {
  return locationPath(location.id)
}

function telUrl(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : undefined
}

function set(next: RaCrisis) {
  crisis.value = next
}

async function edit() {
  if (!crisis.value) return
  const saved = await crisisModal.open({ places: map.value?.places ?? [], crisis: crisis.value }).result
  if (saved) {
    set(saved)
    toast.add({ title: 'Incident updated', color: 'success', icon: 'i-lucide-circle-check' })
  }
}

async function close() {
  if (!crisis.value) return
  const note = await noteModal.open({
    title: `Close ${crisis.value.ref_no}?`,
    description: 'It leaves the building map. The incident and its history stay in Incidents.',
    confirmLabel: 'Close incident',
    noteLabel: 'How it ended',
  }).result
  if (note === false) return
  await act(() => raCrisisApi.close(crisis.value!.id, note || null), 'Incident closed')
}

async function reopen() {
  if (!crisis.value) return
  const note = await noteModal.open({
    title: `Reopen ${crisis.value.ref_no}?`,
    description: 'It shows on the building map again until it is closed.',
    confirmLabel: 'Reopen incident',
    noteLabel: 'Why it is reopened',
  }).result
  if (note === false) return
  await act(() => raCrisisApi.reopen(crisis.value!.id, note || null), 'Incident reopened')
}

async function remove() {
  if (!crisis.value) return
  const ok = await confirm({
    title: `Delete ${crisis.value.ref_no}?`,
    description: 'Only for an incident declared by mistake: it and its history are removed for good. Close a real incident instead.',
    confirmLabel: 'Delete incident',
    destructive: true,
  })
  if (!ok) return
  try {
    await raCrisisApi.remove(crisis.value.id)
    toast.add({ title: 'Incident deleted', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(CRISES_PATH)
  } catch (err) {
    actionError.value = apiErrorMessage(err)
  }
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

const note = ref('')
const noteError = ref<string | null>(null)
async function addNote() {
  noteError.value = null
  if (!note.value.trim()) {
    noteError.value = 'Write the update first.'
    return
  }
  try {
    set(await raCrisisApi.addNote(id.value, note.value.trim()))
    note.value = ''
    toast.add({ title: 'Update added', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    noteError.value = apiErrorMessage(err)
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
    :title="crisis?.ref_no ?? 'Incident'"
    :crumbs="[
      { label: BUILDINGS_GROUP },
      { label: 'Incidents', to: CRISES_PATH },
      ...(crisis ? [{ label: crisis.ref_no }] : []),
    ]"
  >
    <template #actions>
      <template v-if="crisis?.can_manage">
        <template v-if="crisis.status === 'open'">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            label="Update incident"
            @click="edit"
          />
          <UButton
            icon="i-lucide-circle-check"
            label="Close incident"
            @click="close"
          />
        </template>
        <UButton
          v-else-if="crisis.status === 'closed'"
          color="neutral"
          variant="outline"
          icon="i-lucide-rotate-ccw"
          label="Reopen incident"
          @click="reopen"
        />
      </template>
      <UButton
        v-if="crisis?.can_delete"
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        label="Delete incident"
        @click="remove"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the incident"
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
      title="Incident not found"
      description="It may have been deleted."
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the incident"
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
        noun="incident"
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
              :label="`Map of the incident at ${place} and the ${crisis.affected.length} affected places.`"
              height-class="h-80"
              @select="onMarker"
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
                    BCM's guidebook for {{ crisis.hazard.short_name }}, for every affected place.
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
                :to="GUIDEBOOK_PATH"
                variant="link"
                trailing-icon="i-lucide-arrow-right"
                label="Incident guidebook"
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
                    {{ item.row.distance_m ? `${raFormatDistance(item.row.distance_m)} from the incident point` : 'at the incident point' }}
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
                      Its RA for this hazard
                    </h3>
                    <template v-if="item.row.assessment">
                      <p class="mt-1 text-sm text-muted">
                        <NuxtLink
                          :to="assessmentUrl(item.row)"
                          class="text-primary hover:underline"
                        >
                          {{ item.row.assessment.ref_no ?? item.row.assessment.period_year }}
                        </NuxtLink>
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
                          :to="locationUrl(alternate.location)"
                          class="min-w-0 flex-1 truncate text-primary hover:underline"
                        >
                          {{ alternate.location.name }}
                        </NuxtLink>
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

                  <section>
                    <h3 class="font-medium text-highlighted">
                      Emergency contacts
                    </h3>
                    <div
                      v-if="item.row.contacts.length"
                      class="mt-2 space-y-3 text-sm"
                    >
                      <div
                        v-for="group in contactsByKind(item.row)"
                        :key="group.value"
                      >
                        <p class="text-xs font-medium text-muted uppercase">
                          {{ group.label }}
                        </p>
                        <ul class="mt-1 space-y-1">
                          <li
                            v-for="contact in group.rows"
                            :key="`${contact.kind}-${contact.seq}`"
                            class="flex flex-wrap gap-x-2"
                          >
                            <span>{{ contact.name }}</span>
                            <span
                              v-if="contact.floor || contact.group_name"
                              class="text-muted"
                            >{{ [contact.group_name, contact.floor && `floor ${contact.floor}`].filter(Boolean).join(', ') }}</span>
                            <a
                              v-if="telUrl(contact.phone)"
                              :href="telUrl(contact.phone)"
                              class="text-primary tabular-nums hover:underline"
                            >{{ contact.phone }}</a>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <p
                      v-else
                      class="mt-2 text-sm text-muted"
                    >
                      None recorded. <NuxtLink
                        :to="`${locationUrl(item.row.location)}?tab=contacts`"
                        class="text-primary hover:underline"
                      >Add them</NuxtLink>.
                    </p>
                  </section>

                  <section>
                    <h3 class="font-medium text-highlighted">
                      Call tree
                    </h3>
                    <ol
                      v-if="item.row.call_tree.length"
                      class="mt-2 space-y-1 text-sm"
                    >
                      <li
                        v-for="entry in item.row.call_tree"
                        :key="`${entry.level}-${entry.seq}`"
                        class="flex flex-wrap gap-x-2"
                      >
                        <span class="text-muted">L{{ entry.level }}</span>
                        <span>{{ entry.contact_name }}</span>
                        <span
                          v-if="entry.division"
                          class="text-muted"
                        >{{ entry.division }}</span>
                        <a
                          v-if="telUrl(entry.mobile)"
                          :href="telUrl(entry.mobile)"
                          class="text-primary tabular-nums hover:underline"
                        >{{ entry.mobile }}</a>
                      </li>
                    </ol>
                    <p
                      v-else
                      class="mt-2 text-sm text-muted"
                    >
                      None recorded.
                    </p>

                    <template v-if="item.row.recovery_team.length">
                      <h3 class="mt-4 font-medium text-highlighted">
                        Recovery team
                      </h3>
                      <ul class="mt-2 space-y-1 text-sm">
                        <li
                          v-for="member in item.row.recovery_team"
                          :key="`${member.team}-${member.seq}`"
                          class="flex flex-wrap gap-x-2"
                        >
                          <span>{{ member.name }}</span>
                          <span class="text-muted">{{ [member.role, teamLabel(member.team)].filter(Boolean).join(', ') }}</span>
                          <a
                            v-if="telUrl(member.mobile)"
                            :href="telUrl(member.mobile)"
                            class="text-primary tabular-nums hover:underline"
                          >{{ member.mobile }}</a>
                        </li>
                      </ul>
                    </template>
                  </section>
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
          <template #footer>
            <UFormField
              label="Add an update"
              help="Seen by everyone following this incident."
              :error="noteError ?? undefined"
            >
              <UTextarea
                v-model="note"
                :rows="3"
                autoresize
                class="w-full"
              />
            </UFormField>
            <div class="mt-2 flex justify-end">
              <UButton
                color="neutral"
                variant="outline"
                label="Add update"
                loading-auto
                @click="addNote"
              />
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </AppPage>
</template>
