<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaAssessmentSummary, RaCallTreeEntry, RaLocationDetail, RaRecoveryTeamMember } from '~/composables/useRa'

const TABS = ['details', 'map', 'contacts', 'occupants', 'team', 'calltree'] as const
type Tab = (typeof TABS)[number]
/** The LCP sheets are only in the HO workbook. */
const LCP_TABS: Tab[] = ['occupants', 'team', 'calltree']

/** A building's page, under Administration › Master building (its only page). */

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const id = computed(() => Number(route.params.id))
const { data: location, status, error, refresh } = useRaLocation(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !location.value)
const hasMapPin = computed(() => Boolean(raPin(location.value)))

// One page for buildings and branches: the tabs below follow the location's own kind.
const kind = computed<RaKind | null>(() => location.value?.kind ?? null)
provide(raKindKey, kind)
const ra = computed(() => RA_MODULES[kind.value ?? 'head_office'])

const dirty = ref(false)
const formKey = ref(0)
provide(raDirtyKey, dirty)

const tabs = computed(() => TABS.filter((value) => ra.value.hasLcp || !LCP_TABS.includes(value)))
const tab = computed<Tab>(() => {
  const value = route.query.tab
  return typeof value === 'string' && tabs.value.includes(value as Tab) ? value as Tab : 'details'
})

const ALL_TAB_ITEMS = [
  { label: 'Details', value: 'details', icon: 'i-lucide-building-2', slot: 'details' },
  { label: 'Map', value: 'map', icon: 'i-lucide-map-pinned', slot: 'map' },
  { label: 'Emergency contacts', value: 'contacts', icon: 'i-lucide-phone', slot: 'contacts' },
  { label: 'Occupants', value: 'occupants', icon: 'i-lucide-users', slot: 'occupants' },
  { label: 'Recovery team', value: 'team', icon: 'i-lucide-life-buoy', slot: 'team' },
  { label: 'Call tree', value: 'calltree', icon: 'i-lucide-network', slot: 'calltree' },
] as const
const tabItems = computed(() => ALL_TAB_ITEMS.filter((item) => tabs.value.includes(item.value)))

async function confirmLeave() {
  return confirm({
    title: 'Discard unsaved changes?',
    description: 'Your unsaved edits on this tab will be lost.',
    confirmLabel: 'Discard changes',
    destructive: true,
  })
}

async function selectTab(next: string | number) {
  const value = String(next) as Tab
  if (value === tab.value) return
  if (dirty.value && !(await confirmLeave())) return
  dirty.value = false
  await router.replace({ query: { ...route.query, tab: value } })
  formKey.value += 1
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return
  if (!(await confirmLeave())) return false
})

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

function onSaved(saved: RaLocationDetail) {
  location.value = saved
  dirty.value = false
}

/** Four-eyes approval of a new building or its deactivation (RaApprovalBanner). */
async function decide(work: Promise<RaLocationDetail>) {
  location.value = await work
  dirty.value = false
  formKey.value += 1
}

const assessmentColumns: TableColumn<RaAssessmentSummary>[] = [
  { accessorKey: 'ref_no', header: 'Ref. no.' },
  { accessorKey: 'period_year', header: 'Period' },
  { accessorKey: 'due_date', header: 'Renewal due' },
  { accessorKey: 'highest_residual_level', header: 'Highest residual', meta: RA_STATUS_COLUMN },
  { accessorKey: 'status', header: 'Status', meta: RA_STATUS_COLUMN },
]

type RowValues = Record<string, string | number | null>
const teamRows = computed(() => (location.value?.recovery_team ?? []) as unknown as RowValues[])
const callTreeRows = computed(() => (location.value?.call_tree ?? []) as unknown as RowValues[])

function saveTeam(rows: RowValues[]) {
  return raApi.setRecoveryTeam(id.value, rows as unknown as RaRecoveryTeamMember[])
}

function saveCallTree(rows: RowValues[]) {
  return raApi.setCallTree(id.value, rows as unknown as RaCallTreeEntry[])
}

const { can } = useAuth()
/** Without ra.edit the profile is read-only (the API refuses changes too). */
const canEdit = computed(() => can(ra.value.perm.edit))
/** Seen through the Location module without RA access, its RAs are listed, not opened. */
const canOpenRa = useCanOpenRa()
function openAssessment(_event: Event, row: { original: RaAssessmentSummary }) {
  if (canOpenRa(ra.value.kind, row.original)) navigateTo(raRecordPath(ra.value.kind, row.original))
}
</script>

