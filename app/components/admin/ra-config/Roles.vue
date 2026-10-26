<script setup lang="ts">
import type { RaRoleLabel } from '~/composables/useRa'
import type { RaConfigVersion } from '~/composables/useRaConfigAdmin'

/**
 * The sign-off roles of this version: the label of each sign-off box and the title of who
 * signs it. Monitoring, Approval, the Sign-off tab and the reports show these titles. The
 * roles and their order are fixed by the workbook.
 */
const props = defineProps<{ version: RaConfigVersion }>()
const emit = defineEmits<{ saved: [version: RaConfigVersion] }>()

const part = useRaConfigPart<RaRoleLabel[]>(
  computed(() => props.version),
  (value) => (value.signoff_role_labels ?? []).map((row) => ({ ...row })),
  (code, value) => raConfigApi.setRoles(code, value),
  (saved) => emit('saved', saved),
  'Sign-off roles saved',
)
const { draft, error, busy, dirty, submit, reset } = part
const editable = computed(() => props.version.can.edit)

function fallback(role: string) {
  return props.version.default_roles.find((row) => row.role === role)
}
function restore(index: number) {
  const row = draft.value[index]!
  const original = fallback(row.role)
  if (original) draft.value[index] = { ...original }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">
            Sign-off roles
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-muted">
            They sign in this order. The title is who signs, as Monitoring, Approval and the reports show the step.
          </p>
        </div>
        <div
          v-if="editable"
          class="flex gap-2"
        >
          <UButton
            v-if="dirty"
            color="neutral"
            variant="outline"
            label="Undo changes"
            @click="reset"
          />
          <UButton
            icon="i-lucide-save"
            label="Save roles"
            :disabled="!dirty"
            :loading="busy"
            @click="submit"
          />
        </div>
      </div>
    </template>
    <div class="space-y-4">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't save the roles"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="error"
      />
      <fieldset
        :disabled="!editable"
        class="space-y-4"
      >
        <div
          v-for="(row, index) in draft"
          :key="row.role"
          class="grid items-end gap-3 sm:grid-cols-[4rem_minmax(0,14rem)_minmax(0,1fr)_auto]"
        >
          <p class="pb-2 text-sm text-muted">
            Step {{ index + 1 }}
          </p>
          <UFormField
            label="Label"
            :name="`roles.${index}.label`"
          >
            <UInput
              v-model="row.label"
              :aria-label="`Label of step ${index + 1}`"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Title (who signs)"
            :name="`roles.${index}.title`"
          >
            <UInput
              v-model="row.title"
              :aria-label="`Title of step ${index + 1}`"
              class="w-full"
            />
          </UFormField>
          <UTooltip
            v-if="editable"
            text="Back to the workbook's wording"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-rotate-ccw"
              :aria-label="`Reset step ${index + 1}`"
              @click="restore(index)"
            />
          </UTooltip>
        </div>
      </fieldset>
    </div>
  </UCard>
</template>
