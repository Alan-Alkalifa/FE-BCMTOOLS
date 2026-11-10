<script setup lang="ts">
import type { RaImportResult } from '~/composables/useRa'

/**
 * Import from Excel, in a dialog: pick RA HO or RA Branch, choose one or more filled-in
 * workbooks (one building per file), check each file's card, then Import saves every file that
 * is ready, one after another. Nothing is saved before. Opened from Buildings (`?import=…`) and
 * RA / RA Branch Manage.
 */
const props = defineProps<{ kind?: RaKind }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [results: RaImportResult[]] }>()

const toast = useToast()
const { can } = useAuth()

const MAX_BYTES = 10 * 1024 * 1024
const kinds = computed(() => (['head_office', 'branch'] as const).filter((kind) => can(RA_MODULES[kind].perm.edit)))
const chosenKind = ref<RaKind>('head_office')
const kindItems = computed(() => kinds.value.map((value) => ({
  value,
  label: RA_MODULES[value].title,
  description: value === 'branch' ? 'Branches (Cabang workbook)' : 'Head office buildings (HO workbook)',
})))

interface Entry { key: string, file: File }
const entries = ref<Entry[]>([])
const refused = ref<string[]>([])
const summaries = reactive<Record<string, { status: RaImportCardStatus, building: string | null, period: number | null }>>({})
const cards = new Map<string, { check: () => Promise<boolean>, run: () => Promise<RaImportResult | null> }>()
const importing = ref(false)
const done = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  entries.value = []
  refused.value = []
  done.value = false
  for (const key of Object.keys(summaries)) Reflect.deleteProperty(summaries, key)
  chosenKind.value = props.kind && kinds.value.includes(props.kind) ? props.kind : kinds.value[0] ?? 'head_office'
}, { immediate: true })

const input = useTemplateRef<HTMLInputElement>('input')

function onFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = Array.from(target.files ?? [])
  target.value = ''
  refused.value = []
  for (const file of picked) {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      refused.value.push(`${file.name}: use an .xlsx file. Save it as .xlsx in Excel first.`)
      continue
    }
    if (file.size > MAX_BYTES) {
      refused.value.push(`${file.name}: the file is larger than 10 MB.`)
      continue
    }
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (!entries.value.some((entry) => entry.key === key)) entries.value.push({ key, file })
  }
}

function remove(entry: Entry) {
  entries.value = entries.value.filter((item) => item.key !== entry.key)
  cards.delete(entry.key)
  Reflect.deleteProperty(summaries, entry.key)
}

function setCard(key: string, card: unknown) {
  if (card) cards.set(key, card as { check: () => Promise<boolean>, run: () => Promise<RaImportResult | null> })
  else cards.delete(key)
}

/** Two files for the same building and period: only the first can be imported. */
const duplicates = computed(() => {
  const seen = new Map<string, string>()
  const found: Record<string, string> = {}
  for (const entry of entries.value) {
    const summary = summaries[entry.key]
    if (!summary?.building || summary.period === null || summary.status === 'imported') continue
    const id = `${summary.building}|${summary.period}`
    if (seen.has(id)) found[entry.key] = `Another file in this list is for the same ${RA_MODULES[chosenKind.value].location.lower} and period (${seen.get(id)}). Remove one.`
    else seen.set(id, entry.file.name)
  }
  return found
})

const ready = computed(() => entries.value.filter((entry) => ['ready', 'failed'].includes(summaries[entry.key]?.status ?? '') && !duplicates.value[entry.key]))
const reading = computed(() => entries.value.some((entry) => (summaries[entry.key]?.status ?? 'reading') === 'reading'))
const imported = computed(() => entries.value.filter((entry) => summaries[entry.key]?.status === 'imported').length)

