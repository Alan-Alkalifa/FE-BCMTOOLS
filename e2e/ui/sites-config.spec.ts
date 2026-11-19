import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../fixtures/auth'
import { hazardTypes } from '../fixtures/ra'

test.setTimeout(90_000)

type Call = { method: string, path: string, body: unknown }

/** Administration > Sites configuration: GET and PUT /api/admin/sites-config/* answered from
 *  state, every call kept. */
async function mockSitesConfig(page: Page, permissions?: string[]) {
  await signIn(page, permissions ? { permissions } : undefined)
  const calls: Call[] = []
  // Sites configuration > Past disasters (BNPB's DIBI).
  let dibi = {
    enabled: true, every_days: 7, years: 10, synced_at: '2026-11-16T03:00:00Z' as string | null, tried_at: '2026-11-16T03:00:00Z' as string | null,
    error: '2016: HTTP 504 on /api/v1/chart/data.' as string | null, rows: 41250, first: '2016-01-01T02:00:00Z', last: '2026-11-11T04:00:00Z', source: 'https://dibi.bnpb.go.id',
    categories: [
      { category: 'Banjir', rows: 18000, hazard_code: 'H01' as string | null },
      { category: 'Kebakaran hutan dan lahan', rows: 5200, hazard_code: null as string | null },
    ],
  }
  // Sites configuration > Past disasters, WHO's outbreak news and OpenAQ's air quality.
  let outbreaks = {
    enabled: true, hazard_code: 'H11', country: 'Indonesia', synced_at: '2026-11-17T03:00:00Z' as string | null, tried_at: '2026-11-17T03:00:00Z',
    error: null as string | null, rows: 154, first: '1996-06-14', last: '2024-01-11', source: 'https://www.who.int/api/news/diseaseoutbreaknews',
  }
  let air = {
    enabled: true, configured: false, hazard_code: 'H10', threshold: 55.4, every_days: 7, tried_at: null, error: null as string | null,
    locations: 40, read: 12, with_station: 9, last_read_at: '2026-11-17T03:00:00Z' as string | null, per_run: 10, source: 'https://api.openaq.org',
  }
  let weatherStatus = {
    enabled: true, hazard_code: 'H06', polled_at: '2026-11-18T03:50:00Z' as string | null, poll_error: null as string | null, stale: false,
    rows: 840, over_places: 12, active: 31, source: 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)', source_url: 'https://www.bmkg.go.id/peringatan-dini',
  }
  let waqi = { configured: false, radius_km: 5, threshold: 101, source: 'World Air Quality Index Project', source_url: 'https://waqi.info' }
  // Sites configuration > Earthquakes (BMKG).
  let bmkg = { enabled: true, min_magnitude: 5, alert_radius_km: 100, polled_at: '2026-11-06T06:44:00Z', poll_error: null, stale: false }
  await page.route(/\/api\/ra\/hazard-types/, (route) => route.fulfill({ json: { items: [
    { code: 'H01', no: 1, short_name: 'Banjir/ Banjir Bandang', name: 'Banjir/ Banjir Bandang', category: null, type: 'disaster', default_type: 'disaster' },
    { code: 'H06', no: 6, short_name: 'Cuaca ekstrem', name: 'Cuaca ekstrem', category: null, type: 'disaster', default_type: 'disaster' },
    { code: 'H09', no: 9, short_name: 'Kebakaran dalam skala besar', name: 'Kebakaran dalam skala besar', category: null, type: 'disaster', default_type: 'disaster' },
    { code: 'H10', no: 10, short_name: 'Kabut/Kualitas udara yang buruk', name: 'Kabut / Kualitas udara yang buruk', category: null, type: 'incident', default_type: 'incident' },
    { code: 'H11', no: 11, short_name: 'Wabah Penyakit Epidemi /Pandemi', name: 'Wabah Penyakit Epidemi /Pandemi', category: null, type: 'incident', default_type: 'incident' },
    { code: 'H12', no: 12, short_name: 'Kontaminasi Air', name: 'Kontaminasi Air', category: null, type: 'incident', default_type: 'incident' },
  ], updated_at: null, updated_by: null, can_edit: true } }))
  await page.route(/\/api\/admin\/sites-config/, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method: request.method(), path, body })
    if (path.endsWith('/bmkg') && request.method() === 'PUT') {
      bmkg = { ...bmkg, ...(body as object) }
      return route.fulfill({ json: bmkg })
    }
    if (path.endsWith('/bmkg')) return route.fulfill({ json: bmkg })
    if (path.endsWith('/weather/read')) {
      weatherStatus = { ...weatherStatus, polled_at: null }
      return route.fulfill({ json: weatherStatus })
    }
    if (path.endsWith('/weather') && request.method() === 'PUT') {
      weatherStatus = { ...weatherStatus, ...(body as object) }
      return route.fulfill({ json: weatherStatus })
    }
    if (path.endsWith('/weather')) return route.fulfill({ json: weatherStatus })
    if (path.endsWith('/waqi') && request.method() === 'PUT') {
      waqi = { ...waqi, ...(body as object) }
      return route.fulfill({ json: waqi })
    }
    if (path.endsWith('/waqi')) return route.fulfill({ json: waqi })
    if (path.endsWith('/outbreaks/read')) {
      outbreaks = { ...outbreaks, error: 'HTTP 503 from WHO.' }
      return route.fulfill({ json: outbreaks })
    }
    if (path.endsWith('/outbreaks') && request.method() === 'PUT') {
      outbreaks = { ...outbreaks, ...(body as object) }
      return route.fulfill({ json: outbreaks })
    }
    if (path.endsWith('/outbreaks')) return route.fulfill({ json: outbreaks })
    if (path.endsWith('/air-quality/read')) {
      air = { ...air, read: 0 }
      return route.fulfill({ json: air })
    }
    if (path.endsWith('/air-quality') && request.method() === 'PUT') {
      air = { ...air, ...(body as object), read: 0 }
      return route.fulfill({ json: air })
    }
    if (path.endsWith('/air-quality')) return route.fulfill({ json: air })
    if (path.endsWith('/dibi/import')) {
      dibi = { ...dibi, rows: 50000 }
      return route.fulfill({ json: { read: 50000, kept: 49998, skipped: 2, years: [2012, 2026], status: dibi } })
    }
    if (path.endsWith('/dibi/read')) {
      dibi = { ...dibi, synced_at: null, tried_at: null }
      return route.fulfill({ json: dibi })
    }
    if (path.endsWith('/dibi') && request.method() === 'PUT') {
      const sent = body as { enabled: boolean, every_days: number, years: number, hazards: Record<string, string | null> }
      dibi = { ...dibi, ...sent, categories: dibi.categories.map((item) => ({ ...item, hazard_code: sent.hazards[item.category] ?? null })) }
      return route.fulfill({ json: dibi })
    }
    if (path.endsWith('/dibi')) return route.fulfill({ json: dibi })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
  return calls
}

