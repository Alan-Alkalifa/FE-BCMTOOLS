import type { RaBmkgStatus, RaCrisisType } from '~/composables/useRa'

/**
 * Administration > Sites configuration: the live settings of the Sites menu, not versioned.
 * Whether each hazard is a disaster or an incident, BMKG's earthquakes, and the past disasters
 * (BNPB's DIBI, WHO's outbreak news, OpenAQ's air quality, BMKG's weather early warnings, WAQI's
 * air quality stations, GDELT's disaster news, NASA FIRMS's fire hotspots, GDACS's alerts).
 * Read with sites.config.view, changed with sites.config.manage.
 */
const BASE = '/api/admin/sites-config'

/** Sites configuration > Past disasters: BNPB's DIBI, read on schedule by the backend. */
export interface RaDibiStatus {
  enabled: boolean
  every_days: number
  years: number
  /** The last read that worked. */
  synced_at: string | null
  tried_at: string | null
  /** The years the last read couldn't read, and why. */
  error: string | null
  rows: number
  first: string | null
  last: string | null
  source: string
  /** Every DIBI category read (and those mapped but not read yet), with its RA hazard. */
  categories: { category: string, rows: number, hazard_code: string | null }[]
}

export interface RaDibiInput {
  enabled: boolean
  every_days: number
  years: number
  hazards: Record<string, string | null>
}

/** Sites configuration > Past disasters: WHO's Disease Outbreak News, read daily by the backend. */
export interface RaOutbreakStatus {
  enabled: boolean
  hazard_code: string
  country: string
  synced_at: string | null
  tried_at: string | null
  error: string | null
  rows: number
  first: string | null
  last: string | null
  source: string
}

export interface RaOutbreakInput {
  enabled: boolean
  hazard_code: string
}

/** Sites configuration > Past disasters: OpenAQ's PM2.5 near each building. */
export interface RaAirQualityStatus {
  enabled: boolean
  /** An OpenAQ API key is set on the server. */
  configured: boolean
  hazard_code: string
  threshold: number
  every_days: number
  tried_at: string | null
  error: string | null
  /** Active buildings with coordinates. */
  locations: number
  /** Read within the interval with the current threshold. */
  read: number
  with_station: number
  last_read_at: string | null
  per_run: number
  source: string
}

export interface RaAirQualityInput {
  enabled: boolean
  hazard_code: string
  threshold: number
  every_days: number
}

/** Sites configuration > Past disasters: BMKG's weather early warnings, read with the earthquakes. */
export interface RaWeatherStatus {
  enabled: boolean
  hazard_code: string
  polled_at: string | null
  poll_error: string | null
  stale: boolean
  rows: number
  over_places: number
  active: number
  source: string
  source_url: string
}

export interface RaWeatherInput {
  enabled: boolean
  hazard_code: string
}

/** Sites configuration > Past disasters: GDELT's disaster news, the map's places every hour and
 *  each city's history (Indonesian news) every few days. */
export interface RaGdeltStatus {
  enabled: boolean
  polled_at: string | null
  poll_error: string | null
  stale: boolean
  /** The radius around an incident news place (the map has incident news only). */
  incident_radius_km: number
  /** Each hazard's type (Sites configuration › Disaster or incident). */
  hazard_types: Record<string, RaCrisisType>
  every_days: number
  /** GDELT GKG themes per hazard, for the map. */
  themes: Record<string, string[]>
  /** Keywords per hazard, for the history. */
  keywords: Record<string, string[]>
  default_themes: Record<string, string[]>
  default_keywords: Record<string, string[]>
  themes_url: string
  /** Map places shown: their article's headline names the hazard and the place. */
  points: number
  /** Articles by their title check: kept, left out (the keyword only in the body), waiting. */
  titles: { kept: number, dropped: number, waiting: number }
  history: {
    cities: number
    pairs: number
    read: number
    due: number
    failing: number
    held_from: string | null
    ran_at: string | null
    error: string | null
  }
  source: string
  source_url: string
}

