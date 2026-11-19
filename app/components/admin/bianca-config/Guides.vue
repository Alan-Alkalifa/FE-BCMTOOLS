<script setup lang="ts">
const model = defineModel<Record<string, string>>({ required: true })
const props = defineProps<{ disabled: boolean, referenceGuides: Record<string, string> }>()
const route = useRoute()
const router = useRouter()
const details: Record<string, [string, string]> = {
  attestation: ['Attestation statement', 'Management confirmation on the Sign Off Page.'],
  suggested_mtd: ['Suggested MTD', 'How to select the first impact period that meets a trigger.'],
  regulatory: ['Regulatory impact', 'Scoring guidance for laws, regulations and guidelines.'],
  customer: ['Customer impact', 'Scoring guidance for the affected customer base.'],
  expected_mtd: ['Expected MTD', 'Business recovery time and its relationship to Suggested MTD.'],
  it_dependency: ['IT dependencies', 'RTO, RPO, backlog, DAAT and critical gaps.'],
  non_it_dependency: ['Non-IT dependencies', 'Upstream and downstream capacity, MTD, NA and SLA.'],
  recovery: ['Recovery', 'Staff, resources, recovery capacity and vital records.'],
  alternate_site: ['Alternate site strategy', 'Site recommendations by business function category.'],
  risk_assessment: ['Personnel and risk assessment', 'Organization structure and location risk assessment.'],
  critical_timings: ['Critical timings', 'Frequency, deadlines and critical activities.'],
}
const keys = computed(() => [...new Set([...Object.keys(model.value), ...Object.keys(props.referenceGuides)])])
const items = computed(() => keys.value.map((key) => ({ value: key, label: details[key]?.[0] ?? key.replaceAll('_', ' ') })))
const selected = computed({
  get: () => keys.value.includes(String(route.query.guide)) ? String(route.query.guide) : (keys.value.includes('attestation') ? 'attestation' : keys.value[0]!),
  set: (value: string) => router.replace({ query: { ...route.query, guide: value } }),
})
const title = computed(() => details[selected.value]?.[0] ?? selected.value.replaceAll('_', ' '))
const paragraphs = computed(() => (model.value[selected.value] ?? '').split(/\n\s*\n/).filter(Boolean))
</script>

<template>
  <AdminBiancaConfigSectionLayout
    v-model="selected"
    label="Guides and statements"
    :items="items"
  >
    <template #header>
      <div class="flex items-start gap-3">
        <div class="rounded-lg bg-primary/10 p-2 text-primary">
          <UIcon
            :name="selected === 'attestation' ? 'i-lucide-signature' : 'i-lucide-book-open'"
            class="size-5"
          />
        </div>
        <div>
          <h2 class="font-semibold text-highlighted">
            {{ title }}
          </h2><p class="mt-1 text-sm text-muted">
            {{ details[selected]?.[1] }}
          </p>
        </div>
      </div>
    </template>
    <div class="space-y-6">
      <section
        aria-label="Reading preview"
        class="rounded-lg border border-default bg-elevated/40 p-5 sm:p-6"
      >
        <p class="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
          Reading preview
        </p>
        <div
          v-if="paragraphs.length"
          class="max-w-prose space-y-4 text-sm leading-7 text-toned"
        >
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="whitespace-pre-line wrap-anywhere"
          >
            {{ paragraph }}
          </p>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          No saved guidance for this topic.
        </p>
      </section>
      <UFormField
        :label="title"
        help="Use a blank line between paragraphs. Preview updates as you type."
      >
        <UTextarea
          v-model="model[selected]"
          :rows="selected === 'attestation' ? 10 : 6"
          autoresize
          :maxrows="24"
          :maxlength="20000"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>
      <details
        v-if="referenceGuides[selected]"
        class="rounded-lg border border-default p-4"
      >
        <summary class="cursor-pointer text-sm font-medium">
          Workbook reference
        </summary>
        <p class="mt-4 max-w-prose whitespace-pre-line text-sm leading-7 wrap-anywhere">
          {{ referenceGuides[selected] }}
        </p>
        <UButton
          v-if="!disabled"
          type="button"
          class="mt-4"
          color="neutral"
          variant="outline"
          label="Use workbook text"
          @click="model[selected] = referenceGuides[selected]!"
        />
      </details>
    </div>
  </AdminBiancaConfigSectionLayout>
</template>
