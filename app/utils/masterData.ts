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
    key: 'bia-config',
    title: 'BIA configuration',
    description: 'The parameters of the BIA, versioned: Expected MTD with its business function category, upstream / downstream MTD, impact periods, personnel grades, the drop-down lists and the sign-off steps.',
    icon: 'i-lucide-sliders-horizontal',
    to: '/admin/bianca-config',
    permission: ['bianca.config.view', 'bianca.config.manage'],
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