test('Sites configuration is under Administration, apart from RA configuration', async ({ page }) => {
  await mockSitesConfig(page)
  await page.goto('/admin/sites-config')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Sites configuration' })).toHaveAttribute('aria-current', 'page', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Sites configuration' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText(['Disaster or incident', 'Earthquakes', 'Past disasters'])
  // An old RA configuration link to one of its tabs opens it.
  await page.goto('/admin/ra-config?tab=earthquakes')
  await expect(page).toHaveURL(/\/admin\/sites-config\?tab=earthquakes$/, { timeout: 60_000 })
  await expect(page.getByRole('tab', { name: 'Earthquakes' })).toHaveAttribute('aria-selected', 'true')
})

test('without sites.config.manage the Sites configuration is read-only', async ({ page }) => {
  await mockSitesConfig(page, ['sites.access', 'sites.config.view'])
  await page.goto('/admin/sites-config?tab=earthquakes')
  await expect(page.getByTestId('bmkg-status')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Save earthquake settings' })).toHaveCount(0)
})

test('each hazard is a disaster or an incident, saved at once', async ({ page }) => {
  const calls = await mockSitesConfig(page)
  let types = hazardTypes()
  await page.route(/\/api\/ra\/hazard-types/, (route) => route.fulfill({ json: { items: types, updated_at: null, updated_by: null, can_edit: true } }))
  await page.route(/\/api\/admin\/sites-config\/hazard-types/, async (route) => {
    const body = route.request().postDataJSON() as { types: Record<string, 'disaster' | 'incident'> }
    calls.push({ method: 'PUT', path: '/api/admin/sites-config/hazard-types', body })
    types = types.map((item) => ({ ...item, type: body.types[item.code] ?? item.type }))
    await route.fulfill({ json: { types: Object.fromEntries(types.map((item) => [item.code, item.type])) } })
  })
  await page.goto('/admin/sites-config?tab=hazard-types')
  await expect(page.getByRole('tab', { name: 'Disaster or incident' })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  await expect(page.getByText('9 disaster hazards, 24 incident hazards.')).toBeVisible()
  // A live setting: no version picker.
  await expect(page.getByRole('combobox', { name: 'Version' })).toHaveCount(0)
  const fire = page.getByRole('radiogroup', { name: 'H14 Kebakaran' })
  await fire.getByRole('radio', { name: 'Disaster' }).click()
  await expect(page.getByText('10 disaster hazards, 23 incident hazards.')).toBeVisible()
  await page.getByRole('button', { name: 'Save 1 change' }).click()
  await expect(page.getByText('Default: Incident')).toBeVisible()
  expect(calls.find((call) => call.path.endsWith('/hazard-types'))!.body).toEqual({ types: { H14: 'disaster' } })
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
})

test('earthquakes from BMKG: on or off, the minimum magnitude and the alert radius', async ({ page }) => {
  const calls = await mockSitesConfig(page)
  await page.goto('/admin/sites-config?tab=earthquakes')
  await expect(page.getByRole('tab', { name: 'Earthquakes' })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 })
  await expect(page.getByTestId('bmkg-status')).toContainText('Last read 6 Nov 2026, 13:44 WIB.')
  await expect(page.getByRole('switch', { name: 'Read BMKG' })).toBeChecked()
  await page.getByRole('spinbutton', { name: 'Alert radius' }).fill('150')
  await page.getByRole('button', { name: 'Save earthquake settings' }).click()
  await expect(page.getByText('Earthquake settings saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/bmkg'))!.body).toEqual({ enabled: true, min_magnitude: 5, alert_radius_km: 150 })
})

