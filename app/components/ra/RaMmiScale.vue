<script setup lang="ts">
/**
 * The Modified Mercalli Intensity (MMI) scale, I to XII, as a reference above the earthquake
 * list. BMKG's "Felt" gives the intensity per place on this scale (e.g. "III Kab. Manggarai").
 * The colours are the USGS ShakeMap colours.
 */
const LEVELS = [
  { level: 'I', color: '#ffffff', shaking: 'Not felt', effect: 'Felt only by instruments.' },
  { level: 'II', color: '#bfccff', shaking: 'Weak', effect: 'Felt by a few people at rest.' },
  { level: 'III', color: '#a0e6ff', shaking: 'Weak', effect: 'Felt indoors, like a passing truck.' },
  { level: 'IV', color: '#80ffff', shaking: 'Light', effect: 'Felt indoors by many. Windows rattle.' },
  { level: 'V', color: '#7aff93', shaking: 'Moderate', effect: 'Felt by nearly all. Small objects fall.' },
  { level: 'VI', color: '#ffff00', shaking: 'Strong', effect: 'Furniture moves. Light damage.' },
  { level: 'VII', color: '#ffc800', shaking: 'Very strong', effect: 'Hard to stand. Weak buildings damaged.' },
  { level: 'VIII', color: '#ff9100', shaking: 'Severe', effect: 'Considerable damage to ordinary buildings.' },
  { level: 'IX', color: '#ff0000', shaking: 'Violent', effect: 'Heavy damage. Buildings shift.' },
  { level: 'X', color: '#c80000', shaking: 'Extreme', effect: 'Most masonry buildings destroyed.' },
  { level: 'XI', color: '#800000', shaking: 'Extreme', effect: 'Few buildings left standing.' },
  { level: 'XII', color: '#400000', shaking: 'Extreme', effect: 'Total destruction.' },
]
</script>

<template>
  <section
    class="rounded-lg border border-default bg-default p-4"
    aria-labelledby="mmi-title"
    data-testid="mmi-scale"
  >
    <h2
      id="mmi-title"
      class="mb-3 font-semibold text-highlighted"
    >
      Modified Mercalli Intensity (MMI)
    </h2>
    <ol class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12">
      <li
        v-for="item in LEVELS"
        :key="item.level"
        class="overflow-hidden rounded-md border border-default"
      >
        <div
          class="h-2 border-b border-default"
          :style="{ backgroundColor: item.color }"
          aria-hidden="true"
        />
        <div class="space-y-0.5 p-2">
          <p class="text-sm">
            <span class="font-semibold text-highlighted">{{ item.level }}</span>
            <span class="text-muted"> · {{ item.shaking }}</span>
          </p>
          <p class="text-xs text-muted">
            {{ item.effect }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
