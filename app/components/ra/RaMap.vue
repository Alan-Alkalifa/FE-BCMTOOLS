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
  /** Rings: a distance around the selected place, or a disaster's affected area. */
  circles?: RaMapCircle[]
  /** A dashed line between two places, e.g. the distance being measured. */
  line?: [RaPin, RaPin] | null
  editable?: boolean
  /** Accessible name of the map region. */
  label: string
  selected?: number | null
  heightClass?: string
  /** Refit the view whenever the markers or rings change (off where the user is placing a pin). */
  autoFit?: boolean
  /** Move the view to the pin when it jumps far (typed coordinates, a reset). */
  recentre?: boolean
  /** The editable pin's look: a building pin, or a disaster point. */
  pinVariant?: 'location' | 'crisis'
  /** The crisis point's name, e.g. "Incident point" (default "Disaster point"). */
  pinLabel?: string
  /** Zoom with the mouse wheel or trackpad (off by default, so scrolling the page never gets
   *  caught by a map). The + and - buttons and double-click always zoom. */
  scrollZoom?: boolean
}>(), {
  markers: () => [],
  circles: () => [],
  line: null,
  editable: false,
  selected: null,
  heightClass: 'h-96',
  autoFit: true,
  recentre: true,
  pinVariant: 'location',
  pinLabel: 'Disaster point',
  scrollZoom: false,
})
const pin = defineModel<RaPin | null>('pin', { default: null })
const emit = defineEmits<{ select: [id: number, variant: RaMapMarker['variant']], ready: [] }>()

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

function icon(level: RaMapMarker['level'], active: boolean, approval?: RaPinApproval | null, out = false) {
  const colour = RA_PIN_CLASS[level ?? 'none']
  return L!.divIcon({
    html: raPinHtml(RA_PIN_SVG, approval, out),
    className: `ra-pin ${colour}${active ? ' ra-pin-active' : ''}${approval ? ` ra-pin-${approval}` : ''}`,
    iconSize: [32, 32],
    iconAnchor: [16, 31],
    tooltipAnchor: [0, -28],
  })
}

/** A disaster point: red, or orange while the disaster waits for approval. */
function crisisIcon(pending = false) {
  return L!.divIcon({
    html: RA_CRISIS_SVG,
    className: `ra-pin ra-pin-crisis ${pending ? 'text-warning' : 'text-error'}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [0, -14],
  })
}

/** A BMKG earthquake's epicentre: orange, red from magnitude 6.0. */
function quakeIcon(strong = false) {
  return L!.divIcon({
    html: RA_QUAKE_SVG,
    className: `ra-pin ra-pin-quake ${strong ? 'text-error' : 'text-warning'}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [0, -14],
  })
}

function branchIcon(level: RaMapMarker['level'], active: boolean, approval?: RaPinApproval | null, out = false) {
  const colour = RA_PIN_CLASS[level ?? 'none']
  return L!.divIcon({
    html: raPinHtml(RA_BRANCH_SVG, approval, out),
    className: `ra-pin ${colour}${active ? ' ra-pin-active' : ''}${approval ? ` ra-pin-${approval}` : ''}`,
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
      className: ring.quake
        ? 'ra-radius ra-radius-quake'
        : ring.crisis
          ? `ra-radius ${ring.pending ? 'ra-radius-pending' : 'ra-radius-crisis'}`
          : ring.active ? 'ra-radius ra-radius-active' : 'ra-radius',
      interactive: false,
    }))
  }
  if (props.line) {
    layer.addLayer(L.polyline(props.line.map((point) => [point.lat, point.lng] as [number, number]), {
      className: 'ra-measure',
      interactive: false,
    }))
  }
  for (const item of props.markers) {
    const active = item.variant !== 'crisis' && item.variant !== 'quake' && item.id === props.selected
    const marker = L.marker([item.lat, item.lng], {
      icon: item.variant === 'crisis'
        ? crisisIcon(item.pending)
        : item.variant === 'quake'
          ? quakeIcon(item.strong)
          : item.variant === 'branch'
            ? branchIcon(item.level, active, item.approval, item.outOfService)
            : icon(item.level, active, item.approval, item.outOfService),
      title: item.label,
      alt: item.label,
      keyboard: true,
      riseOnHover: true,
    })
    marker.bindTooltip(tooltip(item.label), { direction: 'top' })
    // Leaflet turns Enter on a focused marker into a click.
    marker.on('click', () => emit('select', item.id, item.variant))
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
    const crisis = props.pinVariant === 'crisis'
    editMarker = L.marker([value.lat, value.lng], {
      icon: crisis ? crisisIcon() : icon('none', true),
      draggable: true,
      keyboard: true,
      zIndexOffset: 1000,
      title: crisis ? `${props.pinLabel}. Drag to move.` : 'Location pin. Drag to move.',
      alt: crisis ? props.pinLabel : 'Location pin',
    }).addTo(map)
    editMarker.on('dragend', () => {
      const position = editMarker!.getLatLng()
      pin.value = round(position.lat, position.lng)
    })
  } else {
    editMarker.setLatLng([value.lat, value.lng])
  }
  if (recentre && props.recentre) map.setView([value.lat, value.lng], Math.max(map.getZoom(), PIN_ZOOM))
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
    scrollWheelZoom: props.scrollZoom,
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
  // An editable map opened on an existing pin (updating a disaster) shows that pin's area
  // (the parent fits it on `ready`), not every place.
  drawMarkers(!(props.editable && pin.value && !props.autoFit))
  drawPin(true)
  // Someone moving the map ends a view asked for with fit(): the map then stays where they put it.
  container.value.addEventListener('pointerdown', dropWanted)
  container.value.addEventListener('wheel', dropWanted, { passive: true })
  emit('ready')
}

