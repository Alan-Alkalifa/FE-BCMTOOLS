<script setup lang="ts">
import type { Map as LeafletMap, Marker, LeafletMouseEvent } from 'leaflet'
import type { RaMapCircle, RaMapMarker, RaPin } from '~/composables/useRa'
import 'leaflet/dist/leaflet.css'

/**
 * A Leaflet map of RA locations. Read-only markers (the register, an assessment), or, with
 * `editable`, one pin the user places by clicking the map or dragging it (v-model:pin).
 * Leaflet is loaded on first use, so pages without a map don't download it.
 *
 * The map is a supplement: every place on it is also listed in text next to it.
 */
const props = withDefaults(defineProps<{
  markers?: RaMapMarker[]
  /** Radius rings, e.g. 5 km around each building when nearby branches are shown. */
  circles?: RaMapCircle[]
  editable?: boolean
  /** Accessible name of the map region. */
  label: string
  selected?: number | null
  heightClass?: string
}>(), {
  markers: () => [],
  circles: () => [],
  editable: false,
  selected: null,
  heightClass: 'h-96',
})
const pin = defineModel<RaPin | null>('pin', { default: null })
const emit = defineEmits<{ select: [id: number] }>()

const { data: settings, error: settingsError } = useRaMapSettings()
const container = useTemplateRef<HTMLDivElement>('container')
const tilesFailed = ref(false)
const loadFailed = ref(false)

/** Indonesia, for a map with nothing on it yet. */
const DEFAULT_VIEW = { center: [-2.5, 118] as [number, number], zoom: 5 }
const PIN_ZOOM = 17

let L: typeof import('leaflet') | undefined
let map: LeafletMap | undefined
let layer: import('leaflet').LayerGroup | undefined
let editMarker: Marker | undefined

const PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">'
  + '<path fill="currentColor" stroke="white" stroke-width="1.5" d="M12 1.75c-4.28 0-7.75 3.4-7.75 7.6 0 5.37 6.6 11.9 7.2 12.48a.8.8 0 0 0 1.1 0c.6-.58 7.2-7.1 7.2-12.48 0-4.2-3.47-7.6-7.75-7.6Z"/>'
  + '<circle cx="12" cy="9.5" r="2.75" fill="white"/></svg>'

function icon(level: RaMapMarker['level'], active: boolean) {
  const colour = RA_PIN_CLASS[level ?? 'none']
  return L!.divIcon({
    html: PIN_SVG,
    className: `ra-pin ${colour}${active ? ' ra-pin-active' : ''}`,
    iconSize: [32, 32],
    iconAnchor: [16, 31],
    tooltipAnchor: [0, -28],
  })
}

/** A branch shown next to the buildings: a rounded square with a bank glyph, so it reads
 *  differently from a building pin even without colour. */
const BRANCH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">'
  + '<rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="currentColor" stroke="white" stroke-width="1.5"/>'
  + '<path fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 17.5h12M7.5 15v-4.5M10.5 15v-4.5M13.5 15v-4.5M16.5 15v-4.5M5.5 9 12 5.5 18.5 9Z"/>'
  + '</svg>'

