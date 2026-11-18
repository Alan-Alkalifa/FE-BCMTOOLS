<script setup lang="ts">
import type { SccaAssessment, SccaRecoveryStandard } from '~/composables/useScca'

/**
 * Recovery tab: the DR decision (Standard Teknologi H.03.P.02.01 versi 08.2026). Lampiran 9 is
 * the decision tree, Lampiran 10 the DR type catalogue (the suggested DR and the fields after it)
 * and Lampiran 8 the information shown for the SCCA's category. Everything comes from the SCCA's
 * configuration version (SCCA configuration > DR decision). The suggested DR is guidance: it does
 * not change the Final recovery values.
 */
export interface DrAnswers {
  alt: 'yes' | 'no' | ''
  altNote: string
  accepts: 'yes' | 'no' | ''
  acceptNote: string
  acceptedBy: string
}

const props = defineProps<{
  assessment: SccaAssessment
  standards: SccaRecoveryStandard[]
  category: string | null | undefined
  editable: boolean
}>()
const answers = defineModel<DrAnswers>({ required: true })

const config = useSccaConfigContext()
const dr = computed(() => config.value?.dr ?? null)
const isDraft = computed(() => props.assessment.status === 'draft')
const open = ref(false)

function tri(value: 'yes' | 'no' | ''): boolean | null {
  return value === 'yes' ? true : value === 'no' ? false : null
}

/** A draft runs the tree on what is typed; a submitted or final SCCA shows what it stored. */
const decision = computed(() => {
  if (!dr.value) return null
  if (!isDraft.value) return props.assessment.dr_decision
  return decideDr(dr.value, props.standards, props.category, tri(answers.value.alt), tri(answers.value.accepts))
})

const settings = computed(() => dr.value?.settings)
const needsAccept = computed(() => decision.value?.path === 'tree' && answers.value.alt === 'no')
const info = computed(() => SCCA_DR_CHARACTERISTICS.filter((item) => SCCA_DR_INFO_KEYS.includes(item.key)))
const yesNo = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]
const ownerSignoff = computed(() => settings.value?.acceptance_mode === 'owner_signoff')

const categoryLabel = computed(() => (props.category ? sccaCategory[props.category as SccaCategory]?.label ?? props.category : null))

/** Lampiran 8 and 10 side panel: the columns follow the version's standards order. */
const categories = computed(() => props.standards.map((row) => row.category))
const currentBand = computed(() => decision.value?.suggested ?? (dr.value ? sccaDrBand(dr.value, decision.value?.mtd_h ?? null) : null))
function sameBand(band: { mtd_from_h: number | null }) {
  return currentBand.value != null && currentBand.value.mtd_from_h === band.mtd_from_h
}
</script>

