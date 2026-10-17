import type { BadgeProps } from '@nuxt/ui'

export interface StatusDefinition {
  label: string
  color: NonNullable<BadgeProps['color']>
  icon: string
}

export type StatusScale<K extends string = string> = Record<K, StatusDefinition>

/**
 * Declare a status scale once and render it everywhere with <StatusBadge>.
 * Every status needs an icon so it never relies on colour alone (WCAG 1.4.1).
 */
export function defineStatusScale<K extends string>(scale: StatusScale<K>) {
  return scale
}
