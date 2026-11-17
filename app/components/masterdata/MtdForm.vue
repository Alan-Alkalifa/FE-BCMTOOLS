<script setup lang="ts">
import type { MasterMtd, MasterMtdInput } from '~/composables/useMasterMtd'

/** Add or edit a choice of Master MTD. */
const props = defineProps<{ mtd?: MasterMtd | null, nextSort?: number }>()
const emit = defineEmits<{ close: [saved?: MasterMtd] }>()

const toast = useToast()
const categoryItems = [
  { label: 'None (e.g. NA, SLA)', value: 'none' },
  ...['Business Critical', 'Important', 'Others'].map((value) => ({ label: value, value })),
]

const form = reactive({
  name: props.mtd?.name ?? '',
  code: props.mtd?.code ?? '',
  category: (props.mtd?.category ?? 'none') as NonNullable<MasterMtd['category']> | 'none',
  hours: props.mtd?.hours ?? undefined as number | undefined,
  for_it: props.mtd?.for_it ?? true,
  for_non_it: props.mtd?.for_non_it ?? true,
  description: props.mtd?.description ?? '',
  sort_order: props.mtd?.sort_order ?? props.nextSort ?? 0,
  is_active: props.mtd?.is_active ?? true,
})
const busy = ref(false)
const errors = ref<Record<string, string>>({})
/** The code a new choice gets when left empty. */
const codeFromName = computed(() => form.name.replace(/[^A-Za-z0-9]+/g, '').toLowerCase())

async function save() {
  errors.value = {}
  busy.value = true
  const body: MasterMtdInput = {
    name: form.name.trim(),
    code: form.code.trim() || null,
    category: form.category === 'none' ? null : form.category,
    hours: typeof form.hours === 'number' && Number.isFinite(form.hours) ? form.hours : null,
    for_it: form.for_it,
    for_non_it: form.for_non_it,
    description: form.description.trim() || null,
    sort_order: Number(form.sort_order) || 0,
    is_active: form.is_active,
  }
  try {
    const saved = props.mtd ? await masterMtdApi.update(props.mtd.id, body) : await masterMtdApi.create(body)
    toast.add({ title: props.mtd ? 'MTD saved' : 'MTD added', color: 'success', icon: 'i-lucide-circle-check' })
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
    :title="mtd ? `Edit ${mtd.name}` : 'New MTD'"
    description="BIAs keep the MTD they chose: a change here applies to what the forms and the Excel template offer from now on."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        id="mtd-form"
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
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Name"
            name="name"
            required
            help="As the forms and the Excel template show it, e.g. 4 hours, 2 days."
            :error="errors.name"
          >
            <UInput
              v-model="form.name"
              :maxlength="64"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Code"
            name="code"
            :help="mtd ? undefined : `Left empty: ${codeFromName || 'made from the name'}.`"
            :error="errors.code"
          >
            <UInput
              v-model="form.code"
              :maxlength="32"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField
            label="Business function category"
            name="category"
            :error="errors.category"
            class="sm:col-span-2"
          >
            <USelect
              v-model="form.category"
              :items="categoryItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Hours"
            name="hours"
            help="1 day = 24, 1 week = 168."
            :error="errors.hours"
          >
            <UInput
              v-model.number="form.hours"
              type="number"
              min="0"
              step="0.5"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Offered for"
          name="for_it"
          :error="errors.for_it"
        >
          <div class="flex flex-wrap gap-6 pt-1">
            <UCheckbox
              v-model="form.for_it"
              label="MTD IT"
              description="Part 2a: the Expected MTD of a function"
            />
            <UCheckbox
              v-model="form.for_non_it"
              label="MTD non-IT"
              description="Part 2b: an upstream / downstream MTD"
            />
          </div>
        </UFormField>
        <UFormField
          label="Description"
          name="description"
          :error="errors.description"
        >
          <UTextarea
            v-model="form.description"
            :maxlength="TEXT_LIMITS.long"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>
        <div class="grid items-end gap-4 sm:grid-cols-3">
          <UFormField
            label="Sort"
            name="sort_order"
            help="Lower comes first."
            :error="errors.sort_order"
          >
            <UInput
              v-model.number="form.sort_order"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <USwitch
            v-model="form.is_active"
            label="Active"
            description="Inactive: no longer offered; BIAs that have it keep it."
            class="sm:col-span-2"
          />
        </div>
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
          form="mtd-form"
          :label="mtd ? 'Save MTD' : 'Add MTD'"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