test('past disasters from BNPB\'s DIBI say when they were read, and map each category to a hazard', async ({ page }) => {
  const calls = await mockSitesConfig(page)
  await page.goto('/admin/sites-config?tab=past-disasters')
  await expect(page.getByRole('heading', { name: 'Past disasters from BNPB (DIBI)' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('dibi-status')).toContainText('41.250 records from 1 Jan 2016 to 11 Nov 2026.')
  await expect(page.getByText('2016: HTTP 504 on /api/v1/chart/data.')).toBeVisible()
  // Forest and land fires count for no hazard until BCM picks one.
  await page.getByRole('button', { name: 'RA hazard for Kebakaran hutan dan lahan' }).click()
  await page.getByRole('option', { name: 'H09 · Kebakaran dalam skala besar' }).click()
  await page.getByRole('button', { name: 'Save past disaster settings' }).click()
  await expect(page.getByText('Past disaster settings saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/dibi'))!.body).toEqual({
    enabled: true, every_days: 7, years: 10, hazards: { 'Banjir': 'H01', 'Kebakaran hutan dan lahan': 'H09' },
  })
  await page.getByRole('button', { name: 'Read at the next run' }).click()
  await expect(page.getByTestId('dibi-status')).toContainText('Not read yet.')

  // A download from DIBI's Tabular tab, for when the server can't reach DIBI.
  await page.getByLabel('DIBI download').setInputFiles({ name: 'DIBI 20261116_090424.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('xlsx') })
  await expect(page.getByText('Kept 49.998 records from 2012 to 2026').first()).toBeVisible()
  await expect(page.getByTestId('dibi-status')).toContainText('50.000 records')
  expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/dibi/import'))).toBe(true)
})

test('WHO\'s outbreak news and OpenAQ\'s air quality are set beside past disasters', async ({ page }) => {
  const calls = await mockSitesConfig(page)
  await page.goto('/admin/sites-config?tab=past-disasters')
  const who = page.getByTestId('who-source')
  await expect(who.getByRole('heading', { name: 'Disease outbreaks from WHO' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('who-status')).toContainText('154 news items from 14 Jun 1996 to 11 Jan 2024.')
  await who.getByRole('button', { name: 'Hazard WHO\'s news counts for' }).click()
  await page.getByRole('option', { name: 'H12 · Kontaminasi Air' }).click()
  await who.getByRole('button', { name: 'Save WHO settings' }).click()
  await expect(page.getByText('WHO outbreak news settings saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/outbreaks'))!.body).toEqual({ enabled: true, hazard_code: 'H12' })
  await who.getByRole('button', { name: 'Read WHO now' }).click()
  await expect(who.getByText('HTTP 503 from WHO.')).toBeVisible()

  const openaq = page.getByTestId('openaq-source')
  await expect(openaq.getByText('No OpenAQ API key on the server')).toBeVisible()
  await expect(page.getByTestId('openaq-status')).toContainText('12 of 40 buildings with coordinates read, 9 with a station within 25 km.')
  await openaq.getByRole('spinbutton', { name: 'Daily PM2.5 above' }).fill('35.5')
  await openaq.getByRole('button', { name: 'Save OpenAQ settings' }).click()
  await expect(page.getByText('OpenAQ settings saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/air-quality'))!.body).toEqual({
    enabled: true, hazard_code: 'H10', threshold: 35.5, every_days: 7,
  })
  await openaq.getByRole('button', { name: 'Read every building again' }).click()
  await expect(page.getByText('Every building will be read again').first()).toBeVisible()
})

test('BMKG\'s weather warnings are set beside past disasters', async ({ page }) => {
  const calls = await mockSitesConfig(page)
  await page.goto('/admin/sites-config?tab=past-disasters')
  const card = page.getByTestId('weather-source')
  await expect(card.getByRole('heading', { name: 'Weather early warnings from BMKG' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('weather-status')).toContainText('31 active, 840 kept, 12 over a building or branch.')
  await card.getByRole('button', { name: 'Hazard BMKG\'s weather warnings count for' }).click()
  await page.getByRole('option', { name: 'H01 · Banjir/ Banjir Bandang' }).click()
  await card.getByRole('button', { name: 'Save weather settings' }).click()
  await expect(page.getByText('BMKG weather warning settings saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/weather'))!.body).toEqual({ enabled: true, hazard_code: 'H01' })
  await card.getByRole('button', { name: 'Read at the next poll' }).click()
  await expect(page.getByTestId('weather-status')).toContainText('Not read yet.')
})

test('WAQI\'s station area and the AQI from which a building is affected are set beside past disasters', async ({ page }) => {
  const calls = await mockSitesConfig(page)
  await page.goto('/admin/sites-config?tab=past-disasters')
  const card = page.getByTestId('waqi-source')
  await expect(card.getByRole('heading', { name: 'Air quality stations from WAQI' })).toBeVisible({ timeout: 60_000 })
  await expect(card.getByText('No WAQI token on the server')).toBeVisible()
  await expect(card.getByText('Unhealthy for sensitive groups')).toBeVisible()
  await card.getByRole('spinbutton', { name: 'Station\'s area' }).fill('2.5')
  await card.getByRole('spinbutton', { name: 'Affected from AQI' }).fill('151')
  await card.getByRole('spinbutton', { name: 'Affected from AQI' }).blur()
  await expect(card.getByText('Unhealthy', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Save WAQI settings' }).click()
  await expect(page.getByText('WAQI settings saved').first()).toBeVisible()
  expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/waqi'))!.body).toEqual({ radius_km: 2.5, threshold: 151 })
})