function branchIcon(level: RaMapMarker['level'], active: boolean) {
  const colour = RA_PIN_CLASS[level ?? 'none']
  return L!.divIcon({
    html: BRANCH_SVG,
    className: `ra-pin ${colour}${active ? ' ra-pin-active' : ''}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [0, -12],
  })
}

/** Tooltips take a DOM node, so names are never parsed as HTML. */
function tooltip(text: string) {
  const element = document.createElement('span')
  element.textContent = text
  return element
}

function drawMarkers(fit: boolean) {
  if (!L || !map || !layer) return
  layer.clearLayers()
  for (const ring of props.circles) {
    layer.addLayer(L.circle([ring.lat, ring.lng], {
      radius: ring.radiusM,
      className: ring.active ? 'ra-radius ra-radius-active' : 'ra-radius',
      interactive: false,
    }))
  }
  for (const item of props.markers) {
    const branch = item.variant === 'branch'
    const active = item.id === props.selected
    const marker = L.marker([item.lat, item.lng], {
      icon: branch ? branchIcon(item.level, active) : icon(item.level, active),
      title: item.label,
      alt: item.label,
      keyboard: true,
      riseOnHover: true,
    })
    marker.bindTooltip(tooltip(item.label), { direction: 'top' })
    // Leaflet turns Enter on a focused marker into a click.
    marker.on('click', () => emit('select', item.id))
    layer.addLayer(marker)
  }
  if (!fit) return
  const bounds = L.latLngBounds(props.markers.map((item) => [item.lat, item.lng]))
  for (const ring of props.circles) bounds.extend(L.latLng(ring.lat, ring.lng).toBounds(ring.radiusM * 2))
  if (props.markers.length === 1 && !props.circles.length) {
    map.setView([props.markers[0]!.lat, props.markers[0]!.lng], PIN_ZOOM)
  } else if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }
}

function drawPin(recentre: boolean) {
  if (!L || !map || !props.editable) return
  const value = pin.value
  if (!value) {
    editMarker?.remove()
    editMarker = undefined
    return
  }
  if (!editMarker) {
    editMarker = L.marker([value.lat, value.lng], {
      icon: icon('none', true),
      draggable: true,
      keyboard: true,
      title: 'Location pin. Drag to move.',
      alt: 'Location pin',
    }).addTo(map)
    editMarker.on('dragend', () => {
      const position = editMarker!.getLatLng()
      pin.value = round(position.lat, position.lng)
    })
  } else {
    editMarker.setLatLng([value.lat, value.lng])
  }
  if (recentre) map.setView([value.lat, value.lng], Math.max(map.getZoom(), PIN_ZOOM))
}

function round(lat: number, lng: number): RaPin {
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

async function init() {
  if (map || !container.value || !settings.value) return
  try {
    const module = await import('leaflet')
    L = (module as unknown as { default?: typeof import('leaflet') }).default ?? module
  } catch {
    loadFailed.value = true
    return
  }
  if (!container.value) return
  map = L.map(container.value, {
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    scrollWheelZoom: false,
    keyboard: true,
  })
  L.tileLayer(settings.value.tile_url, {
    attribution: settings.value.attribution,
    maxZoom: settings.value.max_zoom,
  })
    .on('tileerror', () => (tilesFailed.value = true))
    .on('tileload', () => (tilesFailed.value = false))
    .addTo(map)
  map.attributionControl.setPrefix(false)
  layer = L.layerGroup().addTo(map)
  if (props.editable) {
    map.on('click', (event: LeafletMouseEvent) => {
      pin.value = round(event.latlng.lat, event.latlng.lng)
    })
  }
  drawMarkers(true)
  drawPin(true)
}

onMounted(init)
watch(settings, () => init())
watch(() => [props.markers, props.circles], () => drawMarkers(true), { deep: true })
watch(() => props.selected, () => drawMarkers(false))
watch(pin, (value, previous) => {
  // Typed or reset coordinates move the view; a click or drag already shows the spot.
  const moved = !previous || !value || Math.abs(value.lat - previous.lat) > 0.01 || Math.abs(value.lng - previous.lng) > 0.01
  drawPin(moved)
})

onBeforeUnmount(() => {
  map?.remove()
  map = undefined
})

defineExpose({
  /** Zoom to a marker, e.g. when it is picked from the list next to the map. */
  focus(pinToShow: RaPin) {
    map?.setView([pinToShow.lat, pinToShow.lng], Math.max(map.getZoom(), 15))
  },
})
</script>

<template>
  <div class="space-y-2">
    <div
      ref="container"
      role="region"
      :aria-label="label"
      class="ra-map isolate z-0 w-full overflow-hidden rounded-md border border-default bg-elevated"
      :class="[heightClass, { 'cursor-crosshair': editable }]"
    />
    <p
      v-if="settingsError || loadFailed"
      class="flex items-center gap-1.5 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-map-pin-off"
        class="size-4 shrink-0"
      />
      The map couldn't be loaded. The coordinates still work.
    </p>
    <p
      v-else-if="tilesFailed"
      class="flex items-center gap-1.5 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-cloud-off"
        class="size-4 shrink-0"
      />
      Map tiles couldn't load from {{ settings?.tile_url.split('/')[2] ?? 'the tile server' }}. Pins still show, but without the street map.
    </p>
  </div>
</template>

<style>
/* Leaflet's panes use z-index 200-1000; `isolate` on the container keeps them under Nuxt UI
   overlays (modals, menus, toasts). */
.ra-pin {
  background: none;
  border: none;
  filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.35));
}

.ra-radius {
  stroke: var(--ui-text-muted);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
  fill: var(--ui-text-muted);
  fill-opacity: 0.06;
}

.ra-radius-active {
  stroke: var(--ui-primary);
  stroke-width: 2;
  fill: var(--ui-primary);
  fill-opacity: 0.08;
}

.ra-pin-active svg {
  transform: scale(1.2);
  transform-origin: 50% 100%;
}

.ra-pin:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
  border-radius: 9999px;
}

.ra-map.leaflet-container {
  font: inherit;
}

.ra-map .leaflet-control-attribution {
  font-size: 0.6875rem;
}
</style>
