// The symbols of the location map, shared by the map's markers (RaMap) and its legend
// (RaMapSymbol), so the legend shows exactly what is on the map. Static markup, no user text.

/** A head office building: a map pin. */
export const RA_PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">'
  + '<path fill="currentColor" stroke="white" stroke-width="1.5" d="M12 1.75c-4.28 0-7.75 3.4-7.75 7.6 0 5.37 6.6 11.9 7.2 12.48a.8.8 0 0 0 1.1 0c.6-.58 7.2-7.1 7.2-12.48 0-4.2-3.47-7.6-7.75-7.6Z"/>'
  + '<circle cx="12" cy="9.5" r="2.75" fill="white"/></svg>'

/** A branch: a rounded square with a bank glyph, so it reads differently from a building pin
 *  even without colour. */
export const RA_BRANCH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">'
  + '<rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="currentColor" stroke="white" stroke-width="1.5"/>'
  + '<path fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 17.5h12M7.5 15v-4.5M10.5 15v-4.5M13.5 15v-4.5M16.5 15v-4.5M5.5 9 12 5.5 18.5 9Z"/>'
  + '</svg>'

/** An incident point: a siren in a circle (red; orange while it waits for approval). */
export const RA_CRISIS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="10.5" fill="currentColor" stroke="white" stroke-width="1.5"/>'
  + '<path fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M8 16.5v-4a4 4 0 0 1 8 0v4M6.5 16.5h11M12 5.5v1.2M6.7 7.7l.8.8M17.3 7.7l-.8.8"/>'
  + '</svg>'

/** A badge on a building or branch that waits for approval (a new one, or its deactivation):
 *  an hourglass in an orange circle. */
export const RA_WAITING_BADGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="10.5" fill="currentColor" stroke="white" stroke-width="2"/>'
  + '<path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8.5 6.5h7L8.5 17.5h7Z"/>'
  + '</svg>'

/** A badge on a new building or branch that was rejected: a cross in a red circle. */
export const RA_REJECTED_BADGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="10.5" fill="currentColor" stroke="white" stroke-width="2"/>'
  + '<path fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'
  + '</svg>'

/** Where a place's approval stands on the map: waiting (new, or to deactivate) or rejected. */
export type RaPinApproval = 'waiting' | 'rejected'

const BADGES: Record<RaPinApproval, string> = { waiting: RA_WAITING_BADGE_SVG, rejected: RA_REJECTED_BADGE_SVG }

/** A marker's markup, with the approval badge in its top right corner when it has one. */
export function raPinHtml(svg: string, approval?: RaPinApproval | null) {
  if (!approval) return svg
  return `<span class="ra-pin-stack">${svg}<span class="ra-pin-badge ra-pin-badge-${approval}">${BADGES[approval]}</span></span>`
}

export const RA_MAP_SYMBOLS = {
  building: RA_PIN_SVG,
  branch: RA_BRANCH_SVG,
  crisis: RA_CRISIS_SVG,
  waiting: raPinHtml(RA_PIN_SVG, 'waiting'),
  rejected: raPinHtml(RA_PIN_SVG, 'rejected'),
} as const
export type RaMapSymbolName = keyof typeof RA_MAP_SYMBOLS
