<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AuditEvent, OutboxEmail, Page } from '~/composables/useAdmin'

definePageMeta({ permission: 'admin.audit.view' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can } = useAuth()

const TABS = ['events', 'scca', 'ra', 'emails'] as const
type AuditTab = (typeof TABS)[number]
const tab = computed<AuditTab>({
  get: () => (TABS.includes(route.query.tab as AuditTab) ? route.query.tab as AuditTab : 'events'),
  set: (value) => router.replace({ query: { tab: value === 'events' ? undefined : value } }),
})
const kind = ref<'all' | 'auth' | 'admin'>('all')
const emailFilter = ref<'all' | OutboxEmail['status']>('all')
const search = ref('')
const eventPage = ref(1)
const eventPerPage = ref(ROWS_PER_PAGE)
const emailPage = ref(1)
const emailPerPage = ref(ROWS_PER_PAGE)

// SCCA activity; ?assessment=ID (from an assessment's page) shows one assessment.
const sccaSearch = ref('')
const sccaAction = ref('all')
const sccaPage = ref(1)
const sccaPerPage = ref(ROWS_PER_PAGE)
const sccaAssessment = computed(() => Number(route.query.assessment) || undefined)
const sccaQuery = computed(() => ({
  kind: 'scca',
  q: sccaSearch.value.trim() || undefined,
  event: sccaAction.value === 'all' ? undefined : sccaAction.value,
  assessment_id: sccaAssessment.value,
  page: sccaPage.value,
  per_page: sccaPerPage.value,
}))
watch([sccaSearch, sccaAction, sccaAssessment, sccaPerPage], () => (sccaPage.value = 1))

// RA activity; ?building=ID (from a building's page) shows that building with its RAs and
// incidents.
const raSearch = ref('')
const raGroup = ref('all')
const raPage = ref(1)
const raPerPage = ref(ROWS_PER_PAGE)
const raBuilding = computed(() => Number(route.query.building) || undefined)
const raQuery = computed(() => ({
  kind: 'ra',
  q: raSearch.value.trim() || undefined,
  group: raGroup.value === 'all' ? undefined : raGroup.value,
  building_id: raBuilding.value,
  page: raPage.value,
  per_page: raPerPage.value,
}))
watch([raSearch, raGroup, raBuilding, raPerPage], () => (raPage.value = 1))
function clearBuilding() {
  router.replace({ query: { ...route.query, building: undefined } })
}

function clearAssessment() {
  router.replace({ query: { ...route.query, assessment: undefined } })
}

const eventQuery = computed(() => ({
  kind: kind.value === 'all' ? undefined : kind.value,
  q: search.value.trim() || undefined,
  page: eventPage.value,
  per_page: eventPerPage.value,
}))
const emailQuery = computed(() => ({
  status: emailFilter.value === 'all' ? undefined : emailFilter.value,
  page: emailPage.value,
  per_page: emailPerPage.value,
}))
watch([kind, search, eventPerPage], () => (eventPage.value = 1))
watch([emailFilter, emailPerPage], () => (emailPage.value = 1))

const events = useFetch<Page<AuditEvent>>('/api/admin/audit/events', { query: eventQuery, key: 'admin-audit-events' })
const scca = useFetch<Page<AuditEvent>>('/api/admin/audit/events', { query: sccaQuery, key: 'admin-audit-scca' })
const ra = useFetch<Page<AuditEvent>>('/api/admin/audit/events', { query: raQuery, key: 'admin-audit-ra' })
const emails = useFetch<Page<OutboxEmail>>('/api/admin/audit/emails', { query: emailQuery, key: 'admin-audit-emails' })

const eventColumns: TableColumn<AuditEvent>[] = [
  { accessorKey: 'created_at', header: 'When' },
  { accessorKey: 'event', header: 'Event' },
  { accessorKey: 'username', header: 'User' },
  { accessorKey: 'actor', header: 'By' },
  { accessorKey: 'ip', header: 'IP address' },
]
const sccaColumns: TableColumn<AuditEvent>[] = [
  { accessorKey: 'created_at', header: 'When' },
  { id: 'assessment', header: 'Assessment' },
  { accessorKey: 'event', header: 'Action' },
  { accessorKey: 'actor', header: 'By' },
]
const raColumns: TableColumn<AuditEvent>[] = [
  { accessorKey: 'created_at', header: 'When' },
  { id: 'record', header: 'Building or record' },
  { accessorKey: 'event', header: 'Action' },
  { accessorKey: 'actor', header: 'By' },
]
const filteredBuilding = computed(() => {
  if (!raBuilding.value) return null
  const row = ra.data.value?.items.find((item) => item.detail?.building_id === raBuilding.value || (item.target_type === 'ra_locations' && item.target_id === raBuilding.value))
  return (row?.detail?.building as string | undefined) ?? `Building ${raBuilding.value}`
})
const filteredAssessment = computed(() => {
  const first = scca.data.value?.items[0]?.detail as { ref_no?: string, application?: string } | undefined
  return sccaAssessment.value ? (first?.ref_no ?? `Assessment ${sccaAssessment.value}`) : null
})

const TONE_CLASS: Record<string, string> = {
  neutral: 'text-muted',
  primary: 'text-primary',
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
}
const emailColumns: TableColumn<OutboxEmail>[] = [
  { accessorKey: 'created_at', header: 'Queued' },
  { accessorKey: 'subject', header: 'Email' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'provider', header: 'Sent via' },
  { accessorKey: 'attempts', header: 'Attempts' },
  { id: 'actions', header: '' },
]

function detailText(row: AuditEvent) {
  if (!row.detail) return ''
  return Object.entries(row.detail)
    .filter(([key]) => key !== 'password_changed' || row.detail![key])
    .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ')
}

async function retry(row: OutboxEmail) {
  try {
    const result = await adminApi.retryEmail(row.id)
    toast.add(result.status === 'sent'
      ? { title: 'Email sent', color: 'success', icon: 'i-lucide-mail-check' }
      : { title: 'Still failing', description: result.last_error ?? undefined, color: 'error', icon: 'i-lucide-mail-x' })
    await emails.refresh()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

const tabs = [
  { label: 'Sign-in and admin activity', value: 'events', icon: 'i-lucide-scroll-text', slot: 'events' as const },
  { label: 'SCCA activity', value: 'scca', icon: 'i-lucide-shield-check', slot: 'scca' as const },
  { label: 'RA activity', value: 'ra', icon: 'i-lucide-building-2', slot: 'ra' as const },
  { label: 'Email outbox', value: 'emails', icon: 'i-lucide-mail', slot: 'emails' as const },
]
</script>

<template>
  <AppPage
    title="Audit log"
    icon="i-lucide-scroll-text"
    description="Who signed in, what administrators changed, who did what on each SCCA and in RA (buildings, RAs, incidents), and every email BCM Tools sent."
    :crumbs="[{ label: 'Administration' }, { label: 'Audit log' }]"
  >
    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
    >
      <template #events>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Filter by ID"
              aria-label="Filter by ID"
              class="w-full sm:w-72"
            />
            <USelectMenu
              v-model="kind"
              value-key="value"
              :search-input="false"
              :items="[
                { label: 'All events', value: 'all' },
                { label: 'Sign-in', value: 'auth' },
                { label: 'Admin changes', value: 'admin' },
              ]"
              aria-label="Event type"
              class="w-44"
            />
          </div>
          <UTable
            :data="events.data.value?.items ?? []"
            :columns="eventColumns"
            :loading="events.status.value === 'pending'"
            :ui="{ th: 'first:ps-4', td: 'first:ps-4 align-top' }"
          >
            <template #created_at-cell="{ row }">
              <span class="whitespace-nowrap">{{ formatDateTime(row.original.created_at) }}</span>
            </template>
            <template #event-cell="{ row }">
              <p
                class="font-medium"
                :class="{
                  'text-error': eventTone(row.original.event) === 'error',
                  'text-warning': eventTone(row.original.event) === 'warning',
                  'text-highlighted': eventTone(row.original.event) === 'neutral',
                }"
              >
                {{ eventLabel(row.original.event) }}
              </p>
              <p
                v-if="row.original.detail"
                class="max-w-md truncate text-xs text-muted"
                :title="detailText(row.original)"
              >
                {{ detailText(row.original) }}
              </p>
            </template>
            <template #username-cell="{ row }">
              {{ row.original.username || '—' }}
            </template>
            <template #actor-cell="{ row }">
              {{ row.original.actor || '—' }}
            </template>
            <template #ip-cell="{ row }">
              <code class="text-xs">{{ row.original.ip || '—' }}</code>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No events yet.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:page="eventPage"
            v-model:per-page="eventPerPage"
            page-sizes
            :total="events.data.value?.total ?? 0"
            label="Sign-in and admin activity"
          />
        </UCard>
      </template>

      <template #scca>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
            <UInput
              v-model="sccaSearch"
              icon="i-lucide-search"
              placeholder="Ref. no., application or user"
              aria-label="Search SCCA activity"
              class="w-full sm:w-80"
            />
            <USelectMenu
              v-model="sccaAction"
              value-key="value"
              :items="SCCA_ACTIVITY_FILTERS"
              :search-input="false"
              aria-label="Action"
              class="w-56"
            />
            <UBadge
              v-if="filteredAssessment"
              color="neutral"
              variant="subtle"
              size="lg"
              class="gap-1"
            >
              {{ filteredAssessment }}
              <UButton
                color="neutral"
                variant="link"
                size="xs"
                icon="i-lucide-x"
                class="p-0"
                aria-label="Show every assessment"
                @click="clearAssessment"
              />
            </UBadge>
          </div>
          <UTable
            :data="scca.data.value?.items ?? []"
            :columns="sccaColumns"
            :loading="scca.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #created_at-cell="{ row }">
              <span class="whitespace-nowrap">{{ formatDateTime(row.original.created_at) }}</span>
            </template>
            <template #assessment-cell="{ row }">
              <template v-if="row.original.target_type === 'scca_assessments' && row.original.target_id">
                <ULink
                  :to="`/scca/${row.original.target_id}`"
                  class="block font-medium text-highlighted hover:text-primary"
                >
                  {{ (row.original.detail?.application as string) ?? `Assessment ${row.original.target_id}` }}
                </ULink>
                <span class="font-mono text-xs text-muted">{{ row.original.detail?.ref_no ?? '—' }}</span>
              </template>
              <span
                v-else
                class="text-muted"
              >{{ row.original.event === 'scca.monitoring_exported' ? 'Monitoring' : 'SCCA configuration' }}</span>
            </template>
            <template #event-cell="{ row }">
              <p class="flex items-center gap-1.5 font-medium text-highlighted">
                <UIcon
                  :name="sccaActivity(row.original.event).icon"
                  class="size-4 shrink-0"
                  :class="TONE_CLASS[sccaActivity(row.original.event).tone]"
                />
                {{ sccaActivity(row.original.event).label }}
                <UBadge
                  v-if="row.original.detail?.backfilled"
                  label="Earlier history"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
              </p>
              <p
                v-if="sccaActivityDetail(row.original)"
                class="mt-0.5 max-w-xl text-xs text-muted"
              >
                {{ sccaActivityDetail(row.original) }}
              </p>
            </template>
            <template #actor-cell="{ row }">
              <span v-if="row.original.actor">{{ row.original.actor }}</span>
              <span
                v-else-if="['scca.finalised', 'scca.reminded', 'scca.escalated', 'scca.renewal_notice'].includes(row.original.event)"
                class="text-muted"
              >BCM Tools</span>
              <span
                v-else
                class="text-muted"
              >{{ row.original.username || '—' }}</span>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No SCCA activity{{ sccaSearch || sccaAction !== 'all' || sccaAssessment ? ' matches the filters' : ' yet' }}.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:page="sccaPage"
            v-model:per-page="sccaPerPage"
            page-sizes
            :total="scca.data.value?.total ?? 0"
            label="SCCA activity"
          />
        </UCard>
      </template>

      <template #ra>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
            <UInput
              v-model="raSearch"
              icon="i-lucide-search"
              placeholder="Building, building ID, RA or incident ref., or user"
              aria-label="Search RA activity"
              class="w-full sm:w-96"
            />
            <USelectMenu
              v-model="raGroup"
              value-key="value"
              :items="RA_ACTIVITY_GROUPS"
              :search-input="false"
              aria-label="Activity"
              class="w-64"
            />
            <UBadge
              v-if="filteredBuilding"
              color="neutral"
              variant="subtle"
              size="lg"
              class="gap-1"
            >
              {{ filteredBuilding }}
              <UButton
                color="neutral"
                variant="link"
                size="xs"
                icon="i-lucide-x"
                class="p-0"
                aria-label="Show every building"
                @click="clearBuilding"
              />
            </UBadge>
          </div>
          <UTable
            :data="ra.data.value?.items ?? []"
            :columns="raColumns"
            :loading="ra.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #created_at-cell="{ row }">
              <span class="whitespace-nowrap">{{ formatDateTime(row.original.created_at) }}</span>
            </template>
            <template #record-cell="{ row }">
              <ULink
                v-if="raActivityRecord(row.original).to"
                :to="raActivityRecord(row.original).to!"
                class="block font-medium text-highlighted hover:text-primary"
              >
                {{ raActivityRecord(row.original).label }}
              </ULink>
              <span
                v-else
                class="block font-medium text-highlighted"
              >{{ raActivityRecord(row.original).label }}</span>
              <span
                v-if="raActivityRecord(row.original).ref"
                class="font-mono text-xs text-muted"
              >{{ raActivityRecord(row.original).ref }}</span>
            </template>
            <template #event-cell="{ row }">
              <p class="flex items-center gap-1.5 font-medium text-highlighted">
                <UIcon
                  :name="raActivity(row.original.event).icon"
                  class="size-4 shrink-0"
                  :class="TONE_CLASS[raActivity(row.original.event).tone]"
                />
                {{ raActivity(row.original.event).label }}
              </p>
              <p
                v-if="raActivityDetail(row.original)"
                class="mt-0.5 max-w-xl text-xs text-muted"
              >
                {{ raActivityDetail(row.original) }}
              </p>
            </template>
            <template #actor-cell="{ row }">
              <span v-if="row.original.actor">{{ row.original.actor }}</span>
              <span
                v-else
                class="text-muted"
              >{{ row.original.username || 'BCM Tools' }}</span>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No RA activity{{ raSearch || raGroup !== 'all' || raBuilding ? ' matches the filters' : ' yet' }}.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:page="raPage"
            v-model:per-page="raPerPage"
            page-sizes
            :total="ra.data.value?.total ?? 0"
            label="RA activity"
          />
        </UCard>
      </template>

      <template #emails>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
            <USelectMenu
              v-model="emailFilter"
              value-key="value"
              :search-input="false"
              :items="[
                { label: 'All emails', value: 'all' },
                { label: 'Sent', value: 'sent' },
                { label: 'Failed', value: 'failed' },
                { label: 'Queued', value: 'queued' },
              ]"
              aria-label="Email status"
              class="w-44"
            />
          </div>
          <UTable
            :data="emails.data.value?.items ?? []"
            :columns="emailColumns"
            :loading="emails.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #created_at-cell="{ row }">
              <span class="whitespace-nowrap">{{ formatDateTime(row.original.created_at) }}</span>
            </template>
            <template #subject-cell="{ row }">
              <p class="font-medium text-highlighted">
                {{ row.original.subject }}
              </p>
              <p class="text-xs text-muted">
                To {{ row.original.to.join(', ') }}
              </p>
              <p
                v-if="row.original.status !== 'sent' && row.original.last_error"
                class="mt-1 max-w-lg text-xs text-error"
              >
                {{ row.original.last_error }}
              </p>
            </template>
            <template #status-cell="{ row }">
              <StatusBadge
                :scale="emailStatus"
                :value="row.original.status"
                size="sm"
              />
              <p
                v-if="row.original.sent_at"
                class="mt-1 text-xs text-muted"
              >
                {{ formatDateTime(row.original.sent_at) }}
              </p>
            </template>
            <template #provider-cell="{ row }">
              <span :class="row.original.provider ? 'whitespace-nowrap' : 'text-muted'">{{ row.original.provider ?? '—' }}</span>
            </template>
            <template #actions-cell="{ row }">
              <UButton
                v-if="row.original.status !== 'sent' && can('admin.settings.mail')"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-rotate-cw"
                label="Send again"
                @click="retry(row.original)"
              />
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No emails yet.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:page="emailPage"
            v-model:per-page="emailPerPage"
            page-sizes
            :total="emails.data.value?.total ?? 0"
            label="Email outbox"
          />
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
