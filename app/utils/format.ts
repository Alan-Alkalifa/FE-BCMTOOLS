const LOCALE = 'id-ID'
const TIME_ZONE = 'Asia/Jakarta'

type DateInput = Date | string | number | null | undefined

function toDate(value: DateInput) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 16 Okt 2026 */
export function formatDate(value: DateInput) {
  const date = toDate(value)
  return date
    ? new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: TIME_ZONE }).format(date)
    : null
}

/** 16 Okt 2026, 22.30 WIB */
export function formatDateTime(value: DateInput) {
  const date = toDate(value)
  if (!date) return null
  const time = new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short', timeZone: TIME_ZONE }).format(date)
  return `${formatDate(date)}, ${time} WIB`
}

/** 1.234.567,89 */
export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  return value === null || value === undefined
    ? null
    : new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)
}

/** Rp 1.234.567 */
export function formatCurrency(value: number | null | undefined, fractionDigits = 0) {
  return value === null || value === undefined
    ? null
    : new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
}

/** 12,5% (value is a fraction: 0.125) */
export function formatPercent(value: number | null | undefined, maximumFractionDigits = 1) {
  return value === null || value === undefined
    ? null
    : new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits }).format(value)
}
