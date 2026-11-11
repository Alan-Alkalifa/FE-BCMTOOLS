<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import type { SccaApplication, SccaAssessment } from '~/composables/useScca'
import type { SccaImportOptions, SccaImportPreview } from '~/composables/useSccaImport'

/**
 * Upload Excel: an SCCA from the BCM Tools template of the SCCA Tools workbook.
 * - New assessment: pick the reason, the application and the contributor, download the
 *   template, fill it in Excel, choose the file. The review shows what was read; Create draft
 *   saves it as a draft, as the form would.
 * - With `assessment` (an open draft in Manage): the file replaces the draft's ratings,
 *   interdependencies, recovery values and header details.
 * The API reads the file twice (review, then save) and checks everything again on save.
 */
const props = defineProps<{ assessment?: SccaAssessment | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const { data: config } = useSccaConfig()
const input = useTemplateRef<HTMLInputElement>('input')

const reason = ref<string | undefined>(undefined)
const applicationId = ref<number | null>(null)
const picked = ref<SccaApplication | null>(null)
const code = ref('')
const name = ref('')
const contributorId = ref<number | null>(null)
const dueDate = shallowRef<CalendarDate | undefined>(undefined)

const file = ref<File | null>(null)
const preview = ref<SccaImportPreview | null>(null)
const reading = ref(false)
const saving = ref(false)
const failure = ref<string | null>(null)

const draft = computed(() => props.assessment ?? null)
const reasonItems = computed(() => sccaListOptions(config.value, 'assessment_reason'))
const lookup = computed(() => {
  if (!reason.value) return false
  const rule = sccaListItem(config.value, 'assessment_reason', reason.value)?.attrs?.lookup
  return typeof rule === 'boolean' ? rule : reason.value !== 'new_application'
})
const customDue = computed(() =>
  !!sccaListItem(config.value, 'assessment_reason', reason.value)?.attrs?.custom_due_date,
)
const templateUrl = computed(() =>
  sccaTemplateUrl(draft.value?.application_id ?? (lookup.value ? applicationId.value : null)),
)

/** What still has to be chosen before the draft can be created. */
const missing = computed(() => {
  if (draft.value) return null
  if (!reason.value) return 'Pick the reason for assessment.'
  if (lookup.value && !applicationId.value) return 'Pick the application.'
  if (!lookup.value && (!code.value.trim() || !name.value.trim())) return 'Enter the application code and name.'
  if (customDue.value && !dueDate.value) return 'Pick the renewal due date.'
  return null
})

function options(): SccaImportOptions {
  return {
    assessment_reason: reason.value ?? null,
    application_id: lookup.value ? applicationId.value : null,
    application_code: lookup.value ? null : code.value.trim(),
    application_name: lookup.value ? null : name.value.trim(),
    contributor_id: contributorId.value,
    due_date: customDue.value ? dueDate.value?.toString() ?? null : null,
  }
}

watch(open, (value) => {
  if (!value) return
  file.value = null
  preview.value = null
  failure.value = null
  reason.value = undefined
  applicationId.value = null
  picked.value = null
  code.value = ''
  name.value = ''
  contributorId.value = null
  dueDate.value = undefined
})
watch(reason, () => {
  applicationId.value = null
  picked.value = null
})

async function read(chosen: File) {
  file.value = chosen
  preview.value = null
  failure.value = null
  reading.value = true
  try {
    preview.value = draft.value
      ? await sccaImportApi.previewDraft(draft.value.id, chosen)
      : await sccaImportApi.preview(chosen, { application_id: lookup.value ? applicationId.value : null })
    const found = preview.value
    if (!draft.value && found.due_date && customDue.value && !dueDate.value) {
      dueDate.value = parseDate(found.due_date)
    }
  } catch (error) {
    failure.value = sccaImportError(error)
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
  if (!file.value || !preview.value?.can_import || missing.value) return
  saving.value = true
  failure.value = null
  try {
    const saved = draft.value
      ? await sccaImportApi.replaceDraft(draft.value.id, file.value)
      : await sccaImportApi.create(file.value, options())
    toast.add({
      title: draft.value ? 'Draft replaced from the workbook' : `Draft ${saved.ref_no ?? ''} created from the workbook`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    open.value = false
    emit('saved', saved)
  } catch (error) {
    failure.value = sccaImportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="draft ? 'Replace this draft from Excel' : 'Upload Excel'"
    :description="draft
      ? 'The workbook replaces this draft\'s ratings, interdependencies, recovery values and application details. The application, reason, dates and people stay.'
      : 'Create the draft from the SCCA template filled in Excel, instead of typing it into the form.'"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <section
          v-if="!draft"
          class="space-y-3"
        >
          <h3 class="text-sm font-semibold">
            1. What is assessed
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Reason for assessment"
              required
            >
              <USelect
                v-model="reason"
                :items="reasonItems"
                value-key="value"
                label-key="label"
                placeholder="Select a reason"
                class="w-full"
                aria-label="Reason for assessment"
              />
            </UFormField>
            <UFormField
              v-if="lookup"
              label="Application"
              required
            >
              <SccaApplicationSearch
                v-model="applicationId"
                :reason="reason ?? null"
                aria-label="Application"
                @pick="picked = $event"
              />
            </UFormField>
            <template v-else-if="reason">
              <UFormField
                label="Application code"
                required
              >
                <UInput
                  v-model="code"
                  class="w-full"
                  :maxlength="TEXT_LIMITS.short"
                  aria-label="Application code"
                />
              </UFormField>
              <UFormField
                label="Application name"
                required
              >
                <UInput
                  v-model="name"
                  class="w-full"
                  :maxlength="TEXT_LIMITS.name"
                  aria-label="Application name"
                />
              </UFormField>
            </template>
            <UFormField
              label="Contributor (IT support)"
              help="Needed to submit. You can pick it later in the form."
            >
              <UserPicker
                v-model="contributorId"
                aria-label="Contributor (IT support)"
                permission="scca.access"
              />
            </UFormField>
            <UFormField
              v-if="customDue"
              label="Renewal due date"
              required
            >
              <DatePicker v-model="dueDate" />
            </UFormField>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            {{ draft ? '1' : '2' }}. Fill in the template
          </h3>
          <p class="text-sm text-muted">
            Use this template only: an older copy of the workbook is refused. Keep its sheets, rows and columns as they are, and pick values from the dropdowns.
            <template v-if="!draft && lookup && picked">
              It comes with the details of {{ picked.application_name }} filled in.
            </template>
          </p>
          <UButton
            :to="templateUrl"
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
            {{ draft ? '2' : '3' }}. Choose the filled workbook
          </h3>
          <div class="flex flex-wrap items-center gap-3">
            <input
              ref="input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              class="sr-only"
              tabindex="-1"
              aria-label="Choose the SCCA workbook"
              @change="onFile"
            >
            <UButton
              icon="i-lucide-upload"
              :label="file ? 'Choose another file' : 'Choose file'"
              :loading="reading"
              :disabled="saving"
              @click="input?.click()"
            />
            <p
              v-if="file"
              class="text-sm text-muted"
            >
              {{ file.name }}
            </p>
            <p
              v-else
              class="text-sm text-muted"
            >
              .xlsx, up to 10 MB. Nothing is saved until you confirm.
            </p>
          </div>
          <UAlert
            v-if="failure"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="This file can't be used"
            :description="failure"
          />
          <SccaImportReview
            v-if="preview"
            :preview="preview"
          />
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-end gap-3">
        <p
          v-if="preview?.can_import && missing"
          class="me-auto text-sm text-warning"
        >
          {{ missing }}
        </p>
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          :disabled="saving"
          @click="open = false"
        />
        <UButton
          :icon="draft ? 'i-lucide-replace' : 'i-lucide-file-plus'"
          :label="draft ? 'Replace draft' : 'Create draft'"
          :loading="saving"
          :disabled="!preview?.can_import || !!missing || reading"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
