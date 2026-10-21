<script setup lang="ts">
import type { SccaPreview } from '~/composables/useScca'
import type { SccaConfigImpact, SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/**
 * The computation: S_D = Σ (rating / 5) × weight per dimension, with the weight set chosen by
 * the questions rated 5; CIA = the C/I/A mix; thresholds turn scores into levels 1–5; the
 * matrix turns the CIA and Potential Loss levels into the category. Plus the CIMBN recovery
 * standard per category (text for the forms and reports, numbers for the gap checks), a
 * calculator and the impact on the SCCAs of the active version.
 */
const props = defineProps<{ version: SccaConfigVersion }>()
const emit = defineEmits<{ saved: [version: SccaConfigVersion] }>()

const part = useConfigPart(
  computed(() => props.version),
  (value) => ({
    weights: value.weights,
    thresholds: value.thresholds,
    matrix: value.matrix,
    recovery_standards: value.recovery_standards,
  }),
  (code, value) => sccaConfigApi.setFormula(code, value),
  (saved) => emit('saved', saved),
  'Formula saved',
)
const { draft, error, busy, dirty, submit, reset } = part

const LEVELS = [1, 2, 3, 4, 5]
const DIMENSION_NAMES: Record<string, string> = { C: 'Confidentiality', I: 'Integrity', A: 'Availability', P: 'Potential Loss' }

function scopeTitle(scope: string) {
  if (scope === 'CIA') return 'CIA mix (C, I and A into the CIA score)'
  const [dimension, rest] = scope.split(':')
  const name = DIMENSION_NAMES[dimension!] ?? dimension
  if (!rest) return `${name}: one weight set`
  if (rest === 'TYPE0') return `${name}: default set`
  return `${name}: when ${rest.replace('=5', '')} is rated 5`
}

const scopes = computed(() => {
  const order = (scope: string) => (scope === 'CIA' ? 9 : 'CIAP'.indexOf(scope[0]!)) * 10 + (scope.includes('TYPE0') || !scope.includes(':') ? 0 : 1)
  return [...new Set(draft.value.weights.map((w) => w.scope))].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
})

function weightsOf(scope: string) {
  return draft.value.weights.filter((w) => w.scope === scope)
}

function total(scope: string) {
  return weightsOf(scope).reduce((sum, w) => sum + Number(w.weight || 0), 0)
}

/** A set used when one question is rated 5, starting as a copy of the dimension's default set. */
const newTrigger = ref<string | undefined>()
const triggerItems = computed(() => props.version.questions
  .filter((q) => !scopes.value.includes(`${q.dimension}:${q.code}=5`) && !scopes.value.includes(q.dimension))
  .map((q) => ({ label: `${q.code} rated 5`, value: q.code })))

function addSet() {
  const question = props.version.questions.find((q) => q.code === newTrigger.value)
  if (!question) return
  const base = weightsOf(`${question.dimension}:TYPE0`)
  const keys = props.version.questions.filter((q) => q.dimension === question.dimension).map((q) => q.code)
  for (const key of keys) {
    const weight = base.find((w) => w.key === key)?.weight ?? Number((1 / keys.length).toFixed(4))
    draft.value.weights.push({ scope: `${question.dimension}:${question.code}=5`, key, weight })
  }
  newTrigger.value = undefined
}

function removeSet(scope: string) {
  draft.value.weights = draft.value.weights.filter((w) => w.scope !== scope)
}

function threshold(kind: 'CIA' | 'POLOSS', level: number) {
  return draft.value.thresholds.find((t) => t.kind === kind && t.level === level)
}

function cell(cia: number, poloss: number) {
  return draft.value.matrix.find((m) => m.cia_level === cia && m.poloss_level === poloss)
}

const categoryItems = computed(() => (props.version.lists.category ?? []).map((item) => ({ label: item.label, value: item.code })))

// --- calculator --------------------------------------------------------------------------

const ratings = reactive<Record<string, number | undefined>>({})
const preview = ref<SccaPreview | null>(null)
const calculating = ref(false)
const calcError = ref<string | null>(null)

function useSample() {
  const sample: Record<string, number> = {
    C1: 5, C2: 1, C3: 3, C4: 3, C5: 5, I1: 5, I2: 5, I3: 1, I4: 2, I5: 3,
    A1: 5, A2: 5, A3: 5, A4: 4, P1: 3, P2: 4, P3: 2, P4: 5,
  }
  for (const question of props.version.questions) {
    const allowed = question.options.map((o) => o.rating)
    const value = sample[question.code]
    ratings[question.code] = value != null && allowed.includes(value) ? value : allowed[0]
  }
}

async function calculate() {
  calcError.value = null
  calculating.value = true
  try {
    const given = Object.fromEntries(Object.entries(ratings).filter(([, value]) => value != null)) as Record<string, number>
    preview.value = await sccaConfigApi.calculate(props.version.code, given)
  } catch (failure) {
    calcError.value = configErrorText(failure)
  } finally {
    calculating.value = false
  }
}

// --- impact ------------------------------------------------------------------------------

const impact = ref<SccaConfigImpact | null>(null)
const checking = ref(false)
const impactError = ref<string | null>(null)

async function checkImpact() {
  impactError.value = null
  checking.value = true
  try {
    impact.value = await sccaConfigApi.impact(props.version.code)
  } catch (failure) {
    impactError.value = configErrorText(failure)
  } finally {
    checking.value = false
  }
}

watch(() => props.version, () => {
  impact.value = null
  preview.value = null
})
</script>

<template>
  <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div class="min-w-0 space-y-6">
      <div
        v-if="version.can.edit"
        class="flex flex-wrap items-center justify-end gap-2"
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
          label="Save formula"
          :disabled="!dirty"
          :loading="busy"
          @click="submit"
        />
      </div>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't save the formula"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="error"
      />

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Weights
          </h2>
          <p class="mt-1 text-sm text-muted">
            Score of a dimension = Σ (rating ÷ 5) × weight. When a question with its own set is rated 5, that set replaces the default one (the first in question order wins). Each set adds up to 1.
          </p>
        </template>
        <fieldset
          :disabled="!version.can.edit"
          class="grid gap-6 md:grid-cols-2"
        >
          <section
            v-for="scope in scopes"
            :key="scope"
            :aria-label="scopeTitle(scope)"
          >
            <h3 class="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
              <span>
                {{ scopeTitle(scope) }}
                <span class="font-mono text-xs text-muted">{{ scope }}</span>
              </span>
              <UButton
                v-if="version.can.edit && /=5$/.test(scope)"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                :aria-label="`Remove the weight set ${scope}`"
                @click="removeSet(scope)"
              />
            </h3>
            <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
              <template
                v-for="weight in weightsOf(scope)"
                :key="weight.key"
              >
                <label
                  :for="`w-${scope}-${weight.key}`"
                  class="font-mono text-sm"
                >{{ weight.key }}</label>
                <UInputNumber
                  :id="`w-${scope}-${weight.key}`"
                  v-model="weight.weight"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  :format-options="{ maximumFractionDigits: 4 }"
                  class="w-full"
                />
              </template>
            </div>
            <p
              class="mt-2 flex items-center gap-1 text-xs"
              :class="Math.abs(total(scope) - 1) <= 0.0005 ? 'text-muted' : 'text-error'"
            >
              <UIcon
                :name="Math.abs(total(scope) - 1) <= 0.0005 ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
                class="size-3.5"
              />
              Adds up to {{ formatNumber(total(scope), 4) }}
            </p>
          </section>
        </fieldset>
        <template
          v-if="version.can.edit && triggerItems.length"
          #footer
        >
          <div class="flex flex-wrap items-end gap-2">
            <UFormField
              label="Add a weight set for when a question is rated 5"
              class="w-72"
            >
              <USelect
                v-model="newTrigger"
                :items="triggerItems"
                placeholder="Pick the question"
                class="w-full"
              />
            </UFormField>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              label="Add weight set"
              :disabled="!newTrigger"
              @click="addSet"
            />
          </div>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Levels
          </h2>
          <p class="mt-1 text-sm text-muted">
            The lowest score of each level. The CIA score is rounded to 2 decimals first. Level 1 starts at 0.
          </p>
        </template>
        <fieldset
          :disabled="!version.can.edit"
          class="overflow-x-auto"
        >
          <table class="w-full text-sm">
            <caption class="sr-only">
              Minimum score per level
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="px-3 py-2">
                  Level
                </th>
                <th class="px-3 py-2">
                  CIA from
                </th>
                <th class="px-3 py-2">
                  Potential Loss from
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="level in [...LEVELS].reverse()"
                :key="level"
              >
                <th
                  scope="row"
                  class="px-3 py-2 text-left font-medium"
                >
                  {{ level }}
                </th>
                <td
                  v-for="kind in (['CIA', 'POLOSS'] as const)"
                  :key="kind"
                  class="px-3 py-2"
                >
                  <UInputNumber
                    v-if="threshold(kind, level)"
                    v-model="threshold(kind, level)!.min_score"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    :disabled="level === 1"
                    class="w-32"
                    :aria-label="`${kind === 'CIA' ? 'CIA' : 'Potential Loss'} level ${level} from`"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </fieldset>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Category matrix
          </h2>
          <p class="mt-1 text-sm text-muted">
            The category for each pair of CIA and Potential Loss levels.
          </p>
        </template>
        <fieldset
          :disabled="!version.can.edit"
          class="overflow-x-auto"
        >
          <table class="text-sm">
            <caption class="sr-only">
              Category by CIA level (columns) and Potential Loss level (rows)
            </caption>
            <thead class="text-xs uppercase text-muted">
              <tr>
                <th class="px-2 py-2 text-left">
                  PoLoss ╲ CIA
                </th>
                <th
                  v-for="cia in LEVELS"
                  :key="cia"
                  class="px-2 py-2 text-left"
                >
                  {{ cia }}-CIA
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="poloss in [...LEVELS].reverse()"
                :key="poloss"
              >
                <th
                  scope="row"
                  class="px-2 py-1.5 text-left text-xs font-medium uppercase text-muted"
                >
                  {{ poloss }}-PoLoss
                </th>
                <td
                  v-for="cia in LEVELS"
                  :key="cia"
                  class="px-1 py-1"
                >
                  <USelect
                    v-if="cell(cia, poloss)"
                    v-model="cell(cia, poloss)!.category"
                    :items="categoryItems"
                    class="w-36"
                    :aria-label="`CIA ${cia}, Potential Loss ${poloss}`"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </fieldset>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <h2 class="font-semibold text-highlighted">
            CIMBN recovery architecture standard
          </h2>
          <p class="mt-1 text-sm text-muted">
            The text shows on the Recovery tab and the reports. The gap checks use the hours and the minimum uptime (empty: no limit).
          </p>
        </template>
        <fieldset
          :disabled="!version.can.edit"
          class="overflow-x-auto"
        >
          <table class="w-full text-sm">
            <caption class="sr-only">
              Recovery standard per category
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="px-3 py-2 ps-4">
                  Category
                </th>
                <th class="px-3 py-2">
                  MTD text
                </th>
                <th class="px-3 py-2">
                  MTD up to (h)
                </th>
                <th class="px-3 py-2">
                  RTO text
                </th>
                <th class="px-3 py-2">
                  RTO up to (h)
                </th>
                <th class="px-3 py-2">
                  Uptime text
                </th>
                <th class="px-3 py-2 pe-4">
                  Uptime at least (%)
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="standard in draft.recovery_standards"
                :key="standard.category"
              >
                <th
                  scope="row"
                  class="px-3 py-2 ps-4 text-left font-medium"
                >
                  {{ sccaListLabel(version, 'category', standard.category) }}
                </th>
                <td class="px-3 py-2">
                  <UInput
                    :model-value="standard.mtd ?? ''"
                    class="min-w-32"
                    :aria-label="`${standard.category} MTD text`"
                    @update:model-value="standard.mtd = String($event) || null"
                  />
                </td>
                <td class="px-3 py-2">
                  <UInputNumber
                    :model-value="standard.mtd_to_h ?? undefined"
                    :min="0"
                    class="w-24"
                    :aria-label="`${standard.category} MTD up to hours`"
                    @update:model-value="standard.mtd_to_h = $event ?? null"
                  />
                </td>
                <td class="px-3 py-2">
                  <UInput
                    :model-value="standard.rto ?? ''"
                    class="min-w-32"
                    :aria-label="`${standard.category} RTO text`"
                    @update:model-value="standard.rto = String($event) || null"
                  />
                </td>
                <td class="px-3 py-2">
                  <UInputNumber
                    :model-value="standard.rto_to_h ?? undefined"
                    :min="0"
                    class="w-24"
                    :aria-label="`${standard.category} RTO up to hours`"
                    @update:model-value="standard.rto_to_h = $event ?? null"
                  />
                </td>
                <td class="px-3 py-2">
                  <UInput
                    :model-value="standard.uptime ?? ''"
                    class="min-w-32"
                    :aria-label="`${standard.category} uptime text`"
                    @update:model-value="standard.uptime = String($event) || null"
                  />
                </td>
                <td class="px-3 py-2 pe-4">
                  <UInputNumber
                    :model-value="standard.uptime_min_pct ?? undefined"
                    :min="0"
                    :max="100"
                    :step="0.1"
                    class="w-24"
                    :aria-label="`${standard.category} uptime at least`"
                    @update:model-value="standard.uptime_min_pct = $event ?? null"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </fieldset>
      </UCard>
    </div>

    <div class="space-y-6 xl:sticky xl:top-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-highlighted">
              Calculator
            </h2>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              label="Use the V4.2 sample"
              @click="useSample"
            />
          </div>
          <p class="mt-1 text-sm text-muted">
            Try {{ version.code }}'s saved formula. Save your changes first.
          </p>
        </template>
        <form
          class="space-y-4"
          @submit.prevent="calculate"
        >
          <div class="grid grid-cols-3 gap-2">
            <UFormField
              v-for="question in version.questions"
              :key="question.code"
              :label="question.code"
            >
              <USelect
                v-model="ratings[question.code]"
                :items="question.options.map((option) => ({ label: String(option.rating), value: option.rating }))"
                placeholder="—"
                class="w-full"
              />
            </UFormField>
          </div>
          <UAlert
            v-if="calcError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="calcError"
          />
          <div
            v-if="preview"
            class="rounded-md border border-default p-3 text-sm"
            aria-live="polite"
          >
            <template v-if="preview.result">
              <p class="flex items-center gap-2">
                <span class="text-muted">Category</span>
                <UBadge
                  :color="(sccaListItem(version, 'category', preview.result.category)?.attrs.color as 'neutral') ?? 'neutral'"
                  variant="subtle"
                  :label="sccaListLabel(version, 'category', preview.result.category) ?? preview.result.category"
                />
              </p>
              <p class="mt-2 tabular-nums text-muted">
                C {{ formatPercent(preview.result.confidentiality_score, 1) }} ({{ preview.result.confidentiality_weight_set }}) ·
                I {{ formatPercent(preview.result.integrity_score, 1) }} ·
                A {{ formatPercent(preview.result.availability_score, 1) }}
              </p>
              <p class="tabular-nums text-muted">
                CIA {{ formatPercent(preview.result.cia_score, 1) }} → {{ preview.result.cia_level }} ·
                PoLoss {{ formatPercent(preview.result.poloss_score, 1) }} ({{ preview.result.poloss_weight_set }}) → {{ preview.result.poloss_level }}
              </p>
            </template>
            <p v-else>
              Rate every question: {{ preview.missing.join(', ') }} missing.
            </p>
          </div>
          <div class="flex justify-end">
            <UButton
              type="submit"
              color="neutral"
              variant="outline"
              icon="i-lucide-calculator"
              label="Calculate"
              :loading="calculating"
            />
          </div>
        </form>
      </UCard>

      <UCard v-if="version.status === 'draft'">
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Impact on SCCAs
          </h2>
          <p class="mt-1 text-sm text-muted">
            The SCCAs of the active version whose category would change under {{ version.code }} with the same ratings. They keep their version; this only shows the effect.
          </p>
        </template>
        <div class="space-y-3">
          <UAlert
            v-if="impactError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="impactError"
          />
          <template v-if="impact">
            <p class="text-sm">
              Checked {{ formatNumber(impact.checked) }} SCCA{{ impact.checked === 1 ? '' : 's' }} of {{ impact.compared_with ?? 'the active version' }}:
              <span class="font-medium">{{ formatNumber(impact.changed) }} change category</span>,
              {{ formatNumber(impact.re_rate) }} need re-rating.
            </p>
            <ul
              v-if="impact.items.length"
              class="max-h-80 divide-y divide-default overflow-y-auto rounded-md border border-default text-sm"
            >
              <li
                v-for="item in impact.items"
                :key="item.id"
                class="px-3 py-2"
              >
                <ULink
                  :to="`/scca/${item.id}`"
                  class="font-medium text-primary"
                >
                  {{ item.ref_no ?? item.application_name }}
                </ULink>
                <span class="text-muted"> · {{ item.application_name }}</span>
                <p class="text-xs text-muted">
                  <template v-if="item.re_rate.length">
                    Re-rate {{ item.re_rate.join(', ') }}
                  </template>
                  <template v-else>
                    {{ sccaListLabel(version, 'category', item.category_now) }} → {{ sccaListLabel(version, 'category', item.category_new) }}<span v-if="item.overridden"> (overridden to {{ sccaListLabel(version, 'category', item.final_category) }})</span>
                  </template>
                </p>
              </li>
            </ul>
          </template>
          <div class="flex justify-end">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-scan-search"
              :label="impact ? 'Check again' : 'Check impact'"
              :loading="checking"
              @click="checkImpact"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
