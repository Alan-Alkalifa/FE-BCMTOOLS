# BCM Tools design system

The visual and interaction rules for BCM Tools, CIMB Niaga's internal Business Continuity Management app. It is built on [Nuxt UI 4](https://ui.nuxt.com/docs) and Tailwind CSS 4: we theme Nuxt UI rather than write components from scratch, and only add components for patterns Nuxt UI doesn't cover.

| | |
|---|---|
| Scope | BCM Tools only (not a shared package) |
| Style | Corporate and clean: white surfaces, thin borders, minimal shadows, red as an accent |
| Colour mode | Light only |
| Accessibility | WCAG 2.2 AA |
| UI language | English |
| Formats | Indonesian: `16 Okt 2026`, `1.234.567,89`, `Rp 1.234.567`, times in WIB |

**Where things live**

| File | Contents |
|---|---|
| `app/assets/css/main.css` | Tokens: CIMB palette, chart palette, font, motion, accessible shade choices |
| `app/app.config.ts` | Nuxt UI colour aliases and component overrides (e.g. compact tables) |
| `app/utils/format.ts` | Date, number, currency and percent formatting |
| `app/utils/chart.ts` | Chart palette and ECharts base theme |
| `app/utils/status.ts`, `app/components/StatusBadge.vue` | Status scale pattern |
| `app/layouts/default.vue`, `app/components/AppPage.vue`, `AppLogo.vue`, `UserMenu.vue`, `NotificationsMenu.vue` | App shell |

> **Brand colours are an approximation.** The red palette is built around the two colours in the official logo (`#ED3024` and `#790008`). Confirm the official values with the CIMB Niaga brand team and update `--color-cimb-*` in `main.css`; everything else follows.

---

## Contents

