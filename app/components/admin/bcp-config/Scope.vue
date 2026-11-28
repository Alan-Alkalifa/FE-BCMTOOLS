<script setup lang="ts">
import type { BcpConfigVersion } from '~/composables/useBcpConfigAdmin'

/**
 * Which BIA function categories make a Group write a BCP, which ones get a workaround (chapter 6)
 * and a recovery priority (5.1), and how chapter 4 lists the categories.
 */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'scope', (saved) => emit('saved', saved), 'Scope saved')
const categories = computed(() => draft.value.chapter_categories.map((row) => row.category).filter(Boolean))

function add() {
  draft.value.chapter_categories.push({ category: '', title: '', definition: '' })
}
function remove(index: number) {
  const [row] = draft.value.chapter_categories.splice(index, 1)
  if (!row) return
  draft.value.required_categories = draft.value.required_categories.filter((value) => value !== row.category)
  draft.value.workaround_categories = draft.value.workaround_categories.filter((value) => value !== row.category)
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Scope and triggers"
    description="A Group writes a BCP when its final BIA has a function in a category below. The categories are the BIA's (Master data › Master MTD)."
    save-label="Save scope"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField
        label="Categories that need a BCP"
        name="required_categories"
        required
        help="A final BIA with at least one function in these categories lets its Group create a BCP."
      >
        <USelectMenu
          v-model="draft.required_categories"
          :items="categories"
          multiple
          class="w-full"
          aria-label="Categories that need a BCP"
        />
      </UFormField>
      <UFormField
        label="Categories with a workaround and recovery priority"
        name="workaround_categories"
        required
        help="Chapter 6 (workaround) and 5.1 (recovery priority) list the functions in these categories."
      >
        <USelectMenu
          v-model="draft.workaround_categories"
          :items="categories"
          multiple
          class="w-full"
          aria-label="Categories with a workaround and recovery priority"
        />
      </UFormField>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">
        Chapter 4 categories
      </h3>
      <p class="text-sm text-muted">
        In this order, each with its heading and the sentence that defines it.
      </p>
      <div
        v-for="(row, index) in draft.chapter_categories"
        :key="index"
        class="grid gap-3 rounded-md border border-default p-3 md:grid-cols-[12rem_14rem_minmax(0,1fr)_auto]"
      >
        <UFormField
          label="BIA category"
          required
        >
          <UInput
            v-model="row.category"
            class="w-full"
            maxlength="255"
            :aria-label="`BIA category ${index + 1}`"
          />
        </UFormField>
        <UFormField
          label="Heading"
          required
        >
          <UInput
            v-model="row.title"
            class="w-full"
            maxlength="255"
            :aria-label="`Heading of ${row.category || `category ${index + 1}`}`"
          />
        </UFormField>
        <UFormField label="Definition">
          <UTextarea
            v-model="row.definition"
            class="w-full"
            :rows="3"
            autoresize
            :aria-label="`Definition of ${row.category || `category ${index + 1}`}`"
          />
        </UFormField>
        <UButton
          v-if="version.can.edit"
          class="self-start md:mt-6"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="`Remove ${row.category || `category ${index + 1}`}`"
          @click="remove(index)"
        />
      </div>
      <UButton
        v-if="version.can.edit && draft.chapter_categories.length < 5"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add category"
        @click="add"
      />
    </div>
  </AdminBcpConfigPartForm>
</template>
