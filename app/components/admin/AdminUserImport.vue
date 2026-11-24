<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrImportResult } from '~/composables/useAdmin'

/**
 * Administration > Users > Import from HR file (.xlsx or .csv): preview first, then apply.
 * Rows match on NIP, then email; a row without an email is skipped. New people get no role
 * and no invitation; roles and passwords never change. LDAP will later fill the same fields.
 */
const emit = defineEmits<{ close: [applied?: boolean] }>()

const toast = useToast()
const file = ref<File | null>(null)
const preview = ref<HrImportResult | null>(null)
const busy = ref(false)
const problem = ref<string | null>(null)
const onlyChanges = ref(true)

type Row = HrImportResult['rows'][number]
const ACTION: Record<Row['action'], { label: string, color: 'success' | 'info' | 'neutral' | 'warning' | 'error' }> = {
  create: { label: 'New', color: 'success' },
  update: { label: 'Update', color: 'info' },
  unchanged: { label: 'Unchanged', color: 'neutral' },
  skip: { label: 'Skipped', color: 'warning' },
  error: { label: 'Error', color: 'error' },
}
const columns: TableColumn<Row>[] = [
  { accessorKey: 'line', header: 'Row' },
  { accessorKey: 'nip', header: 'NIP' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'action', header: 'Result' },
  { accessorKey: 'remark', header: 'Remark' },
]
const rows = computed(() => (preview.value?.rows ?? []).filter((row) => !onlyChanges.value || row.action !== 'unchanged'))

watch(file, () => {
  preview.value = null
  problem.value = null
})

async function run(dryRun: boolean) {
  if (!file.value) {
    problem.value = 'Choose the HR file (.xlsx or .csv).'
    return
  }
  busy.value = true
  problem.value = null
  try {
    const result = await adminApi.importUsers(file.value, dryRun)
    if (dryRun) {
      preview.value = result
      return
    }
    const { create, update, skip, error } = result.counts
    toast.add({
      title: `Imported: ${create} new, ${update} updated`,
      description: `${skip} skipped, ${error} with errors. New users have no role yet: give them one to let them sign in.`,
      color: error ? 'warning' : 'success',
      icon: 'i-lucide-users',
    })
    if (result.detected) {
      toast.add({
        title: `${result.detected} organization change${result.detected === 1 ? '' : 's'} to check`,
        description: 'The new HR data seems to move, rename, add or close units. Confirm or dismiss each in Master data › Organization structure.',
        color: 'info',
        icon: 'i-lucide-scan-search',
        actions: [{ label: 'Open detected changes', color: 'neutral', variant: 'outline', onClick: () => { navigateTo('/masterdata/organization?tab=detected') } }],
      })
    }
    emit('close', true)
  } catch (failure) {
    const data = (failure as { data?: { details?: Record<string, string>, message?: string } }).data
    problem.value = data?.details?.file ?? data?.message ?? adminErrorText(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    title="Import from HR file"
    description="The HR employee export: NIP, Emp Name, Directorate, Sub Directorate, Group, Division, Department, Job Name, Organization Level, Location, Town or City, Province, Email Address, DS NIP, DS Name, Email DS."
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="problem"
        />
        <ul class="list-disc space-y-1 ps-5 text-sm text-muted">
          <li>Rows match an account on NIP, then on email. A row without an email is skipped.</li>
          <li>New people are added without a role and without an invitation; roles and passwords never change here.</li>
          <li>Direct supervisors (DS NIP) are linked after every row, so their order in the file doesn't matter.</li>
        </ul>
        <UFileUpload
          v-model="file"
          accept=".xlsx,.csv"
          label="Drop the HR file here"
          description=".xlsx or .csv, 10 MB at most"
          class="w-full"
          layout="list"
        />
        <template v-if="preview">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              v-for="(count, action) in preview.counts"
              :key="action"
              :color="ACTION[action].color"
              variant="subtle"
              :label="`${ACTION[action].label}: ${count}`"
            />
            <USwitch
              v-model="onlyChanges"
              label="Hide unchanged"
              class="ms-auto"
            />
          </div>
          <div class="max-h-80 overflow-y-auto rounded-md border border-default">
            <UTable
              :data="rows"
              :columns="columns"
              :ui="{ th: 'first:ps-3 last:pe-3', td: 'first:ps-3 last:pe-3 align-top text-sm' }"
            >
              <template #action-cell="{ row }">
                <UBadge
                  :color="ACTION[row.original.action].color"
                  variant="subtle"
                  size="sm"
                  :label="ACTION[row.original.action].label"
                />
                <p
                  v-if="row.original.changes.length"
                  class="mt-1 text-xs text-muted"
                >
                  {{ row.original.changes.join(', ') }}
                </p>
              </template>
              <template #empty>
                <p class="py-4 text-center text-sm text-muted">
                  Every row is unchanged.
                </p>
              </template>
            </UTable>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close')"
        />
        <UButton
          v-if="!preview"
          icon="i-lucide-eye"
          label="Preview"
          :loading="busy"
          :disabled="!file"
          @click="run(true)"
        />
        <UButton
          v-else
          icon="i-lucide-upload"
          :label="`Apply (${preview.counts.create + preview.counts.update} changes)`"
          :loading="busy"
          :disabled="!(preview.counts.create + preview.counts.update)"
          @click="run(false)"
        />
      </div>
    </template>
  </UModal>
</template>
