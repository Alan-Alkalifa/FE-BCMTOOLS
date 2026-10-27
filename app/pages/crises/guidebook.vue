<script setup lang="ts">
import type { RaPlaybookEntry, RaPlaybookPhase } from '~/composables/useRa'

/**
 * BCM's standard incident steps for each of the 33 hazards. Every incident shows the steps of its
 * hazard. The module ships starter steps; BCM (ra.manage) reviews and replaces them.
 */
definePageMeta({ permission: 'ra.access' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data, status, error, refresh } = useRaPlaybook()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const groups = computed(() => {
  const byCategory = new Map<string, { code: string, label: string, items: RaPlaybookEntry[] }>()
  for (const item of data.value?.items ?? []) {
    const key = item.category?.code ?? '-'
    if (!byCategory.has(key)) byCategory.set(key, { code: key, label: item.category?.label ?? 'Other', items: [] })
    byCategory.get(key)!.items.push(item)
  }
  return [...byCategory.values()]
})

/** Hazard groups fold like an accordion: all closed when the page loads, one open at a time. */
const openGroup = ref<string | null>(null)
function isOpen(code: string) {
  return openGroup.value === code
}
function toggleGroup(code: string) {
  openGroup.value = isOpen(code) ? null : code
}

const selectedCode = computed({
  get: () => (typeof route.query.hazard === 'string' ? route.query.hazard : data.value?.items[0]?.code),
  set: (code) => router.replace({ query: { ...route.query, hazard: code } }),
})
const selected = computed(() => data.value?.items.find((item) => item.code === selectedCode.value) ?? null)

const editing = ref(false)
const draft = reactive<Record<RaPlaybookPhase, string>>({ immediate: '', stabilise: '', recover: '' })
const formError = ref<string | null>(null)

function startEditing() {
  if (!selected.value) return
  for (const phase of RA_PLAYBOOK_PHASES) draft[phase.value] = selected.value.steps[phase.value].join('\n')
  formError.value = null
  editing.value = true
}

watch(selectedCode, () => {
  editing.value = false
})

async function save() {
  if (!selected.value) return
  formError.value = null
  const steps = RA_PLAYBOOK_PHASES.flatMap((phase) => draft[phase.value]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ phase: phase.value, text })))
  try {
    const saved = await raCrisisApi.savePlaybook(selected.value.code, steps)
    if (data.value) {
      data.value = { ...data.value, items: data.value.items.map((item) => (item.code === saved.code ? saved : item)) }
    }
    editing.value = false
    toast.add({ title: 'Guidebook steps saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    formError.value = apiErrorMessage(err)
  }
}
</script>

<template>
  <AppPage
    title="Incident guidebook"
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: 'Incident guidebook' }]"
  >
    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the incident guidebook"
      class="space-y-6"
    >
      <SkeletonCard :lines="8" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the incident guidebook"
      :description="apiErrorMessage(error)"
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

    <template v-else-if="data">
      <p class="text-sm text-muted">
        BCM's standard steps for each hazard, shown with every incident of that hazard next to the
        affected place's own RA, contacts and call tree.
      </p>

      <div class="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <UCard :ui="{ body: 'p-2 sm:p-2' }">
          <nav aria-label="Hazards">
            <div
              v-for="group in groups"
              :key="group.code"
              class="border-b border-default last:border-b-0"
            >
              <h2>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-xs font-medium text-muted uppercase hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-primary"
                  :aria-expanded="isOpen(group.code)"
                  :aria-controls="`hazards-${group.code}`"
                  @click="toggleGroup(group.code)"
                >
                  <span class="min-w-0 flex-1">{{ group.label }}</span>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="size-4 shrink-0 transition-transform"
                    :class="{ '-rotate-180': isOpen(group.code) }"
                  />
                </button>
              </h2>
              <ul
                v-show="isOpen(group.code)"
                :id="`hazards-${group.code}`"
                class="pb-2"
              >
                <li
                  v-for="item in group.items"
                  :key="item.code"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-primary"
                    :class="{ 'bg-elevated font-medium text-highlighted': item.code === selectedCode }"
                    :aria-current="item.code === selectedCode ? 'true' : undefined"
                    @click="selectedCode = item.code"
                  >
                    <span
                      class="min-w-0 flex-1 truncate"
                    >{{ item.short_name }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </UCard>

        <UCard v-if="selected">
          <template #header>
            <div class="min-w-0">
              <h2
                class="text-lg font-semibold"
              >
                {{ selected.short_name }}
              </h2>
              <p class="text-sm text-muted">
                {{ selected.code }} · {{ selected.category?.label }}
                <template v-if="selected.updated_by">
                  · saved by {{ selected.updated_by }}, {{ formatDateTime(selected.updated_at) }}
                </template>
              </p>
            </div>
          </template>

          <UAlert
            v-if="formError"
            class="mb-4"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Couldn't save the steps"
            :description="formError"
          />

          <div
            v-if="editing"
            class="space-y-4"
          >
            <UFormField
              v-for="phase in RA_PLAYBOOK_PHASES"
              :key="phase.value"
              :label="phase.label"
              :help="`${phase.description} One step per line.`"
            >
              <UTextarea
                v-model="draft[phase.value]"
                :rows="4"
                autoresize
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            v-else
            class="grid gap-6 md:grid-cols-3"
          >
            <section
              v-for="phase in RA_PLAYBOOK_PHASES"
              :key="phase.value"
            >
              <h3 class="font-medium text-highlighted">
                {{ phase.label }}
              </h3>
              <p class="text-xs text-muted">
                {{ phase.description }}
              </p>
              <ol
                v-if="selected.steps[phase.value].length"
                class="mt-2 list-decimal space-y-1.5 ps-5 text-sm"
              >
                <li
                  v-for="(step, index) in selected.steps[phase.value]"
                  :key="index"
                >
                  {{ step }}
                </li>
              </ol>
              <p
                v-else
                class="mt-2 text-sm text-muted"
              >
                No steps.
              </p>
            </section>
          </div>

          <template
            v-if="data.can_edit"
            #footer
          >
            <div class="flex justify-end gap-2">
              <template v-if="editing">
                <UButton
                  color="neutral"
                  variant="outline"
                  label="Cancel"
                  @click="editing = false"
                />
                <UButton
                  label="Save steps"
                  loading-auto
                  @click="save"
                />
              </template>
              <UButton
                v-else
                color="neutral"
                variant="outline"
                icon="i-lucide-pencil"
                :label="selected.reviewed ? 'Edit steps' : 'Review and edit steps'"
                @click="startEditing"
              />
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </AppPage>
</template>
