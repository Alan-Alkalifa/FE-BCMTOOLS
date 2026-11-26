# In-app tabs

Pages open in tabs under the top bar, like a browser. Tabs are always on for signed-in users;
there is no setting.

## Rules

- **One tab per page.** The tab key is the route path without the query (`utils/tabs.ts`,
  `tabKeyOf`). `/scca/monitoring` is one tab whatever its filters; `/scca/manage/12` and
  `/scca/manage/15` are two. A record's report (`…/12/report`) opens inside the record's tab.
- **Opening a page that is already open switches to it.** A menu link without a query brings
  back the tab's last URL (filters, sort, page); a link with its own query applies it.
- **Home is pinned** and cannot be closed. Other tabs can be pinned from the tab menu.
- **At most 10 tabs** (`TAB_LIMIT`). Opening another closes the longest-unused tab that is not
  pinned and has no unsaved edits; if none qualifies, the navigation is refused with a message.
- **Unsaved edits** put a dot on the tab. Switching tabs keeps them; closing the tab asks.
- **A tab hidden for more than 2 minutes** (`TAB_STALE_MS`) loads its page again when it comes
  back, unless it has unsaved edits.
- The list survives a reload (`sessionStorage` `bcm.tabs.<user id>`) and is forgotten on sign-out.
- On a phone the strip is a button with the number of tabs that opens a sheet.

## How it fits together

| Part | File | Job |
| --- | --- | --- |
| Tab store | `composables/useTabs.ts` | The open tabs, the one in front, pinned, unsaved, last seen |
| Route guard | `plugins/tabs.client.ts` | Every navigation: switch to an open tab, open a new one, or retarget the current one |
| Host | `components/AppTabHost.ts` (from `app.vue`) | Keeps each open tab's page alive; one wrapper component per tab so closing frees it |
| Tab bar, switcher | `components/AppTabBar.vue`, `AppTabSwitcher.vue` (in `AppPage`) | Switch, close, pin, reorder, the tab menu |
| Actions | `composables/useTabActions.ts` | Close (asks when unsaved), close others / to the right, open in a browser tab |
| Unsaved edits | `composables/useUnsavedChanges.ts` | Leave guard + `beforeunload` + the tab's dot |

## Writing a page that works in a tab

- **Render through `AppPage`.** It names the tab (`title`, or `tab-title` for a record) and keeps
  the scroll position while the tab is in the background.
- **Read the route with `useRoute()`.** A background page keeps the route it was last shown
  with, so its filters do not follow another tab's query. Do not read
  `router.currentRoute` in a page.
- **Track unsaved edits with `useUnsavedChanges(dirty)`**, not a hand-written
  `onBeforeRouteLeave`: that would ask on every tab switch.
- **After creating a record, navigate with `{ replace: true }`.** The "New" tab then becomes the
  record's tab instead of staying open empty.
- **A page that only forwards** (a resolver, an old link) sets `definePageMeta({ tab: false })`.
- **Timers and polling** pause in `onDeactivated` and catch up in `onActivated`
  (see `pages/sites/map.vue`). Charts and maps size themselves again in `onActivated`
  (`AppChart`, `RaMap`).

Tests: `e2e/ui/tabs.spec.ts`.
