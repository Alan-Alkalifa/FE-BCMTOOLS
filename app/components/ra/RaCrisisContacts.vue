<script setup lang="ts">
import type { RaCrisisPlace } from '~/composables/useRa'

/**
 * Who to call for one affected place, as tables: its emergency contacts, call tree and recovery
 * team. Used on the disaster page (phones dial, with the team charts and a link to add missing
 * contacts) and in its print view (`print`: plain text, nothing to click).
 */
const props = defineProps<{ place: RaCrisisPlace, print?: boolean }>()
const { can } = useAuth()

const contacts = computed(() => RA_CONTACT_KINDS.flatMap((kind) => props.place.contacts
  .filter((contact) => contact.kind === kind.value)
  .map((contact) => ({
    ...contact,
    type: kind.single,
    details: contact.kind === 'floor_warden'
      ? [contact.group_name, contact.floor && `Floor ${contact.floor}`].filter(Boolean).join(', ')
      : contact.address ?? '',
  }))))

const callTree = computed(() => [...props.place.call_tree].sort((a, b) => a.level - b.level))

function teamLabel(team: string) {
  return RA_RECOVERY_TEAMS.find((item) => item.value === team)?.label ?? team
}

function telUrl(phone: string | null | undefined) {
  if (props.print) return undefined
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits.replace('+', '').length >= 3 ? `tel:${digits}` : undefined
}

const tableClass = 'w-full text-left text-sm print:text-xs'
const headClass = 'bg-muted text-xs font-semibold text-muted print:bg-transparent'
const cellClass = 'px-3 py-2 align-top print:px-2 print:py-1'
</script>

<template>
  <div class="space-y-5">
    <section>
      <h3 class="font-medium text-highlighted">
        Emergency contacts
      </h3>
      <div
        v-if="contacts.length"
        class="mt-2 overflow-x-auto rounded-md border border-default print:overflow-visible"
      >
        <table :class="tableClass">
          <thead :class="headClass">
            <tr>
              <th :class="cellClass">
                Type
              </th>
              <th :class="cellClass">
                Name
              </th>
              <th :class="cellClass">
                Phone
              </th>
              <th :class="cellClass">
                Area or address
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(contact, index) in contacts"
              :key="`${contact.kind}-${contact.seq ?? index}`"
              class="break-inside-avoid"
            >
              <td :class="[cellClass, 'whitespace-nowrap text-muted']">
                {{ contact.type }}
              </td>
              <td :class="cellClass">
                {{ contact.name }}
              </td>
              <td :class="[cellClass, 'whitespace-nowrap tabular-nums']">
                <a
                  v-if="telUrl(contact.phone)"
                  :href="telUrl(contact.phone)"
                  class="text-primary hover:underline"
                >{{ contact.phone }}</a>
                <template v-else>
                  {{ contact.phone || '—' }}
                </template>
              </td>
              <td
                :class="[cellClass, 'text-muted']"
                lang="id"
              >
                {{ contact.details || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-else
        class="mt-2 text-sm text-muted"
      >
        None recorded.<template v-if="!print && can('sites.master')">
          <NuxtLink
            :to="masterBuildingPath(place.location.id, 'contacts')"
            class="text-primary hover:underline"
          >Add them</NuxtLink>.
        </template>
      </p>
    </section>

    <section>
      <div class="flex flex-wrap items-center justify-between gap-x-3">
        <h3 class="font-medium text-highlighted">
          Call tree
        </h3>
        <RaDiagramButton
          v-if="!print"
          :kind="place.location.kind"
          diagram="call_tree"
          compact
        />
      </div>
      <div
        v-if="callTree.length"
        class="mt-2 overflow-x-auto rounded-md border border-default print:overflow-visible"
      >
        <table :class="tableClass">
          <thead :class="headClass">
            <tr>
              <th :class="cellClass">
                Level
              </th>
              <th :class="cellClass">
                Called by
              </th>
              <th :class="cellClass">
                Name
              </th>
              <th :class="cellClass">
                Division
              </th>
              <th :class="cellClass">
                Mobile
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(entry, index) in callTree"
              :key="`${entry.level}-${entry.seq ?? index}`"
              class="break-inside-avoid"
            >
              <td :class="[cellClass, 'whitespace-nowrap text-muted']">
                Level {{ entry.level }}
              </td>
              <td
                :class="[cellClass, 'text-muted']"
                lang="id"
              >
                {{ entry.caller || '—' }}
              </td>
              <td
                :class="cellClass"
                lang="id"
              >
                {{ entry.contact_name }}
              </td>
              <td
                :class="[cellClass, 'text-muted']"
                lang="id"
              >
                {{ entry.division || '—' }}
              </td>
              <td :class="[cellClass, 'whitespace-nowrap tabular-nums']">
                <a
                  v-if="telUrl(entry.mobile)"
                  :href="telUrl(entry.mobile)"
                  class="text-primary hover:underline"
                >{{ entry.mobile }}</a>
                <template v-else>
                  {{ entry.mobile || '—' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-else
        class="mt-2 text-sm text-muted"
      >
        None recorded.
      </p>
    </section>

    <section v-if="place.recovery_team.length">
      <div class="flex flex-wrap items-center justify-between gap-x-3">
        <h3 class="font-medium text-highlighted">
          Recovery team
        </h3>
        <RaDiagramButton
          v-if="!print"
          :kind="place.location.kind"
          diagram="recovery_team"
          compact
        />
      </div>
      <div class="mt-2 overflow-x-auto rounded-md border border-default print:overflow-visible">
        <table :class="tableClass">
          <thead :class="headClass">
            <tr>
              <th :class="cellClass">
                Team
              </th>
              <th :class="cellClass">
                Role
              </th>
              <th :class="cellClass">
                Name
              </th>
              <th :class="cellClass">
                Mobile
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(member, index) in place.recovery_team"
              :key="`${member.team}-${member.seq ?? index}`"
              class="break-inside-avoid"
            >
              <td :class="[cellClass, 'text-muted']">
                {{ teamLabel(member.team) }}
              </td>
              <td
                :class="[cellClass, 'text-muted']"
                lang="id"
              >
                {{ member.role || '—' }}
              </td>
              <td
                :class="cellClass"
                lang="id"
              >
                {{ member.name }}
              </td>
              <td :class="[cellClass, 'whitespace-nowrap tabular-nums']">
                <a
                  v-if="telUrl(member.mobile)"
                  :href="telUrl(member.mobile)"
                  class="text-primary hover:underline"
                >{{ member.mobile }}</a>
                <template v-else>
                  {{ member.mobile || '—' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
