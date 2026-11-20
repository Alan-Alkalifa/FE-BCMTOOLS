import type { Ref } from 'vue'

/**
 * A page or form with unsaved edits (`dirty`): asks before leaving the page or closing the
 * browser tab, and, with in-app tabs on (docs/tabs.md), puts a dot on its tab. Switching to
 * another in-app tab does not ask: the page stays open in the background with its edits.
 */
export function useUnsavedChanges(dirty: Ref<boolean>, options: { confirm?: () => Promise<boolean> } = {}) {
  const tabs = useTabs()
  const tabId = useTabId()
  const confirm = useConfirm()
  const { $tabNav } = useNuxtApp()

  const confirmLeave = options.confirm ?? (() => confirm({
    title: 'Discard unsaved changes?',
    description: 'Your unsaved edits on this page will be lost.',
    confirmLabel: 'Discard changes',
    destructive: true,
  }))

  watch(dirty, (value) => {
    if (tabId) tabs.setDirty(tabId, value)
  }, { immediate: true })

  onBeforeRouteLeave(async (to, from) => {
    if (!dirty.value) return
    if ($tabNav?.keepsAlive(to, from)) return
    if (!(await confirmLeave())) return false
  })

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    if (tabId) tabs.setDirty(tabId, false)
  })

  return { confirmLeave }
}
