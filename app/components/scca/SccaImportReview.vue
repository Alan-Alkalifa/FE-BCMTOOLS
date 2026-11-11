<script setup lang="ts">
import type { SccaImportPreview } from '~/composables/useSccaImport'

/** What an uploaded workbook holds and what is wrong with it, before anything is saved. */
const props = defineProps<{ preview: SccaImportPreview }>()

const links = computed(() => ({
  ready: props.preview.interdependencies.filter((row) => row.status === 'ready').length,
  left: props.preview.interdependencies.filter((row) => row.status !== 'ready').length,
}))
const recovery = computed(() => props.preview.recovery.filter((row) => row.filled > 0).length)
</script>

<template>
  <div class="space-y-4">
    <dl class="grid gap-3 sm:grid-cols-4">
      <div class="rounded-md border border-default p-3">
        <dt class="text-xs text-muted">
          Ratings
        </dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums">
          {{ preview.ratings.read }} of {{ preview.ratings.total }}
        </dd>
      </div>
      <div class="rounded-md border border-default p-3">
        <dt class="text-xs text-muted">
          Category
        </dt>
        <dd class="mt-1">
          <StatusBadge
            v-if="preview.result"
            :scale="sccaCategory"
            :value="preview.result.final_category"
          />
          <span
            v-else
            class="text-sm text-muted"
          >Once all are rated</span>
        </dd>
      </div>
      <div class="rounded-md border border-default p-3">
        <dt class="text-xs text-muted">
          Interdependencies
        </dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums">
          {{ links.ready }}<span
            v-if="links.left"
            class="ms-1 text-sm font-normal text-warning"
          >{{ links.left }} left out</span>
        </dd>
      </div>
      <div class="rounded-md border border-default p-3">
        <dt class="text-xs text-muted">
          Recovery blocks filled
        </dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums">
          {{ recovery }} of {{ preview.recovery.length }}
        </dd>
      </div>
    </dl>

    <UAlert
      v-if="preview.errors"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-x"
      :title="`${preview.errors} thing${preview.errors === 1 ? '' : 's'} to fix in the workbook`"
      description="Correct the cells listed below in Excel, save, and choose the file again. Nothing has been saved."
    />
    <UAlert
      v-else
      color="success"
      variant="subtle"
      icon="i-lucide-circle-check"
      title="The workbook can be imported"
      :description="preview.warnings ? `${preview.warnings} thing${preview.warnings === 1 ? '' : 's'} to check, listed below. You can finish them in the form.` : 'Everything was read.'"
    />

    <div
      v-if="preview.problems.length"
      class="max-h-72 overflow-y-auto rounded-md border border-default"
    >
      <table class="w-full text-sm">
        <caption class="sr-only">
          What was found in the workbook
        </caption>
        <thead class="sticky top-0 bg-muted text-left text-xs uppercase text-muted">
          <tr>
            <th class="w-24 px-3 py-2">
              Kind
            </th>
            <th class="w-52 px-3 py-2">
              Where
            </th>
            <th class="px-3 py-2">
              What
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(problem, index) in preview.problems"
            :key="index"
          >
            <td class="px-3 py-2 align-top">
              <UBadge
                :label="SCCA_IMPORT_LEVELS[problem.level].label"
                :color="SCCA_IMPORT_LEVELS[problem.level].color"
                :icon="SCCA_IMPORT_LEVELS[problem.level].icon"
                variant="subtle"
                size="sm"
              />
            </td>
            <td class="px-3 py-2 align-top font-mono text-xs">
              {{ problem.sheet }}<template v-if="problem.cell">
                · {{ problem.cell }}
              </template>
            </td>
            <td class="px-3 py-2 align-top">
              {{ problem.message }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
