<script setup lang="ts">
import type { RaAssessment, RaImportPreview } from '~/composables/useRa'

/**
 * Upload Excel on an open RA draft (Manage), as SCCA's on a draft. The workbook of the draft's
 * kind replaces its hazard ratings, existing mitigation and action plans; a hazard without a row
 * is emptied. The building, reason, dates, LIC, LICOM, signers and review years stay. "Update the
 * building's profile from this file" replaces its contacts (and LCP sheets, HO) too. The review
 * shows what was read and what to fix (a workbook with errors can't replace the draft).
 */
const props = defineProps<{ assessment: RaAssessment }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const toast = useToast()
const MAX_BYTES = 10 * 1024 * 1024
const workbook = computed(() => (props.assessment.kind === 'branch' ? 'Cabang' : 'HO'))

const file = ref<File | null>(null)
const preview = ref<RaImportPreview | null>(null)
const reading = ref(false)
const saving = ref(false)
const failure = ref<string | null>(null)
const replaceProfile = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) return
  file.value = null
  preview.value = null
  failure.value = null
  replaceProfile.value = false
})

const input = useTemplateRef<HTMLInputElement>('input')
const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0)

function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const chosen = target.files?.[0]
  target.value = ''
  if (chosen) read(chosen)
}
function onDrop(event: DragEvent) {
  dragDepth.value = 0
  const chosen = event.dataTransfer?.files?.[0]
  if (chosen && !saving.value) read(chosen)
}

async function read(chosen: File) {
  failure.value = null
  if (!chosen.name.toLowerCase().endsWith('.xlsx')) {
    failure.value = `${chosen.name}: use an .xlsx file. Save it as .xlsx in Excel first.`
    return
  }
  if (chosen.size > MAX_BYTES) {
    failure.value = `${chosen.name}: the file is larger than 10 MB.`
    return
  }
  file.value = chosen
  preview.value = null
  reading.value = true
  try {
    const found = await raApi.importDraftPreview(props.assessment.id, chosen)
    if (file.value === chosen) preview.value = found
  } catch (error) {
    const details = (error as { data?: { details?: Record<string, string> } }).data?.details
    failure.value = details?.file ?? apiErrorMessage(error)
    file.value = null
  } finally {
    reading.value = false
  }
}

async function save() {
  if (!file.value || !preview.value?.can_import) return
  saving.value = true
  failure.value = null
  try {
    const saved = await raApi.replaceDraft(props.assessment.id, file.value, replaceProfile.value)
    clearNuxtData((key) => key.startsWith('ra-'))
    toast.add({ title: 'Draft replaced from the workbook', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
    open.value = false
  } catch (error) {
    const details = (error as { data?: { details?: Record<string, string> } }).data?.details
    failure.value = details ? Object.values(details).join(' ') : apiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

const downloading = ref(false)
async function downloadTemplate() {
  downloading.value = true
  try {
    await downloadRaImportTemplate(props.assessment.kind)
  } catch (error) {
    toast.add({ color: 'error', title: 'Couldn\'t download the template', description: apiErrorMessage(error) })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Replace this draft from Excel"
    description="The workbook replaces this draft's hazard ratings, existing mitigation and action plans. The building, reason, dates and people stay."
    :dismissible="!saving"
    :ui="{ content: 'sm:max-w-4xl', body: 'space-y-6' }"
  >
    <template #body>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold">
          1. Fill in the template
        </h3>
        <p class="text-sm text-muted">
          Use the {{ workbook }} workbook. Keep its sheets, rows and columns as they are.
        </p>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-download"
          label="Download template"
          :loading="downloading"
          @click="downloadTemplate"
        />
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">
          2. Choose the filled workbook
        </h3>
        <input
          ref="input"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="sr-only"
          tabindex="-1"
          aria-label="Choose the RA workbook"
          @change="onFile"
        >
        <div
          data-testid="draft-drop-zone"
          class="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors sm:flex-row sm:gap-3 sm:text-start"
          :class="[dragging ? 'border-primary bg-primary/5' : 'border-default', saving ? 'opacity-60' : '']"
          @dragenter.prevent="dragDepth++"
          @dragover.prevent
          @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
          @drop.prevent="onDrop"
        >
          <UIcon
            name="i-lucide-file-spreadsheet"
            class="size-8 shrink-0"
            :class="preview?.can_import ? 'text-success' : 'text-muted'"
          />
          <div class="min-w-0 flex-1 text-sm">
            <p
              v-if="file"
              class="truncate font-medium text-highlighted"
              data-testid="draft-file"
            >
              {{ file.name }}
            </p>
            <p
              v-else
              class="font-medium text-highlighted"
            >
              {{ dragging ? 'Drop to add the file' : 'Drop the Excel file here, or choose it' }}
            </p>
            <p class="text-muted">
              {{ reading ? 'Reading the file…' : preview ? preview.template : '.xlsx, up to 10 MB. Nothing is saved until you replace the draft.' }}
            </p>
          </div>
          <UButton
            icon="i-lucide-upload"
            :label="file ? 'Choose another file' : 'Choose file'"
            :variant="file ? 'outline' : 'solid'"
            :color="file ? 'neutral' : 'primary'"
            :loading="reading"
            :disabled="saving"
            @click="input?.click()"
          />
        </div>
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="This file can't be used"
          :description="failure"
        />
        <template v-if="preview">
          <USwitch
            v-model="replaceProfile"
            :label="`Update the ${assessment.kind === 'branch' ? 'branch' : 'building'}'s profile from this file`"
            :description="assessment.kind === 'branch' ? 'Replaces its emergency contacts.' : 'Replaces its emergency contacts, occupants, recovery team and call tree.'"
          />
          <RaImportReview :preview="preview" />
        </template>
      </section>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-end gap-3">
        <p
          v-if="preview && !preview.can_import"
          class="me-auto text-sm text-warning"
        >
          Fix the workbook and choose it again.
        </p>
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          :disabled="saving"
          @click="open = false"
        />
        <UButton
          icon="i-lucide-replace"
          label="Replace draft"
          :loading="saving"
          :disabled="!preview?.can_import || reading"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
