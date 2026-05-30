# Per-section design systems

How each signed-in section (Capital, Fantasy, Pool, …) gets its **own visual
identity that shares no CSS with the marketing site or the other sections** —
and how to add the next one.

The whole trick is two things working together:

1. **A CSS file scoped to `[data-theme="<section>"]`** — so its tokens and
   component classes physically cannot apply anywhere else.
2. **Importing that CSS only in the section's `layout.tsx`** — so Next.js
   code-splits it; it never even loads on other routes.

Everything else (routing, the shared `AppShell` header/nav, the data layer) is
shared. Only the *look* is walled off.

---

## The recipe (copy this for a new section "foo")

### 1. Create the section's CSS folder — `src/styles/foo/`
- `index.css` — design tokens + component classes (`.card`, `.btn`, `.tbl`, …).
- `app.css` — page/layout helpers specific to this section (`.foo-page`,
  grids, rows, etc.).

**Every rule must be nested under `[data-theme="foo"]`.** Use native CSS nesting
(Next/Lightning CSS supports it):

```css
[data-theme="foo"] {
  /* tokens live on the scope itself ( `&` == the wrapper ) */
  & {
    background: var(--foo-bg);
    color: var(--foo-text);
    font-family: var(--foo-font-text);
    /* …all --foo-* token definitions… */
  }

  /* component classes — these resolve to `[data-theme="foo"] .card`, so they
     can't leak to the marketing site or other sections */
  .card { background: var(--foo-surface); border-radius: 16px; /* … */ }
  .btn-primary { /* … */ }
  .tbl { /* … */ }
}
```

Two ways to source the styles (we've done both):
- **Capital** (`src/styles/capital/`): vendored an external design-system zip.
  A small Node transform wraps the vendored CSS in the `[data-theme="capital"]`
  block, turns `:root`/`body` into `&`, strips its Google-font `@import`, and
  remaps fonts to our next/font vars. Capital swaps in its **own slate palette**.
- **Fantasy** (`src/styles/fantasy/`): authored from scratch, **reusing the
  shared Whoosh palette** from `globals.css` — only structure/typography differ.

Either is fine. The non-negotiable is the `[data-theme]` scope.

### 2. Wire fonts via next/font — `src/app/layout.tsx`
Load the section's display/number fonts there, assign each a CSS variable on
`<html>` (e.g. `--font-foo`), then point the section's `--foo-font-*` tokens at
them. Don't `@import` Google Fonts inside the section CSS (double-load + layout
shift).

### 3. Add the `[data-theme="foo"]` block in `globals.css`
`globals.css` keeps generic structural defaults (`--theme-border-width`,
`--theme-radius`, `--theme-card-shadow`, `--theme-surface`) that the **shared
`AppShell` chrome** reads. Add a `[data-theme="foo"] { … }` block there setting
those `--theme-*` values (and, if you remap palette vars like `--ink`, do it
here or in the section CSS) so the header / back button / bottom bar adopt the
section's look. The marketing site and other sections are untouched because
they're outside this attribute scope.

### 4. The section layout owns the scope + import — `src/app/foo/layout.tsx`
```tsx
import { requirePremiumSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import "@/styles/foo/index.css";
import "@/styles/foo/app.css";

export const dynamic = "force-dynamic";

export default async function FooLayout({ children }: { children: React.ReactNode }) {
  await requirePremiumSession();                 // premium gate, once for the whole section
  return (
    <div data-theme="foo" className="flex flex-1 flex-col">
      <AppShell section="foo">{children}</AppShell>
    </div>
  );
}
```
- The `data-theme="foo"` wrapper is what activates the scoped CSS.
- The CSS imports here are code-split to `/foo/*` routes → zero leakage.
- The wrapper carries **no color utilities** — the section CSS paints the canvas.

### 5. Page shell helper (avoids the mobile-overflow trap)
Give the section a page-container class and include these four lines — they
prevent a flexbox bug where the page grows wider than the phone screen:
```css
.foo-page {
  width: 100%;          /* track the parent, not the content's max width */
  max-width: var(--foo-container);
  margin: 0 auto;
  min-width: 0;         /* let the flex item shrink */
  overflow-x: clip;     /* safety net; safe because no position:sticky lives inside */
}
```

### 6. Register the section in nav — `src/lib/sections.ts`
Add a `SECTIONS.foo` entry: `key`, `label`, `href`, `nav` (sub-pages), `tabs`
(mobile bottom-bar items + icon keys). The shared `AppShell`, `SectionSubNav`,
`MobileRouteStrip`, and `BottomTabBar` are all config-driven from this file, so
you don't touch them. (New tab icons: add to the `ICONS` map in
`BottomTabBar.tsx` and the `IconKey` union in `sections.ts`.)

### 7. Author pages with the section's own classes
Build pages from the section's component classes (`.card`, `.kpi`, `.tbl`,
`.btn`, …) + the section's layout helpers (`.foo-*`). **Do not** use the global
brand utilities (`bg-blue`, `border-ink`, `rounded-theme`, `font-display`, the
color-block look) — that's the "main design," and using it defeats the
separation. Section-specific React components live in `src/components/foo/`.

---

## Why it can't leak (the guarantees)
- **Selector scope:** every section rule is under `[data-theme="foo"]`, so it
  only matches inside that wrapper.
- **Load scope:** the CSS is imported in the section layout only → Next
  code-splits it; other routes never download it.
- **Verify:** load marketing `/` and confirm its body font / colors are
  unchanged and section classes (`.card`, `.kpi`) have no effect there.

## Gotchas we hit (so you don't)
- **Mobile overflow:** a flex child with `margin: 0 auto` sizes to its content's
  max width → page wider than the screen. Fix: `width: 100%` + `min-width: 0` on
  the page container (see step 5).
- **`overflow-x: clip`** on the page container is safe *only* because no
  `position: sticky` element lives inside it (the sticky header/sub-nav are
  siblings, in `AppShell`). Don't clip an ancestor of a sticky element.
- **Wide tables / horizontal rails on mobile:** wrap them in an
  `overflow-x: auto` container so they scroll instead of widening the page.
- **`react-hooks/set-state-in-effect` lint:** never call `setState`
  synchronously in an effect body — defer it (timeout/callback) or derive the
  value during render.
- **Numbers:** in finance contexts use the mono/tabular treatment so figures
  don't jitter and line up in tables.

## File map (reference)
```
src/styles/<section>/index.css      scoped tokens + components
src/styles/<section>/app.css        scoped page/layout helpers
src/app/<section>/layout.tsx        gate + data-theme wrapper + AppShell + CSS imports
src/app/globals.css                 [data-theme="<section>"] → --theme-* for the shared shell
src/app/layout.tsx                  next/font loading (--font-<section>)
src/lib/sections.ts                 nav/tab config (single source of truth)
src/components/<section>/*           section-specific React components
src/components/AppShell.tsx         shared header/back-button/sub-nav/bottom-bar (config-driven)
```
Examples to copy: **Capital** (`src/styles/capital/`, `src/app/capital/`) and
**Fantasy** (`src/styles/fantasy/`, `src/app/fantasy/`).
