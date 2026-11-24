<script setup lang="ts">
import type { BiancaFunction } from '~/composables/useBianca'
import { BIANCA_PARTS, type BiancaPart } from '~/utils/biancaParts'

/**
 * The report of a BIA's business functions, read only: each part of the workbook for the picked
 * function (?fn=, 1-based). Print picks the parts and the functions to print; a BIA sent for
 * approval also downloads as a PDF or an Excel file. The Appendix opens it.
 */
definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))
const { data, status, error, refresh } = useBiancaAssessment(id)
// A tab kept open shows the BIA as saved now, not as it was when the tab first opened.
onActivated(() => {
  if (data.value) refresh()
})
const { data: lookups } = useBiancaLookups(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const exporter = useBiancaExport()
const pdf = useBiancaPdf()

useHead({ title: computed(() => `Report ${data.value?.ref_no ?? 'BIA'} · BCM Tools`) })

const functions = computed(() => data.value?.functions ?? [])
/** The function shown (1-based, as in the address). */
const number = computed({
  get: () => {
    const value = Number(route.query.fn) || 1
    return Math.min(Math.max(value, 1), Math.max(functions.value.length, 1))
  },
  set: (value: number) => {
    router.replace({ query: { ...route.query, fn: String(value) } })
  },
})
const fn = computed<BiancaFunction | undefined>(() => functions.value[number.value - 1])
const functionItems = computed(() => functions.value.map((item, index) => ({ label: `${index + 1}. ${item.name}`, value: index + 1 })))
const periods = computed(() => lookups.value?.periods ?? [])

const shown = (value: unknown) => (value == null || value === '' ? '—' : String(value))

const editable = computed(() => !!data.value?.can_edit)
/** A draft is only printed (from the page); the PDF and the Excel export are for a BIA sent on. */
const isDraft = computed(() => data.value?.status === 'draft')

// --- Print: the parts and the functions picked, as the page shows them --------------------------
const partItems = BIANCA_PARTS.map((item) => ({ label: item.label, value: item.value }))
const printOpen = ref(false)
const printParts = ref<BiancaPart[]>(BIANCA_PARTS.map((item) => item.value))
const printFunctions = ref<string[]>([])
const printItems = computed(() => functions.value.map((item, index) => ({ label: `${index + 1}. ${item.name}`, value: String(index + 1) })))
/** What is being printed: set when Print is pressed, so the page shows only that while it prints. */
const printing = ref<{ parts: BiancaPart[], functions: number[] } | null>(null)
function openPrint() {
  printFunctions.value = printItems.value.map((item) => item.value)
  printOpen.value = true
}
async function print() {
  printing.value = { parts: [...printParts.value], functions: printFunctions.value.map(Number).sort((a, b) => a - b) }
  printOpen.value = false
  await nextTick()
  window.print()
}
onMounted(() => window.addEventListener('afterprint', () => (printing.value = null)))
</script>

<template>
  <AppPage
    :title="data?.ref_no ? `Report · BIA ${data.ref_no}` : 'Report'"
    icon="i-lucide-file-text"
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Manage', to: '/bianca/manage' },
      { label: data?.ref_no ?? 'BIA', to: data ? biancaPath(data.id) : undefined },
      { label: 'Report' },
    ]"
  >
    <SkeletonTable
      v-if="showSkeleton"
      :columns="3"
      label="Loading the report"
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not open this BIA"
      :description="error.statusCode === 404 ? 'It does not exist, or you cannot open it.' : error.message"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>

    <div
      v-else-if="data"
      class="space-y-6"
    >
      <!-- The BIA, and what to do with the report -->
      <UCard>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <dl class="grid flex-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt class="text-xs text-muted">
                BIA
              </dt>
              <dd class="font-medium">
                {{ data.ref_no ?? `#${data.id}` }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Directorate
              </dt>
              <dd>{{ shown(data.directorate) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Sub directorate
              </dt>
              <dd>{{ shown(data.sub_directorate) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Group
              </dt>
              <dd>{{ shown(data.org_group) }}</dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-2 print:hidden">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              :label="editable ? 'Back to the form' : 'Back to the BIA'"
              :to="`${biancaPath(data.id)}?tab=appendix`"
            />
            <UButton
              v-if="functions.length"
              icon="i-lucide-printer"
              label="Print"
              @click="openPrint"
            />
            <template v-if="!isDraft">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-file-down"
                label="Download PDF"
                :loading="pdf.busy.value"
                @click="pdf.run(data.id)"
              />
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-file-spreadsheet"
                label="Export all to Excel"
                :loading="exporter.busy.value"
                @click="exporter.run(data.id)"
              />
            </template>
          </div>
        </div>
      </UCard>

      <UAlert
        v-if="!functions.length"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="This BIA has no business functions yet."
      />

      <template v-else-if="fn && !printing">
        <!-- The function shown -->
        <div class="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <UFormField
            label="Business function"
            class="w-full max-w-md"
          >
            <USelect
              v-model="number"
              :items="functionItems"
              class="w-full"
            />
          </UFormField>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="editable"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              label="Edit in the form"
              :to="`${biancaPath(data.id)}?tab=functions`"
            />
            <UButton
              v-if="!isDraft"
              color="neutral"
              variant="outline"
              icon="i-lucide-file-spreadsheet"
              label="Export this function to Excel"
              :loading="exporter.busy.value"
              @click="exporter.run(data.id, [number])"
            />
          </div>
        </div>

        <BiancaFunctionReport
          :fn="fn"
          :number="number"
          :periods="periods"
        />
      </template>
      <!-- Printing: the functions and the parts picked, one function to a page -->
      <template v-else-if="printing">
        <BiancaFunctionReport
          v-for="(picked, index) in printing.functions"
          :key="picked"
          :fn="functions[picked - 1]!"
          :number="picked"
          :periods="periods"
          :parts="printing.parts"
          :class="index ? 'break-before-page' : ''"
        />
      </template>
    </div>

    <UModal
      v-model:open="printOpen"
      title="Print the report"
      description="Pick the parts and the business functions to print."
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="grid gap-6 sm:grid-cols-2">
          <UFormField label="Parts">
            <UCheckboxGroup
              v-model="printParts"
              :items="partItems"
            />
            <div class="mt-2 flex gap-3">
              <UButton
                variant="link"
                size="xs"
                class="px-0"
                label="All"
                @click="printParts = BIANCA_PARTS.map((item) => item.value)"
              />
              <UButton
                variant="link"
                size="xs"
                class="px-0"
                label="None"
                @click="printParts = []"
              />
            </div>
          </UFormField>
          <UFormField label="Business functions">
            <UCheckboxGroup
              v-model="printFunctions"
              :items="printItems"
            />
            <div class="mt-2 flex gap-3">
              <UButton
                variant="link"
                size="xs"
                class="px-0"
                label="All"
                @click="printFunctions = printItems.map((item) => item.value)"
              />
              <UButton
                variant="link"
                size="xs"
                class="px-0"
                label="None"
                @click="printFunctions = []"
              />
            </div>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="printOpen = false"
        />
        <UButton
          icon="i-lucide-printer"
          label="Print"
          :disabled="!printParts.length || !printFunctions.length"
          @click="print"
        />
      </template>
    </UModal>
  </AppPage>
</template>
