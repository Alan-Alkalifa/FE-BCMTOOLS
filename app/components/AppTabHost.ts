import { KeepAlive, Suspense, cloneVNode, defineComponent, h, onActivated, provide, shallowReactive, shallowRef, watch, type Component, type PropType, type VNode } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { PageRouteSymbol } from '#app/components/injections'
import { tabIdKey } from '~/composables/useTabs'

/**
 * Renders the pages of the open in-app tabs (docs/tabs.md), each kept alive in the background
 * so its filters, scroll and half-filled forms stay as they were. One wrapper component per tab,
 * named after the tab, so closing a tab frees exactly that page (KeepAlive `include`).
 *
 * A background page keeps seeing the route it was last shown with: its filters do not follow
 * another tab's query.
 */
const wrappers = new Map<string, Component>()

function wrapperFor(id: string): Component {
  let wrapper = wrappers.get(id)
  if (wrapper) return wrapper
  wrapper = defineComponent({
    name: `AppTab_${id}`,
    props: {
      vnode: { type: Object as PropType<VNode>, required: true },
      route: { type: Object as PropType<RouteLocationNormalizedLoaded>, required: true },
      generation: { type: Number, default: 0 },
    },
    setup(props) {
      provide(tabIdKey, id)
      // The page's useRoute(): the route while this tab is in front, frozen while it is not.
      const shown = shallowRef(props.route)
      watch(() => props.route, (route) => {
        shown.value = route
      })
      const route = {} as RouteLocationNormalizedLoaded
      for (const key in props.route) {
        Object.defineProperty(route, key, { get: () => shown.value[key as keyof RouteLocationNormalizedLoaded], enumerable: true })
      }
      provide(PageRouteSymbol, shallowReactive(route))

      const tabs = useTabs()
      onActivated(() => {
        const tab = tabs.byId(id)
        if (!tab) return
        // Back after a while: load the page again, unless it holds unsaved edits.
        if (tab.hiddenAt && Date.now() - tab.hiddenAt > TAB_STALE_MS && !tab.dirty) tabs.reload(id)
        tab.hiddenAt = null
      })
      return () => h(Suspense, null, { default: () => cloneVNode(props.vnode, { key: `${props.generation}` }) })
    },
  })
  wrappers.set(id, wrapper)
  return wrapper
}

export default defineComponent({
  name: 'AppTabHost',
  props: {
    component: { type: Object as PropType<VNode>, required: true },
    route: { type: Object as PropType<RouteLocationNormalizedLoaded>, required: true },
  },
  setup(props) {
    const tabs = useTabs()
    const include = computed(() => tabs.list.value.map((tab) => `AppTab_${tab.id}`))
    // Forget the wrappers of closed tabs.
    watch(include, (names) => {
      for (const id of wrappers.keys()) {
        if (!names.includes(`AppTab_${id}`)) wrappers.delete(id)
      }
    })
    return () => {
      const key = tabKeyOf(props.route)
      const tab = key ? tabs.byKey(key) : undefined
      return [
        h(KeepAlive, { include: include.value }, {
          default: () => (tab
            ? h(wrapperFor(tab.id), { key: tab.id, vnode: props.component, route: props.route, generation: tab.generation })
            : null),
        }),
        // A page without a tab (a redirect on its way, Forbidden) shows as usual.
        tab ? null : h(Suspense, null, { default: () => props.component }),
      ]
    }
  },
})
