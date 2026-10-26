<script setup lang="ts">
import type { RaConfigVersion } from '~/composables/useRaConfigAdmin'

/**
 * The Lampiran rating guides (what each rating 1-5 means on each scale), shown next to every
 * rating on the hazard page, and the mitigation strategy examples.
 */
const props = defineProps<{ version: RaConfigVersion }>()
const emit = defineEmits<{ saved: [version: RaConfigVersion] }>()

const SCALES: { key: RaGuideScale, label: string }[] = [
  { key: 'historical', label: 'Historical of occurrence (Tabel 1)' },
  { key: 'probability', label: 'Probability of occurrence (Tabel 2)' },
  ...RA_IMPACTS.map((impact) => ({ key: impact.key as RaGuideScale, label: `${impact.label} impact (Tabel 3)` })),
]
const scale = ref<RaGuideScale>('historical')
const scaleItems = SCALES.map((item) => ({ label: item.label, value: item.key }))

const guides = useRaConfigPart(
  computed(() => props.version),
  (value) => Object.fromEntries(SCALES.map(({ key }) => [key,
    [...(value.guides[key] ?? [])].sort((a, b) => a.rating - b.rating).map((guide) => ({ ...guide, label: guide.label ?? '' })),
  ])) as Record<RaGuideScale, { rating: number, label: string, guidance: string }[]>,
  (code, value) => raConfigApi.setGuides(code, Object.fromEntries(Object.entries(value).map(([key, rows]) => [key,
    rows.map((row) => ({ ...row, label: row.label.trim() || null }))])) as RaConfigVersion['guides']),
  (saved) => emit('saved', saved),
  'Rating guides saved',
)

const examples = useRaConfigPart(
  computed(() => props.version),
  (value) => value.mitigation_examples.map((row) => ({ ...row })),
  (code, value) => raConfigApi.setMitigationExamples(code, value),
  (saved) => emit('saved', saved),
  'Mitigation examples saved',
)
const editable = computed(() => props.version.can.edit)
const guideDraft = guides.draft
const exampleDraft = examples.draft
</script>

<template>
  <div class="grid items-start gap-6 xl:grid-cols-2">
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              Rating guides
            </h2>
            <p class="mt-1 text-sm text-muted">
              What each rating means, shown under every rating on the hazard page.
            </p>
          </div>
          <div
            v-if="editable"
            class="flex gap-2"
          >
            <UButton
              v-if="guides.dirty.value"
              color="neutral"
              variant="outline"
              label="Undo changes"
              @click="guides.reset"
            />
            <UButton
              icon="i-lucide-save"
              label="Save guides"
              :disabled="!guides.dirty.value"
              :loading="guides.busy.value"
              @click="guides.submit"
            />
          </div>
        </div>
      </template>
      <div class="space-y-4">
        <UAlert
          v-if="guides.error.value"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't save the guides"
          :ui="{ description: 'whitespace-pre-line' }"
          :description="guides.error.value"
        />
        <USelect
          v-model="scale"
          :items="scaleItems"
          aria-label="Scale"
          class="w-full sm:w-80"
        />
        <fieldset
          :disabled="!editable"
          class="space-y-3"
        >
          <div
            v-for="row in guideDraft[scale]"
            :key="row.rating"
            class="grid items-start gap-2 sm:grid-cols-[2rem_8rem_minmax(0,1fr)]"
          >
            <span class="pt-2 text-right font-medium tabular-nums">{{ row.rating }}</span>
            <UInput
              v-model="row.label"
              placeholder="Label"
              :aria-label="`Label of rating ${row.rating}`"
              class="w-full"
            />
            <UTextarea
              v-model="row.guidance"
              lang="id"
              :rows="2"
              autoresize
              :aria-label="`Guidance of rating ${row.rating}`"
              class="w-full"
            />
          </div>
        </fieldset>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              Mitigation strategy examples
            </h2>
            <p class="mt-1 text-sm text-muted">
              Shown in the rating guide of the hazard page.
            </p>
          </div>
          <div
            v-if="editable"
            class="flex gap-2"
          >
            <UButton
              v-if="examples.dirty.value"
              color="neutral"
              variant="outline"
              label="Undo changes"
              @click="examples.reset"
            />
            <UButton
              icon="i-lucide-save"
              label="Save examples"
              :disabled="!examples.dirty.value"
              :loading="examples.busy.value"
              @click="examples.submit"
            />
          </div>
        </div>
      </template>
      <div class="space-y-4">
        <UAlert
          v-if="examples.error.value"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't save the examples"
          :ui="{ description: 'whitespace-pre-line' }"
          :description="examples.error.value"
        />
        <fieldset
          :disabled="!editable"
          class="space-y-3"
        >
          <div
            v-for="(row, index) in exampleDraft"
            :key="index"
            class="grid items-start gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
          >
            <UInput
              v-model="row.area"
              placeholder="Area"
              :aria-label="`Area ${index + 1}`"
              class="w-full"
            />
            <UTextarea
              v-model="row.example"
              lang="id"
              :rows="2"
              autoresize
              :aria-label="`Example ${index + 1}`"
              class="w-full"
            />
            <UButton
              v-if="editable"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              :aria-label="`Remove example ${index + 1}`"
              @click="exampleDraft.splice(index, 1)"
            />
          </div>
        </fieldset>
        <UButton
          v-if="editable"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          label="Add example"
          @click="exampleDraft.push({ area: '', example: '' })"
        />
      </div>
    </UCard>
  </div>
</template>
