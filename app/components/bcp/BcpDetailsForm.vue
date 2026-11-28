<script setup lang="ts">
import type { BcpPlan } from '~/composables/useBcp'

/**
 * New BCP: pick the Group (from its final BIA). The Group decides the rest, as SCCA's reason;
 * what the pick brings with it shows under the picker. Submitted by Create BCP in the top bar
 * (form id `bcp-form-details`).
 */
const emit = defineEmits<{ saved: [plan: BcpPlan] }>()
const saving = inject(bcpSavingKey, ref(false))

const { data, status } = useBcpEligible()
const items = computed(() => (data.value?.items ?? []).map((row) => ({
  label: row.org_group ?? row.bia_ref_no ?? String(row.bia_id),
  description: [row.directorate, row.sub_directorate].filter(Boolean).join(' › '),
  value: row.bia_id,
})))
const biaId = ref<number | undefined>()
const picked = computed(() => data.value?.items.find((row) => row.bia_id === biaId.value))
const error = ref<string | null>(null)

async function submit() {
  if (!biaId.value) return
  error.value = null
  saving.value = true
  try {
    emit('saved', await bcpApi.create(biaId.value))
  } catch (failure) {
    error.value = bcpErrorText(failure)
  } finally {
    saving.value = false
  }
}
defineExpose({ canCreate: computed(() => !!biaId.value) })
</script>

<template>
  <UCard>
    <form
      id="bcp-form-details"
      class="max-w-xl space-y-4"
      novalidate
      @submit.prevent="submit"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't create the BCP"
        :description="error"
      />
      <UAlert
        v-if="status === 'success' && !items.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="No final BIA with a business critical function for your Group yet."
        description="A BCP starts from the Group's latest final BIA. Groups that already have a BCP are not listed."
      />
      <UFormField
        label="Group"
        name="bia_id"
        required
        help="Groups you coordinate whose latest final BIA has a business critical function and no BCP yet."
      >
        <USelectMenu
          v-model="biaId"
          value-key="value"
          :items="items"
          :disabled="!items.length"
          placeholder="Pick a Group"
          class="w-full"
          aria-label="Group"
        />
      </UFormField>
      <UAlert
        v-if="picked"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="`Copies ${picked.bia_ref_no} (final ${formatDate(picked.finalised_at) || '—'})`"
        :description="`${picked.functions} functions, ${picked.critical} business critical. Check them on the Summary BIA tab after creating.`"
      />
    </form>
  </UCard>
</template>