export interface RaGdeltInput {
  enabled: boolean
  incident_radius_km: number
  every_days: number
  themes: Record<string, string[]>
  keywords: Record<string, string[]>
}

/** Sites configuration > Past disasters: Media Cloud's news archive, the history of each
 *  incident hazard since 2016 (the hazard and the city in the headline, Indonesian). */
export interface RaMediacloudStatus {
  /** Switched on and the server has a key. */
  enabled: boolean
  switched_on: boolean
  configured: boolean
  key_url: string
  every_days: number
  /** The collections searched; empty is every source (Indonesian language). */
  collections: RaMediacloudCollection[]
  history_start: string
  /** The incident hazards with keywords: the ones searched. */
  hazards: string[]
  example_query: string | null
  history: {
    /** Regencies and cities a headline can name: Indonesia's 514 and the buildings' cities. */
    cities: number
    hazards: number
    /** Hazards read up to yesterday or today. */
    complete: number
    /** The earliest last day read among the hazards. */
    read_until: string | null
    due: number
    failing: number
    stories: number
    /** Stories whose headline named a regency or city. */
    tagged: number
    held_from: string | null
    ran_at: string | null
    error: string | null
  }
  source: string
  source_url: string
}

export interface RaMediacloudCollection {
  id: number
  name: string | null
}

/** A collection in Media Cloud's directory, found by name. */
export interface RaMediacloudFound extends RaMediacloudCollection {
  sources: number | null
  description: string | null
}

export interface RaMediacloudInput {
  enabled: boolean
  every_days: number
  collections: RaMediacloudCollection[]
}

/** Sites configuration > Past disasters: NASA FIRMS's fire hotspots, the map every hour (the last
 *  7 days) and each building's history (the past year, then every few days). */
export interface RaFirmsStatus {
  /** Switched on and the server has a MAP_KEY. */
  enabled: boolean
  switched_on: boolean
  configured: boolean
  key_url: string
  polled_at: string | null
  poll_error: string | null
  stale: boolean
  radius_km: number
  hazard_code: string
  sources: string[]
  default_sources: string[]
  all_sources: string[]
  confidence: 'low' | 'nominal' | 'high'
  every_days: number
  hotspots: number
  history: {
    buildings: number
    read: number
    due: number
    failing: number
    held_from: string | null
    ran_at: string | null
    error: string | null
  }
  source: string
  source_url: string
}

export interface RaFirmsInput {
  enabled: boolean
  radius_km: number
  hazard_code: string
  sources: string[]
  confidence: 'low' | 'nominal' | 'high'
  every_days: number
}

/** Sites configuration > Past disasters: GDACS's disaster alerts, the last week every hour, kept
 *  for good (the past year read once). */
export interface RaGdacsStatus {
  enabled: boolean
  polled_at: string | null
  poll_error: string | null
  stale: boolean
  radius_km: number
  /** The RA hazard each GDACS event type counts for. */
  hazards: Record<string, string>
  default_hazards: Record<string, string>
  /** The event types shown on the map and the hazard page (every type is still read). */
  types: string[]
  event_types: Record<string, string>
  events: number
  first: string | null
  history: { held_from: string | null, done: boolean, ran_at: string | null, error: string | null }
  source: string
  source_url: string
}

export interface RaGdacsInput {
  enabled: boolean
  radius_km: number
  types: string[]
  hazards: Record<string, string | null>
}

/** Sites configuration > Past disasters: WAQI's air quality stations, read live. */
export interface RaWaqiSettings {
  /** The server has a WAQI token. */
  configured: boolean
  radius_km: number
  threshold: number
  source: string
  source_url: string
}

export interface RaWaqiSettingsInput {
  radius_km: number
  threshold: number
}

