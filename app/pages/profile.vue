<script setup lang="ts">
import type { ProfileField } from '~/components/ProfileFields.vue'
import { PROFILE_PHOTO_URL, type Profile } from '~/composables/useProfile'

useHead({ title: 'Profile · BCM Tools' })

const { data: profile, status, error } = useProfile()

const SHOWN_GRAPH_FIELDS = new Set([
  'id', 'displayName', 'givenName', 'surname', 'mail', 'userPrincipalName', 'jobTitle', 'department',
  'companyName', 'officeLocation', 'employeeId', 'mobilePhone', 'businessPhones', 'preferredLanguage',
])

function sections(p: Profile): { title: string, icon: string, fields: ProfileField[] }[] {
  return [
    {
      title: 'Work',
      icon: 'i-lucide-briefcase',
      fields: [
        { label: 'Job title', value: p.job_title },
        { label: 'Department', value: p.department },
        { label: 'Company', value: p.company_name },
        { label: 'Office', value: p.office_location },
        { label: 'Employee ID', value: p.employee_id },
      ],
    },
    {
      title: 'Contact',
      icon: 'i-lucide-mail',
      fields: [
        { label: 'Email', value: p.email },
        { label: 'User principal name', value: p.user_principal_name },
        { label: 'Mobile phone', value: p.mobile_phone },
        { label: 'Business phones', value: p.business_phones.join(', ') },
        { label: 'Preferred language', value: p.preferred_language },
      ],
    },
  ]
}

const otherFields = computed<ProfileField[]>(() =>
  Object.entries(profile.value?.graph_profile ?? {})
    .filter(([key]) => !SHOWN_GRAPH_FIELDS.has(key))
    .map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value: formatValue(value),
    })),
)

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ') || null
  return String(value)
}

const accessFields = computed<ProfileField[]>(() => [
  {
    label: 'Last sign-in',
    value: profile.value?.last_login_at
      ? new Date(profile.value.last_login_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null,
  },
])
</script>

<template>
  <UContainer class="py-10 space-y-6">
    <div
      v-if="status === 'pending'"
      class="space-y-4"
    >
      <USkeleton class="h-16 w-72" />
      <USkeleton class="h-48 w-full" />
    </div>

    <UAlert
      v-else-if="error?.statusCode === 404"
      color="warning"
      variant="subtle"
      icon="i-lucide-user-x"
      title="No profile saved yet"
      description="Your Microsoft profile is saved when you sign in. Sign out and sign in again to load it."
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load your profile"
      :description="error.message"
    />

    <template v-else-if="profile">
      <div class="flex items-center gap-4">
        <UAvatar
          :src="profile.has_photo ? PROFILE_PHOTO_URL : undefined"
          :alt="profile.display_name ?? undefined"
          size="3xl"
        />
        <div>
          <h1 class="text-2xl font-semibold">
            {{ profile.display_name }}
          </h1>
          <p class="text-muted">
            {{ [profile.job_title, profile.department].filter(Boolean).join(' · ') || profile.email }}
          </p>
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <UCard
          v-for="section in sections(profile)"
          :key="section.title"
        >
          <template #header>
            <h2 class="flex items-center gap-2 font-semibold">
              <UIcon :name="section.icon" /> {{ section.title }}
            </h2>
          </template>
          <ProfileFields :fields="section.fields" />
        </UCard>

        <UCard>
          <template #header>
            <h2 class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-shield-check" /> Access
            </h2>
          </template>
          <div class="flex flex-wrap gap-1 mb-3">
            <UBadge
              v-for="role in profile.roles"
              :key="role"
              :label="role"
              variant="subtle"
            />
            <span
              v-if="!profile.roles.length"
              class="text-sm text-muted"
            >No app roles assigned</span>
          </div>
          <ProfileFields :fields="accessFields" />
        </UCard>

        <UCard v-if="otherFields.length">
          <template #header>
            <h2 class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-map-pin" /> Other Microsoft profile fields
            </h2>
          </template>
          <ProfileFields :fields="otherFields" />
        </UCard>
      </div>

      <p class="text-xs text-muted">
        From your Microsoft Entra ID profile, refreshed each time you sign in. Empty fields haven't been filled in by your organisation.
      </p>
    </template>
  </UContainer>
</template>
