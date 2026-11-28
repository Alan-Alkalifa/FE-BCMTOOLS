import type { BcpScenarioSnapshot } from './useBcpConfigAdmin'

/** Master data › BCP scenario and procedure: edited live; BCP configuration copies it. */
export type BcpScenario = BcpScenarioSnapshot
export type BcpProcedure = BcpScenarioSnapshot['procedures'][number]

export interface BcpScenarioMaster {
  scenarios: BcpScenario[]
  /** The workaround conditions of the draft (else active) BCP configuration. */
  conditions: { code: string, title: string, active: boolean }[]
  /** The BCP configuration version the conditions come from. */
  version: string | null
}

const BASE = '/api/masterdata/bcp-scenarios'
export const bcpScenarioApi = {
  get: () => $fetch<BcpScenarioMaster>(BASE),
  save: (scenarios: BcpScenario[]) => $fetch<BcpScenarioMaster>(BASE, { method: 'PUT', body: { scenarios } }),
}
