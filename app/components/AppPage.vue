<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  crumbs?: { label: string, to?: string }[]
}>()

useHead({ title: () => `${props.title} · BCM Tools` })

const breadcrumbItems = computed(() =>
  props.crumbs?.length ? [{ label: 'Home', to: '/' }, ...props.crumbs] : [],
)
</script>

<template>
  <div class="min-h-dvh">
    <header class="print:hidden border-b border-default bg-default">
      <div class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <AppLogo />
        <h1 class="sr-only">
          {{ title }}
        </h1>
        <div class="ms-auto flex items-center gap-2">
          <slot name="actions" />
          <UserMenu />
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <UBreadcrumb
        v-if="breadcrumbItems.length"
        class="print:hidden"
        :items="breadcrumbItems"
      />
      <p
        v-if="description"
        class="text-sm text-muted"
      >
        {{ description }}
      </p>
      <slot />
    </main>
  </div>
</template>
