import type { ComputedRef } from 'vue'
import { BIANCA_TEXTS, type BiancaTextKey } from '~/utils/biancaTexts'

/**
 * A guidance text of the BIA form: the one set in BIA configuration › Guides (`text_<key>`),
 * or its default. Inside the form (BiancaForm provides the configuration's guides).
 */
export function useBiancaText() {
  const guides = inject<ComputedRef<Record<string, string> | undefined> | undefined>('bianca-guides', undefined)
  return (key: BiancaTextKey) => guides?.value?.[`text_${key}`]?.trim() || BIANCA_TEXTS[key][1]
}
