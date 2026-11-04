<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaConfigVersion, RaConfigVersionMeta } from '~/composables/useRaConfigAdmin'

/** The versions of one kind (active, draft, retired) and, for the draft, its code (e.g. V.05), name and notes. */
const props = defineProps<{ versions: RaConfigVersionMeta[], version: RaConfigVersion }>()
const emit = defineEmits<{ open: [code: string], saved: [version: RaConfigVersion] }>()

const columns: TableColumn<RaConfigVersionMeta>[] = [
  { accessorKey: 'code', header: 'Version' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'used_by', header: 'Assessments', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'created_by', header: 'Started' },
  { accessorKey: 'published_by', header: 'Published' },
]

const part = useRaConfigPart(
  computed(() => props.version),
  (value) => ({ code: value.code, name: value.name, notes: value.notes ?? '' }),
  (ref, value) => raConfigApi.update(ref, { ...value, code: value.code.trim(), notes: value.notes.trim() || null }),
  (saved) => emit('saved', saved),
  'Version saved',
)
const { draft, error, busy, dirty, submit } = part
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Versions
        </h2>
        <p class="mt-1 text-sm text-muted">
          Each assessment keeps the version it was created on. New assessments use the active version.
        </p>
      </template>
      <UTable
        :data="versions"
        :columns="columns"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #code-cell="{ row }">
          <UButton
            variant="link"
            class="p-0 font-medium"
            :label="row.original.code"
            :aria-current="row.original.code === version.code ? 'true' : undefined"
            @click="emit('open', row.original.code)"
          />
          <p class="max-w-72 truncate text-xs text-muted">
            {{ row.original.name }}
          </p>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            :scale="sccaVersionStatus"
            :value="row.original.status"
            size="sm"
          />
          <p
            v-if="row.original.requested_by"
            class="mt-1 text-xs text-muted"
          >
            Publish requested by {{ row.original.requested_by }}
          </p>
        </template>
        <template #used_by-cell="{ row }">
          <span class="tabular-nums">{{ formatNumber(row.original.used_by) }}</span>
        </template>
        <template #created_by-cell="{ row }">
          <span v-if="row.original.based_on">From {{ row.original.based_on }}<br></span>
          <span class="text-xs text-muted">{{ row.original.created_by ?? 'Migration' }}<template v-if="row.original.created_at">, {{ formatDate(row.original.created_at) }}</template></span>
        </template>
        <template #published_by-cell="{ row }">
          <template v-if="row.original.published_at">
            {{ row.original.published_by ?? '—' }}
            <p class="text-xs text-muted">
              {{ formatDateTime(row.original.published_at) }}
            </p>
          </template>
          <span v-else>—</span>
        </template>
      </UTable>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">
          {{ version.code }}
        </h2>
        <p
          v-if="version.based_on"
          class="mt-1 text-sm text-muted"
        >
          Copied from {{ version.based_on }}.
        </p>
      </template>
      <form
        class="space-y-4"
        novalidate
        @submit.prevent="submit"
      >
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't save the version"
          :ui="{ description: 'whitespace-pre-line' }"
          :description="error"
        />
        <fieldset
          :disabled="!version.can.edit"
          class="space-y-4"
        >
          <UFormField
            label="Version code"
            name="code"
            required
            help="Its code, e.g. V.05: letters, digits, dot, dash or underscore. Unique within RA or RA Branch."
          >
            <UInput
              v-model="draft.code"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Name"
            name="name"
            required
          >
            <UInput
              v-model="draft.name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Notes"
            name="notes"
            help="What changes in this version and why. Shown to whoever approves the publish."
          >
            <UTextarea
              v-model="draft.notes"
              :rows="4"
              class="w-full"
            />
          </UFormField>
        </fieldset>
        <div
          v-if="version.can.edit"
          class="flex justify-end"
        >
          <UButton
            type="submit"
            label="Save version"
            :disabled="!dirty"
            :loading="busy"
          />
        </div>
      </form>
    </UCard>
  </div>
</template>
