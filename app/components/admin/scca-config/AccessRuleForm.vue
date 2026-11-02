<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import type { SccaAccessOptions, SccaAccessRule, SccaAccessRuleInput } from '~/composables/useSccaConfigAdmin'

/** SCCA configuration > Access scope: add or change one rule. */
const props = defineProps<{ rule: SccaAccessRule | null, options: SccaAccessOptions }>()
const emit = defineEmits<{ close: [saved?: SccaAccessRule] }>()

const toast = useToast()
const form = reactive<SccaAccessRuleInput>({
  name: props.rule?.name ?? '',
  levels: [...(props.rule?.levels ?? [])],
  directorates: [...(props.rule?.directorates ?? [])],
  reasons: [...(props.rule?.reasons ?? props.options.reasons.map((item) => item.code))],
  categories: [...(props.rule?.categories ?? [])],
  renewal_statuses: [...(props.rule?.renewal_statuses ?? [])],
  can_generate: props.rule?.can_generate ?? false,
  contributor_levels: [...(props.rule?.contributor_levels ?? ['D-2'])],
  user_ids: [...(props.rule?.user_ids ?? [])],
  valid_from: props.rule?.valid_from ?? null,
  valid_until: props.rule?.valid_until ?? null,
  is_active: props.rule?.is_active ?? true,
})
/** Who: organization levels, or named users (then with an end date). */
const who = ref<'levels' | 'users'>(props.rule?.user_ids.length ? 'users' : 'levels')
const ownDirectorate = ref(!(props.rule?.directorates.length))
const users = ref(props.rule?.users ?? [])
const nextUser = ref<number | null>(null)
const busy = ref(false)
const errors = ref<Record<string, string>>({})

const levelItems = computed(() => props.options.levels)
const directorateItems = computed(() => props.options.directorates)
const reasonItems = computed(() => props.options.reasons.map((item) => ({ label: item.label, value: item.code })))
const categoryItems = computed(() => props.options.categories.map((code) => ({ label: sccaCategory[code as SccaCategory]?.label ?? code, value: code })))
const statusItems = computed(() => props.options.renewal_statuses.map((item) => ({ label: item.label, value: item.code })))
const annualSelected = computed(() => form.reasons.some((code) => /annual|renew/i.test(code)))

function dateModel(key: 'valid_from' | 'valid_until') {
  return computed<CalendarDate | undefined>({
    get: () => (form[key] ? parseDate(form[key]!) : undefined),
    set: (value) => (form[key] = value ? value.toString() : null),
  })
}
const validFrom = dateModel('valid_from')
const validUntil = dateModel('valid_until')

function addUser(user: { id: number, display_name: string | null, email: string | null } | null) {
  if (!user || users.value.some((row) => row.id === user.id)) return
  users.value = [...users.value, { id: user.id, name: user.display_name || user.email || `#${user.id}` }]
  nextTick(() => (nextUser.value = null))
}
function removeUser(id: number) {
  users.value = users.value.filter((row) => row.id !== id)
}

