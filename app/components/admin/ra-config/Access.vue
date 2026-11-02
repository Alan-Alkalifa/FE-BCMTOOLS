<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import type { PickedUser } from '~/components/UserPicker.vue'
import type { RaAccessCheck, RaAccessRule } from '~/composables/useRaConfigAdmin'
import AccessRuleForm from '~/components/admin/ra-config/AccessRuleForm.vue'

/**
 * RA configuration > Access scope, as SCCA's: who picks which locations for an Annual review or
 * a Structural change, sees their Renewals rows and generates their annual reviews. BCM
 * (`ra.monitor`, `ra.manage` and the RA Branch ones) always sees every location of its side.
 * Live, for RA and RA Branch alike: a change applies right away and is audited.
 */
const { can } = useAuth()
const toast = useToast()
const confirm = useConfirm()
const ruleForm = useOverlay().create(AccessRuleForm)
const editable = computed(() => can('ra.config.manage'))

const { data, status, error, refresh } = useAsyncData('ra-access-rules', () => raAccessApi.list())
const rules = computed(() => data.value?.items ?? [])
const options = computed(() => data.value?.options)
const reasonLabel = (code: string) => options.value?.reasons.find((item) => item.code === code)?.label ?? code
const statusLabel = (code: string) => options.value?.renewal_statuses.find((item) => item.code === code)?.label ?? code
const kindLabel = (code: string) => options.value?.kinds.find((item) => item.code === code)?.label ?? code
const activeCount = computed(() => rules.value.filter((rule) => rule.is_active).length)

const columns: TableColumn<RaAccessRule>[] = [
  { accessorKey: 'name', header: 'Rule' },
  { id: 'who', header: 'Who' },
  { id: 'locations', header: 'Locations' },
  { id: 'reasons', header: 'Reasons' },
  { id: 'generate', header: 'Generate' },
  { id: 'valid', header: 'Valid' },
  { id: 'actions', header: '' },
]

async function edit(rule: RaAccessRule | null) {
  if (!options.value) return
  if (await ruleForm.open({ rule, options: options.value }).result) await refresh()
}

async function remove(rule: RaAccessRule) {
  const ok = await confirm({
    title: `Delete ${rule.name}?`,
    description: 'The users it covers lose what it opened to them right away. BCM keeps seeing everything.',
    confirmLabel: 'Delete rule',
    destructive: true,
  })
  if (!ok) return
  try {
    await raAccessApi.remove(rule.id)
    toast.add({ title: 'Rule deleted', color: 'success', icon: 'i-lucide-circle-check' })
    await refresh()
  } catch (failure) {
    const data = (failure as { data?: { details?: Record<string, string> } }).data
    toast.add({ title: data?.details?.rule ?? apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

function actions(rule: RaAccessRule): DropdownMenuItem[] {
  const last = rule.is_active && activeCount.value <= 1
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => edit(rule) },
    {
      label: last ? 'Delete (the only active rule)' : 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      disabled: last,
      onSelect: () => remove(rule),
    },
  ]
}

// --- Check a user ------------------------------------------------------------------------------

const checkUserId = ref<number | null>(null)
const checked = ref<RaAccessCheck | null>(null)
const checking = ref(false)
async function check(user: PickedUser | null) {
  checked.value = null
  if (!user) return
  checking.value = true
  try {
    checked.value = await raAccessApi.check(user.id)
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the access rules"
      :description="apiErrorMessage(error)"
    />
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              Access scope
            </h2>
            <p class="mt-1 max-w-3xl text-sm text-muted">
              Outside BCM, a user picks locations for an Annual review or a Structural change, sees
              their Renewals rows and generates their annual reviews only for the locations an
              active rule opens to them. Without a rule, Monitoring shows them only the RAs they
              take part in. A location's directorate is on its building page. The rules apply to
              RA and RA Branch alike.
            </p>
          </div>
          <UButton
            v-if="editable"
            icon="i-lucide-plus"
            label="New rule"
            :disabled="!options"
            @click="edit(null)"
          />
        </div>
      </template>
      <UTable
        :data="rules"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top text-sm' }"
      >
        <template #name-cell="{ row }">
          <p class="font-medium text-highlighted">
            {{ row.original.name }}
          </p>
          <UBadge
            v-if="!row.original.is_active"
            color="neutral"
            variant="subtle"
            size="sm"
            label="Inactive"
          />
          <p
            v-if="row.original.updated_by"
            class="text-xs text-muted"
          >
            {{ row.original.updated_by }} · {{ formatDateTime(row.original.updated_at) }}
          </p>
        </template>
        <template #who-cell="{ row }">
          <template v-if="row.original.user_ids.length">
            {{ row.original.users.map((user) => user.name).join(', ') }}
          </template>
          <template v-else>
            {{ row.original.levels.join(', ') || '—' }}
          </template>
        </template>
        <template #locations-cell="{ row }">
          <p>{{ row.original.directorates.length ? row.original.directorates.join(', ') : 'Own directorate' }}</p>
          <p class="text-xs text-muted">
            {{ row.original.kinds.length ? row.original.kinds.map(kindLabel).join(', ') : 'Buildings and branches' }}
            <template v-if="row.original.renewal_statuses.length">
              · {{ row.original.renewal_statuses.map(statusLabel).join(', ') }}
            </template>
          </p>
        </template>
        <template #reasons-cell="{ row }">
          {{ row.original.reasons.map(reasonLabel).join(', ') }}
        </template>
        <template #generate-cell="{ row }">
          <span v-if="row.original.can_generate">Yes</span>
          <span
            v-else
            class="text-muted"
          >No</span>
        </template>
        <template #valid-cell="{ row }">
          <span v-if="row.original.valid_from || row.original.valid_until">
            {{ formatDate(row.original.valid_from) || 'Now' }} – {{ formatDate(row.original.valid_until) || 'no end' }}
          </span>
          <span
            v-else
            class="text-muted"
          >Always</span>
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu
            v-if="editable"
            :items="actions(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="`Actions for ${row.original.name}`"
            />
          </UDropdownMenu>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            No rules yet: only BCM picks locations for an Annual review or a Structural change.
          </p>
        </template>
      </UTable>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Check a user
        </h2>
        <p class="text-sm text-muted">
          What the access scope gives one person today.
        </p>
      </template>
      <div class="space-y-4">
        <UserPicker
          v-model="checkUserId"
          class="max-w-md"
          aria-label="User to check"
          @pick="check"
        />
        <p
          v-if="checking"
          class="text-sm text-muted"
        >
          Checking…
        </p>
        <dl
          v-else-if="checked"
          class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2"
        >
          <div>
            <dt class="text-xs text-muted">
              Directorate · level
            </dt>
            <dd>{{ checked.user.directorate || 'No directorate' }} · {{ checked.user.org_level || 'no level' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Rules that cover them
            </dt>
            <dd>{{ checked.rules.map((rule) => rule.name).join(', ') || 'None: they see only the RAs they take part in' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Locations opened
            </dt>
            <dd>
              <template v-if="checked.reasons.length">
                {{ checked.reasons.map((code) => `${reasonLabel(code)}: ${checked!.locations[code] ?? 0}`).join(' · ') }}
              </template>
              <span v-else>None</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Generate
            </dt>
            <dd>
              {{ checked.can_generate ? 'Can generate annual reviews' : 'Cannot generate' }}
            </dd>
          </div>
        </dl>
      </div>
    </UCard>
  </div>
</template>
