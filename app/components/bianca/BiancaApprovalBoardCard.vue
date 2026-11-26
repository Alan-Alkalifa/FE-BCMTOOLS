<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { BiancaBoardRow, BiancaWaitLevel } from '~/composables/useBiancaApproval'

/** Shared table/filter card for BIANCA BCM board and Administrator All Approval List. */
const props = defineProps<{
  mode: 'board' | 'all'
  rows: BiancaBoardRow[]
  total: number
  loading: boolean
  page: number
  perPage: number
  filtered: boolean
  columns: TableColumn<BiancaBoardRow>[]
  stepItems: Array<{ label: string, value: string }>
  levelItems: Array<{ label: string, value: BiancaWaitLevel | 'all' }>
  categoryItems: Array<{ label: string, value: string }>
  exportUrl: string
  nudgingBulk: boolean
  picked: Set<number>
  allPicked: boolean | 'indeterminate'
  pageTo: (page: number) => { query: Record<string, unknown> }
  actionsFor: (row: BiancaBoardRow) => DropdownMenuItem[]
}>()

const emit = defineEmits<{
  'clear': []
  'nudge-many': []
  'pick': [row: BiancaBoardRow, value: boolean | 'indeterminate']
  'update:allPicked': [value: boolean | 'indeterminate']
  'update:perPage': [value: number]
}>()

const search = defineModel<string>('search', { required: true })
const step = defineModel<string>('step', { required: true })
const level = defineModel<BiancaWaitLevel | 'all'>('level', { required: true })
const category = defineModel<string>('category', { required: true })
const approver = defineModel<number | null>('approver', { required: true })

const { can } = useAuth()
const pickedCount = computed(() => props.rows.filter((row) => props.picked.has(row.id)).length)
</script>

