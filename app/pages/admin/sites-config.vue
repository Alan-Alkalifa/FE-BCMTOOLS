<script setup lang="ts">
/**
 * Administration > Sites configuration: the live settings of the Sites menu, not versioned.
 * Whether each hazard is a disaster or an incident, BMKG's earthquakes on the building map, and
 * the past disasters that help rate an RA's hazards (BNPB's DIBI, WHO's outbreak news, OpenAQ's
 * air quality, BMKG's weather early warnings). Read with sites.config.view, changed with
 * sites.config.manage.
 */
definePageMeta({ permission: 'sites.config.view' })

const route = useRoute()
const router = useRouter()

const tab = computed<SitesConfigTab>({
  get: () => (SITES_CONFIG_TABS.includes(route.query.tab as SitesConfigTab) ? route.query.tab as SitesConfigTab : 'hazard-types'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'hazard-types' ? undefined : value } }),
})
const tabItems = [
  { label: 'Disaster or incident', value: 'hazard-types', icon: 'i-lucide-split', slot: 'hazard-types' },
  { label: 'Earthquakes', value: 'earthquakes', icon: 'i-lucide-activity', slot: 'earthquakes' },
  { label: 'Past disasters', value: 'past-disasters', icon: 'i-lucide-history', slot: 'past-disasters' },
]
</script>

<template>
  <AppPage
    title="Sites configuration"
    icon="i-lucide-map-pinned"
    description="Disaster or incident per hazard, the earthquakes on the building map and the past disasters."
    :crumbs="[{ label: 'Administration' }, { label: 'Sites configuration' }]"
  >
    <UTabs
      v-model="tab"
      :items="tabItems"
      variant="link"
      class="min-w-0"
      :ui="{ list: 'overflow-x-auto overflow-y-hidden [scrollbar-width:thin]', indicator: 'bottom-0', trigger: 'shrink-0' }"
    >
      <template #hazard-types>
        <AdminSitesConfigHazardTypes class="mt-4" />
      </template>
      <template #earthquakes>
        <AdminSitesConfigEarthquakes class="mt-4" />
      </template>
      <template #past-disasters>
        <AdminSitesConfigPastDisasters class="mt-4" />
        <div class="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <AdminSitesConfigOutbreakNews />
          <AdminSitesConfigAirQuality />
          <AdminSitesConfigWeather />
          <AdminSitesConfigWaqi />
        </div>
      </template>
    </UTabs>
  </AppPage>
</template>
