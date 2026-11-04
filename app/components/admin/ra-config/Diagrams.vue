<script setup lang="ts">
import type { RaDiagramInfo } from '~/composables/useRaConfigAdmin'

/**
 * RA configuration > Team diagrams: the recovery team structure and the location call tree
 * charts of the kind picked above. The location pages open them from the Recovery team and
 * Call tree tabs, and the Excel and PDF downloads print them. By default they are the pictures
 * of the HO workbook's LCP sheets; BCM can upload a PNG or JPEG instead, and go back. Live: not
 * part of a configuration version.
 */
const props = defineProps<{ kind: RaKind }>()

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg']

const toast = useToast()
const confirm = useConfirm()
const { can } = useAuth()
const editable = computed(() => can('ra.config.manage'))
const kindTitle = computed(() => RA_MODULES[props.kind].title)

const { data, status, error, refresh } = useAsyncData(
  () => `ra-config-diagrams-${props.kind}`,
  () => raConfigApi.diagrams(props.kind),
  { watch: [() => props.kind] },
)

const inputs = ref<Partial<Record<RaDiagram, HTMLInputElement | null>>>({})
const busy = ref<string | null>(null)
const errors = ref<Partial<Record<RaDiagram, string>>>({})

function sizeText(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function details(item: RaDiagramInfo) {
  const type = item.content_type === 'image/png' ? 'PNG' : 'JPEG'
  return `${item.width} × ${item.height} px · ${type} · ${sizeText(item.size)}`
}

function replaced(saved: RaDiagramInfo) {
  if (!data.value) return
  data.value = { items: data.value.items.map((item) => (item.diagram === saved.diagram ? saved : item)) }
}

async function onFile(item: RaDiagramInfo, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  errors.value = { ...errors.value, [item.diagram]: undefined }
  if (!TYPES.includes(file.type)) {
    errors.value = { ...errors.value, [item.diagram]: 'Use a PNG or JPEG image.' }
    return
  }
  if (file.size > MAX_BYTES) {
    errors.value = { ...errors.value, [item.diagram]: 'Use an image of 5 MB or less.' }
    return
  }
  busy.value = `upload-${item.diagram}`
  try {
    replaced(await raConfigApi.uploadDiagram(props.kind, item.diagram, file))
    toast.add({ title: `${item.label} replaced`, description: 'The location pages and the downloads use it from now on.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const detail = (failure as { data?: { details?: Record<string, string> } }).data?.details?.file
    errors.value = { ...errors.value, [item.diagram]: detail ?? adminErrorText(failure) }
  } finally {
    busy.value = null
  }
}

async function reset(item: RaDiagramInfo) {
  const ok = await confirm({
    title: `Go back to the workbook's ${item.label.toLowerCase()}?`,
    description: `The uploaded picture (${item.filename}) is removed. ${kindTitle.value} locations and downloads show the picture of the HO workbook's LCP sheet again.`,
    confirmLabel: 'Use the workbook picture',
    destructive: true,
  })
  if (!ok) return
  busy.value = `reset-${item.diagram}`
  try {
    replaced(await raConfigApi.resetDiagram(props.kind, item.diagram))
    errors.value = { ...errors.value, [item.diagram]: undefined }
    toast.add({ title: `${item.label}: workbook picture restored`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-muted">
      The charts {{ kindTitle }} locations open from their Recovery team and Call tree tabs, and the Excel and PDF downloads print. They start as the pictures of the HO workbook's LCP sheets. Changes apply at once: they are not part of a version.
    </p>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the team diagrams"
      :description="adminErrorText(error)"
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
      v-else-if="status === 'pending' && !data"
      class="grid gap-6 xl:grid-cols-2"
    >
      <SkeletonCard :lines="8" />
      <SkeletonCard :lines="8" />
    </div>

    <div
      v-else-if="data"
      class="grid items-start gap-6 xl:grid-cols-2"
    >
      <UCard
        v-for="item in data.items"
        :key="item.diagram"
        :aria-labelledby="`diagram-${item.diagram}`"
        role="region"
      >
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                :id="`diagram-${item.diagram}`"
                class="font-semibold text-highlighted"
              >
                {{ item.label }}
              </h2>
              <p class="text-sm text-muted">
                {{ RA_DIAGRAMS[item.diagram].description }}
              </p>
            </div>
            <UBadge
              :color="item.custom ? 'info' : 'neutral'"
              variant="subtle"
              :icon="item.custom ? 'i-lucide-upload' : 'i-lucide-file-spreadsheet'"
              :label="item.custom ? 'Uploaded' : 'Workbook picture'"
            />
          </div>
        </template>

        <div class="space-y-3">
          <a
            :href="raDiagramUrl(kind, item.diagram, item.version)"
            target="_blank"
            rel="noopener"
            class="block rounded-md border border-default bg-white focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="`Open the ${item.label.toLowerCase()} full size`"
          >
            <img
              :src="raDiagramUrl(kind, item.diagram, item.version)"
              :alt="`${item.label}: ${RA_DIAGRAMS[item.diagram].description}`"
              class="mx-auto max-h-80 w-auto"
            >
          </a>
          <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt class="text-muted">
              Image
            </dt>
            <dd class="tabular-nums">
              {{ details(item) }}
            </dd>
            <dt class="text-muted">
              Source
            </dt>
            <dd v-if="item.custom">
              {{ item.filename }}, uploaded by {{ item.updated_by ?? 'someone' }}<template v-if="item.updated_at">
                on {{ formatDateTime(item.updated_at) }}
              </template>.
            </dd>
            <dd v-else>
              The picture of the HO workbook's LCP sheet.
            </dd>
          </dl>
          <p
            v-if="errors[item.diagram]"
            class="flex items-center gap-1 text-sm text-error"
            role="alert"
          >
            <UIcon
              name="i-lucide-circle-alert"
              class="size-4 shrink-0"
            />
            {{ errors[item.diagram] }}
          </p>
        </div>

        <template
          v-if="editable"
          #footer
        >
          <div class="flex flex-wrap items-center justify-end gap-2">
            <UButton
              v-if="item.custom"
              color="neutral"
              variant="ghost"
              icon="i-lucide-rotate-ccw"
              label="Use the workbook picture"
              :loading="busy === `reset-${item.diagram}`"
              :disabled="Boolean(busy)"
              @click="reset(item)"
            />
            <input
              :ref="(element) => { inputs[item.diagram] = element as HTMLInputElement | null }"
              type="file"
              accept="image/png,image/jpeg"
              class="sr-only"
              tabindex="-1"
              :aria-label="`Choose an image for the ${item.label.toLowerCase()}`"
              @change="onFile(item, $event)"
            >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-upload"
              :label="item.custom ? 'Replace image' : 'Upload image'"
              :aria-label="`${item.custom ? 'Replace' : 'Upload'} the ${item.label.toLowerCase()} image`"
              :loading="busy === `upload-${item.diagram}`"
              :disabled="Boolean(busy)"
              @click="inputs[item.diagram]?.click()"
            />
          </div>
          <p class="mt-2 text-right text-xs text-muted">
            PNG or JPEG, 5 MB or less.
          </p>
        </template>
      </UCard>
    </div>
  </div>
</template>
