import type { RaBmkgStatus, RaCrisisType } from '~/composables/useRa'

/**
 * Administration > Sites configuration: the live settings of the Sites menu, not versioned.
 * Whether each hazard is a disaster or an incident, BMKG's earthquakes, and the past disasters
 * (BNPB's DIBI, WHO's outbreak news, OpenAQ's air quality, BMKG's weather early warnings, WAQI's
 * air quality stations, GDELT's disaster news).
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
  radius_km: number
  every_days: number
  /** GDELT GKG themes per hazard, for the map. */
  themes: Record<string, string[]>
  /** Keywords per hazard, for the history. */
  keywords: Record<string, string[]>
  default_themes: Record<string, string[]>
  default_keywords: Record<string, string[]>
  themes_url: string
  points: number
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
  radius_km: number
  every_days: number
  themes: Record<string, string[]>
  keywords: Record<string, string[]>
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
  waqi: () => $fetch<RaWaqiSettings>(`${BASE}/waqi`),
  saveWaqi: (body: RaWaqiSettingsInput) => $fetch<RaWaqiSettings>(`${BASE}/waqi`, { method: 'PUT', body }),
  saveHazardTypes: (types: Record<string, RaCrisisType>) =>
    $fetch<{ types: Record<string, RaCrisisType> }>(`${BASE}/hazard-types`, { method: 'PUT', body: { types } }),
}