// A map opened in a dialog starts while the dialog animates: re-measure when its size settles.
let resizeObserver: ResizeObserver | undefined
/** The area asked for with fit(), kept while the map settles: a dialog still animating changes
 *  the map's size after the fit, which would leave the area off-centre or out of view. */
let wanted: import('leaflet').LatLngBounds | undefined
const FIT_OPTIONS = { padding: [60, 60] as [number, number], maxZoom: 16 }
function dropWanted() {
  wanted = undefined
}
function onResize() {
  if (!map) return
  map.invalidateSize({ animate: false })
  if (wanted) map.fitBounds(wanted, { ...FIT_OPTIONS, animate: false })
}
// Printing lays the page out at the paper's width: re-measure so the tiles fill it.
function onPrint() {
  map?.invalidateSize({ animate: false })
}
onMounted(() => {
  init()
  window.addEventListener('beforeprint', onPrint)
  window.addEventListener('afterprint', onPrint)
  if (container.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container.value)
  }
})
watch(settings, () => init())
watch(() => props.scrollZoom, (on) => {
  if (on) map?.scrollWheelZoom.enable()
  else map?.scrollWheelZoom.disable()
})
watch(() => [props.markers, props.circles], () => drawMarkers(props.autoFit), { deep: true })
watch(() => props.line, () => drawMarkers(false), { deep: true })
watch(() => props.selected, () => drawMarkers(false))
watch(pin, (value, previous) => {
  // Typed or reset coordinates move the view; a click or drag already shows the spot.
  const moved = !previous || !value || Math.abs(value.lat - previous.lat) > 0.01 || Math.abs(value.lng - previous.lng) > 0.01
  drawPin(moved)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  container.value?.removeEventListener('pointerdown', dropWanted)
  container.value?.removeEventListener('wheel', dropWanted)
  window.removeEventListener('beforeprint', onPrint)
  window.removeEventListener('afterprint', onPrint)
  if (map) {
    // Leaflet ends a zoom animation from a 250 ms timer that remove() doesn't cancel: leaving the
    // page (or closing a dialog) mid-zoom made that timer read the removed map pane ("Cannot read
    // properties of undefined (reading '_leaflet_pos')"). Stop any pan, mark the zoom as done so
    // the timer does nothing, drop the listeners, then remove the map.
    map.stop()
    ;(map as unknown as { _animatingZoom?: boolean })._animatingZoom = false
    map.off()
    map.remove()
  }
  map = undefined
})

defineExpose({
  /** Zoom to a marker, e.g. when it is picked from the list next to the map. */
  focus(pinToShow: RaPin) {
    wanted = undefined
    map?.setView([pinToShow.lat, pinToShow.lng], Math.max(map.getZoom(), 15))
  },
  /** Show all of these points, e.g. the two ends of a measured distance. */
  fit(pins: RaPin[]) {
    if (!L || !map || !pins.length) return
    wanted = L.latLngBounds(pins.map((item) => [item.lat, item.lng] as [number, number]))
    map.fitBounds(wanted, FIT_OPTIONS)
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

.ra-radius-crisis {
  stroke: var(--ui-error);
  stroke-width: 2;
  fill: var(--ui-error);
  fill-opacity: 0.1;
}

/* A disaster waiting for approval: orange and dashed, so it reads as "not confirmed yet"
   without colour too. */
.ra-radius-pending {
  stroke: var(--ui-warning);
  stroke-width: 2;
  stroke-dasharray: 8 5;
  fill: var(--ui-warning);
  fill-opacity: 0.1;
}

/* A BMKG earthquake's alert radius around the selected epicentre: orange and dotted. */
.ra-radius-quake {
  stroke: var(--ui-warning);
  stroke-width: 2;
  stroke-dasharray: 2 6;
  stroke-linecap: round;
  fill: var(--ui-warning);
  fill-opacity: 0.05;
}

.ra-measure {
  stroke: var(--ui-primary);
  stroke-width: 3;
  stroke-dasharray: 8 6;
  fill: none;
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
