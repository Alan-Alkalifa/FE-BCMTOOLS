/**
 * Character limits of text fields, the same as the backend schemas (app/schemas/common.py and
 * the SCCA long-text limit). Shown under each field as a counter ("12/255").
 */
export const TEXT_LIMITS = {
  short: 32,
  medium: 64,
  name: 255,
  long: 2000,
} as const

export type TextLimit = keyof typeof TEXT_LIMITS