export const sitesConfigApi = {
  bmkg: () => $fetch<RaBmkgStatus>(`${BASE}/bmkg`),
  saveBmkg: (body: { enabled: boolean, min_magnitude: number }) =>
    $fetch<RaBmkgStatus>(`${BASE}/bmkg`, { method: 'PUT', body }),
  dibi: () => $fetch<RaDibiStatus>(`${BASE}/dibi`),
  saveDibi: (body: RaDibiInput) => $fetch<RaDibiStatus>(`${BASE}/dibi`, { method: 'PUT', body }),
  readDibi: () => $fetch<RaDibiStatus>(`${BASE}/dibi/read`, { method: 'POST' }),
  /** A DIBI download (Excel or CSV), kept by record id. */
  importDibi: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch<{ read: number, kept: number, skipped: number, years: number[], status: RaDibiStatus }>(`${BASE}/dibi/import`, { method: 'POST', body })
  },
  outbreaks: () => $fetch<RaOutbreakStatus>(`${BASE}/outbreaks`),
  saveOutbreaks: (body: RaOutbreakInput) => $fetch<RaOutbreakStatus>(`${BASE}/outbreaks`, { method: 'PUT', body }),
  readOutbreaks: () => $fetch<RaOutbreakStatus>(`${BASE}/outbreaks/read`, { method: 'POST' }),
  airQuality: () => $fetch<RaAirQualityStatus>(`${BASE}/air-quality`),
  saveAirQuality: (body: RaAirQualityInput) => $fetch<RaAirQualityStatus>(`${BASE}/air-quality`, { method: 'PUT', body }),
  readAirQuality: () => $fetch<RaAirQualityStatus>(`${BASE}/air-quality/read`, { method: 'POST' }),
  weather: () => $fetch<RaWeatherStatus>(`${BASE}/weather`),
  saveWeather: (body: RaWeatherInput) => $fetch<RaWeatherStatus>(`${BASE}/weather`, { method: 'PUT', body }),
  readWeather: () => $fetch<RaWeatherStatus>(`${BASE}/weather/read`, { method: 'POST' }),
  gdelt: () => $fetch<RaGdeltStatus>(`${BASE}/gdelt`),
  saveGdelt: (body: RaGdeltInput) => $fetch<RaGdeltStatus>(`${BASE}/gdelt`, { method: 'PUT', body }),
  readGdelt: () => $fetch<RaGdeltStatus>(`${BASE}/gdelt/read`, { method: 'POST' }),
  mediacloud: () => $fetch<RaMediacloudStatus>(`${BASE}/mediacloud`),
  saveMediacloud: (body: RaMediacloudInput) => $fetch<RaMediacloudStatus>(`${BASE}/mediacloud`, { method: 'PUT', body }),
  readMediacloud: () => $fetch<RaMediacloudStatus>(`${BASE}/mediacloud/read`, { method: 'POST' }),
  findMediacloudCollections: (q: string) => $fetch<{ items: RaMediacloudFound[] }>(`${BASE}/mediacloud/collections`, { query: { q } }),
  firms: () => $fetch<RaFirmsStatus>(`${BASE}/firms`),
  saveFirms: (body: RaFirmsInput) => $fetch<RaFirmsStatus>(`${BASE}/firms`, { method: 'PUT', body }),
  readFirms: () => $fetch<RaFirmsStatus>(`${BASE}/firms/read`, { method: 'POST' }),
  gdacs: () => $fetch<RaGdacsStatus>(`${BASE}/gdacs`),
  saveGdacs: (body: RaGdacsInput) => $fetch<RaGdacsStatus>(`${BASE}/gdacs`, { method: 'PUT', body }),
  readGdacs: () => $fetch<RaGdacsStatus>(`${BASE}/gdacs/read`, { method: 'POST' }),
  waqi: () => $fetch<RaWaqiSettings>(`${BASE}/waqi`),
  saveWaqi: (body: RaWaqiSettingsInput) => $fetch<RaWaqiSettings>(`${BASE}/waqi`, { method: 'PUT', body }),
  saveHazardTypes: (types: Record<string, RaCrisisType>) =>
    $fetch<{ types: Record<string, RaCrisisType> }>(`${BASE}/hazard-types`, { method: 'PUT', body: { types } }),
}
