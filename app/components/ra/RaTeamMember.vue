<script setup lang="ts">
import type { RaUserRef } from '~/composables/useRa'

/**
 * One member of the location incident team (the LIC or the LICOM): a BCM Tools user picked from
 * the directory, and their mobile number. Picking someone else puts in the mobile number from
 * their profile (empty when it has none, so it is asked for); the number can still be edited.
 * The form fields are `<member>_user_id` and `<member>_phone`. The LIC is `fixed`: always the
 * assessor, looked up from the directory, so it shows their name without a picker.
 */
const props = withDefaults(defineProps<{
  member: 'lic' | 'licom'
  label: string
  hint?: string
  /** The name typed on an assessment from before users were picked. */
  legacyName?: string | null
  disabled?: boolean
  /** Field labels: "Name" under a legend, or "<label>" with "<short> mobile number". */
  nameLabel?: string
  shortLabel?: string
  phoneLabel?: string
  /** No picker: the member is looked up (the LIC is the assessor). */
  fixed?: boolean
}>(), {
  hint: undefined,
  legacyName: null,
  disabled: false,
  nameLabel: 'Name',
  shortLabel: undefined,
  phoneLabel: 'Mobile number',
  fixed: false,
})

const userId = defineModel<number | null>('userId', { required: true })
const user = defineModel<RaUserRef | null>('user', { required: true })
const phone = defineModel<string>('phone', { required: true })

const short = computed(() => props.shortLabel ?? props.member.toUpperCase())
const help = computed(() =>
  !props.fixed && !userId.value && props.legacyName
    ? `Typed as “${props.legacyName}” before: pick them from the user directory.`
    : props.hint || undefined,
)

function onPicked(picked: RaUserRef | null) {
  const changed = picked?.id !== user.value?.id
  user.value = picked
  if (changed) phone.value = raPhoneOrEmpty(picked?.mobile_phone)
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      :label="nameLabel"
      :name="`${member}_user_id`"
      :help="help"
      required
      eager-validation
    >
      <UInput
        v-if="fixed"
        :model-value="user?.name ?? legacyName ?? ''"
        disabled
        :aria-label="`${short}: ${label}`"
        class="w-full"
      />
      <RaSignerSelect
        v-else
        v-model="userId"
        :current="user"
        :disabled="disabled"
        :aria-label="`${short}: ${label}`"
        @picked="onPicked"
      />
    </UFormField>
    <UFormField
      :label="phoneLabel"
      :name="`${member}_phone`"
      required
      eager-validation
    >
      <UInput
        v-model="phone"
        :disabled="disabled"
        :aria-label="`${short} mobile number`"
        type="tel"
        autocomplete="off"
        placeholder="e.g. 0813 1226 2739"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
