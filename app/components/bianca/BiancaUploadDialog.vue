<script setup lang="ts">
import type { BiancaAssessment, BiancaImportResult } from '~/composables/useBianca'

/**
 * Upload Excel: a BIA from the BIANCA template.
 * - From Manage / New BIA: download the template (its dropdowns come from the database), fill it
 *   in Excel, choose the file. The review lists what is missing or wrong, cell by cell; Create
 *   draft is enabled only when nothing is.
 * - With `assessment` (an open draft): the file replaces the draft's content.
 * The file is recognised by its content, so its name doesn't matter, but it has to be the
 * template of your own Group.
 */
const props = defineProps<{ assessment?: BiancaAssessment | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [assessment: BiancaAssessment] }>()

const toast = useToast()
const input = useTemplateRef<HTMLInputElement>('input')

const file = ref<File | null>(null)
const result = ref<BiancaImportResult | null>(null)
const reading = ref(false)
const saving = ref(false)
const failure = ref<string | null>(null)
const draft = computed(() => props.assessment ?? null)

watch(open, (value) => {
  if (!value) return
  file.value = null
  result.value = null
  failure.value = null
})

async function read(chosen: File) {
  file.value = chosen
  result.value = null
  failure.value = null
  reading.value = true
  try {
    result.value = draft.value
      ? await biancaApi.importPreviewDraft(draft.value.id, chosen)
      : await biancaApi.importPreview(chosen)
  } catch (error) {
    const failed = biancaImportFailure(error)
    failure.value = failed.message
    result.value = failed.result
  } finally {
    reading.value = false
  }
}

function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const chosen = target.files?.[0]
  target.value = ''
  if (chosen) read(chosen)
}

async function save() {
  if (!file.value || !result.value?.can_import) return
  saving.value = true
  failure.value = null
  try {
    const saved = draft.value
      ? await biancaApi.importReplace(draft.value.id, file.value)
      : await biancaApi.importCreate(file.value)
    toast.add({
      title: draft.value ? 'Draft replaced from the workbook' : `Draft ${saved.ref_no ?? ''} created from the workbook`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    open.value = false
    emit('saved', saved)
  } catch (error) {
    const failed = biancaImportFailure(error)
    failure.value = failed.message
    result.value = failed.result ?? result.value
  } finally {
    saving.value = false
  }
}

const errors = computed(() => result.value?.problems.filter((p) => p.level === 'error') ?? [])
const warnings = computed(() => result.value?.problems.filter((p) => p.level === 'warning') ?? [])
function where(problem: { sheet: string | null, cell: string | null }) {
  return [problem.sheet, problem.cell].filter(Boolean).join(' · ')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="draft ? 'Replace this draft from Excel' : 'Upload Excel'"
    :description="draft
      ? 'The workbook replaces everything in this draft except its Group.'
      : 'Create the draft from the BIA template filled in Excel, instead of typing it into the form.'"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            1. Fill in the template
          </h3>
          <p class="text-sm text-muted">
            Use the template downloaded here, for your own Group: its application systems and office locations come from the system. Fill every white cell and pick values from the dropdowns. The file name doesn't matter.
          </p>
          <UButton
            :to="draft ? `${BIANCA_TEMPLATE_URL}?assessment_id=${draft.id}` : BIANCA_TEMPLATE_URL"
            external
            download
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            label="Download template"
          />
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            2. Choose the filled workbook
          </h3>
          <div class="flex flex-wrap items-center gap-3">
            <input
              ref="input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              class="sr-only"
              tabindex="-1"
              aria-label="Choose the BIA workbook"
              @change="onFile"
            >
            <UButton
              icon="i-lucide-upload"
              :label="file ? 'Choose another file' : 'Choose file'"
              :loading="reading"
              color="neutral"
              variant="outline"
              @click="input?.click()"
            />
            <span
              v-if="file"
              class="text-sm text-muted"
            >{{ file.name }}</span>
          </div>
        </section>

        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failure"
        />

        <section
          v-if="result"
          class="space-y-3"
          aria-live="polite"
        >
          <h3 class="text-sm font-semibold">
            3. Review
          </h3>
          <UAlert
            v-if="result.can_import"
            color="success"
            variant="subtle"
            icon="i-lucide-circle-check"
            :title="`${result.functions} business ${result.functions === 1 ? 'function' : 'functions'} read; every required cell is filled.`"
          />
          <UAlert
            v-else
            color="error"
            variant="subtle"
            icon="i-lucide-circle-x"
            :title="`${errors.length} ${errors.length === 1 ? 'problem' : 'problems'} to fix in the workbook`"
            description="Nothing is saved until the workbook has none."
          />
          <ul
            v-if="errors.length"
            class="max-h-64 space-y-1 overflow-y-auto rounded-md border border-default p-3 text-sm"
          >
            <li
              v-for="(problem, index) in errors"
              :key="`e${index}`"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-circle-x"
                class="mt-0.5 size-4 shrink-0 text-error"
              />
              <span>
                <span
                  v-if="where(problem)"
                  class="me-1 font-mono text-xs text-muted"
                >{{ where(problem) }}</span>{{ problem.message }}
              </span>
            </li>
          </ul>
          <details
            v-if="warnings.length"
            class="rounded-md border border-default p-3 text-sm"
          >
            <summary class="cursor-pointer font-medium text-warning">
              {{ warnings.length }} {{ warnings.length === 1 ? 'thing' : 'things' }} to check (they don't stop the upload)
            </summary>
            <ul class="mt-2 space-y-1">
              <li
                v-for="(problem, index) in warnings"
                :key="`w${index}`"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-triangle-alert"
                  class="mt-0.5 size-4 shrink-0 text-warning"
                />
                <span>{{ problem.message }}</span>
              </li>
            </ul>
          </details>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          icon="i-lucide-file-check"
          :label="draft ? 'Replace draft' : 'Create draft'"
          :disabled="!result?.can_import"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
