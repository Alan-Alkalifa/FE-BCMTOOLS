<script setup lang="ts">
defineProps<{
  label: string
  flush?: boolean
  items: { value: string, label: string, count?: number }[]
}>()

const selected = defineModel<string>({ required: true })
</script>

<template>
  <div class="grid min-w-0 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <UCard :ui="{ body: 'p-2 sm:p-2' }">
      <nav :aria-label="label">
        <ul class="space-y-0.5">
          <li
            v-for="item in items"
            :key="item.value"
          >
            <UButton
              type="button"
              block
              color="neutral"
              :variant="item.value === selected ? 'soft' : 'ghost'"
              class="justify-between text-left"
              :aria-current="item.value === selected ? 'page' : undefined"
              @click="selected = item.value"
            >
              <span>{{ item.label }}</span>
              <span
                v-if="item.count != null"
                class="text-xs text-muted tabular-nums"
              >{{ item.count }}</span>
            </UButton>
          </li>
        </ul>
      </nav>
    </UCard>

    <UCard
      class="min-w-0"
      :ui="flush ? { body: 'p-0 sm:p-0' } : undefined"
    >
      <template #header>
        <slot name="header" />
      </template>
      <slot />
    </UCard>
  </div>
</template>
