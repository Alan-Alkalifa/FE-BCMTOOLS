<script setup lang="ts">
import type { BcmAssignment, BcmOperationalRole } from '~/utils/bianca-bcm-roles'

const props = defineProps<{ role: BcmOperationalRole, assignment?: BcmAssignment }>()
const emit = defineEmits<{ close: [saved?: boolean] }>()
const user = ref(props.assignment?.user.id ?? null)
const description = ref(props.assignment?.description ?? '')
const active = ref(props.assignment?.is_active ?? true)
const busy = ref(false)
const error = ref('')
const toast = useToast()
async function save() {
  if (!user.value || busy.value) return
  busy.value = true
  error.value = ''
  const base = '/api/masterdata/bcm-roles'
  try {
    await $fetch(props.assignment ? `${base}/${props.assignment.id}` : base, {
      method: props.assignment ? 'PUT' : 'POST',
      body: { role: props.role, user_id: user.value, description: description.value.trim() || null, is_active: active.value },
    })
    toast.add({ title: 'BCM role assignment saved', color: 'success' })
    emit('close', true)
  } catch (failure) {
    error.value = biancaConfigError(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="`${assignment ? 'Edit' : 'Add'} ${bcmRoleLabel(role)} assignment`"
    description="Assign an existing directory user to this operational role."
    :dismissible="!busy"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        id="bcm-role-assignment"
        class="space-y-4"
        @submit.prevent="save"
      >
        <UAlert
          v-if="error"
          :title="error"
          color="error"
          variant="subtle"
        />
        <UFormField
          label="Directory user"
          required
        >
          <UserPicker
            v-model="user"
            :selected="assignment?.user.id === user ? assignment.user : null"
            endpoint="/api/masterdata/bcm-roles/people"
            aria-label="Directory user"
          />
        </UFormField>
        <UFormField label="Description">
          <UTextarea
            v-model="description"
            :maxlength="500"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <USwitch
          v-model="active"
          label="Active"
          description="An active assignment can be used to select a signer before submission."
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="busy"
          @click="emit('close')"
        />
        <UButton
          label="Save assignment"
          form="bcm-role-assignment"
          type="submit"
          :loading="busy"
          :disabled="!user"
        />
      </div>
    </template>
  </UModal>
</template>
