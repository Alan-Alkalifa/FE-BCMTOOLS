<template>
  <UApp>
    <NuxtLoadingIndicator
      color="var(--ui-primary)"
      :height="2"
      :throttle="300"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
