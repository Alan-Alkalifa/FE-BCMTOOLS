<script setup lang="ts">
import type { RaImportPreview } from '~/composables/useRa'

/** What a workbook holds (counts, residual risk) and what to check after import. Read from the
 *  preview, before anything is saved. */
const props = defineProps<{ preview: RaImportPreview }>()

const employees = computed(() => props.preview.occupants.reduce((sum, unit) => sum + (unit.employee_count ?? 0), 0))
const values = computed(() => {
  const found = props.preview
  const count = (n: number, one: string, many: string) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`
  const items = [{ key: 'contacts', icon: 'i-lucide-phone', text: count(found.contacts.length, 'emergency contact', 'emergency contacts') }]
  if (found.kind === 'head_office') {
    items.push(
      { key: 'employees', icon: 'i-lucide-users', text: count(employees.value, 'employee', 'employees') },
      { key: 'recovery_team', icon: 'i-lucide-life-buoy', text: count(found.recovery_team.length, 'recovery team member', 'recovery team members') },
      { key: 'call_tree', icon: 'i-lucide-network', text: count(found.call_tree.length, 'call tree contact', 'call tree contacts') },
    )
  }
  items.push({ key: 'hazards', icon: 'i-lucide-list-checks', text: `${found.ratings.rated} of ${found.ratings.total} hazards rated` })
  return items
})
const levels: RaLevel[] = ['High', 'Medium', 'Low']
const showAll = ref(false)
const notes = computed(() => (showAll.value ? props.preview.warnings : props.preview.warnings.slice(0, 4)))
const ra = computed(() => RA_MODULES[props.preview.kind])
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-3">
      <h4 class="text-sm font-semibold">
        Values
      </h4>
      <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="item in values"
          :key="item.key"
          class="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm"
        >
          <UIcon
            :name="item.icon"
            class="size-4 shrink-0 text-muted"
          />
          <span>{{ item.text }}</span>
        </li>
      </ul>
      <div
        v-if="levels.some((level) => preview.ratings.counts.residual[level])"
        class="flex flex-wrap items-center gap-2 text-sm"
      >
        <span class="text-muted">Residual risk:</span>
        <template
          v-for="level in levels"
          :key="level"
        >
          <span
            v-if="preview.ratings.counts.residual[level]"
            class="inline-flex items-center gap-1"
          >
            <StatusBadge
              :scale="raRiskLevel"
              :value="level"
              size="sm"
            />
            <span class="tabular-nums">{{ preview.ratings.counts.residual[level] }}</span>
          </span>
        </template>
      </div>
    </section>

    <section
      v-if="preview.warnings.length"
      class="space-y-2"
    >
      <div class="flex items-center gap-2">
        <h4 class="text-sm font-semibold">
          Check after import
        </h4>
        <UBadge
          color="warning"
          variant="subtle"
          :label="String(preview.warnings.length)"
        />
      </div>
      <p class="text-sm text-muted">
        These are imported as shown. You can fix them later on the {{ ra.location.lower }} page.
      </p>
      <ul
        class="space-y-2 text-sm"
        aria-label="Check after import"
      >
        <li
          v-for="(note, index) in notes"
          :key="index"
          class="flex gap-2"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="mt-0.5 size-4 shrink-0 text-warning"
          />
          <div class="min-w-0">
            <p class="text-xs text-muted">
              {{ note.sheet }}{{ note.cell ? ` · ${note.cell}` : '' }}
            </p>
            <p>{{ note.message }}</p>
          </div>
        </li>
      </ul>
      <UButton
        v-if="preview.warnings.length > 4"
        color="neutral"
        variant="link"
        size="sm"
        :label="showAll ? 'Show fewer' : `Show all ${preview.warnings.length}`"
        @click="showAll = !showAll"
      />
    </section>
  </div>
</template>
