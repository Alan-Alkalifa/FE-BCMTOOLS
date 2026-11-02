/**
 * Rows per page kept in the URL (`?per_page=50`; 20 is left out), so a reload or a shared link
 * keeps it. Changing it goes back to page 1.
 */
export function useRowsPerPage(defaultSize: number = ROWS_PER_PAGE) {
  const route = useRoute()
  const router = useRouter()
  return computed<number>({
    get: () => {
      const size = Number(route.query.per_page)
      return PAGE_SIZES.includes(size) ? size : defaultSize
    },
    set: (size) => router.replace({
      query: { ...route.query, per_page: size === defaultSize ? undefined : String(size), page: undefined },
    }),
  })
}
