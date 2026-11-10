<script setup lang="ts">
import type { RaAssessment } from '~/composables/useRa'

/**
 * A returned RA's notice, on every tab of the RA page. Need revision: the signer's comment and,
 * for the assessor, Accept revision (nothing can change until then, and the assessor is reminded
 * each working day). In revision: the comment and who accepted it.
 */
const props = defineProps<{ assessment: RaAssessment }>()
const emit = defineEmits<{ accepted: [assessment: RaAssessment] }>()

const toast = useToast()
const accepting = ref(false)

const state = computed(() => props.assessment.status === 'draft' ? props.assessment.revision_state ?? null : null)
const returnedBy = computed(() => props.assessment.returned_by ?? 'a signer')
const returnedOn = computed(() => props.assessment.returned_at ? formatDateTime(props.assessment.returned_at) : null)
const assessor = computed(() => props.assessment.created_by ?? props.assessment.lic_name ?? 'the assessor')

async function accept() {
  accepting.value = true
  try {
    const saved = await raApi.acceptRevision(props.assessment.id)
    toast.add({ title: 'Revision accepted', description: 'You can make changes now.', color: 'success', icon: 'i-lucide-circle-check' })
    emit('accepted', saved)
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    accepting.value = false
  }
}
</script>

<template>
  <UAlert
    v-if="state === 'need_revision'"
    color="error"
    variant="subtle"
    icon="i-lucide-undo-2"
    :title="`Need revision: returned by ${returnedBy}${returnedOn ? ` on ${returnedOn}` : ''}`"
    :ui="{ description: 'whitespace-pre-line' }"
    data-testid="revision-banner"
  >
    <template #description>
      <p>{{ assessment.returned_comment }}</p>
      <p class="mt-2 font-medium">
        {{ assessment.can_accept_revision
          ? 'Accept the revision to make changes.'
          : `Waiting for ${assessor} to accept the revision. It can't be changed until then.` }}
      </p>
    </template>
    <template
      v-if="assessment.can_accept_revision"
      #actions
    >
      <UButton
        label="Accept revision"
        icon="i-lucide-check"
        :loading="accepting"
        @click="accept"
      />
    </template>
  </UAlert>
  <UAlert
    v-else-if="state === 'in_revision'"
    color="warning"
    variant="subtle"
    icon="i-lucide-pencil-line"
    :title="`In revision: returned by ${returnedBy}${returnedOn ? ` on ${returnedOn}` : ''}`"
    :ui="{ description: 'whitespace-pre-line' }"
    data-testid="revision-banner"
  >
    <template #description>
      <p>{{ assessment.returned_comment }}</p>
      <p
        v-if="assessment.revision_accepted_by"
        class="mt-2 text-muted"
      >
        Accepted by {{ assessment.revision_accepted_by }}{{ assessment.revision_accepted_at ? ` on ${formatDateTime(assessment.revision_accepted_at)}` : '' }}.
      </p>
    </template>
  </UAlert>
</template>
