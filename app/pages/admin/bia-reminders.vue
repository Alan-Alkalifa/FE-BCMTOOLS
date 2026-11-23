<script setup lang="ts">
definePageMeta({ permission: 'bianca.approval.manage' })
</script>

<template>
  <AppPage
    title="BIA reminders and escalation"
    icon="i-lucide-bell-ring"
    description="Live reminder, escalation and annual renewal notice rules for Business Impact Analysis (BIANCA)."
    :crumbs="[
      { label: 'Administration' },
      { label: 'BIA configuration', to: '/admin/bianca-config' },
      { label: 'Reminders and escalation' },
    ]"
  >
    <template #actions>
      <UButton
        to="/admin/bianca-config?tab=reminders"
        color="neutral"
        variant="outline"
        icon="i-lucide-arrow-left"
        label="Back to BIA configuration"
      />
    </template>

    <AdminBiancaConfigReminders />
  </AppPage>
</template>
