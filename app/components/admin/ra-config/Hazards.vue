<script setup lang="ts">
import type { RaConfigVersion, RaHazardsInput } from '~/composables/useRaConfigAdmin'

/**
 * The hazard groups and the Type of Hazard in each, in order. Codes are kept (incidents and the
 * incident guidebook refer to them); a new hazard or group gets the next free code when saved;
 * a hazard left out is removed from this version only.
 */
const props = defineProps<{ version: RaConfigVersion }>()
const emit = defineEmits<{ saved: [version: RaConfigVersion] }>()

const part = useRaConfigPart<RaHazardsInput>(
  computed(() => props.version),
  (value) => ({
    categories: value.categories.map((category) => ({
      code: category.code,
      name: category.name,
      label: category.label,
      hazards: category.hazards.map((hazard) => ({ code: hazard.code, short_name: hazard.short_name, name: hazard.name })),
    })),
  }),
  (code, value) => raConfigApi.setHazards(code, value),
  (saved) => emit('saved', saved),
  'Hazards saved',
)
const { draft, error, busy, dirty, submit, reset } = part
const editable = computed(() => props.version.can.edit)

/** The running number of each hazard, as the assessment shows it. */
const numbers = computed(() => {
  let number = 0
  return draft.value.categories.map((category) => category.hazards.map(() => ++number))
})

function addHazard(groupIndex: number) {
  draft.value.categories[groupIndex]!.hazards.push({ code: null, short_name: '', name: '' })
}

function removeHazard(groupIndex: number, index: number) {
  draft.value.categories[groupIndex]!.hazards.splice(index, 1)
}

function move(groupIndex: number, index: number, offset: number) {
  const list = draft.value.categories[groupIndex]!.hazards
  const target = index + offset
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item!)
}

function addGroup() {
  draft.value.categories.push({ code: null, name: '', label: '', hazards: [{ code: null, short_name: '', name: '' }] })
}

function removeGroup(groupIndex: number) {
  draft.value.categories.splice(groupIndex, 1)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">
            Hazard groups and Type of Hazard
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-muted">
            The hazards every assessment of this version rates, in order. The short name is the Type of Hazard shown in the tables; the full name is shown on the hazard's page.
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
            label="Save hazards"
            :disabled="!dirty"
            :loading="busy"
            @click="submit"
          />
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't save the hazards"
        :ui="{ description: 'whitespace-pre-line' }"
        :description="error"
      />

      <fieldset
        v-for="(category, groupIndex) in draft.categories"
        :key="category.code ?? `new-${groupIndex}`"
        :disabled="!editable"
        class="space-y-3 rounded-lg border border-default p-4"
      >
        <legend class="px-1 text-sm font-medium text-muted">
          {{ category.code ?? 'New group' }}
        </legend>
        <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <UFormField
            label="Hazard group name"
            :name="`categories.${groupIndex}.name`"
            required
          >
            <UInput
              v-model="category.name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="English label"
            :name="`categories.${groupIndex}.label`"
            required
          >
            <UInput
              v-model="category.label"
              class="w-full"
            />
          </UFormField>
          <div class="flex items-end">
            <UTooltip
              v-if="editable"
              text="Remove group"
            >
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Remove the group ${category.label || category.name || groupIndex + 1}`"
                @click="removeGroup(groupIndex)"
              />
            </UTooltip>
          </div>
        </div>
        <ol class="space-y-2">
          <li
            v-for="(hazard, index) in category.hazards"
            :key="hazard.code ?? `new-${groupIndex}-${index}`"
            class="grid items-start gap-2 sm:grid-cols-[2.5rem_minmax(0,14rem)_minmax(0,1fr)_auto]"
          >
            <span class="pt-2 text-right text-sm text-muted tabular-nums">{{ numbers[groupIndex]?.[index] }}</span>
            <UInput
              v-model="hazard.short_name"
              :aria-label="`Type of Hazard ${numbers[groupIndex]?.[index]}`"
              placeholder="Type of Hazard"
              class="w-full"
            />
            <UTextarea
              v-model="hazard.name"
              :aria-label="`Full name of hazard ${numbers[groupIndex]?.[index]}`"
              placeholder="Full name"
              :rows="1"
              autoresize
              class="w-full"
            />
            <div
              v-if="editable"
              class="flex gap-1"
            >
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-arrow-up"
                :disabled="index === 0"
                :aria-label="`Move hazard ${numbers[groupIndex]?.[index]} up`"
                @click="move(groupIndex, index, -1)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-arrow-down"
                :disabled="index === category.hazards.length - 1"
                :aria-label="`Move hazard ${numbers[groupIndex]?.[index]} down`"
                @click="move(groupIndex, index, 1)"
              />
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-x"
                :disabled="category.hazards.length === 1"
                :aria-label="`Remove hazard ${numbers[groupIndex]?.[index]}`"
                @click="removeHazard(groupIndex, index)"
              />
            </div>
          </li>
        </ol>
        <UButton
          v-if="editable"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          label="Add hazard"
          @click="addHazard(groupIndex)"
        />
      </fieldset>

      <UButton
        v-if="editable"
        color="neutral"
        variant="outline"
        icon="i-lucide-folder-plus"
        label="Add hazard group"
        @click="addGroup"
      />
    </div>
  </UCard>
</template>
