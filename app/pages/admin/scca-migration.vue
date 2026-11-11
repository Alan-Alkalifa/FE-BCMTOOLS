<script setup lang="ts">
import type {
  SccaMigrationCounts,
  SccaMigrationItem,
  SccaMigrationRow,
  SccaMigrationRun,
} from '~/composables/useSccaImport'

/**
 * Administration > SCCA migration: signed SCCA workbooks brought into BCM Tools in one run.
 * 1. Choose the workbooks (and the manifest, which says what a workbook doesn't).
 * 2. Review: each workbook is read (nothing is saved) and shows what it will become and why.
 * 3. Import: the ready ones are saved oldest first, one request each, then the run is finished
 *    (the interdependency links are saved last). A run can be undone for 7 days.
 */
definePageMeta({ permission: 'scca.migrate' })
useHead({ title: 'SCCA migration · BCM Tools' })

const toast = useToast()
const confirm = useConfirm()
const picker = useTemplateRef<HTMLInputElement>('picker')
const manifestPicker = useTemplateRef<HTMLInputElement>('manifestPicker')

const MAX_FILES = 200
const files = ref<File[]>([])
const manifest = ref<File | null>(null)
const items = ref<Record<string, SccaMigrationItem>>({})
const failures = ref<Record<string, string>>({})
const reading = ref(false)
const readCount = ref(0)
/** Per file name: leave it out of the run, or bring it in as a draft. */
const choice = ref<Record<string, 'skip' | 'draft' | undefined>>({})
const opened = ref<string | null>(null)

const importing = ref(false)
const importCount = ref(0)
const result = ref<SccaMigrationRun | null>(null)

const { data: runs, refresh: refreshRuns } = useAsyncData('scca-migration-runs', () => sccaMigrationApi.runs(), { server: false })

function options() {
  const names = Object.keys(choice.value)
  return {
    skip: names.filter((name) => choice.value[name] === 'skip'),
    draft: names.filter((name) => choice.value[name] === 'draft'),
  }
}

const rows = computed(() => files.value.map((file) => ({
  file,
  item: items.value[file.name] ?? null,
  failure: failures.value[file.name] ?? null,
})))

const counts = computed<SccaMigrationCounts>(() => {
  const all = Object.values(items.value)
  const ready = all.filter((item) => item.state === 'ready')
  return {
    total: files.value.length,
    ready: ready.length,
    final: ready.filter((item) => item.outcome === 'final').length,
    draft: ready.filter((item) => item.outcome === 'draft').length,
    record: ready.filter((item) => item.outcome === 'record').length,
    blocked: all.filter((item) => item.state === 'blocked').length,
    skipped: all.filter((item) => item.state === 'skipped').length,
    unreadable: all.filter((item) => item.state === 'unreadable').length + Object.keys(failures.value).length,
    new_applications: new Set(ready.filter((item) => item.application?.new).map((item) => item.application!.application_code)).size,
  }
})
const reviewed = computed(() => files.value.length > 0 && !reading.value && readCount.value === files.value.length)

async function review() {
  reading.value = true
  readCount.value = 0
  items.value = {}
  failures.value = {}
  result.value = null
  // One workbook per request (a proxy limits a request's size), a few at a time.
  const queue = [...files.value]
  async function worker() {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        const plan = await sccaMigrationApi.preview([file], manifest.value, options())
        const found = plan.items[0]
        if (found) items.value = { ...items.value, [file.name]: found }
      } catch (error) {
        failures.value = { ...failures.value, [file.name]: sccaImportError(error) }
      }
      readCount.value += 1
    }
  }
  await Promise.all([worker(), worker(), worker()])
  markDuplicates()
  reading.value = false
}

/** Two workbooks of this upload for the same application and date: the API sees one at a time. */
function markDuplicates() {
  const seen = new Map<string, string>()
  const next = { ...items.value }
  for (const file of files.value) {
    const item = next[file.name]
    if (!item || item.state !== 'ready' || !item.application) continue
    const key = `${item.application.application_code}|${item.assessment_date}`
    const first = seen.get(key)
    if (first) {
      next[file.name] = { ...item, state: 'skipped', message: `Same application and assessment date as ${first}.` }
    } else {
      seen.set(key, file.name)
    }
  }
  items.value = next
}

function onFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const chosen = [...(target.files ?? [])]
  target.value = ''
  const known = new Set(files.value.map((file) => file.name))
  const added = chosen.filter((file) => /\.xlsx$/i.test(file.name) && !known.has(file.name))
  const refused = chosen.length - added.length
  files.value = [...files.value, ...added].slice(0, MAX_FILES)
  if (refused) {
    toast.add({ title: `${refused} file${refused === 1 ? '' : 's'} left out`, description: 'Only .xlsx workbooks, each file name once.', color: 'warning' })
  }
  if (files.value.length) review()
}

function onManifest(event: Event) {
  const target = event.target as HTMLInputElement
  manifest.value = target.files?.[0] ?? null
  target.value = ''
  if (files.value.length) review()
}

function clear() {
  files.value = []
  manifest.value = null
  items.value = {}
  failures.value = {}
  choice.value = {}
  result.value = null
  readCount.value = 0
}

function setChoice(name: string, value: 'skip' | 'draft' | undefined) {
  choice.value = { ...choice.value, [name]: value }
  review()
}

async function downloadReport() {
  // The dry run report in parts of 5 workbooks would be 40 files: it is built here instead.
  const lines = [['File', 'Result', 'Becomes', 'Application', 'New application', 'Assessment date', 'Approved on', 'Category', 'Ratings', 'Why / what to fix']]
  for (const { file, item, failure } of rows.value) {
    lines.push([
      file.name,
      item?.state ?? 'unreadable',
      item?.state === 'ready' ? item.outcome ?? '' : '',
      item?.application ? `${item.application.application_code} ${item.application.application_name}` : '',
      item?.application?.new ? 'yes' : '',
      item?.assessment_date ?? '',
      item?.approved_on ?? '',
      item?.category ?? '',
      item?.ratings ? `${item.ratings.read}/${item.ratings.total}` : '',
      [failure, item?.message, ...(item?.reasons ?? [])].filter(Boolean).join(' '),
    ])
  }
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'SCCA_Migration-dry-run.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function runImport() {
  const ready = rows.value
    .filter((row) => row.item?.state === 'ready')
    // Oldest first: an application's later SCCA renews its earlier one.
    .sort((a, b) => (a.item!.assessment_date ?? '').localeCompare(b.item!.assessment_date ?? '') || a.file.name.localeCompare(b.file.name))
  if (!ready.length) return
  const summary = counts.value
  const ok = await confirm({
    title: `Import ${ready.length} SCCA${ready.length === 1 ? '' : 's'}?`,
    description: [
      `${summary.final} final (approved outside BCM Tools), ${summary.draft} draft, ${summary.record} record of an older form.`,
      summary.new_applications ? `${summary.new_applications} new application${summary.new_applications === 1 ? '' : 's'} will be added to the application list.` : null,
      'Final SCCAs set their application\'s category, RTO and RPO. No emails are sent. The run can be undone for 7 days.',
    ].filter(Boolean).join(' '),
    confirmLabel: 'Import',
  })
  if (!ok) return
  importing.value = true
  importCount.value = 0
  const failed: SccaMigrationRow[] = []
  try {
    const run = await sccaMigrationApi.start()
    for (const row of ready) {
      try {
        await sccaMigrationApi.add(run.id, row.file, manifest.value, options())
      } catch (error) {
        failed.push({ file: row.file.name, state: 'failed', message: sccaImportError(error) })
      }
      importCount.value += 1
    }
    const done = await sccaMigrationApi.finish(run.id)
    result.value = { ...done, items: [...done.items, ...failed], failed: done.failed + failed.length }
    toast.add({
      title: `${done.imported} SCCA${done.imported === 1 ? '' : 's'} imported`,
      color: done.failed || failed.length ? 'warning' : 'success',
      icon: 'i-lucide-circle-check',
    })
    files.value = []
    items.value = {}
    choice.value = {}
    readCount.value = 0
    await refreshRuns()
  } catch (error) {
    toast.add({ title: 'The run stopped', description: sccaImportError(error), color: 'error' })
  } finally {
    importing.value = false
  }
}

