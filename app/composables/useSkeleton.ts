import type { InjectionKey } from 'vue'

const IN_SKELETON_GROUP: InjectionKey<true> = Symbol('in-skeleton-group')

/** Marks descendants as part of one loading region, so they don't announce themselves again. */
export function provideSkeletonGroup() {
  provide(IN_SKELETON_GROUP, true)
}

/**
 * Attributes for a skeleton's root element: a single "Loading" status region when it stands alone,
 * or hidden from assistive technology when an enclosing <SkeletonGroup> already announces it.
 */
export function useSkeletonRoot(label: MaybeRefOrGetter<string | undefined> = undefined) {
  const grouped = inject(IN_SKELETON_GROUP, false)
  return computed(() =>
    grouped
      ? { 'aria-hidden': 'true' as const }
      : { 'role': 'status', 'aria-busy': 'true' as const, 'aria-label': toValue(label) ?? 'Loading' },
  )
}

/**
 * True only once `loading` has stayed true for `delay` ms, so fast responses never flash a skeleton.
 */
export function useDelayedLoading(loading: MaybeRefOrGetter<boolean>, delay = 300) {
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(
    () => toValue(loading),
    (isLoading) => {
      clearTimeout(timer)
      if (isLoading) {
        timer = setTimeout(() => (visible.value = true), delay)
      } else {
        visible.value = false
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => clearTimeout(timer))
  return readonly(visible)
}