<template>
  <AppPage
    :title="location?.name ?? ra.location.single"
    :description="location?.code ? `${ra.location.single} ID ${location.code}` : undefined"
    :crumbs="[
      { label: 'Administration' },
      { label: 'Master building', to: MASTER_BUILDINGS_PATH },
      ...(location ? [{ label: location.name }] : []),
    ]"
  >
    <template #actions>
      <UButton
        v-if="location && can('admin.audit.view')"
        :to="{ path: '/admin/audit', query: { tab: 'ra', building: location.id } }"
        color="neutral"
        variant="outline"
        icon="i-lucide-history"
        label="Activity"
      />
      <UButton
        v-if="location && (location.assessable ?? location.is_active) && canEdit"
        :to="{ path: raPath(ra.kind, 'manage', 'new'), query: { location_id: location.id } }"
        icon="i-lucide-plus"
        label="New assessment"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      :label="`Loading ${ra.location.lower}`"
      class="space-y-6"
    >
      <div class="skeleton h-8 w-80" />
      <SkeletonCard :lines="4" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error?.statusCode === 404"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-help"
      :title="`${ra.location.single} not found`"
      description="It may have been deleted."
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`Could not load the ${ra.location.lower}`"
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

    <template v-else-if="location">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p class="text-2xl font-semibold text-highlighted">
          {{ location.name }}
        </p>
        <StatusBadge
          :scale="raLocationKind"
          :value="location.kind"
        />
        <StatusBadge
          :scale="raBuildingStatus"
          :value="raBuildingState(location)"
        />
        <span class="text-sm text-muted">
          <template v-if="ra.hasRegion && location.region">
            {{ location.region }} ·
          </template>
          <template v-if="ra.hasLcp">
            {{ formatNumber(location.occupant_summary.units, 0) }} {{ location.occupant_summary.units === 1 ? 'division' : 'divisions' }} ·
            {{ formatNumber(location.occupant_summary.employees, 0) }} employees ·
          </template>
          {{ formatNumber(location.assessments.length, 0) }} {{ location.assessments.length === 1 ? 'assessment' : 'assessments' }}
        </span>
      </div>

      <RaApprovalBanner
        v-if="location.approval"
        :noun="ra.location.lower"
        :status="location.approval.status"
        :action="location.approval.action"
        :requested-by="location.approval.requested_by"
        :requested-at="location.approval.requested_at"
        :decided-by="location.approval.decided_by"
        :decided-at="location.approval.decided_at"
        :note="location.approval.note"
        :can="location.approval_can"
        :approve="(note) => decide(raApi.approveLocation(location!.id, note))"
        :reject="(note) => decide(raApi.rejectLocation(location!.id, note))"
        :withdraw="() => decide(raApi.withdrawLocationRequest(location!.id))"
        :resubmit="() => decide(raApi.resubmitLocation(location!.id))"
      />

      <UAlert
        v-if="!hasMapPin"
        color="warning"
        variant="subtle"
        icon="i-lucide-map-pin-off"
        title="Map coordinates required"
        :description="`This ${ra.location.lower} won't appear on the Building map until its map pin is saved.`"
      >
        <template
          v-if="canEdit"
          #actions
        >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-map-pinned"
            label="Add map coordinates"
            @click="selectTab('map')"
          />
        </template>
      </UAlert>

      <UAlert
        v-if="!canEdit"
        color="info"
        variant="subtle"
        icon="i-lucide-eye"
        :title="`You can view this ${ra.location.lower}`"
        description="Changing it needs the RA edit permission (ra.edit)."
      />

      <UTabs
        :model-value="tab"
        :items="tabItems"
        variant="link"
        :unmount-on-hide="false"
        class="min-w-0"
        @update:model-value="selectTab"
      >
        <template #details>
          <fieldset
            :disabled="!canEdit"
            class="min-w-0"
          >
            <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <RaLocationForm
                :key="`details-${formKey}`"
                :location="location"
                :cancel-to="MASTER_BUILDINGS_PATH"
                @saved="onSaved"
              />
              <UCard>
                <template #header>
                  <h2 class="text-lg font-semibold">
                    Assessments
                  </h2>
                  <p class="text-sm text-muted">
                    RA cycles of this {{ ra.location.lower }}, newest first. {{ ra.hasLcp ? 'They all use the profile on the other tabs.' : 'They all use its emergency contacts.' }}
                  </p>
                </template>
                <UTable
                  v-if="location.assessments.length"
                  :data="location.assessments"
                  :columns="assessmentColumns"
                  :class="{ 'cursor-pointer': canOpenRa(ra.kind) }"
                  :on-select="openAssessment"
                >
                  <template #ref_no-cell="{ row }">
                    <NuxtLink
                      v-if="canOpenRa(ra.kind, row.original)"
                      :to="raRecordPath(ra.kind, row.original)"
                      class="font-medium whitespace-nowrap text-primary hover:underline"
                    >
                      {{ row.original.ref_no || 'Assessment' }}
                    </NuxtLink>
                    <span
                      v-else
                      class="font-medium whitespace-nowrap"
                    >{{ row.original.ref_no || 'Assessment' }}</span>
                  </template>
                  <template #due_date-cell="{ row }">
                    {{ formatDate(row.original.due_date) || '—' }}
                  </template>
                  <template #highest_residual_level-cell="{ row }">
                    <StatusBadge
                      v-if="row.original.highest_residual_level"
                      :scale="raRiskLevel"
                      :value="row.original.highest_residual_level"
                      size="sm"
                    />
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </template>
                  <template #status-cell="{ row }">
                    <StatusBadge
                      :scale="raStatus"
                      :value="raStatusKey(row.original)"
                      size="sm"
                    />
                  </template>
                </UTable>
                <p
                  v-else
                  class="py-6 text-center text-sm text-muted"
                >
                  No assessments yet.
                </p>
              </UCard>
            </div>
          </fieldset>
        </template>
        <template #map>
          <fieldset
            :disabled="!canEdit"
            class="min-w-0"
          >
            <RaLocationMapTab
              :key="`map-${formKey}`"
              :location="location"
              @saved="onSaved"
            />
          </fieldset>
        </template>
        <template #contacts>
          <fieldset
            :disabled="!canEdit"
            class="min-w-0"
          >
            <RaContactsForm
              :key="`contacts-${formKey}`"
              :location="location"
              @saved="onSaved"
            />
          </fieldset>
        </template>
        <template
          v-if="ra.hasLcp"
          #occupants
        >
          <fieldset
            :disabled="!canEdit"
            class="min-w-0"
          >
            <RaOccupantsTab
              :location="location"
              @saved="onSaved"
            />
          </fieldset>
        </template>
        <template
          v-if="ra.hasLcp"
          #team
        >
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="max-w-3xl text-sm text-muted">
              Define the members of each team by specifying their roles and listing everyone assigned to each role. Enter each role only once, then add all corresponding team members. The role, member names and mobile numbers are required (a mobile can also be text), while home phone numbers are optional. The chart will display the complete team structure and organizational hierarchy.
            </p>
            <RaDiagramButton
              :kind="ra.kind"
              diagram="recovery_team"
            />
          </div>
          <fieldset
            :disabled="!canEdit"
            class="min-w-0"
          >
            <RaGroupedRowsForm
              :key="`team-${formKey}`"
              :groups="RA_RECOVERY_TEAMS"
              group-key="team"
              :lead="RA_TEAM_LEAD"
              :fields="RA_TEAM_FIELDS"
              :initial="teamRows"
              item-label="member"
              save-label="Save recovery team"
              saved-message="Recovery team saved"
              error-title="Couldn't save the recovery team"
              :save="saveTeam"
              @saved="onSaved"
            />
          </fieldset>
        </template>
        <template
          v-if="ra.hasLcp"
          #calltree
        >
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="max-w-3xl text-sm text-muted">
              Define the communication flow at each level by specifying who makes the call and listing all individuals or parties they need to contact. Enter any relevant text. The caller, at least one contact and each contact's mobile number (or text, such as “Sesuai dokumen BCP masing-masing”) are mandatory, while other details are optional. The chart will display the complete communication hierarchy.
            </p>
            <RaDiagramButton
              :kind="ra.kind"
              diagram="call_tree"
            />
          </div>
          <fieldset
            :disabled="!canEdit"
            class="min-w-0"
          >
            <RaGroupedRowsForm
              :key="`calltree-${formKey}`"
              :groups="RA_CALL_TREE_GROUPS"
              group-key="level"
              :lead="RA_CALL_TREE_LEAD"
              :fields="RA_CALL_TREE_FIELDS"
              :initial="callTreeRows"
              item-label="contact"
              save-label="Save call tree"
              saved-message="Call tree saved"
              error-title="Couldn't save the call tree"
              :save="saveCallTree"
              @saved="onSaved"
            />
          </fieldset>
        </template>
      </UTabs>
    </template>
  </AppPage>
</template>
