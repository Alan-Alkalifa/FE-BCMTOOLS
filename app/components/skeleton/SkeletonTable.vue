<script setup lang="ts">
const props = withDefaults(
  defineProps<{ rows?: number, columns?: number, toolbar?: boolean, label?: string }>(),
  { rows: 8, columns: 5, toolbar: false },
)

const attrs = useSkeletonRoot(() => props.label)

const widths = ['w-40', 'w-24', 'w-32', 'w-20', 'w-28', 'w-16']
</script>

<template>
  <div
    v-bind="attrs"
    class="space-y-3"
  >
    <div
      v-if="toolbar"
      class="flex items-center gap-2"
    >
      <div class="skeleton h-8 w-64" />
      <div class="skeleton h-8 w-32" />
      <div class="skeleton h-8 w-28 ms-auto" />
    </div>

    <div class="overflow-hidden rounded-lg ring ring-default">
      <div class="flex gap-6 px-3 py-2.5 bg-muted">
        <div
          v-for="col in columns"
          :key="col"
          class="skeleton h-3 flex-1 max-w-24"
        />
      </div>
      <div class="divide-y divide-default">
        <div
          v-for="row in rows"
          :key="row"
          class="flex gap-6 px-3 py-3"
        >
          <div
            v-for="col in columns"
            :key="col"
            class="flex-1"
          >
            <div
              class="skeleton h-3.5"
              :class="widths[(row + col) % widths.length]"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
