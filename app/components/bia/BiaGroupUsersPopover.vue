<script setup lang="ts">
import type { BiaGroupUser } from '~/composables/useBiaWorkflow'

const props = withDefaults(defineProps<{
  groupName: string
  users: BiaGroupUser[]
  directorateUsers?: BiaGroupUser[]
  variant?: 'link' | 'soft'
}>(), {
  directorateUsers: () => [],
  variant: 'soft',
})

const label = computed(() => {
  const gCount = props.users.length
  const dCount = props.directorateUsers.length
  if (gCount && dCount) {
    return `${gCount} ${gCount === 1 ? 'BIA user' : 'BIA users'} (+${dCount} Dir/Sub)`
  }
  if (gCount) {
    return `${gCount} ${gCount === 1 ? 'BIA user' : 'BIA users'}`
  }
  return `${dCount} Dir/Sub ${dCount === 1 ? 'user' : 'users'}`
})

const sections = computed(() => [
  { key: 'group', title: `BIA users in ${props.groupName}`, rows: props.users, showGroup: false },
  { key: 'dir', title: 'Directorate & Sub-directorate oversight', rows: props.directorateUsers, showGroup: true },
].filter((section) => section.rows.length > 0))

function subtitle(u: BiaGroupUser, showGroup: boolean) {
  const hierarchy = [u.directorate, u.sub_directorate].filter((v) => v && v !== '—').join(' › ')
  return [hierarchy, showGroup ? u.org_group : null].filter(Boolean).join(' · ')
}
</script>

<template>
  <UPopover v-if="sections.length">
    <UButton
      type="button"
      color="neutral"
      :variant="variant"
      size="xs"
      icon="i-lucide-users"
      :label="label"
      :class="variant === 'link' ? 'px-0 text-xs text-muted' : undefined"
    />
    <template #content>
      <div class="w-80 max-h-96 overflow-y-auto space-y-3 p-3 text-xs">
        <div
          v-for="(section, idx) in sections"
          :key="section.key"
          :class="idx > 0 ? 'border-t border-default pt-2.5' : undefined"
        >
          <p class="font-semibold text-highlighted">
            {{ section.title }}
          </p>
          <ul class="mt-1 divide-y divide-default">
            <li
              v-for="u in section.rows"
              :key="`${section.key}-${u.id}`"
              class="py-1.5"
            >
              <p class="font-medium text-highlighted">
                {{ u.name }}
                <span
                  v-if="u.org_level"
                  class="ms-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px] font-normal text-muted"
                >{{ u.org_level }}</span>
                <span
                  v-if="u.roles.length"
                  class="font-normal text-muted"
                > · {{ u.roles.join(', ') }}</span>
              </p>
              <p
                v-if="u.job_title || u.email"
                class="text-muted"
              >
                {{ [u.job_title, u.email].filter(Boolean).join(' · ') }}
              </p>
              <p
                v-if="subtitle(u, section.showGroup)"
                class="text-[11px] text-dimmed"
              >
                {{ subtitle(u, section.showGroup) }}
              </p>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </UPopover>
</template>
