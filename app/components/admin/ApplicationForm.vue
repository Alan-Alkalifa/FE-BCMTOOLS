<script setup lang="ts">
import type { Application, ApplicationInput } from '~/composables/useApplications'

/** Add or edit an application of the master. */
const props = defineProps<{ application?: Application | null }>()
const emit = defineEmits<{ close: [saved?: Application] }>()

const toast = useToast()
const { data: config } = useSccaConfig()

const form = reactive({
  application_code: props.application?.application_code ?? '',
  application_name: props.application?.application_name ?? '',
  category: props.application?.category ?? undefined as string | undefined,
  rto_hours: props.application?.rto_hours ?? undefined as string | undefined,
  rpo: props.application?.rpo ?? undefined as string | undefined,
  description: props.application?.description ?? '',
  is_active: props.application?.is_active ?? true,
})
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const codeLocked = computed(() => !!props.application?.in_use)

const categoryItems = computed(() => sccaListOptions(config.value, 'category', form.category))
const hoursItems = computed(() => sccaListOptions(config.value, 'hours', form.rto_hours))
const rpoItems = computed(() => sccaListOptions(config.value, 'rpo', form.rpo))

async function save() {
  errors.value = {}
  busy.value = true
  const body: ApplicationInput = {
    application_code: form.application_code.trim(),
    application_name: form.application_name.trim(),
    category: form.category || null,
    rto_hours: form.rto_hours || null,
    rpo: form.rpo || null,
    description: form.description.trim() || null,
    is_active: form.is_active,
  }
  try {
    const saved = props.application
      ? await applicationsApi.update(props.application.id, body)
      : await applicationsApi.create(body)
    toast.add({ title: props.application ? 'Application saved' : 'Application added', color: 'success', icon: 'i-lucide-circle-check' })
    emit('close', saved)
  } catch (error) {
    const details = (error as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ? { ...details } : { form: adminErrorText(error) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="application ? `Edit ${application.application_code}` : 'New application'"
    :description="application?.final_assessment
      ? `Category, RTO and RPO come from ${application.final_assessment.ref_no}; the next final SCCA overwrites them.`
      : 'A final SCCA of this application will set its category, RTO and RPO.'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        id="application-form"
        class="space-y-4"
        novalidate
        @submit.prevent="save"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />
        <div class="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <UFormField
            label="Application code"
            name="application_code"
            required
            :error="errors.application_code"
            :help="codeLocked ? 'An SCCA uses this application, so its code can\'t change.' : 'Stored in capitals.'"
          >
            <template #hint>
              <FieldCount
                :value="form.application_code"
                :max="TEXT_LIMITS.short"
              />
            </template>
            <UInput
              v-model="form.application_code"
              :maxlength="TEXT_LIMITS.short"
              :disabled="codeLocked"
              class="w-full uppercase"
            />
          </UFormField>
          <UFormField
            label="Application name"
            name="application_name"
            required
            :error="errors.application_name"
          >
            <template #hint>
              <FieldCount
                :value="form.application_name"
                :max="TEXT_LIMITS.name"
              />
            </template>
            <UInput
              v-model="form.application_name"
              :maxlength="TEXT_LIMITS.name"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField
            label="Category"
            name="category"
            :error="errors.category"
          >
            <USelect
              v-model="form.category"
              :items="categoryItems"
              placeholder="Not set"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="RTO (hours)"
            name="rto_hours"
            :error="errors.rto_hours"
          >
            <USelect
              v-model="form.rto_hours"
              :items="hoursItems"
              placeholder="Not set"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="RPO"
            name="rpo"
            :error="errors.rpo"
          >
            <USelect
              v-model="form.rpo"
              :items="rpoItems"
              placeholder="Not set"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Description"
          name="description"
          :error="errors.description"
        >
          <template #hint>
            <FieldCount
              :value="form.description"
              :max="TEXT_LIMITS.long"
            />
          </template>
          <UTextarea
            v-model="form.description"
            :maxlength="TEXT_LIMITS.long"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>
        <USwitch
          v-model="form.is_active"
          label="Active"
          description="Inactive applications can't be picked for a new SCCA or as an upstream or downstream application."
        />
      </form>
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
          type="submit"
          form="application-form"
          :label="application ? 'Save application' : 'Add application'"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