<template>
  <UCard v-if="dr">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">
            Disaster recovery decision
          </h3>
          <p class="mt-1 text-sm text-muted">
            DR Decision Tree (Lampiran 9) and the DR type catalogue (Lampiran 10) of Standard Teknologi H.03.P.02.01 versi 08.2026. The suggested DR is guidance: enter the committed values in the Final row below.
          </p>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          icon="i-lucide-book-open"
          label="View Lampiran 8 and Lampiran 10"
          @click="open = true"
        />
      </div>
    </template>

    <div class="space-y-5">
      <p
        v-if="!isDraft && !decision"
        class="rounded-md bg-elevated/60 p-3 text-sm text-muted"
      >
        Not assessed: this SCCA was finalised before the DR Decision Tree. The decision is made at its next review.
      </p>
      <p
        v-else-if="!category || !decision || decision.status === 'no_category'"
        class="rounded-md bg-elevated/60 p-3 text-sm text-muted"
      >
        Complete the Rating tab to run the DR decision.
      </p>

      <template v-else>
        <dl class="grid gap-4 sm:grid-cols-3">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
              Final category
            </dt>
            <dd class="mt-1">
              <StatusBadge
                :scale="sccaCategory"
                :value="(category as SccaCategory)"
                size="sm"
              />
            </dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
              MTD (Lampiran 8)
            </dt>
            <dd class="mt-1 tabular-nums">
              {{ decision.mtd_h == null ? '—' : `${decision.mtd_h} h` }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
              Path
            </dt>
            <dd class="mt-1 text-sm">
              {{ decision.path === 'mandatory' ? `DR is mandatory for ${categoryLabel}: no questions` : 'DR Decision Tree' }}
            </dd>
          </div>
        </dl>

        <div
          v-if="decision.path === 'tree'"
          class="grid gap-4 lg:grid-cols-2"
        >
          <div class="space-y-2">
            <UFormField
              :label="settings?.question_alt_process"
              required
            >
              <USelect
                v-model="answers.alt"
                :items="yesNo"
                value-key="value"
                label-key="label"
                class="w-40"
                placeholder="—"
                :disabled="!editable || !isDraft"
                aria-label="Alternate business process available"
              />
            </UFormField>
            <UFormField
              v-if="answers.alt === 'yes'"
              label="Describe the alternate business process"
              required
            >
              <UTextarea
                v-model="answers.altNote"
                :maxlength="TEXT_LIMITS.long"
                :rows="2"
                autoresize
                class="w-full"
                :disabled="!editable || !isDraft"
                aria-label="Alternate business process description"
              />
              <FieldCount
                class="mt-1 block text-right text-xs"
                :value="answers.altNote"
                :max="TEXT_LIMITS.long"
              />
            </UFormField>
          </div>

          <div
            v-if="needsAccept"
            class="space-y-2"
          >
            <UFormField
              :label="settings?.question_accept"
              required
            >
              <USelect
                v-model="answers.accepts"
                :items="yesNo"
                value-key="value"
                label-key="label"
                class="w-40"
                placeholder="—"
                :disabled="!editable || !isDraft"
                aria-label="Business accepts running without DR"
              />
            </UFormField>
            <template v-if="answers.accepts === 'yes'">
              <UFormField
                label="Justification"
                required
              >
                <UTextarea
                  v-model="answers.acceptNote"
                  :maxlength="TEXT_LIMITS.long"
                  :rows="2"
                  autoresize
                  class="w-full"
                  :disabled="!editable || !isDraft"
                  aria-label="Business acceptance justification"
                />
                <FieldCount
                  class="mt-1 block text-right text-xs"
                  :value="answers.acceptNote"
                  :max="TEXT_LIMITS.long"
                />
              </UFormField>
              <UFormField
                v-if="!ownerSignoff"
                label="Accepted by (business owner)"
                required
              >
                <UInput
                  v-model="answers.acceptedBy"
                  :maxlength="TEXT_LIMITS.name"
                  class="w-full"
                  :disabled="!editable || !isDraft"
                  aria-label="Business owner who accepted"
                />
              </UFormField>
              <p
                v-else
                class="text-xs text-muted"
              >
                The application owner confirms this acceptance at the sign-off.
              </p>
            </template>
          </div>
        </div>

        <UAlert
          v-if="decision.status === 'needs_answer'"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-help"
          title="Answer the DR decision questions"
          description="The decision tree needs an answer before it can give an outcome. Submit is blocked until it is answered."
        />
        <UAlert
          v-else
          :color="decision.outcome === 'proposed' ? 'info' : 'success'"
          variant="subtle"
          :icon="decision.outcome === 'proposed' ? 'i-lucide-shield-check' : 'i-lucide-shield-off'"
          :title="decision.outcome_label ?? ''"
          :description="decision.reason ?? ''"
        />

        <div v-if="decision.status === 'complete' && decision.suggested">
          <h4
            class="mb-2 text-sm font-semibold"
            :class="decision.outcome === 'not_required' ? 'text-muted' : undefined"
          >
            {{ decision.outcome === 'proposed' ? 'Suggested DR' : 'Reference only: the catalogue row for this MTD' }}
            <span class="font-normal text-muted">({{ bandLabel(decision.suggested) }})</span>
          </h4>
          <dl
            class="grid gap-x-6 gap-y-3 rounded-md border border-default p-3 sm:grid-cols-2"
            :class="decision.outcome === 'not_required' ? 'opacity-60' : undefined"
          >
            <div
              v-for="field in SCCA_DR_BAND_FIELDS"
              :key="field.key"
              :class="field.key === 'suggested_dr' ? 'sm:col-span-2' : undefined"
            >
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                {{ field.label }}
              </dt>
              <dd
                class="mt-0.5 text-sm"
                :class="field.key === 'suggested_dr' ? 'text-base font-semibold text-highlighted' : undefined"
              >
                {{ decision.suggested[field.key] || '—' }}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h4 class="mb-2 text-sm font-semibold">
            Information for {{ categoryLabel }} (Lampiran 8)
          </h4>
          <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div
              v-for="item in info"
              :key="item.key"
            >
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                {{ item.label }}
              </dt>
              <dd class="mt-0.5 text-sm">
                {{ decision.characteristics?.[item.key] || '—' }}
              </dd>
            </div>
          </dl>
        </div>
      </template>
    </div>

    <UModal
      v-model:open="open"
      title="Lampiran 8 and Lampiran 10"
      description="Standard Teknologi dan Pemeliharaan Perangkat TI, H.03.P.02.01 versi 08.2026. The current category and the matching catalogue row are highlighted."
      :ui="{ content: 'sm:max-w-6xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <section>
            <h4 class="mb-2 font-semibold">
              Lampiran 8 · System characteristics by criticality
            </h4>
            <div class="overflow-x-auto">
              <table class="w-full min-w-3xl text-sm">
                <thead>
                  <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th class="px-3 py-2">
                      Characteristic
                    </th>
                    <th
                      v-for="name in categories"
                      :key="name"
                      class="px-3 py-2"
                      :class="name === category ? 'text-primary' : undefined"
                    >
                      {{ sccaCategory[name as SccaCategory]?.label ?? name }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="item in SCCA_DR_CHARACTERISTICS"
                    :key="item.key"
                  >
                    <th class="px-3 py-2 text-left align-top font-medium">
                      {{ item.label }}
                    </th>
                    <td
                      v-for="name in categories"
                      :key="`${item.key}-${name}`"
                      class="px-3 py-2 align-top"
                      :class="name === category ? 'bg-primary/5 font-medium text-highlighted' : undefined"
                    >
                      {{ dr.characteristics?.[name]?.[item.key] || '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h4 class="mb-2 font-semibold">
              Lampiran 10 · DR type catalogue by MTD
            </h4>
            <div class="overflow-x-auto">
              <table class="w-full min-w-5xl text-sm">
                <thead>
                  <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th class="px-3 py-2">
                      MTD
                    </th>
                    <th
                      v-for="field in SCCA_DR_BAND_FIELDS"
                      :key="field.key"
                      class="px-3 py-2"
                    >
                      {{ field.label }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="band in dr.catalogue"
                    :key="band.suggested_dr"
                    :class="sameBand(band) ? 'bg-primary/5 font-medium text-highlighted' : undefined"
                  >
                    <td class="px-3 py-2 align-top tabular-nums">
                      {{ bandLabel(band) }}
                    </td>
                    <td
                      v-for="field in SCCA_DR_BAND_FIELDS"
                      :key="field.key"
                      class="px-3 py-2 align-top"
                    >
                      {{ band[field.key] || '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-xs text-muted">
              LST = last successful transaction, LDB = last day backup, LSB = last successful backup. DR capacity under 100% uses a virtualization environment.
            </p>
          </section>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
