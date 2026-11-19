import type { AppTab } from '~/composables/useTabs'

/** What the tab bar and the phone switcher do with a tab (docs/tabs.md). */
export function useTabActions() {
  const tabs = useTabs()
  const confirm = useConfirm()
  const toast = useToast()
  const { $tabNav } = useNuxtApp()

  const closable = (tab: AppTab) => !tab.pinned

  async function close(tab: AppTab) {
    if (!closable(tab)) return false
    if (tab.dirty) {
      const ok = await confirm({
        title: 'Close this tab?',
        description: `${tab.title} has changes that were not saved. If you close the tab, they are lost.`,
        confirmLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
        destructive: true,
      })
      if (!ok) return false
    }
    const next = tabs.remove(tab.id)
    if (next) await navigateTo(next)
    return true
  }

  /** Close several tabs; tabs with unsaved edits stay open (and say so). */
  async function closeMany(targets: AppTab[], keep: AppTab) {
    const kept = targets.filter((tab) => tab.dirty)
    for (const tab of targets) {
      if (!tab.dirty && closable(tab)) tabs.remove(tab.id)
    }
    if (tabs.activeTab.value?.id !== keep.id) await $tabNav.show(keep)
    if (kept.length) {
      toast.add({
        title: kept.length === 1 ? '1 tab kept open' : `${kept.length} tabs kept open`,
        description: 'They have unsaved changes: save them or close each tab yourself.',
        color: 'warning',
        icon: 'i-lucide-circle-dot',
      })
    }
  }

  function closeOthers(tab: AppTab) {
    return closeMany(tabs.list.value.filter((item) => item.id !== tab.id && closable(item)), tab)
  }

  function closeRight(tab: AppTab) {
    const at = tabs.list.value.findIndex((item) => item.id === tab.id)
    return closeMany(tabs.list.value.slice(at + 1).filter(closable), tab)
  }

  function openInBrowserTab(tab: AppTab) {
    window.open(tab.url, '_blank', 'noopener')
  }

  function menu(tab: AppTab) {
    const isHome = tab.key === HOME_TAB_KEY
    const at = tabs.list.value.findIndex((item) => item.id === tab.id)
    return [
      [
        isHome
          ? { label: 'Home stays pinned', icon: 'i-lucide-pin', disabled: true }
          : tab.pinned
            ? { label: 'Unpin tab', icon: 'i-lucide-pin-off', onSelect: () => tabs.setPinned(tab.id, false) }
            : { label: 'Pin tab', icon: 'i-lucide-pin', onSelect: () => tabs.setPinned(tab.id, true) },
        { label: 'Close tab', icon: 'i-lucide-x', disabled: !closable(tab), onSelect: () => close(tab) },
        { label: 'Close other tabs', icon: 'i-lucide-copy-x', disabled: !tabs.list.value.some((item) => item.id !== tab.id && closable(item)), onSelect: () => closeOthers(tab) },
        { label: 'Close tabs to the right', icon: 'i-lucide-arrow-right-to-line', disabled: !tabs.list.value.slice(at + 1).some(closable), onSelect: () => closeRight(tab) },
      ],
      [
        { label: 'Open in a new browser tab', icon: 'i-lucide-external-link', onSelect: () => openInBrowserTab(tab) },
      ],
    ]
  }

  return { close, closeOthers, closeRight, openInBrowserTab, menu, show: (tab: AppTab) => $tabNav.show(tab) }
}
