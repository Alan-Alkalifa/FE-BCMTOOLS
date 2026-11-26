import { h } from 'vue'
import SortHeader from '~/components/SortHeader.vue'

/**
 * Server-side column sorting kept in the URL (`?sort=<column>&dir=asc|desc`), for the SCCA
 * tables. `header(label, key)` is a table column header that sorts by `key`; a click on the
 * sorted column turns the direction around, a click on another column sorts it ascending
 * (or descending for the keys in `firstDesc`: dates and counts, where the biggest is the
 * interesting end). Sorting goes back to page 1.
 *
 * A second table on the same page keeps its own sorting with `prefix` (its URL keys become
 * `<prefix>sort` / `<prefix>dir`) and `page`, the URL key of its own page number.
 */
export function useTableSort(firstDesc: string[] = [], options: { prefix?: string, page?: string } = {}) {
  const route = useRoute()
  const router = useRouter()
  const sortKey = `${options.prefix ?? ''}sort`
  const dirKey = `${options.prefix ?? ''}dir`
  const pageKey = options.page ?? 'page'

  const sort = computed(() => {
    const value = route.query[sortKey]
    return typeof value === 'string' && value ? value : undefined
  })
  const dir = computed<'asc' | 'desc'>(() => (route.query[dirKey] === 'desc' ? 'desc' : 'asc'))

  function sortedBy(key: string): 'asc' | 'desc' | null {
    return sort.value === key ? dir.value : null
  }

  function sortBy(key: string) {
    const next = sort.value === key ? (dir.value === 'asc' ? 'desc' : 'asc') : (firstDesc.includes(key) ? 'desc' : 'asc')
    router.replace({ query: { ...route.query, [sortKey]: key, [dirKey]: next, [pageKey]: undefined } })
  }

  /** A sortable column header (a render function for a TableColumn's `header`). */
  function header(label: string, key: string, end = false) {
    return () => h(SortHeader, { label, direction: sortedBy(key), end, onSort: () => sortBy(key) })
  }

  /** The query to send with the list request. */
  const query = computed(() => ({ sort: sort.value, dir: sort.value ? dir.value : undefined }))

  return { sort, dir, query, sortedBy, sortBy, header }
}
