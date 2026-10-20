<script setup lang="ts">
// No layout of its own: a required change shows on the sign-in shell, a voluntary one in the app.
definePageMeta({ layout: false })

useHead({ title: 'Change password · BCM Tools' })

const { user } = useAuth()
const required = ref(!!user.value?.must_change_password)

async function onChanged() {
  if (required.value) await navigateTo('/', { replace: true })
}
</script>

<template>
  <AuthShell
    v-if="required"
    title="Set a new password"
    description="An administrator gave you a temporary password. Choose your own to continue."
  >
    <ChangePasswordForm
      required
      @changed="onChanged"
    />
  </AuthShell>
  <NuxtLayout
    v-else
    name="default"
  >
    <AppPage
      title="Change password"
      :crumbs="[{ label: 'Change password' }]"
    >
      <UCard class="max-w-xl">
        <ChangePasswordForm @changed="onChanged" />
      </UCard>
    </AppPage>
  </NuxtLayout>
</template>