async function undo(run: SccaMigrationRun) {
  const ok = await confirm({
    title: `Undo run ${run.id}?`,
    description: `Its ${run.imported} SCCA${run.imported === 1 ? '' : 's'} are deleted with their attached workbooks, and the applications it created are removed. Applications get back the category, RTO and RPO of their earlier final SCCA.`,
    confirmLabel: 'Undo run',
    destructive: true,
  })
  if (!ok) return
  try {
    await sccaMigrationApi.undo(run.id)
    toast.add({ title: `Run ${run.id} undone`, color: 'success', icon: 'i-lucide-undo-2' })
    if (result.value?.id === run.id) result.value = null
    await refreshRuns()
  } catch (error) {
    toast.add({ title: 'This run can\'t be undone', description: sccaImportError(error), color: 'error' })
  }
}

/** A run whose import was interrupted: save its interdependency links and totals. */
async function finish(run: SccaMigrationRun) {
  try {
    result.value = await sccaMigrationApi.finish(run.id)
    await refreshRuns()
  } catch (error) {
    toast.add({ title: 'The run couldn\'t be finished', description: sccaImportError(error), color: 'error' })
  }
}

const STATES = {
  ready: { label: 'Ready', color: 'success', icon: 'i-lucide-circle-check' },
  blocked: { label: 'Needs a fix', color: 'error', icon: 'i-lucide-circle-x' },
  skipped: { label: 'Skipped', color: 'neutral', icon: 'i-lucide-circle-minus' },
  unreadable: { label: 'Can\'t be read', color: 'error', icon: 'i-lucide-file-x' },
  imported: { label: 'Imported', color: 'success', icon: 'i-lucide-circle-check' },
  failed: { label: 'Failed', color: 'error', icon: 'i-lucide-circle-x' },
} as const
const OUTCOMES = {
  final: 'Final SCCA',
  draft: 'Draft',
  record: 'Record (older form)',
} as const
</script>

