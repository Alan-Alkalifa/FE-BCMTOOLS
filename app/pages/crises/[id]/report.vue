<script setup lang="ts">
/**
 * An incident's print view: what happened and where, the map with its legend, what to do, every
 * affected place with its RA for the hazard and who to call (as tables), and the history. Print
 * uses the browser; the app's frame is hidden when printing (main.css).
 */
definePageMeta({ permission: ['location.access', 'ra.access', 'ra_branch.access'] })

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data: crisis, status, error, refresh } = useRaCrisis(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !crisis.value)
const { user } = useAuth()

const place = computed(() => (crisis.value ? raCrisisPlaceName(crisis.value) : ''))
const title = computed(() => (crisis.value ? `${crisis.value.hazard.short_name} at ${place.value}` : 'Incident'))
const markers = computed(() => (crisis.value ? raCrisisMarkers(crisis.value) : []))
const circles = computed(() => (crisis.value ? raCrisisCircles(crisis.value) : []))
const printedAt = new Date().toISOString()

function printReport() {
  window.print()
}

function residual(row: NonNullable<typeof crisis.value>['affected'][number]) {
  if (!row.assessment) return 'No RA yet'
  const rating = row.assessment.rating
  if (!rating?.residual_level) return 'Not rated'
  return `${raRiskLevel[rating.residual_level]?.label ?? rating.residual_level}${rating.residual_probability ? ` (P${rating.residual_probability} × I${rating.residual_impact})` : ''}`
}

const cell = 'px-3 py-2 align-top print:px-2 print:py-1'
</script>

