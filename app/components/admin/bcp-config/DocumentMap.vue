<script setup lang="ts">
/**
 * BCP configuration > Versions > Document map: where each chapter and appendix of Template BCP
 * Unit Kerja ver.23 is configured, as BIA configuration's Workbook map. Each link opens the tab.
 */
const route = useRoute()

const items = BCP_DOCUMENT_MAP.map((row) => ({ ...row, value: row.part, label: row.part }))
const open = ref<string[]>([])
const allOpen = computed(() => open.value.length === items.length)
function toggleAll() {
  open.value = allOpen.value ? [] : items.map((item) => item.value)
}
const link = (tab: string) => ({ query: { version: route.query.version, tab } })
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 basis-60">
          <h2 class="font-semibold text-highlighted">
            Document map
          </h2>
          <p class="mt-1 text-sm text-muted">
            Where each part of the BCP template (Template BCP Unit Kerja ver.23) is configured in this version. Open a part, then choose a link to go to that tab.
          </p>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="allOpen ? 'i-lucide-chevrons-down-up' : 'i-lucide-chevrons-up-down'"
          :label="allOpen ? 'Collapse all' : 'Expand all'"
          @click="toggleAll"
        />
      </div>
    </template>
    <UAccordion
      v-model="open"
      type="multiple"
      :items="items"
      :ui="{ item: 'rounded-md border border-default bg-default px-4 mb-2 last:mb-0' }"
    >
      <template #default="{ item }">
        <span class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span class="font-medium text-highlighted">{{ item.part }}</span>
          <span class="text-xs text-muted">{{ item.targets.length }} setting{{ item.targets.length === 1 ? '' : 's' }}</span>
        </span>
      </template>
      <template #content="{ item }">
        <div class="space-y-3 pb-4">
          <p class="text-sm text-muted">
            {{ item.purpose }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="target in item.targets"
              :key="target.label"
              :to="link(target.tab)"
              size="xs"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-arrow-right"
              :label="target.label"
            />
          </div>
        </div>
      </template>
    </UAccordion>
  </UCard>
</template>