- [Foundations](#foundations)
  - [Colour](#colour)
  - [Typography](#typography)
  - [Spacing and layout](#spacing-and-layout)
  - [Radius, borders and elevation](#radius-borders-and-elevation)
  - [Iconography](#iconography)
  - [Motion](#motion)
  - [Formatting](#formatting)
- [Components](#components)
  - [Buttons and links](#buttons-and-links)
  - [Forms](#forms)
  - [Data tables](#data-tables)
  - [Feedback](#feedback)
  - [Loading states](#loading-states)
  - [Status badges](#status-badges)
  - [Cards and KPI tiles](#cards-and-kpi-tiles)
  - [Charts](#charts)
  - [Navigation and page structure](#navigation-and-page-structure)
- [Accessibility checklist](#accessibility-checklist)
- [Writing style](#writing-style)
- [Changing the system](#changing-the-system)

---

## Foundations

### Colour

Always use **semantic** colours (`primary`, `error`, `text-muted`, `bg-elevated`, ...) in components, never raw palette classes like `text-red-600`. Semantic names are what let us retune the palette in one place.

The one exception is **brand surfaces**: large areas that are the brand rather than UI, such as the login page's left panel (`from-cimb-950 via-cimb-900 to-cimb-700` gradient with white text). They use the `cimb-*` palette directly. Keep text on the dark end (`cimb-900`/`950`), in white or `white/70` and above, so it stays above 4.5:1; translucent white on `cimb-700` drops below that.

#### Semantic colours

| Name | Palette | Shade used for fills and text | Use for |
|---|---|---|---|
| `primary` | `cimb` (CIMB red) | 600 `#D21E13` | Primary actions, active navigation, links, focus rings |
| `neutral` | Tailwind `slate` | — | Text, borders, backgrounds, secondary buttons |
| `secondary` | Tailwind `slate` | — | Rarely; prefer `neutral` |
| `success` | Tailwind `green` | 700 `#15803D` | Completed, passed, healthy |
| `info` | Tailwind `blue` | 600 `#2563EB` | Neutral information, in progress |
| `warning` | Tailwind `amber` | 700 `#B45309` | Needs attention, at risk |
| `error` | Tailwind `rose` | 700 `#BE123C` | Failures, validation errors, destructive actions |

Nuxt UI uses shade 500 for fills by default. We override that in `main.css` (`--ui-primary`, `--ui-error`, ...) because white text on the 500 shades of red, green and amber is below 4.5:1. Every shade in the table above reaches at least 4.5:1 against white, so solid buttons, badges and coloured text all pass AA.

#### CIMB red palette (`cimb`)

| Shade | Hex | Notes |
|---|---|---|
| 50 | `#FEF3F2` | Tinted backgrounds (subtle badges, selected rows) |
| 100 | `#FEE4E2` | |
| 200 | `#FDCDCA` | |
| 300 | `#FAA7A1` | |
| 400 | `#F5736A` | |
| **500** | **`#ED3024`** | **Logo red.** Logo and large decorative accents only: 4.2:1 on white, too low for text |
| **600** | **`#D21E13`** | **`primary`.** Buttons, links, active states (5.3:1 on white) |
| 700 | `#B0170F` | Hover/pressed on primary |
| 800 | `#911611` | |
| 900 | `#790008` | Logo maroon |
| 950 | `#44030A` | |

#### Brand red vs. error red

CIMB's brand colour is red, and red also means "error". To keep them apart:

1. **Different hue.** Brand red is a warm orange-red (`#D21E13`); errors use a cooler crimson (`rose-700`, `#BE123C`).
2. **Errors always carry an icon and words.** `i-lucide-circle-alert` plus a message such as "Sign-in failed". Never signal an error with colour alone.
3. **Destructive buttons are not primary-red.** Use `color="error"` with `variant="soft"` or `"outline"` (`variant="solid"` only inside the confirmation dialog), and a verb that names the action ("Delete plan").
4. **Use red sparingly.** One primary button per view. Most of the screen is white and slate; red marks the one thing to do next or where you are.

#### Neutrals and surfaces

Use Nuxt UI's semantic utilities. Values come from `slate`.

| Utility | Use for |
|---|---|
| `text-highlighted` | Headings, key values |
| `text-default` | Body text, table cells |
| `text-muted` | Labels, secondary text, helper text (4.8:1, passes AA) |
| `text-dimmed` | Placeholders and disabled text only (below 4.5:1, so never for content people need to read) |
| `bg-default` | Page and card surface (white) |
| `bg-muted` | Table headers, login background |
| `bg-elevated` | Hover and selected states |
| `border-default` | Card borders, dividers |
| `border-accented` | Input borders, stronger separators |

#### Data visualisation palette

The [Okabe-Ito](https://jfly.uni-koeln.de/color/) palette, which stays distinguishable for the common forms of colour blindness. Use the series **in order**; don't pick colours by preference.

| Token | Hex | |
|---|---|---|
| `chart-1` | `#0072B2` | Blue |
| `chart-2` | `#E69F00` | Orange |
| `chart-3` | `#009E73` | Bluish green |
| `chart-4` | `#D55E00` | Vermillion |
| `chart-5` | `#56B4E9` | Sky blue |
| `chart-6` | `#CC79A7` | Reddish purple |
| `chart-7` | `#7A6F00` | Olive (darkened Okabe-Ito yellow, which is unreadable on white) |
| `chart-8` | `#64748B` | Slate, for "Other" or baseline series |

CSS: `bg-chart-1`, `text-chart-3`, `var(--color-chart-2)`. TypeScript: `CHART_PALETTE` from `app/utils/chart.ts`. Brand red is deliberately **not** a series colour, so a red bar never reads as "bad".

When a chart shows status (e.g. passed/failed), use the status colours with labels instead of the series palette.

### Typography

**Typeface:** [Inter](https://rsms.me/inter/) (variable), self-hosted from the `@fontsource-variable/inter` package so it works on the private network. Nuxt UI's Google Fonts download is turned off (`ui.fonts: false`). Stylistic set `cv11` (single-storey `a`) is on for legibility.

| Role | Classes | Size / line height | Use |
|---|---|---|---|
| Page title | set by `AppPage` | 16 / 24px semibold | `h1` in the navbar, with the page's icon; also the browser tab title |
| Display | `text-2xl font-semibold` | 24 / 32px | A person or record name heading a detail page |
| Section heading | `text-lg font-semibold` | 18 / 28px | Card or section titles (`<h2>`) |
| Card title | `font-semibold` | 16 / 24px | Titles inside cards (`<h3>`) |
| Body | `text-sm` | 14 / 20px | Default for forms, tables and content |
| Small | `text-xs` | 12 / 16px | Table headers (uppercase, tracking-wide), captions, footers |
| KPI value | `text-3xl font-semibold tabular-nums` | 30 / 36px | Numbers on stat tiles |

Rules:

- **14px is the base size.** This is a data-dense work tool; 16px is reserved for titles.
- **Numbers in tables, KPIs and anything compared vertically use `tabular-nums`** so digits line up. Compact tables apply it automatically.
- Weights: 400 regular, 500 medium (buttons, labels), 600 semibold (headings). Don't use 700+.
- Headings are sentence case ("Recovery plans", not "Recovery Plans"). No all-caps except table headers.
- Keep heading levels in order: one `h1` (the navbar title from `AppPage`), then `h2`, then `h3`.

### Spacing and layout

Tailwind's 4px scale. Prefer these steps:

| Token | px | Use |
|---|---|---|
| `1` | 4 | Icon to text inside badges |
| `2` | 8 | Between related controls, compact table cell padding (vertical) |
| `3` | 12 | Compact table cell padding (horizontal), gaps inside cards |
| `4` | 16 | Form field spacing, card padding on mobile |
| `6` | 24 | Between cards and sections, card padding on desktop |
| `8` | 32 | Between major page regions |

**Density:** comfortable layout, compact data. Pages and cards breathe (24px gaps); tables and forms are tight (32px controls, 8×12px table cells).

**Layout:**

- App shell: a collapsible sidebar (menu from the database) and a 64px navbar per page (title, icon, actions). See [Navigation](#navigation-and-page-structure).
- Page content is capped at `max-w-7xl` (1280px) and centred, so tables and forms don't stretch on wide monitors.
- Grids: `grid gap-6 md:grid-cols-2` for cards, `lg:grid-cols-4` for KPI rows.
- Breakpoints are Tailwind's (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). The app is designed for desktop (≥1280px) but must stay usable at 768px. The module grid goes from one column to two at `sm` and three at `lg`.

### Radius, borders and elevation

Radius is controlled by `--ui-radius: 0.25rem` and Nuxt UI's multiples of it:

| Element | Radius |
|---|---|
| Badges, checkboxes | 4px |
| Buttons, inputs, selects, menu items | 6px |
| Cards, modals, popovers, tables | 8px |
| Avatars | Full circle |

Borders do the work shadows do elsewhere:

- Cards, tables and inputs: 1px `border-default` / `ring-default`. **No shadow.**
- Shadows only for things that float above the page: dropdown menus, popovers, tooltips, modals, toasts (Nuxt UI defaults).
- Don't stack cards inside cards. Use a divider or a sub-heading instead.

### Iconography

- **Set:** [Lucide](https://lucide.dev/icons/) only (`i-lucide-*`), bundled at build time.
- **Write icon names as literal strings** so the build can find them; names built at runtime (`` `i-lucide-${name}` ``) won't be bundled and will be blank.
- **Sizes:** 16px inline with 14px text (default), 20px in navigation, 24px+ only for empty states.
- **Icons support text, not replace it.** An icon-only button needs `aria-label` and a tooltip.
- Standard meanings: `circle-alert` error, `triangle-alert` warning, `circle-check` success, `info` information, `circle-help` unknown, `log-out` sign out, `plus` create, `pencil` edit, `trash-2` delete, `download` export, `search` search, `filter` filter.

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 150ms | Hover, focus, small state changes |
| `--duration-normal` | 200ms | Menus, popovers, modals, toasts appearing |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Everything |

- Only fades and short slides (≤8px). No bouncing, scaling or decorative animation.
- Never animate content people are reading (tables, numbers).
- `prefers-reduced-motion: reduce` turns all animation and transitions off (global rule in `main.css`).

### Formatting

The UI is in English; numbers, dates and currency follow Indonesian conventions. Always format through `app/utils/format.ts` (auto-imported), never with `toLocaleString()` directly, so the locale and the WIB time zone are consistent.

| Function | Example output | Notes |
|---|---|---|
| `formatDate(value)` | `16 Okt 2026` | |
| `formatDateTime(value)` | `16 Okt 2026, 22.30 WIB` | Always shown in Jakarta time, whatever the browser's time zone |
| `formatNumber(value)` | `1.234.567,89` | Up to 2 decimals by default |
| `formatCurrency(value)` | `Rp 1.234.567` | No decimals by default |
| `formatPercent(0.125)` | `12,5%` | Input is a fraction |

All return `null` for missing values; render that as an em dash `—`. The backend sends UTC timestamps; convert only for display.

---

## Components

Use Nuxt UI components (`U*`) with the props below. Only build a custom component when the same combination appears on three or more screens.

### Buttons and links

| Variant | Props | Use |
|---|---|---|
| Primary | `color="primary"` (default), `variant="solid"` | The main action of a page or dialog. **One per view.** |
| Secondary | `color="neutral" variant="outline"` | Other actions next to a primary ("Cancel", "Export") |
| Tertiary | `color="neutral" variant="ghost"` | Toolbar and low-emphasis actions, icon buttons |
| Destructive | `color="error" variant="soft"` | Delete/revoke. Opens a confirmation; the dialog's confirm button is `color="error" variant="solid"` |
| Link | `variant="link"` | Navigation inside text or card footers |

- **Sizes:** `md` (32px) is the default everywhere, including forms. `lg` (36px) only for a single hero action (e.g. "Sign in with Microsoft"). `sm` (28px) in table rows and dense toolbars.
- **Labels** are verbs in sentence case: "Create plan", "Save changes", not "OK" or "Submit".
- **Order:** in dialogs and forms, primary on the right, secondary to its left. In page headers, primary is the right-most action.
- **States:** show a spinner while the action runs (see [Loading states](#loading-states)); `disabled` only with a visible reason nearby.
- **Full-page navigations** (`/auth/*`) need `external`, so the router doesn't handle them.

### Forms

Use `UForm` + `UFormField` with a [Zod](https://zod.dev) schema for validation.

```vue
<UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
  <UFormField label="Plan name" name="name" required>
    <UInput v-model="state.name" class="w-full" />
  </UFormField>
  <UFormField label="Owner" name="owner" help="The person accountable for keeping this plan current.">
    <USelectMenu v-model="state.owner" :items="owners" class="w-full" />
  </UFormField>
  <div class="flex justify-end gap-2">
    <UButton color="neutral" variant="outline" label="Cancel" />
    <UButton type="submit" label="Save plan" loading-auto />
  </div>
</UForm>
```

- **Layout:** one column, labels above fields, 16px between fields (`space-y-4`), max width `max-w-xl` for single-column forms. Group long forms into cards with `h2` section headings.
- **Controls:** `md` size (32px). `UInput` text, `UInputNumber` numbers, `USelect` for ≤7 fixed options, `USelectMenu` for longer or searchable lists, `UInputDate` for dates, `UTextarea` for free text, `URadioGroup` for 2–4 visible choices, `USwitch` for settings that apply immediately, `UCheckbox` for opt-ins in a form.
- **Required fields:** mark with `required` (asterisk). If most fields are required, mark the optional ones "(optional)" instead.
- **Help text** goes in `help`, below the field, in `text-muted`. Don't use placeholders as labels; placeholders are for format examples only (`e.g. 4 hours`).
- **Validation:** validate on blur and on submit, not on every keystroke. Error text appears under the field in `error` colour, says what's wrong and how to fix it ("Enter an RTO between 1 and 72 hours"), and the field gets `aria-invalid`. On submit failure, focus the first invalid field.
- **Server errors** that aren't about one field: a `UAlert color="error"` at the top of the form.
- **Dates** are entered and shown as `16 Okt 2026`; send ISO dates (`2026-10-16`) to the API.
- **Money:** prefix `Rp`, no decimals unless the field needs them; format with `formatCurrency` when displayed.

### Data tables

Use `UTable` (TanStack Table under the hood). The app config makes every table compact: 8×12px cells, 12px uppercase headers on `bg-muted`, `tabular-nums`.

| Concern | Rule |
|---|---|
| Alignment | Text left, numbers and money **right**, status badges and actions left |
| Columns | Most important identifying column first (name/ID). Actions column last, `sm` ghost icon buttons or a `...` dropdown |
| Width | Don't wrap identifiers; truncate long text with a tooltip showing the full value |
| Sorting | Sortable headers show an arrow icon; default sort is stated in the UI or obvious (e.g. newest first) |
| Filtering | Toolbar above the table: search `UInput` with `i-lucide-search` on the left, filters (`USelectMenu`) next to it, primary action on the right |
| Pagination | `UPagination` below the table, right-aligned, with "Showing 1–25 of 312" on the left. 25 rows per page by default |
| Row click | If rows open a detail page, the whole row is clickable **and** the name cell is a real link (for keyboard and new-tab use) |
| Selection | Checkbox column first; bulk actions appear in the toolbar when rows are selected |
| Loading | `<SkeletonTable>` for the first load; `UTable :loading` (progress bar, rows stay visible) for refreshes. See [Loading states](#loading-states) |
| Empty | Centred message in the table body: what's missing and the next step ("No plans yet. Create the first plan."), with the primary action if the user can take it |
| Error | `UAlert color="error"` above the table with a "Try again" button; keep the last good data visible if there is any |
| Missing values | `—`, never blank or `null` |
| Dates and numbers | Through `format.ts` |

### Feedback

| Component | When | Rules |
|---|---|---|
| `UAlert` (inline) | A message about a page, form or section that stays until resolved | `variant="subtle"`, always an icon, title states the situation, description says what to do |
| Toast (`useToast()`) | Confirmation of an action the user just took ("Plan saved") | Success and info only; auto-dismiss after 5s; bottom-right; never for errors the user must act on |
| `UModal` | A focused task or a decision that blocks the flow | Title is a question or task ("Delete this plan?"), body explains consequences, actions: secondary "Cancel", then primary/destructive confirm |
| Confirmation dialog | Before destructive or irreversible actions | Name the object ("Delete 'Data centre outage'?"), say what is lost, confirm button repeats the verb ("Delete plan"). For very destructive actions, ask the user to type the name |
| Skeletons, spinners, progress | Anything that takes time | See [Loading states](#loading-states) |

Alert colours: `info` (blue) neutral information, `success` (green) completed, `warning` (amber) attention needed, `error` (rose) something failed. Icons: `info`, `circle-check`, `triangle-alert`, `circle-alert`.

### Loading states

Every wait gets feedback, but the right kind: brief waits get none, content gets a skeleton in its own shape, actions get a spinner on the control that started them, and long jobs get real progress.

#### What to show

| Situation | Show | Component |
|---|---|---|
| Navigating between pages | Thin red bar across the top of the window | `NuxtLoadingIndicator` in `app.vue` (automatic; appears after 300ms) |
| A page or section loading its data **for the first time** | Skeleton shaped like the content | `SkeletonGroup`, `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonKpi` |
| Data **refreshing** (filter, sort, page change, refetch) | Keep the current content visible, add a progress bar | `UTable :loading`, or `UProgress` (indeterminate) at the top of the card |
| A button action (save, delete, export) | Spinner in the button | `UButton loading-auto` (or `:loading`) |
| A form submitting | Spinner in the submit button; fields stay visible | `UForm loading-auto` + submit `UButton loading-auto` |
| A long job with known progress (import, bulk update) | Progress bar with percentage and what's happening ("Importing 120 of 450 plans") | `UProgress :model-value` |
| A long job without progress, over ~10s | Spinner plus a message that it's still working, and a way to leave | `UAlert color="info"` with `i-lucide-loader-circle` |
| Redirecting away (Microsoft sign-in) | Spinner in the button that started it | `UButton :loading` |

Never use a full-page spinner or overlay that blocks the whole app. Never show a skeleton and a spinner for the same thing.

#### Timing

| Wait | Behaviour |
|---|---|
| Under 300ms | Show nothing; the content just appears. A skeleton that flashes for 100ms reads as flicker. |
| 300ms – 10s | Skeleton (content) or spinner (action). |
| Over 10s | Add text saying what's happening; offer cancel if the API supports it. |
| Failed | Replace the skeleton with an error `UAlert` and a "Try again" button. Never leave a skeleton showing after a request has ended. |

`useDelayedLoading(source, delay = 300)` implements the 300ms rule:

```ts
const { data, status } = useFetch<Plan[]>('/api/plans')
const showSkeleton = useDelayedLoading(() => status.value === 'pending')
```

```vue
<SkeletonTable v-if="showSkeleton" toolbar />
<UAlert v-else-if="error" color="error" ... />
<UTable v-else-if="data" :data="data" :loading="status === 'pending'" />
```

#### Skeletons

Skeletons are grey placeholders in the **shape of the real content**, so the page doesn't jump when data arrives and the user can see what's coming.

| Component | Props | Use for |
|---|---|---|
| `SkeletonText` | `lines` (3) | A paragraph or a few lines of text |
| `SkeletonCard` | `lines` (4), `header` (true), `fields` (false: label/value rows) | A card; with `fields`, a details card like the profile's |
| `SkeletonTable` | `rows` (8), `columns` (5), `toolbar` (false) | A data table, optionally with its search/filter toolbar |
| `SkeletonKpi` | | A KPI tile |
| `SkeletonGroup` | `label` ("Loading") | Wraps several skeletons, or custom shapes, as one loading region |
| `.skeleton` class | | A single custom bar or circle inside a `SkeletonGroup`: `<div class="skeleton h-4 w-32" />` |

Rules:

- **Match the layout.** Same grid, same card count, roughly the same text widths and heights as the loaded state. `SkeletonTable` should use the real number of columns.
- **Vary widths** so it reads as text, and make the last line of a paragraph shorter (the components do this).
- **Only structure, never real labels.** Static parts that don't depend on data (page title, card titles you already know, buttons) render normally; only data-dependent parts are skeletons.
- **Pulse animation** only (no shimmer sweep). It switches off with reduced motion.
- **Don't use `USkeleton` for groups.** Nuxt UI's `USkeleton` makes every bar its own `role="alert"`, so a screen reader would announce "Loading" for each one. The components above announce once per region: a standalone skeleton is its own `role="status"` region, and inside a `SkeletonGroup` they are hidden from assistive technology while the group announces its `label`.
- **Give regions a specific label** when there are several on a page: `<SkeletonGroup label="Loading recovery plans">`.

Example, a dashboard's first load:

```vue
<SkeletonGroup v-if="showSkeleton" label="Loading dashboard" class="space-y-6">
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <SkeletonKpi v-for="n in 4" :key="n" />
  </div>
  <SkeletonTable :rows="5" :columns="4" />
</SkeletonGroup>
```

#### Spinners in buttons

- Prefer `loading-auto`: Nuxt UI shows the spinner while the `@click` (or `UForm @submit`) handler's promise is pending, so you can't forget to reset it.
- The spinner replaces the leading icon; the label stays, so the button keeps its width and the user knows what's running.
- If you fill the `#leading` slot yourself (like the Microsoft logo on the login page), the slot replaces the spinner too, so render `<UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />` in it while loading.
- Spinners keep turning (slower) under reduced motion, because they're the only sign that work is running. Other animations stop.
- A loading button can't be clicked again (prevents double submits). Other controls stay usable unless the action would conflict with them.
- If the action is quick and succeeds, follow it with a success toast ("Plan saved"); if it fails, an error message, never a silent reset.

#### Accessibility

- Loading regions use `role="status"` with `aria-busy="true"` and a label, so screen readers say "Loading profile" once (polite, doesn't interrupt).
- When content arrives, don't move focus; when a user-started action finishes, keep focus on the button (or move it to the error message if it failed).
- Loading indicators must not be the only signal for a failure; see [Feedback](#feedback).

### Status badges

Statuses are shown with `<StatusBadge>`, driven by a **status scale**: a single definition of every value's label, colour and icon. Define each scale once, next to the feature that owns it, and use it everywhere that status appears (tables, detail pages, charts, filters).

```ts
// app/utils/status.ts or the feature's own file
export const planStatus = defineStatusScale({
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  in_review: { label: 'In review', color: 'info', icon: 'i-lucide-eye' },
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-circle-check' },
  expired: { label: 'Expired', color: 'warning', icon: 'i-lucide-clock-alert' },
})
```

```vue
<StatusBadge :scale="planStatus" :value="plan.status" />
```

(The example is illustrative; BCM scales will be defined with their features.)

Rules:

- **Every status has an icon**, so it never depends on colour alone.
- **Colour by meaning, not by position:** `success` good/done, `info` in progress/neutral, `warning` needs attention, `error` failed/breached, `neutral` not started/unknown. A scale may reuse a colour (e.g. two neutral states) but then the icons and labels must differ.
- **Ordered severity scales** (e.g. low → critical) use `neutral` → `info` → `warning` → `error`. Never use brand red (`primary`) for a status.
- Badges are `variant="subtle"` and `size="md"` (`sm` in dense tables). An unrecognised value renders as an outlined "Unknown" badge rather than breaking the page.
- Labels are short (1–3 words) and sentence case.
- Keys match the API's values exactly (`in_review`), so data can be passed straight in.

### Cards and KPI tiles

**Cards** (`UCard`) group related content. Header with an `h2`/`h3` title (optional leading icon and right-aligned actions), body, optional footer for links or secondary actions. Border only, no shadow, 24px padding (Nuxt UI default). Don't nest cards.

**KPI tiles** summarise one number on dashboards. Compose them from `UCard`:

```vue
<UCard>
  <p class="text-sm text-muted">Plans due for review</p>
  <p class="mt-1 text-3xl font-semibold tabular-nums text-highlighted">{{ formatNumber(12) }}</p>
  <p class="mt-1 text-xs text-muted">
    <UIcon name="i-lucide-arrow-up-right" class="text-warning" /> 3 more than last month
  </p>
</UCard>
```

- Label on top (what is counted), value large, context below (trend, target, or time period).
- Trend direction: arrow icon + words. Colour the arrow by whether the change is **good or bad**, not by direction (more overdue plans is bad even though it's "up").
- Rows of 2–4 tiles (`grid gap-6 sm:grid-cols-2 lg:grid-cols-4`). If a tile is clickable, the whole tile links to the filtered list behind the number.
- Show `—` with a short reason when a value can't be computed; never show `0` for "unknown".

### Charts

**Library:** [Apache ECharts](https://echarts.apache.org) through [`vue-echarts`](https://github.com/ecomfe/vue-echarts). Use **`<AppChart>`** (`app/components/AppChart.vue`): it is the card with the title, the summary sentence, the *View as table* switch, the loading skeleton and the empty message at a fixed height, and it loads ECharts on demand (`app/charts/echarts.ts`, SVG renderer so text keeps its size at any width). Pass it an ECharts `option` and the same data as `table`. `SccaBarChart` and `SccaLineChart` are examples. The theme is registered once in `app/charts/echarts.ts`:

```ts
import * as echarts from 'echarts/core'
echarts.registerTheme('bcm', CHART_THEME) // from app/utils/chart.ts
```

Then render with `<VChart theme="bcm" :option="option" autoresize />`. Import only the chart types you use (`echarts/charts`, `echarts/components`) to keep the bundle small.

Rules:

- **Choose the simplest chart:** bar for comparing categories, line for trends over time, stacked bar for parts of a whole across categories. Avoid pie charts beyond 3 slices; never use 3D.
- **Colours:** series palette in order; status colours (with legend labels) when the series *are* statuses. Brand red is not a series colour.
- **Always** a title (in the card header), axis labels with units, and a legend when there's more than one series. Format axis and tooltip values with `format.ts`.
- **Accessibility:** charts also need a text alternative: a summary sentence above or below ("12 of 40 plans are overdue"), and a "View as table" toggle for anything non-trivial. Set `aria` in the ECharts option to enable generated descriptions.
- **Gridlines** light (`#E2E8F0`), horizontal only. Start value axes at zero for bars.
- **Empty and loading** states as for tables: a `<SkeletonCard>` with the chart's height while loading, and keep the card size fixed so the page doesn't jump.

### Navigation and page structure

**App shell** (`app/layouts/default.vue` and `AppPage`):

```text
┌───────────────┬──────────────────────────────────────────────────────┐
│ [logo] BCM    │ [⇤] Page title     [actions] │ [🔔] [avatar] Name ▾  │  ← navbar (h1)
│ Tools         ├──────────────────────────────────────────────────────┤
│               │ Home / Module / Page                                 │  ← breadcrumbs
│ Home          │ One-line description                                 │
│ SCCA        ▾ │                                                      │
│   Assessments │   page content (<main>), max-w-7xl, centred          │
│   New …       │                                                      │
│ Administration│                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
```

- **Sidebar** (`UDashboardSidebar` + `UNavigationMenu`): built from `GET /api/me/menu`, so each user sees only what their roles allow. Groups expand; the current page is highlighted in primary. Collapsible to icons (`⇤` in the navbar), resizable, and a slide-over on small screens. Background `bg-muted/60`, a border on the right.
- **Every page** is wrapped in `<AppPage title="..." icon="..." description="..." :crumbs="...">`. It renders the navbar (the page `h1` with its icon, and an `actions` slot), breadcrumbs and a one-line description, and sets the browser tab title to "Page · BCM Tools".
- **Top-right of the navbar**, on every page: the page actions, a divider, the **notification bell** (`NotificationsMenu`) and the **user menu** (`UserMenu`: avatar, with name and roles from `lg` up; opens Profile, Change password and Sign out). Below `sm` (phones) the page actions move to a row under the navbar (`UDashboardToolbar`) so the title, bell and avatar always fit.
- **Notifications** are a placeholder for now: the bell opens a panel with a "Coming soon" badge and an empty state. `composables/useNotifications.ts` holds the type, the unread count (shown as a dot on the bell) and where to plug in the future `GET /api/me/notifications`; the menu needs no change when it goes live.
- **Menu icons** come from the database, so they must be in `utils/menu-icons.ts` (bundled at build time); the Menus admin page only offers those.
- **Page actions** go in the `actions` slot (primary on the right).
- **Breadcrumbs** (`AppPage` `crumbs`) on module pages, starting from Home: `Home / SCCA` on the module list, `Home / SCCA / New assessment` (or the record name) one level down. Not on Home itself. The last crumb is the current page and is not a link.
- **Tabs** (`UTabs`) to switch between views of the same record. Don't use tabs for steps in a process (use a stepper, `UStepper`).
- **Public pages** (sign-in, forgot and reset password, a forced password change) opt out of the shell with `definePageMeta({ layout: false })` and use `AuthShell`: the brand panel on the left, one card on `bg-muted` on the right.
- **Data tables** sit edge to edge in a card (`:ui="{ body: 'p-0 sm:p-0' }"`): filters in a toolbar above the table (`border-b p-4`), "Showing x–y of z" and pagination in a footer (`border-t p-4`). Row actions go in a `⋮` menu in the last column.

---

## Accessibility checklist

Target: **WCAG 2.2 AA**. Check every new screen against this list.

- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for text ≥ 18px or 14px bold, and for icons and input borders). Use semantic colours; don't introduce new ones without checking.
- [ ] Nothing is communicated by colour alone: statuses have icons and labels, errors have icons and text, charts have labels.
- [ ] Everything works with the keyboard, in a logical order, with a visible focus ring (Nuxt UI's default; never remove `outline`).
- [ ] Icon-only buttons have `aria-label` (and a tooltip).
- [ ] Form fields have visible labels; errors are linked to their field and announced.
- [ ] One `h1` per page (from `AppPage`, screen-reader only), headings in order.
- [ ] Images have `alt` text (`alt=""` if decorative).
- [ ] Click targets are at least 24×24px (WCAG 2.5.8).
- [ ] Usable at 200% browser zoom and at 768px width.
- [ ] Respects reduced motion (handled globally).
- [ ] Charts have a text summary and a table view.

---

## Writing style

- **English, plain and direct.** Write for busy bank staff, not engineers. "Plan saved", not "The operation completed successfully".
- **Sentence case** everywhere: titles, buttons, labels, menu items.
- **Buttons are verbs** naming the outcome: "Create plan", "Export to Excel".
- **Errors** say what happened and what to do: "Couldn't save the plan. Check your connection and try again."
- **Empty states** say what's missing and the next step.
- Use BCM terms consistently (pick one: "BCP" or "plan", "exercise" or "test") and keep a glossary in this file as features are added.
- Dates and numbers through `format.ts`. Write "WIB" after times.

### Glossary (SCCA)

| Term | Meaning |
|---|---|
| SCCA | System Criticality Categorisation Assessment |
| SCC | The resulting criticality category |
| CIA | Combined Confidentiality, Integrity and Availability score |
| Potential Loss | Impact dimension (financial, customer, reputation, regulatory) |
| MTD | Maximum tolerable downtime |
| RTO | Recovery time objective |
| RPO | Recovery point objective |

SCCA categories use `sccaCategory` in `app/utils/scca.ts`: Critical (`error`), Very Important (`warning`), Important (`info`), Necessary and Other (`neutral`).

### Glossary (RA)

| Term | Meaning |
|---|---|
| RA | Risk Assessment of a work location (office building) |
| RA Branch | The same assessment for a branch, from the Cabang workbook: one residual risk per hazard and three sign-offs |
| LRP | Location Risk Profile, the RA scorecard workbook |
| LIC | Location Incident Coordinator |
| LICOM | Location Incident Commander |
| CBF | Critical business function |
| Gross risk | Probability × impact before the existing mitigation measures |
| Residual risk | Probability × impact after the existing mitigation measures |
| CIM | Control Issue Management, the follow-up for a high residual risk |
| DAT / ERT | Damage Assessment Team / Emergency Response Team |
| IMT / RTF | Incident Management Team / Recovery Task Force of a critical business function |
| LCP | Location Continuity Plan: the building's occupants, continuity strategy, recovery team and call tree (RA only) |
| BOSM / BM / NRSOH | Branch roles in RA Branch: the BOSM is the LIC and prepares the RA, the branch manager (BM) approves it, the NRSOH is the LICOM and reviews it |
| Crisis | One of the 33 RA hazards happening now at a point, with an affected radius; open until closed, with a history |
| Guidebook | The crisis guidebook: BCM's standard steps per hazard (right away, within the first hours, recovery), shown with every crisis of that hazard |
| Alternate place | A building or branch outside a crisis's area, nearest first, where an affected place can move |

Maps (`RaMap.vue`, Leaflet) are a supplement, never the only way to see something: every pin also appears as text next to the map (a list, a table or the location card), and the map region has an accessible name. Pins use the semantic risk colours (`RA_PIN_CLASS`: High `text-error`, Medium `text-warning`, Low `text-info`, none `text-muted`) with a legend in words. Scroll-wheel zoom is off so the page scrolls normally; use the + / − buttons or the keyboard. Names go into tooltips as text, never HTML. A second kind of place on the same map gets a different shape, not only a different colour: branches are rounded squares with a bank glyph, head office buildings pins, and a crisis point a siren in a circle. A distance ring around the selected place is dashed (`.ra-radius`, `primary` when it belongs to the selection), a crisis's affected area is a solid `error` ring (`.ra-radius-crisis`), and a measured distance a dashed `primary` line (`.ra-measure`). Distances are written `850 m` / `7,1 km` (`raFormatDistance`) and say they are straight-line; road distance is a link to Google Maps.

Crisis statuses use `raCrisisStatus`: Open (`error`, `i-lucide-siren`) and Closed (`neutral`). Open crises are an `error` `UAlert` above the location map with a link to their instructions. Declaring a crisis is the page's one solid action, in `error`. Playbook steps not yet reviewed by BCM carry `raPlaybookReview` *Starter steps* (`warning`) and a warning banner on the crisis; reviewed ones *Reviewed by BCM* (`success`).

RA sign-off statuses use `raStatus`: Draft (`neutral`), Returned (`warning`), In sign-off (`info`), Approved (`success`); `raCompletion` (Complete / Incomplete) only says whether a draft is ready to submit. A locked (in sign-off or approved) assessment shows its forms with disabled controls and no save buttons, plus one banner naming who is up next — not an error. Approve is the primary action of the sign-off step; Return for changes is a destructive outline button that always asks for a comment.

RA risk levels use `raRiskLevel` in `app/utils/ra.ts`: High (`error`), Medium (`warning`), Low (`info`), Not applicable (`neutral`). Heat-map cells add a light tint of the same semantic colour (`bg-error/10`, `bg-warning/10`, `bg-info/5`), always with the level badge, so the level never depends on colour alone. Workbook content (hazard names, rating guidance, the sign-off statement) stays in Indonesian as data; the interface around it is English.

RA and RA Branch share their screens (`app/components/ra/Ra*Page.vue`, used by thin pages under `pages/ra/` and `pages/ra-branch/`). Anything that differs on screen — titles, "location" or "branch", the LIC/LICOM hints, the sign-off roles, the region field — comes from `RA_MODULES` in `app/utils/ra.ts` through `useRaModule()`; don't branch on the route in a component. Add and view buttons of a list sit in the table card's toolbar, right above the table, not in the page header. Like SCCA, each module has **Monitoring** (read-only), **Manage** (drafts) and **Approval** (inbox, history, BCM board); build links with `raPath()` / `raRecordPath()`, never by hand. On the Hazards tab the user picks a hazard group first (one card per category, with its rated count), then a hazard of that group.

---

## Changing the system

1. **Tokens** (colours, font, motion) change in `app/assets/css/main.css`. Keep `CHART_PALETTE` in `app/utils/chart.ts` in sync with `--color-chart-*`.
2. **Component defaults** change in `app/app.config.ts` (see each component's "Theme" section in the Nuxt UI docs for slot names).
3. **New colours:** check contrast against white (≥ 4.5:1 for text and fills with white text) before adding.
4. **New shared components** go in `app/components/` and get a section here.
5. Update this document in the same pull request as the change.
