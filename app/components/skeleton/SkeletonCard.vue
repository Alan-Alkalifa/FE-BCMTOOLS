<script setup lang="ts">
const props = withDefaults(
  defineProps<{ lines?: number, header?: boolean, fields?: boolean, label?: string }>(),
  { lines: 4, header: true, fields: false },
)

const attrs = useSkeletonRoot(() => props.label)
</script>

<template>
  <UCard v-bind="attrs">
    <template
      v-if="header"
      #header
    >
      <div class="skeleton h-4 w-32" />
    </template>

    <div
      v-if="fields"
      class="grid grid-cols-[8rem_1fr] gap-x-6 gap-y-3"
    >
      <template
        v-for="line in lines"
        :key="line"
      >
        <div class="skeleton h-3.5 w-20" />
        <div
          class="skeleton h-3.5"
          :class="line % 2 ? 'w-40' : 'w-28'"
        />
      </template>
    </div>
    <div
      v-else
      class="space-y-2.5"
    >
      <div
        v-for="line in lines"
        :key="line"
        class="skeleton h-3.5"
        :class="line === lines && lines > 1 ? 'w-3/5' : 'w-full'"
      />
    </div>
  </UCard>
</template>
