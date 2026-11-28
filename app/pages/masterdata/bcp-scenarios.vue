<script setup lang="ts">
import type { BcpScenario, BcpScenarioMaster } from '~/composables/useBcpScenarioMaster'

/**
 * Administration › Master data › BCP scenario and procedure: the scenarios of each workaround
 * condition and their standard procedures, saved at once (no draft), as Master MTD. The draft
 * BCP configuration follows it; published versions keep their copy, so an existing BCP never
 * changes. A BCP lists every active scenario of a condition and can change its rows.
 */
definePageMeta({ permission: ['masterdata.bcp_scenario.view', 'masterdata.bcp_scenario.manage'] })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can } = useAuth()
const manage = computed(() => can('masterdata.bcp_scenario.manage'))
const { data, error, refresh } = await useFetch<BcpScenarioMaster>('/api/masterdata/bcp-scenarios', { key: 'bcp-scenario-master' })

const scenarios = ref<BcpScenario[]>([])
// Codes the master had when it was loaded: they are locked (BCPs and versions use them).
const savedCodes = ref(new Set<string>())
function reset(master = data.value) {
  scenarios.value = structuredClone(toRaw(master?.scenarios ?? []))
  savedCodes.value = new Set((master?.scenarios ?? []).map((row) => row.code))
}
watch(data, (master) => reset(master), { immediate: true })
const dirty = computed(() => JSON.stringify(scenarios.value) !== JSON.stringify(data.value?.scenarios ?? []))
useUnsavedChanges(dirty)

const ALL = '__all__'
const condition = computed<string>({
  get: () => (typeof route.query.condition === 'string' ? route.query.condition : ALL),
  set: (value) => router.replace({ query: { ...route.query, condition: value === ALL ? undefined : value } }),
})
const conditionItems = computed(() => [
  { label: 'All conditions', value: ALL },
  ...(data.value?.conditions ?? []).map((row) => ({ label: row.title + (row.active ? '' : ' (inactive)'), value: row.code })),
])
const conditionTitle = (code: string) => data.value?.conditions.find((row) => row.code === code)?.title ?? code
const shown = computed(() => scenarios.value.filter((row) => condition.value === ALL || row.condition_code === condition.value))

