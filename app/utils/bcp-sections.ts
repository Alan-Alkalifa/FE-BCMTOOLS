/** BCP: its sections (Manage now; Monitoring and Approval later), paths and statuses. */
import type { InjectionKey, Ref } from 'vue'

export type BcpSection = 'manage'

export const BCP_SECTIONS: Record<BcpSection, { label: string, to: string }> = {
  manage: { label: 'Manage', to: '/bcp/manage' },
}

export function bcpPath(section: BcpSection, id: number) {
  return `${BCP_SECTIONS[section].to}/${id}`
}

export type BcpStatus = 'draft' | 'in_approval' | 'final' | 'invalid' | 'cancelled' | 'superseded'

export const bcpStatus = defineStatusScale<BcpStatus>({
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  in_approval: { label: 'In approval', color: 'warning', icon: 'i-lucide-hourglass' },
  final: { label: 'Final', color: 'success', icon: 'i-lucide-badge-check' },
  invalid: { label: 'Invalid', color: 'error', icon: 'i-lucide-octagon-x' },
  cancelled: { label: 'Cancelled', color: 'neutral', icon: 'i-lucide-ban' },
  superseded: { label: 'Superseded', color: 'neutral', icon: 'i-lucide-archive' },
})

export const bcpDirtyKey: InjectionKey<Ref<boolean>> = Symbol('bcp-dirty')
export const bcpSavingKey: InjectionKey<Ref<boolean>> = Symbol('bcp-saving')