<template>
  <AppPage
    icon="i-lucide-printer"
    :title="crisis ? `${crisis.ref_no} print view` : 'Incident print view'"
    :crumbs="[
      { label: BUILDINGS_GROUP },
      { label: 'Incidents', to: CRISES_PATH },
      ...(crisis ? [{ label: crisis.ref_no, to: crisisPath(crisis.id) }, { label: 'Print view' }] : []),
    ]"
  >
    <template #actions>
      <UButton
        icon="i-lucide-printer"
        label="Print"
        :disabled="!crisis"
        @click="printReport"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the incident"
      class="space-y-6"
    >
      <SkeletonCard :lines="8" />
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

    <article
      v-else-if="crisis"
      class="space-y-6 print:space-y-4"
      data-testid="crisis-report"
    >
      <header class="space-y-2">
        <p class="text-sm text-muted">
          Incident report · {{ crisis.ref_no }}
        </p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 class="text-2xl font-semibold text-highlighted print:text-xl">
            {{ title }}
          </h2>
          <StatusBadge
            :scale="raCrisisStatus"
            :value="crisis.status"
          />
        </div>
        <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          <div>
            <dt class="text-muted">
              Hazard
            </dt>
            <dd>
              {{ crisis.hazard.short_name }}<template v-if="crisis.hazard.category">
                ({{ crisis.hazard.category.label }})
              </template>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Place
            </dt>
            <dd>{{ place }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Affected area
            </dt>
            <dd>{{ raFormatDistance(crisis.radius_m) }} radius · {{ crisis.affected.length }} {{ crisis.affected.length === 1 ? 'place' : 'places' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Since
            </dt>
            <dd>{{ formatDateTime(crisis.started_at) }}</dd>
          </div>
          <div v-if="crisis.declared_by">
            <dt class="text-muted">
              Declared by
            </dt>
            <dd>{{ crisis.declared_by }}</dd>
          </div>
          <div v-if="crisis.status === 'closed'">
            <dt class="text-muted">
              Closed
            </dt>
            <dd>
              {{ formatDateTime(crisis.closed_at) }}<template v-if="crisis.closed_by">
                by {{ crisis.closed_by }}
              </template>
            </dd>
          </div>
        </dl>
        <p
          v-if="crisis.description"
          class="whitespace-pre-line"
        >
          {{ crisis.description }}
        </p>
        <p
          v-if="crisis.earthquake"
          class="text-sm text-muted"
        >
          From the BMKG earthquake M{{ raFormatMagnitude(crisis.earthquake.magnitude) }} on {{ formatDateTime(crisis.earthquake.occurred_at) }}<template v-if="crisis.earthquake.region">
            ({{ crisis.earthquake.region }})
          </template>. Source: {{ crisis.earthquake.source }}.
        </p>
        <p
          v-if="crisis.closing_note"
          class="text-sm"
        >
          How it ended: {{ crisis.closing_note }}
        </p>
        <p class="text-xs text-muted">
          Printed {{ formatDateTime(printedAt) }}<template v-if="user?.name">
            by {{ user.name }}
          </template> from BCM Tools.
        </p>
      </header>

      <!-- The map is as wide on screen as on A4 paper, so what you see is what prints. -->
      <section class="max-w-[178mm] break-inside-avoid space-y-3">
        <h2 class="text-lg font-semibold">
          Map
        </h2>
        <RaMap
          :markers="markers"
          :circles="circles"
          :label="`Map of the incident at ${place} and the ${crisis.affected.length} affected places.`"
          height-class="h-80 print:h-64"
          scroll-zoom
        />
        <RaMapLegend
          :items="['building', 'branch', crisis.status === 'pending' ? 'crisis_pending' : 'crisis']"
          :labels="{ building: 'Affected head office building', branch: 'Affected branch' }"
          :residual="`Colour: residual risk for ${crisis.hazard.short_name}`"
        />
      </section>

      <section class="break-inside-avoid space-y-3">
        <h2 class="text-lg font-semibold">
          What to do
        </h2>
        <p
          v-if="!crisis.playbook.reviewed"
          class="text-sm text-muted"
        >
          Starter steps: BCM hasn't reviewed them for this hazard yet. Follow the building's emergency procedures where they differ.
        </p>
        <div class="grid gap-4 md:grid-cols-3 print:grid-cols-3">
          <section
            v-for="phase in RA_PLAYBOOK_PHASES"
            :key="phase.value"
          >
            <h3 class="font-medium text-highlighted">
              {{ phase.label }}
            </h3>
            <ol
              v-if="crisis.playbook.steps[phase.value].length"
              class="mt-2 list-decimal space-y-1 ps-5 text-sm print:text-xs"
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
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-semibold">
          Affected places ({{ crisis.affected.length }})
        </h2>
        <div
          v-if="crisis.affected.length"
          class="overflow-x-auto rounded-md border border-default print:overflow-visible"
        >
          <table class="w-full text-left text-sm print:text-xs">
            <thead class="bg-muted text-xs font-semibold text-muted print:bg-transparent">
              <tr>
                <th :class="cell">
                  Place
                </th>
                <th :class="cell">
                  Type
                </th>
                <th :class="cell">
                  Distance
                </th>
                <th :class="cell">
                  RA
                </th>
                <th :class="cell">
                  Residual risk
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="row in crisis.affected"
                :key="row.location.id"
                class="break-inside-avoid"
              >
                <td :class="cell">
                  {{ row.location.name }}
                </td>
                <td :class="[cell, 'text-muted']">
                  {{ RA_PLACE_KIND_LABEL[row.location.kind] }}
                </td>
                <td :class="[cell, 'whitespace-nowrap tabular-nums']">
                  {{ row.distance_m ? raFormatDistance(row.distance_m) : 'At the point' }}
                </td>
                <td :class="[cell, 'text-muted']">
                  {{ row.assessment ? (row.assessment.ref_no ?? row.assessment.period_year) : '—' }}
                </td>
                <td :class="cell">
                  {{ residual(row) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          No building or branch is in the area.
        </p>
      </section>

      <section
        v-for="row in crisis.affected"
        :key="row.location.id"
        class="space-y-4 border-t border-default pt-5 print:break-before-page print:border-0 print:pt-0"
        :aria-label="row.location.name"
      >
        <div>
          <h2 class="text-lg font-semibold">
            {{ row.location.name }}
          </h2>
          <p class="text-sm text-muted">
            {{ RA_PLACE_KIND_LABEL[row.location.kind] }} ·
            {{ row.distance_m ? `${raFormatDistance(row.distance_m)} from the incident point` : 'at the incident point' }}
          </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
          <section class="break-inside-avoid">
            <h3 class="font-medium text-highlighted">
              RA for this hazard
            </h3>
            <template v-if="row.assessment">
              <p class="mt-1 text-sm text-muted">
                {{ row.assessment.ref_no ?? row.assessment.period_year }} · {{ raStatus[row.assessment.status]?.label ?? row.assessment.status }}
              </p>
              <dl class="mt-2 space-y-2 text-sm">
                <div>
                  <dt class="text-muted">
                    Residual risk
                  </dt>
                  <dd>{{ residual(row) }}</dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Existing mitigation
                  </dt>
                  <dd
                    class="whitespace-pre-line"
                    lang="id"
                  >
                    {{ row.assessment.rating?.mitigation || '—' }}
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
                    {{ row.assessment.rating?.action_plan || '—' }}
                  </dd>
                </div>
              </dl>
            </template>
            <p
              v-else
              class="mt-1 text-sm text-muted"
            >
              No RA for this place yet.
            </p>
          </section>

          <section class="break-inside-avoid">
            <h3 class="font-medium text-highlighted">
              Nearest places outside the area
            </h3>
            <ul
              v-if="row.alternates.length"
              class="mt-2 space-y-1 text-sm"
            >
              <li
                v-for="alternate in row.alternates"
                :key="alternate.location.id"
                class="flex justify-between gap-3"
              >
                <span>{{ alternate.location.name }} <span class="text-muted">({{ RA_PLACE_KIND_LABEL[alternate.location.kind] }})</span></span>
                <span class="text-muted tabular-nums">{{ raFormatDistance(alternate.distance_m) }}</span>
              </li>
            </ul>
            <p
              v-else
              class="mt-2 text-sm text-muted"
            >
              No other place on the map is outside the area.
            </p>
          </section>
        </div>

        <RaCrisisContacts
          :place="row"
          print
        />
      </section>

      <section class="space-y-3 border-t border-default pt-5 print:border-0">
        <h2 class="text-lg font-semibold">
          History
        </h2>
        <div class="overflow-x-auto rounded-md border border-default print:overflow-visible">
          <table class="w-full text-left text-sm print:text-xs">
            <thead class="bg-muted text-xs font-semibold text-muted print:bg-transparent">
              <tr>
                <th :class="cell">
                  When
                </th>
                <th :class="cell">
                  What
                </th>
                <th :class="cell">
                  Who
                </th>
                <th :class="cell">
                  Note
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(entry, index) in crisis.history"
                :key="index"
                class="break-inside-avoid"
              >
                <td :class="[cell, 'whitespace-nowrap tabular-nums']">
                  {{ formatDateTime(entry.at) }}
                </td>
                <td :class="cell">
                  {{ RA_CRISIS_ACTION_LABEL[entry.action] ?? entry.action }}
                </td>
                <td :class="[cell, 'text-muted']">
                  {{ entry.user ?? 'Someone' }}
                </td>
                <td :class="[cell, 'whitespace-pre-line']">
                  {{ entry.note || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </article>
  </AppPage>
</template>
