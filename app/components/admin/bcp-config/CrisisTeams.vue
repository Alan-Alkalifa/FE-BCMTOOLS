<script setup lang="ts">
import type { BcpConfigVersion, BcpCrisisRole } from '~/composables/useBcpConfigAdmin'

/**
 * The minimum structure of the IMT and the RTF (chapter 2.3 and 2.4, appendix 1 and 2) and the
 * bank-wide CMT names on the escalation chart (appendix 5). Each team needs a required "lead".
 */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'crisis_teams', (saved) => emit('saved', saved), 'Crisis teams saved')
const TEAMS = [
  { key: 'imt', title: 'Incident Management Team (IMT)' },
  { key: 'rtf', title: 'Recovery Task Force (RTF)' },
] as const

function addRole(team: 'imt' | 'rtf') {
  const rows = draft.value[team]
  rows.push({ code: bcpCodeFrom('member', rows.map((row) => row.code)), label: '', min_level: null, required: false, min_count: 1 })
}
function codeFor(team: 'imt' | 'rtf', role: BcpCrisisRole, index: number) {
  if (bcpSavedCodes(props.version.payload.crisis_teams[team]).has(role.code) || role.code === 'lead') return
  role.code = bcpCodeFrom(role.label, draft.value[team].filter((_, i) => i !== index).map((row) => row.code))
}
function addMember() {
  const rows = draft.value.cmt_members
  rows.push({ code: bcpCodeFrom('member', rows.map((row) => row.code)), title: '', name: '' })
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Crisis teams"
    description="The roles every BCP fills in for its IMT and RTF, and the CMT shown on the escalation chart."
    save-label="Save crisis teams"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <section
      v-for="team in TEAMS"
      :key="team.key"
      class="space-y-3"
    >
      <h3 class="text-sm font-semibold text-highlighted">
        {{ team.title }}
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-sm">
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="px-3 py-2">
                Role
              </th>
              <th class="w-32 px-3 py-2">
                Minimum level
              </th>
              <th class="w-28 px-3 py-2 text-right">
                At least
              </th>
              <th class="w-24 px-3 py-2">
                Required
              </th>
              <th class="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(role, index) in draft[team.key]"
              :key="index"
            >
              <td class="px-3 py-2">
                <UInput
                  v-model="role.label"
                  class="w-full"
                  maxlength="255"
                  :aria-label="`${team.key.toUpperCase()} role ${index + 1}`"
                  @blur="codeFor(team.key, role, index)"
                />
                <p
                  v-if="role.code === 'lead'"
                  class="mt-1 text-xs text-muted"
                >
                  The lead (Ketua): required on every BCP.
                </p>
              </td>
              <td class="px-3 py-2">
                <UInput
                  :model-value="role.min_level ?? ''"
                  class="w-full"
                  maxlength="32"
                  placeholder="e.g. D2"
                  :aria-label="`Minimum level of ${role.label || `role ${index + 1}`}`"
                  @update:model-value="(value) => (role.min_level = String(value).trim() || null)"
                />
              </td>
              <td class="px-3 py-2">
                <UInputNumber
                  v-model="role.min_count"
                  :min="0"
                  :max="20"
                  class="w-full"
                  :aria-label="`Minimum number of ${role.label || `role ${index + 1}`}`"
                />
              </td>
              <td class="px-3 py-2">
                <USwitch
                  v-model="role.required"
                  :disabled="role.code === 'lead'"
                  :aria-label="`${role.label || `Role ${index + 1}`} is required`"
                />
              </td>
              <td class="px-3 py-2 text-right">
                <UButton
                  v-if="version.can.edit && role.code !== 'lead'"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Remove ${role.label || `role ${index + 1}`}`"
                  @click="draft[team.key].splice(index, 1)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UButton
        v-if="version.can.edit"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        :label="`Add ${team.key.toUpperCase()} role`"
        @click="addRole(team.key)"
      />
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">
        Crisis Management Team (appendix 5)
      </h3>
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField
          label="CMT secretary: position"
          required
        >
          <UInput
            v-model="draft.cmt_secretary.title"
            class="w-full"
            maxlength="255"
          />
        </UFormField>
        <UFormField label="CMT secretary: name">
          <UInput
            v-model="draft.cmt_secretary.name"
            class="w-full"
            maxlength="255"
          />
        </UFormField>
      </div>
      <div
        v-for="(member, index) in draft.cmt_members"
        :key="index"
        class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <UInput
          v-model="member.title"
          class="w-full"
          maxlength="255"
          placeholder="Position, e.g. Vice Chairman (Risk Management)"
          :aria-label="`Position of CMT member ${index + 1}`"
        />
        <UInput
          v-model="member.name"
          class="w-full"
          maxlength="255"
          :aria-label="`Name of CMT member ${index + 1}`"
        />
        <UButton
          v-if="version.can.edit"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="`Remove CMT member ${index + 1}`"
          @click="draft.cmt_members.splice(index, 1)"
        />
      </div>
      <UButton
        v-if="version.can.edit"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add CMT member"
        @click="addMember"
      />
    </section>
  </AdminBcpConfigPartForm>
</template>