async function importAll() {
  importing.value = true
  const results: RaImportResult[] = []
  try {
    const checked: string[] = []
    for (const entry of ready.value) {
      if (await cards.get(entry.key)?.check()) checked.push(entry.key)
    }
    if (!checked.length) {
      toast.add({ title: 'Nothing to import yet', description: 'Fill in the fields marked in each file.', color: 'warning', icon: 'i-lucide-triangle-alert' })
      return
    }
    for (const key of checked) {
      const result = await cards.get(key)?.run()
      if (result) results.push(result)
    }
    if (results.length) {
      clearNuxtData((key) => key.startsWith('ra-'))
      emit('imported', results)
      toast.add({
        title: `${results.length} ${results.length === 1 ? 'file' : 'files'} imported`,
        description: results.length < checked.length ? 'Some files need attention. Check them below.' : undefined,
        color: results.length < checked.length ? 'warning' : 'success',
        icon: 'i-lucide-circle-check',
      })
    }
    done.value = entries.value.every((entry) => summaries[entry.key]?.status === 'imported')
  } finally {
    importing.value = false
  }
}

const downloading = ref(false)
async function downloadTemplate() {
  downloading.value = true
  try {
    await downloadRaImportTemplate(chosenKind.value)
  } catch (failure) {
    toast.add({ color: 'error', title: 'Couldn\'t download the template', description: apiErrorMessage(failure) })
  } finally {
    downloading.value = false
  }
}

const importLabel = computed(() => {
  const count = ready.value.length
  return count > 1 ? `Import ${count} files` : 'Import'
})
</script>

<template>
  <UModal
    v-model:open="open"
    title="Import from Excel"
    description="Add buildings and their RA from filled-in workbooks. One building per file."
    :dismissible="!importing"
    :ui="{ content: 'sm:max-w-4xl', body: 'space-y-5' }"
  >
    <template #body>
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">
          1. Choose the type
        </h3>
        <URadioGroup
          v-model="chosenKind"
          :items="kindItems"
          variant="card"
          orientation="horizontal"
          legend="Type of RA"
          :disabled="importing"
          :ui="{ legend: 'sr-only', fieldset: 'grid gap-3 sm:grid-cols-2' }"
        />
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold">
          2. Choose the files
        </h3>
        <div class="flex flex-wrap items-center gap-3">
          <input
            ref="input"
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            class="sr-only"
            tabindex="-1"
            aria-label="Choose the RA workbooks"
            @change="onFiles"
          >
          <UButton
            icon="i-lucide-upload"
            :label="entries.length ? 'Add more files' : 'Choose files'"
            :disabled="importing"
            @click="input?.click()"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            label="Download empty template"
            :loading="downloading"
            @click="downloadTemplate"
          />
          <span class="text-sm text-muted">.xlsx, up to 10 MB each.</span>
        </div>
        <UAlert
          v-if="refused.length"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Some files were not added"
        >
          <template #description>
            <ul class="list-disc ps-4">
              <li
                v-for="message in refused"
                :key="message"
              >
                {{ message }}
              </li>
            </ul>
          </template>
        </UAlert>
      </section>

      <section
        v-if="entries.length"
        class="space-y-4"
        aria-label="Files to import"
      >
        <h3 class="text-sm font-semibold">
          3. Check each file
        </h3>
        <RaImportFileCard
          v-for="entry in entries"
          :key="entry.key"
          :ref="(card) => setCard(entry.key, card)"
          :file="entry.file"
          :kind="chosenKind"
          :duplicate="duplicates[entry.key] ?? null"
          @remove="remove(entry)"
          @summary="(summary) => (summaries[entry.key] = summary)"
        />
      </section>
      <p
        v-else
        class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted"
      >
        No files yet.
      </p>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">
          <template v-if="imported">
            {{ imported }} of {{ entries.length }} imported.
          </template>
          <template v-else-if="reading">
            Reading the files…
          </template>
          <template v-else-if="entries.length">
            {{ ready.length }} of {{ entries.length }} ready.
          </template>
        </p>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :label="done || imported ? 'Close' : 'Cancel'"
            :disabled="importing"
            @click="open = false"
          />
          <UButton
            v-if="!done"
            icon="i-lucide-file-input"
            :label="importLabel"
            :loading="importing"
            :disabled="!ready.length || reading"
            @click="importAll"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
