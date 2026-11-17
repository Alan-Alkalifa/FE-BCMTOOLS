/**
 * Administration › Master data: the masters BCM keeps for the modules, each at
 * /masterdata/<master>. The hub lists those the user may open.
 */
export const MASTER_DATA_PATH = '/masterdata'

export interface MasterDataEntry {
  key: string
  title: string
  description: string
  icon: string
  to: string
  /** Any of these opens it. */
  permission: string[]
  usedBy: string
}

export const MASTER_DATA: MasterDataEntry[] = [
  {
    key: 'mtd',
    title: 'Master MTD',
    description: 'The MTD choices of the BIA: the Expected MTD of a business function (with its category) and the MTD of an upstream or downstream.',
    icon: 'i-lucide-timer',
    to: '/masterdata/mastermtd',
    permission: ['masterdata.access', 'master.mtd.manage'],
    usedBy: 'BIANCA',
  },
  {
    key: 'building',
    title: 'Master building',
    description: 'Every head office building and branch: the office locations of RA and the main and alternate locations of a BIA.',
    icon: 'i-lucide-building',
    to: '/masterdata/masterbuilding',
    permission: ['location.master'],
    usedBy: 'RA, RA Branch, BIANCA',
  },
  {
    key: 'applications',
    title: 'Applications',
    description: 'Every application BCM tracks, with its category, RTO and RPO: the IT systems of SCCA and of a BIA.',
    icon: 'i-lucide-app-window',
    to: '/admin/applications',
    permission: ['scca.application.view', 'scca.application.manage'],
    usedBy: 'SCCA, BIANCA',
  },
]