const busy = ref(false)
const failure = ref<string | null>(null)
async function save() {
  if (!manage.value || !dirty.value || busy.value) return
  busy.value = true
  failure.value = null
  try {
    data.value = await bcpScenarioApi.save(scenarios.value)
    clearNuxtData((key) => key.startsWith('bcp-config-'))
    toast.add({ title: 'Scenarios saved', description: data.value.version ? `BCP configuration ${data.value.version} follows them.` : undefined, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    failure.value = configErrorText(err)
  } finally {
    busy.value = false
  }
}

function label(row: BcpScenario) {
  return row.name || row.code
}
function addScenario() {
  const conditionCode = condition.value === ALL ? (data.value?.conditions[0]?.code ?? '') : condition.value
  scenarios.value.push({
    code: bcpCodeFrom('scenario', scenarios.value.map((row) => row.code)),
    name: '',
    condition_code: conditionCode,
    description: '',
    active: true,
    procedures: [{ code: 'procedure', name: '', procedure: '', form: '', pic: '', notes: '', active: true }],
  })
}
function renameScenario(row: BcpScenario) {
  if (savedCodes.value.has(row.code)) return
  row.code = bcpCodeFrom(row.name, scenarios.value.filter((other) => other !== row).map((other) => other.code))
}
function addProcedure(row: BcpScenario) {
  row.procedures.push({ code: bcpCodeFrom('procedure', row.procedures.map((p) => p.code)), name: '', procedure: '', form: '', pic: '', notes: '', active: true })
}
function removeScenario(row: BcpScenario) {
  scenarios.value.splice(scenarios.value.indexOf(row), 1)
}
</script>

<template>
  <AppPage
    title="BCP scenario and procedure"
    icon="i-lucide-route"
    description="The scenarios of each workaround condition and their standard procedures. Saved at once; BCP configuration copies them into its draft."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'BCP scenario and procedure' }]"
  >
    <template #actions>
      <template v-if="manage && data">
        <UBadge
          v-if="dirty"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-dot"
          label="Unsaved changes"
        />
        <UButton
          v-if="dirty"
          label="Discard changes"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="reset()"
        />
        <UButton
          icon="i-lucide-save"
          label="Save"
          :loading="busy"
          :disabled="!dirty"
          @click="save"
        />
      </template>
    </template>

    <UAlert
      v-if="error"
      title="Could not load the BCP scenarios"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :description="configErrorText(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>
    <div
      v-else-if="data"
      class="space-y-6"
    >
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Used from the next BCP configuration version"
        :description="data.version
          ? `BCP configuration ${data.version} follows these scenarios; published versions keep their copy, so an existing BCP never changes. A scenario a published version used can be made inactive, not removed.`
          : 'Each BCP configuration version keeps a copy of these scenarios.'"
      />
      <div class="flex flex-wrap items-center gap-3">
        <USelect
          v-model="condition"
          :items="conditionItems"
          class="w-96 max-w-full"
          aria-label="Condition"
        />
        <span class="text-sm text-muted">{{ shown.length }} scenario{{ shown.length === 1 ? '' : 's' }}</span>
      </div>
      <UAlert
        v-if="failure"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Not saved"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="failure"
      />

      <fieldset
        :disabled="!manage"
        class="min-w-0 space-y-6"
      >
        <UCard
          v-for="row in shown"
          :key="row.code"
          :ui="{ root: row.active ? '' : 'opacity-70' }"
        >
          <template #header>
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <UFormField
                label="Scenario"
                required
                :hint="row.code"
              >
                <UInput
                  v-model="row.name"
                  class="w-full"
                  maxlength="255"
                  :aria-label="`Name of scenario ${label(row)}`"
                  @blur="renameScenario(row)"
                />
              </UFormField>
              <UFormField
                label="Condition"
                required
              >
                <USelect
                  v-model="row.condition_code"
                  :items="(data.conditions ?? []).map((c) => ({ label: c.title, value: c.code }))"
                  class="w-full"
                  :aria-label="`Condition of ${label(row)}`"
                />
              </UFormField>
              <UFormField label="Active">
                <USwitch
                  v-model="row.active"
                  :aria-label="`${label(row)} is active`"
                />
              </UFormField>
              <UButton
                v-if="manage && !savedCodes.has(row.code)"
                class="self-start md:mt-6"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Remove ${label(row)}`"
                @click="removeScenario(row)"
              />
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="Description">
              <UTextarea
                v-model="row.description"
                class="w-full"
                :rows="2"
                autoresize
                :aria-label="`Description of ${label(row)}`"
              />
            </UFormField>
            <p class="text-xs text-muted">
              {{ conditionTitle(row.condition_code) }}
            </p>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[56rem] text-sm">
                <caption class="sr-only">
                  Procedures of {{ label(row) }}
                </caption>
                <thead class="bg-muted text-left text-xs uppercase text-muted">
                  <tr>
                    <th class="w-48 px-3 py-2">
                      Name
                    </th>
                    <th class="px-3 py-2">
                      Procedure
                    </th>
                    <th class="w-40 px-3 py-2">
                      Form
                    </th>
                    <th class="w-48 px-3 py-2">
                      PIC
                    </th>
                    <th class="w-20 px-3 py-2">
                      Active
                    </th>
                    <th class="w-12 px-3 py-2" />
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="(procedure, index) in row.procedures"
                    :key="index"
                  >
                    <td class="px-3 py-2 align-top">
                      <UInput
                        v-model="procedure.name"
                        class="w-full"
                        maxlength="255"
                        :aria-label="`Name of procedure ${index + 1} of ${label(row)}`"
                      />
                    </td>
                    <td class="px-3 py-2 align-top">
                      <UTextarea
                        v-model="procedure.procedure"
                        class="w-full"
                        :rows="4"
                        autoresize
                        :aria-label="`Procedure ${index + 1} of ${label(row)}`"
                      />
                    </td>
                    <td class="px-3 py-2 align-top">
                      <UTextarea
                        v-model="procedure.form"
                        class="w-full"
                        :rows="2"
                        autoresize
                        :aria-label="`Form of procedure ${index + 1} of ${label(row)}`"
                      />
                    </td>
                    <td class="px-3 py-2 align-top">
                      <UInput
                        v-model="procedure.pic"
                        class="w-full"
                        maxlength="255"
                        :aria-label="`PIC of procedure ${index + 1} of ${label(row)}`"
                      />
                    </td>
                    <td class="px-3 py-2 align-top">
                      <USwitch
                        v-model="procedure.active"
                        :aria-label="`Procedure ${index + 1} of ${label(row)} is active`"
                      />
                    </td>
                    <td class="px-3 py-2 text-right align-top">
                      <UButton
                        v-if="manage && row.procedures.length > 1"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        :aria-label="`Remove procedure ${index + 1} of ${label(row)}`"
                        @click="row.procedures.splice(index, 1)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UButton
              v-if="manage"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              label="Add procedure"
              :aria-label="`Add procedure to ${label(row)}`"
              @click="addProcedure(row)"
            />
          </div>
        </UCard>
        <p
          v-if="!shown.length"
          class="py-6 text-center text-sm text-muted"
        >
          No scenario for this condition yet.
        </p>
        <UButton
          v-if="manage"
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add scenario"
          @click="addScenario"
        />
      </fieldset>
    </div>
  </AppPage>
</template>