<template>
  <UCard
    class="mt-4"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <ListFilterBar
      :filtered="filtered"
      @clear="emit('clear')"
    >
      <template #search>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Group, directorate or ref. no."
          :aria-label="mode === 'all' ? 'Search all approvals' : 'Search the board'"
          class="w-full"
        />
      </template>
      <USelectMenu
        v-model="step"
        value-key="value"
        :items="stepItems"
        :search-input="false"
        aria-label="Step"
        class="w-48"
      />
      <USelectMenu
        v-model="level"
        value-key="value"
        :items="levelItems"
        :search-input="false"
        aria-label="Waiting time"
        class="w-44"
      />
      <USelectMenu
        v-model="category"
        value-key="value"
        :items="categoryItems"
        :search-input="false"
        aria-label="Category"
        class="w-44"
      />
      <UserPicker
        v-model="approver"
        placeholder="Any approver"
        aria-label="Approver"
        permission="bianca.access"
        class="w-56"
      />
    </ListFilterBar>
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-4 py-2">
      <p
        v-if="mode === 'all'"
        class="text-sm text-muted"
      >
        Administrator view: assign or reassign any pending approval step and approve on behalf without participant restrictions.
      </p>
      <p
        v-else
        class="text-sm text-muted"
      >
        Reminders and escalation follow
        <NuxtLink
          v-if="can('bianca.settings.manage') && can('bianca.config.view')"
          to="/admin/bianca-config?tab=reminders"
          class="text-primary hover:underline"
        >BIANCA configuration &gt; Reminders and escalation</NuxtLink><span v-else>the BIANCA reminder rules</span>.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :to="exportUrl"
          external
          download
          color="neutral"
          variant="outline"
          icon="i-lucide-file-spreadsheet"
          label="Export to Excel"
        />
        <UButton
          icon="i-lucide-bell-ring"
          :label="`Send reminder (${pickedCount})`"
          :loading="nudgingBulk"
          :disabled="!pickedCount || nudgingBulk"
          @click="emit('nudge-many')"
        />
      </div>
    </div>
    <UTable
      :data="rows"
      :columns="columns"
      :loading="loading"
      :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
    >
      <template #select-header>
        <UCheckbox
          v-if="rows.length"
          :model-value="allPicked"
          aria-label="Select every BIA on this page"
          @update:model-value="emit('update:allPicked', $event)"
        />
      </template>
      <template #select-cell="{ row }">
        <UCheckbox
          :model-value="picked.has(row.original.id)"
          :aria-label="`Select ${row.original.ref_no ?? `#${row.original.id}`}`"
          @update:model-value="emit('pick', row.original, $event)"
        />
      </template>
      <template #org_group-cell="{ row }">
        <NuxtLink
          :to="biancaApprovalPath(row.original.id)"
          class="font-medium text-primary hover:underline"
        >
          {{ row.original.org_group || 'BIA' }}
        </NuxtLink>
        <p
          v-if="row.original.directorate"
          class="text-xs text-muted"
        >
          {{ row.original.directorate }}
        </p>
      </template>
      <template #ref_no-cell="{ row }">
        <span class="font-mono text-xs">{{ row.original.ref_no || '—' }}</span>
      </template>
      <template #highest_category-cell="{ row }">
        <StatusBadge
          v-if="row.original.highest_category"
          :scale="BIANCA_CATEGORY"
          :value="row.original.highest_category as keyof typeof BIANCA_CATEGORY"
          size="sm"
        />
        <span
          v-else
          class="text-muted"
        >—</span>
      </template>
      <template #step_title-cell="{ row }">
        {{ row.original.step_title || row.original.step || '—' }}
      </template>
      <template #approver-cell="{ row }">
        {{ row.original.approver || '—' }}
        <p
          v-if="!row.original.can_act"
          class="text-xs text-muted"
        >
          Your own BIA: reminders only
        </p>
      </template>
      <template #steps-cell="{ row }">
        <div
          v-if="row.original.steps?.length"
          class="flex flex-col gap-1 text-xs"
        >
          <div
            v-for="s in row.original.steps"
            :key="s.role"
            class="flex items-center gap-1.5"
          >
            <UBadge
              :color="s.status === 'approved' ? 'success' : s.current ? 'warning' : 'neutral'"
              variant="subtle"
              size="xs"
              :label="s.title"
            />
            <span class="truncate text-muted">{{ s.name || 'Unassigned' }}</span>
          </div>
        </div>
        <span
          v-else
          class="text-muted"
        >—</span>
      </template>
      <template #level-cell="{ row }">
        <StatusBadge
          :scale="biancaWaitLevel"
          :value="row.original.level"
          size="sm"
        />
      </template>
      <template #waiting_since-cell="{ row }">
        {{ formatDate(row.original.waiting_since) || '—' }}
      </template>
      <template #working_days_waiting-cell="{ row }">
        <span class="block text-right tabular-nums">{{ biancaWaiting(row.original.working_days_waiting) }}</span>
      </template>
      <template #reminders_sent-cell="{ row }">
        <span class="block text-right tabular-nums">{{ row.original.reminders_sent }}</span>
      </template>
      <template #escalated_at-cell="{ row }">
        <span
          v-if="row.original.escalated_at"
          class="text-error"
        >{{ formatDate(row.original.escalated_at) }}</span>
        <span
          v-else
          class="text-muted"
        >—</span>
      </template>
      <template #actions-cell="{ row }">
        <UDropdownMenu
          :items="actionsFor(row.original)"
          :content="{ align: 'end' }"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            trailing-icon="i-lucide-chevron-down"
            label="Act"
            :aria-label="`Act on ${row.original.ref_no ?? `#${row.original.id}`}`"
          />
        </UDropdownMenu>
      </template>
      <template #empty>
        <p class="py-6 text-center text-sm text-muted">
          {{ filtered ? 'Nothing in approval matches these filters.' : 'Nothing is in approval.' }}
        </p>
      </template>
    </UTable>
    <TablePagination
      :per-page="perPage"
      page-sizes
      :page="page"
      :total="total"
      :to="pageTo"
      :label="mode === 'all' ? 'All Approval List' : 'BCM board'"
      @update:per-page="emit('update:perPage', $event)"
    />
  </UCard>
</template>
