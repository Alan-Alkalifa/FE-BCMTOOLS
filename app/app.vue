<script setup lang="ts">
import AppTabHost from '~/components/AppTabHost'

// In-app tabs (docs/tabs.md) for signed-in users: the pages of the open tabs stay alive.
const { enabled: tabsOn } = useTabs()
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator
      color="var(--ui-primary)"
      :height="2"
      :throttle="300"
    />
    <NuxtLayout>
      <NuxtPage
        v-if="tabsOn"
        page-key="tabs"
      >
        <template #default="{ Component, route }">
          <AppTabHost
            :component="Component"
            :route="route"
          />
        </template>
      </NuxtPage>
      <NuxtPage v-else />
    </NuxtLayout>
  </UApp>
</template>
