<script setup lang="ts">
import type { ProfileField } from '~/components/ProfileFields.vue'
import { PROFILE_PHOTO_URL, type Profile } from '~/composables/useProfile'

const { data: profile, status, error, refresh } = useProfile()
const { fetchUser } = useAuth()
const toast = useToast()
const showSkeleton = useDelayedLoading(() => status.value === 'pending')
const photoInput = useTemplateRef<HTMLInputElement>('photoInput')
const photoBusy = ref(false)
const photoVersion = ref(0)

const photoUrl = computed(() =>
  profile.value?.has_photo ? `${PROFILE_PHOTO_URL}?v=${photoVersion.value}` : undefined,
)

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
        { label: 'Mobile phone', value: p.mobile_phone },
        { label: 'Business phones', value: p.business_phones.join(', ') },
        { label: 'Preferred language', value: p.preferred_language },
      ],
    },
  ]
}

const accountFields = computed<ProfileField[]>(() => [
  { label: 'ID', value: profile.value?.username },
  { label: 'Sign-in', value: profile.value?.auth_provider === 'ldap' ? 'LDAP' : 'BCM Tools password' },
  { label: 'Last sign-in', value: formatDateTime(profile.value?.last_login_at) },
  { label: 'Password changed', value: formatDateTime(profile.value?.password_changed_at) },
])

async function uploadPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const body = new FormData()
  body.append('photo', file)
  photoBusy.value = true
  try {
    await $fetch('/api/me/photo', { method: 'PUT', body })
    photoVersion.value += 1
    await Promise.all([refresh(), fetchUser()])
    toast.add({ title: 'Photo updated', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    photoBusy.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}

async function removePhoto() {
  photoBusy.value = true
  try {
    await $fetch('/api/me/photo', { method: 'DELETE' })
    await Promise.all([refresh(), fetchUser()])
  } finally {
    photoBusy.value = false
  }
}
</script>

<template>
  <AppPage
    title="Profile"
    icon="i-lucide-user"
    :crumbs="[{ label: 'Profile' }]"
  >
    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading profile"
      class="space-y-6"
    >
      <div class="flex items-center gap-4">
        <div class="skeleton size-16 rounded-full" />
        <div class="space-y-2">
          <div class="skeleton h-6 w-48" />
          <div class="skeleton h-4 w-32" />
        </div>
      </div>
      <div class="grid gap-6 md:grid-cols-2">
        <SkeletonCard
          v-for="n in 3"
          :key="n"
          fields
          :lines="4"
        />
      </div>
    </SkeletonGroup>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load your profile"
      :description="error.message"
    />

    <template v-else-if="profile">
      <UCard>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UAvatar
            :src="photoUrl"
            :alt="profile.display_name ?? undefined"
            size="3xl"
          />
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-semibold text-highlighted">
              {{ profile.display_name }}
            </h2>
            <p class="text-sm text-muted">
              {{ [profile.job_title, profile.department].filter(Boolean).join(' · ') || profile.email }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <UBadge
                v-for="role in profile.roles"
                :key="role.code"
                :label="role.name"
                color="neutral"
                variant="subtle"
                icon="i-lucide-shield"
              />
              <span
                v-if="!profile.roles.length"
                class="text-sm text-muted"
              >No role assigned yet</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <input
              ref="photoInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="sr-only"
              aria-label="Choose a profile photo"
              @change="uploadPhoto"
            >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-image-up"
              :label="profile.has_photo ? 'Change photo' : 'Add photo'"
              :loading="photoBusy"
              @click="photoInput?.click()"
            />
            <UButton
              v-if="profile.has_photo"
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              label="Remove"
              :disabled="photoBusy"
              @click="removePhoto"
            />
          </div>
        </div>
      </UCard>

      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="section in sections(profile)"
          :key="section.title"
        >
          <template #header>
            <h3 class="flex items-center gap-2 font-semibold text-highlighted">
              <UIcon
                :name="section.icon"
                class="text-muted"
              /> {{ section.title }}
            </h3>
          </template>
          <ProfileFields :fields="section.fields" />
        </UCard>

        <UCard>
          <template #header>
            <h3 class="flex items-center gap-2 font-semibold text-highlighted">
              <UIcon
                name="i-lucide-shield-check"
                class="text-muted"
              /> Account
            </h3>
          </template>
          <ProfileFields :fields="accountFields" />
          <template #footer>
            <UButton
              to="/account/password"
              color="neutral"
              variant="outline"
              icon="i-lucide-key-round"
              label="Change password"
              size="sm"
            />
          </template>
        </UCard>
      </div>

      <p class="text-xs text-muted">
        Work and contact details are kept by your BCM Tools administrator. Ask them if something is out of date.
      </p>
    </template>
  </AppPage>
</template>