<template>
  <AppPage
    title="SCCA migration"
    icon="i-lucide-file-up"
    description="Bring signed SCCA workbooks into BCM Tools. Each workbook is read and shown here first: nothing is saved until you import."
    :crumbs="[{ label: 'Administration' }, { label: 'SCCA migration' }]"
  >
    <div class="space-y-6">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            1. Choose the workbooks
          </h2>
          <p class="mt-1 text-sm text-muted">
            The SCCA Tools workbooks as they were signed (.xlsx, up to 10 MB each, {{ MAX_FILES }} a run). The manifest is one sheet that says what a workbook doesn't: the application code, the day it was approved, the reason and the renewal date.
          </p>
        </template>
        <div class="flex flex-wrap items-center gap-3">
          <input
            ref="picker"
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            class="sr-only"
            tabindex="-1"
            aria-label="Choose the SCCA workbooks"
            @change="onFiles"
          >
          <input
            ref="manifestPicker"
            type="file"
            accept=".xlsx"
            class="sr-only"
            tabindex="-1"
            aria-label="Choose the manifest"
            @change="onManifest"
          >
          <UButton
            icon="i-lucide-upload"
            :label="files.length ? 'Add workbooks' : 'Choose workbooks'"
            :disabled="importing"
            @click="picker?.click()"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-table"
            :label="manifest ? `Manifest: ${manifest.name}` : 'Choose manifest'"
            :disabled="importing"
            @click="manifestPicker?.click()"
          />
          <UButton
            :to="SCCA_MANIFEST_URL"
            external
            download
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            label="Empty manifest"
          />
          <UButton
            v-if="files.length"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="Clear"
            :disabled="importing || reading"
            @click="clear"
          />
        </div>
        <UAlert
          v-if="!manifest && reviewed && counts.blocked"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-table"
          title="Most fixes go in the manifest"
          description="Download the empty manifest, add one row per workbook that needs a fix (file name, application code, approved on), and choose it here. The review runs again."
        />
      </UCard>

      <UCard
        v-if="files.length"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-highlighted">
                2. Review
              </h2>
              <p
                class="mt-1 text-sm text-muted"
                aria-live="polite"
              >
                <template v-if="reading">
                  Reading {{ readCount }} of {{ files.length }}…
                </template>
                <template v-else>
                  {{ counts.ready }} ready ({{ counts.final }} final, {{ counts.draft }} draft, {{ counts.record }} record) · {{ counts.blocked }} need a fix · {{ counts.skipped }} skipped · {{ counts.unreadable }} can't be read
                </template>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-download"
                label="Dry run report"
                :disabled="!reviewed || importing"
                @click="downloadReport"
              />
              <UButton
                icon="i-lucide-file-up"
                :label="importing ? `Importing ${importCount} of ${counts.ready}…` : `Import ${counts.ready} SCCA${counts.ready === 1 ? '' : 's'}`"
                :loading="importing"
                :disabled="!reviewed || !counts.ready"
                @click="runImport"
              />
            </div>
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-4xl text-sm">
            <caption class="sr-only">
              What each workbook will become
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="px-3 py-2 ps-4">
                  Workbook
                </th>
                <th class="px-3 py-2">
                  Result
                </th>
                <th class="px-3 py-2">
                  Application
                </th>
                <th class="px-3 py-2">
                  Assessed
                </th>
                <th class="px-3 py-2">
                  Category
                </th>
                <th class="px-3 py-2 pe-4">
                  Why / what to fix
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <template
                v-for="{ file, item, failure } in rows"
                :key="file.name"
              >
                <tr>
                  <th
                    scope="row"
                    class="px-3 py-2 ps-4 text-left align-top font-normal"
                  >
                    <UButton
                      v-if="item && (item.problems.length || item.people.length)"
                      color="neutral"
                      variant="link"
                      class="p-0 text-left font-medium"
                      :icon="opened === file.name ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      :label="file.name"
                      :aria-expanded="opened === file.name"
                      @click="opened = opened === file.name ? null : file.name"
                    />
                    <span
                      v-else
                      class="font-medium"
                    >{{ file.name }}</span>
                  </th>
                  <td class="px-3 py-2 align-top">
                    <USkeleton
                      v-if="!item && !failure"
                      class="h-5 w-20"
                    />
                    <template v-else>
                      <UBadge
                        :label="STATES[item?.state ?? 'unreadable'].label"
                        :color="STATES[item?.state ?? 'unreadable'].color"
                        :icon="STATES[item?.state ?? 'unreadable'].icon"
                        variant="subtle"
                        size="sm"
                      />
                      <p
                        v-if="item?.state === 'ready' && item.outcome"
                        class="mt-1 text-xs text-muted"
                      >
                        {{ OUTCOMES[item.outcome] }}
                      </p>
                    </template>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <template v-if="item?.application">
                      <p>{{ item.application.application_name }}</p>
                      <p class="text-xs text-muted">
                        {{ item.application.application_code }}<template v-if="item.application.new">
                          · new application
                        </template>
                      </p>
                    </template>
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                  <td class="px-3 py-2 align-top whitespace-nowrap">
                    {{ formatDate(item?.assessment_date) || '—' }}
                    <p
                      v-if="item?.approved_on"
                      class="text-xs text-muted"
                    >
                      Approved {{ formatDate(item.approved_on) }}
                    </p>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <StatusBadge
                      v-if="item?.category"
                      :scale="sccaCategory"
                      :value="item.category"
                      size="sm"
                    />
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                  <td class="px-3 py-2 pe-4 align-top">
                    <p v-if="failure || item?.message">
                      {{ failure ?? item?.message }}
                    </p>
                    <ul
                      v-if="item?.state === 'ready' && item.reasons.length"
                      class="list-disc ps-4 text-muted"
                    >
                      <li
                        v-for="reason in item.reasons"
                        :key="reason"
                      >
                        {{ reason }}
                      </li>
                    </ul>
                    <div
                      v-if="item && (item.state === 'ready' || choice[file.name])"
                      class="mt-1 flex flex-wrap gap-2"
                    >
                      <UButton
                        v-if="item.outcome === 'final' && !choice[file.name]"
                        size="xs"
                        color="neutral"
                        variant="outline"
                        label="Import as draft instead"
                        :disabled="reading || importing"
                        @click="setChoice(file.name, 'draft')"
                      />
                      <UButton
                        v-if="!choice[file.name]"
                        size="xs"
                        color="neutral"
                        variant="outline"
                        label="Leave out"
                        :disabled="reading || importing"
                        @click="setChoice(file.name, 'skip')"
                      />
                      <UButton
                        v-if="choice[file.name]"
                        size="xs"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-undo-2"
                        label="Undo this choice"
                        :disabled="reading || importing"
                        @click="setChoice(file.name, undefined)"
                      />
                    </div>
                  </td>
                </tr>
                <tr v-if="item && opened === file.name">
                  <td
                    colspan="6"
                    class="bg-elevated/40 px-4 py-3"
                  >
                    <p
                      v-if="item.people.length"
                      class="mb-2 text-sm"
                    >
                      <span class="font-medium">Signed by:</span>
                      <template
                        v-for="(person, index) in item.people"
                        :key="person.box"
                      >
                        {{ index ? ' · ' : ' ' }}{{ person.name }}<span class="text-muted">{{ person.user ? '' : ' (no BCM Tools user: kept as text)' }}</span>
                      </template>
                    </p>
                    <ul class="space-y-1 text-sm">
                      <li
                        v-for="(problem, index) in item.problems"
                        :key="index"
                        class="flex gap-2"
                      >
                        <UBadge
                          :label="SCCA_IMPORT_LEVELS[problem.level].label"
                          :color="SCCA_IMPORT_LEVELS[problem.level].color"
                          variant="subtle"
                          size="sm"
                          class="shrink-0 self-start"
                        />
                        <span><span class="font-mono text-xs text-muted">{{ problem.sheet }}{{ problem.cell ? ` · ${problem.cell}` : '' }}</span> {{ problem.message }}</span>
                      </li>
                    </ul>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard v-if="result">
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Run {{ result.id }}: {{ result.imported }} imported, {{ result.failed }} failed
          </h2>
        </template>
        <ul class="divide-y divide-default text-sm">
          <li
            v-for="row in result.items.filter((item) => item.state === 'imported' || item.state === 'failed')"
            :key="row.file"
            class="flex flex-wrap items-start justify-between gap-3 py-2"
          >
            <div>
              <p class="font-medium">
                {{ row.file }}
              </p>
              <p
                v-if="row.message"
                class="text-error"
              >
                {{ row.message }}
              </p>
              <p
                v-if="row.links && (row.links.left_out.length || row.links.without_final.length)"
                class="text-muted"
              >
                <template v-if="row.links.left_out.length">
                  Interdependencies left out: {{ row.links.left_out.join('; ') }}.
                </template>
                <template v-if="row.links.without_final.length">
                  Kept with the workbook's values (no final SCCA): {{ row.links.without_final.join(', ') }}.
                </template>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UBadge
                :label="row.state === 'imported' ? OUTCOMES[row.outcome ?? 'draft'] : STATES.failed.label"
                :color="row.state === 'imported' ? 'success' : 'error'"
                variant="subtle"
                size="sm"
              />
              <NuxtLink
                v-if="row.id"
                :to="sccaPath('monitoring', row.id)"
                class="font-mono text-xs text-primary hover:underline"
              >{{ row.ref_no }}</NuxtLink>
            </div>
          </li>
        </ul>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Runs
          </h2>
          <p class="mt-1 text-sm text-muted">
            A run can be undone for 7 days, while none of its SCCAs was changed, renewed or linked from another SCCA.
          </p>
        </template>
        <p
          v-if="!runs?.items.length"
          class="px-4 py-6 text-center text-sm text-muted"
        >
          No runs yet.
        </p>
        <table
          v-else
          class="w-full text-sm"
        >
          <caption class="sr-only">
            Migration runs
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="px-3 py-2 ps-4">
                Run
              </th>
              <th class="px-3 py-2">
                By
              </th>
              <th class="px-3 py-2">
                Imported
              </th>
              <th class="px-3 py-2">
                Failed
              </th>
              <th class="px-3 py-2 pe-4" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="run in runs.items"
              :key="run.id"
            >
              <td class="px-3 py-2 ps-4">
                {{ run.id }} · {{ formatDate(run.created_at) }}
              </td>
              <td class="px-3 py-2">
                {{ run.created_by?.display_name ?? run.created_by?.email ?? '—' }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ run.imported }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ run.failed }}
              </td>
              <td class="px-3 py-2 pe-4 text-right">
                <span
                  v-if="run.undone_at"
                  class="text-muted"
                >Undone {{ formatDate(run.undone_at) }}</span>
                <UButton
                  v-else-if="!run.finished"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  label="Finish this run"
                  @click="finish(run)"
                />
                <UButton
                  v-else-if="run.imported"
                  size="xs"
                  color="error"
                  variant="outline"
                  icon="i-lucide-undo-2"
                  label="Undo"
                  :disabled="!run.can_undo"
                  @click="undo(run)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </div>
  </AppPage>
</template>