async function save() {
  errors.value = {}
  busy.value = true
  const body: SccaAccessRuleInput = {
    ...form,
    name: form.name.trim(),
    levels: who.value === 'levels' ? form.levels : [],
    user_ids: who.value === 'users' ? users.value.map((row) => row.id) : [],
    directorates: ownDirectorate.value ? [] : form.directorates,
  }
  try {
    const saved = props.rule ? await sccaAccessApi.update(props.rule.id, body) : await sccaAccessApi.create(body)
    toast.add({ title: props.rule ? 'Rule saved' : 'Rule added', description: 'It applies right away.', color: 'success', icon: 'i-lucide-circle-check' })
    emit('close', saved)
  } catch (failure) {
    const data = (failure as { data?: { details?: Record<string, string>, message?: string } }).data
    errors.value = data?.details ? Object.fromEntries(Object.entries(data.details).map(([key, value]) => [key.split('.')[0]!, value])) : { form: data?.message ?? apiErrorMessage(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :title="rule ? `Edit ${rule.name}` : 'New access rule'"
    description="Outside BCM, users pick, see and generate only for the applications an active rule opens to them."
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <form
        id="scca-access-rule-form"
        class="space-y-5"
        novalidate
        @submit.prevent="save"
      >
        <UAlert
          v-if="errors.form || errors.rule"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form || errors.rule"
        />
        <UFormField
          label="Name"
          name="name"
          required
          :error="errors.name"
        >
          <UInput
            v-model="form.name"
            maxlength="120"
            class="w-full"
            placeholder="e.g. D-3 overdue annual reviews"
          />
        </UFormField>

        <fieldset class="space-y-3">
          <legend class="text-sm font-medium text-highlighted">
            Who
          </legend>
          <URadioGroup
            v-model="who"
            orientation="horizontal"
            :items="[
              { value: 'levels', label: 'Organization levels' },
              { value: 'users', label: 'Specific users' },
            ]"
          />
          <UFormField
            v-if="who === 'levels'"
            name="levels"
            help="Users of these levels (Administration > Users > Organization level)."
            :error="errors.levels"
          >
            <USelectMenu
              v-model="form.levels"
              :items="levelItems"
              multiple
              create-item
              placeholder="Pick levels"
              class="w-full"
              aria-label="Organization levels"
              @create="(item: string) => form.levels.push(item)"
            />
          </UFormField>
          <template v-else>
            <UFormField
              name="user_ids"
              help="A rule for named users needs a Valid until date."
              :error="errors.user_ids || errors.levels"
            >
              <UserPicker
                v-model="nextUser"
                permission="scca.access"
                placeholder="Add a user"
                aria-label="Add a user"
                @pick="addUser"
              />
            </UFormField>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="user in users"
                :key="user.id"
                color="neutral"
                variant="subtle"
              >
                {{ user.name }}
                <UButton
                  color="neutral"
                  variant="link"
                  size="xs"
                  icon="i-lucide-x"
                  :aria-label="`Remove ${user.name}`"
                  @click="removeUser(user.id)"
                />
              </UBadge>
            </div>
          </template>
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="text-sm font-medium text-highlighted">
            Which applications
          </legend>
          <USwitch
            v-model="ownDirectorate"
            label="The user's own directorate"
            description="Off: the directorates picked below, whatever the user's own."
          />
          <UFormField
            v-if="!ownDirectorate"
            name="directorates"
            :error="errors.directorates"
          >
            <USelectMenu
              v-model="form.directorates"
              :items="directorateItems"
              multiple
              placeholder="Pick directorates"
              class="w-full"
              aria-label="Directorates"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Reasons"
              name="reasons"
              required
              :error="errors.reasons"
            >
              <USelectMenu
                v-model="form.reasons"
                value-key="value"
                :items="reasonItems"
                multiple
                :search-input="false"
                class="w-full"
                aria-label="Reasons"
              />
            </UFormField>
            <UFormField
              label="Categories"
              name="categories"
              help="Empty: every category."
              :error="errors.categories"
            >
              <USelectMenu
                v-model="form.categories"
                value-key="value"
                :items="categoryItems"
                multiple
                :search-input="false"
                placeholder="Every category"
                class="w-full"
                aria-label="Categories"
              />
            </UFormField>
            <UFormField
              label="Renewal status"
              name="renewal_statuses"
              :help="annualSelected ? 'Annual review only. Empty: every status.' : 'Applies to an Annual review only.'"
              :error="errors.renewal_statuses"
            >
              <USelectMenu
                v-model="form.renewal_statuses"
                value-key="value"
                :items="statusItems"
                multiple
                :search-input="false"
                placeholder="Every status"
                class="w-full"
                aria-label="Renewal status"
              />
            </UFormField>
            <UFormField
              label="Contributor levels"
              name="contributor_levels"
              help="Who may be the contributor of an annual review they generate (any directorate)."
              :error="errors.contributor_levels"
            >
              <USelectMenu
                v-model="form.contributor_levels"
                :items="levelItems"
                multiple
                class="w-full"
                aria-label="Contributor levels"
              />
            </UFormField>
          </div>
          <USwitch
            v-model="form.can_generate"
            label="Can generate annual reviews"
            description="Monitoring > Renewals > Generate annual review, for the applications this rule opens."
          />
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="text-sm font-medium text-highlighted">
            When
          </legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Valid from"
              name="valid_from"
              :error="errors.valid_from"
            >
              <DatePicker
                v-model="validFrom"
                class="w-full"
                placeholder="From today"
                aria-label="Valid from"
              />
            </UFormField>
            <UFormField
              label="Valid until"
              name="valid_until"
              :required="who === 'users'"
              :error="errors.valid_until"
            >
              <DatePicker
                v-model="validUntil"
                class="w-full"
                placeholder="No end"
                aria-label="Valid until"
              />
            </UFormField>
          </div>
          <USwitch
            v-model="form.is_active"
            label="Active"
            :description="errors.is_active || 'At least one rule stays active.'"
            :color="errors.is_active ? 'error' : 'primary'"
          />
        </fieldset>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close')"
        />
        <UButton
          type="submit"
          form="scca-access-rule-form"
          :label="rule ? 'Save rule' : 'Add rule'"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
