# Design

Visual system for tsundoku. Strategy lives in [PRODUCT.md](./PRODUCT.md); this file documents the tokens, fonts, and component vocabulary that implement it. Tailwind v4 + shadcn-style token names; nothing here should require hand-rolled CSS outside `app.css`'s `@theme` block.

## Lane

**Reading Room.** Warm paper light surface + warm-ink text + deep oxblood accent. Dark mode is the same room at dusk under a study lamp — not "inverted." Covers carry the chroma; the UI gets out of the way.

Scene sentence: *A bibliophile checking on their library from their couch on a Sunday afternoon — daylight through the window now, a dim study lamp at dusk; the same shelves, same room, two different lights.*

Anchors: Are.na, Criterion Channel browse, MUBI, Linear settings (operator surfaces), Raycast (command palette).

## Color tokens

OKLCH, with chroma reduced near the lightness extremes. All neutrals carry a faint warm tint (`c ≈ 0.005–0.018`, hue ≈ 60–85 — paper) so they never look bleached. **No `#000`, no `#fff` anywhere.**

Token names follow shadcn-svelte conventions so primitives drop in without rewiring.

### Light theme — "daylight"

| Token | OKLCH | Role |
|---|---|---|
| `--color-background` | `oklch(0.972 0.014 82)` | Page paper |
| `--color-foreground` | `oklch(0.205 0.008 60)` | Ink |
| `--color-card` | `oklch(0.985 0.010 85)` | Raised paper (continue-reading tiles, modal sheets) |
| `--color-card-foreground` | `oklch(0.205 0.008 60)` | Same ink |
| `--color-popover` | `oklch(0.992 0.006 85)` | Floating panels |
| `--color-popover-foreground` | `oklch(0.205 0.008 60)` | |
| `--color-muted` | `oklch(0.935 0.012 80)` | Quiet surface (filters, secondary panels) |
| `--color-muted-foreground` | `oklch(0.495 0.012 70)` | Secondary text |
| `--color-border` | `oklch(0.895 0.010 75)` | Hairline rules |
| `--color-input` | `oklch(0.895 0.010 75)` | Input borders |
| `--color-ring` | `oklch(0.448 0.142 26)` | Focus ring (accent) |
| `--color-primary` | `oklch(0.448 0.142 26)` | Maroon — primary action, active state |
| `--color-primary-foreground` | `oklch(0.985 0.010 85)` | Paper on maroon |
| `--color-secondary` | `oklch(0.935 0.012 80)` | Secondary button surface |
| `--color-secondary-foreground` | `oklch(0.205 0.008 60)` | |
| `--color-accent` | `oklch(0.918 0.024 70)` | Hovered nav row, subtle highlight |
| `--color-accent-foreground` | `oklch(0.205 0.008 60)` | |
| `--color-destructive` | `oklch(0.515 0.176 30)` | Errors only |
| `--color-destructive-foreground` | `oklch(0.985 0.010 85)` | |
| `--color-sidebar` | `oklch(0.945 0.012 80)` | Sidebar surface (one tick darker than page) |
| `--color-sidebar-foreground` | `oklch(0.205 0.008 60)` | |
| `--color-sidebar-border` | `oklch(0.895 0.010 75)` | |
| `--color-sidebar-accent` | `oklch(0.910 0.022 70)` | Hovered/active nav row |
| `--color-sidebar-accent-foreground` | `oklch(0.205 0.008 60)` | |
| `--color-sidebar-ring` | `oklch(0.448 0.142 26)` | |

### Dark theme — "study lamp"

| Token | OKLCH | Role |
|---|---|---|
| `--color-background` | `oklch(0.165 0.008 50)` | Warm dim ground (not slate, not pure black) |
| `--color-foreground` | `oklch(0.920 0.018 80)` | Warm paper-ink, slightly amber |
| `--color-card` | `oklch(0.210 0.010 55)` | Raised surface |
| `--color-card-foreground` | `oklch(0.920 0.018 80)` | |
| `--color-popover` | `oklch(0.225 0.012 55)` | |
| `--color-popover-foreground` | `oklch(0.920 0.018 80)` | |
| `--color-muted` | `oklch(0.225 0.010 55)` | |
| `--color-muted-foreground` | `oklch(0.660 0.014 75)` | |
| `--color-border` | `oklch(0.265 0.012 60)` | |
| `--color-input` | `oklch(0.265 0.012 60)` | |
| `--color-ring` | `oklch(0.708 0.118 32)` | Brass — accent in dark mode |
| `--color-primary` | `oklch(0.708 0.118 32)` | Brass replaces maroon (maroon goes muddy in dark) |
| `--color-primary-foreground` | `oklch(0.165 0.008 50)` | |
| `--color-secondary` | `oklch(0.245 0.012 58)` | |
| `--color-secondary-foreground` | `oklch(0.920 0.018 80)` | |
| `--color-accent` | `oklch(0.260 0.014 60)` | |
| `--color-accent-foreground` | `oklch(0.920 0.018 80)` | |
| `--color-destructive` | `oklch(0.638 0.196 27)` | |
| `--color-destructive-foreground` | `oklch(0.985 0.010 85)` | |
| `--color-sidebar` | `oklch(0.190 0.010 55)` | |
| `--color-sidebar-foreground` | `oklch(0.920 0.018 80)` | |
| `--color-sidebar-border` | `oklch(0.245 0.012 60)` | |
| `--color-sidebar-accent` | `oklch(0.235 0.014 58)` | |
| `--color-sidebar-accent-foreground` | `oklch(0.920 0.018 80)` | |
| `--color-sidebar-ring` | `oklch(0.708 0.118 32)` | |

## Typography

Three families, one role each. **No display fonts in UI labels.**

| Family | Usage | Variable |
|---|---|---|
| **Spectral** | Wordmark, page titles (H1), book titles in detail-hero, large quotes | `--font-display` |
| **Inter** | All UI — body, nav, buttons, labels, secondary copy | `--font-sans` |
| **JetBrains Mono** | Format labels (`EPUB · CBZ · AUDIO · PHYSICAL`), ISBNs, paths, identifiers, version strings, operator-surface tables | `--font-mono` |

Scale (Tailwind utilities):

| Step | Class | Used for |
|---|---|---|
| display-2 | `text-5xl font-display tracking-tight` | Login hero, empty-state hero |
| display-1 | `text-4xl font-display tracking-tight` | Book-detail title |
| h1 | `text-3xl font-display tracking-tight` | Page titles |
| h2 | `text-xl font-medium tracking-tight` | Section titles |
| h3 | `text-sm font-medium uppercase tracking-wider text-muted-foreground` | Sidebar group titles, format labels |
| body | `text-sm leading-relaxed` | UI body |
| body-prose | `text-base leading-7 max-w-[68ch]` | Long copy (settings descriptions) |
| caption | `text-xs text-muted-foreground` | Secondary metadata |
| code | `font-mono text-xs` | ISBNs, IDs, paths |

## Radii

| Token | Value | Used for |
|---|---|---|
| `--radius-sm` | `0.25rem` | Inputs, small buttons, chips |
| `--radius-md` | `0.5rem` | Cards, panels |
| `--radius-lg` | `0.75rem` | Modals, the book-detail hero |

Book covers are intentionally **not** rounded — paper edges, like physical books on a shelf. Apply `rounded-none` explicitly.

## Format-by-aspect

The book format is encoded in the cover's aspect ratio AND a caps-mono label. Hue is never the sole carrier.

| Format | Aspect | Label | Notes |
|---|---|---|---|
| PDF / EPUB / MOBI / AZW3 / FB2 | `2/3` | `EPUB` etc | Book proportions |
| CBX (CBZ/CBR comic) | `2/3` portrait, or `1/1.4` for landscape | `CBZ` | Comic-jacket proportions |
| AUDIOBOOK | `1/1` | `AUDIO` | Square sleeve, like an LP |
| Physical-only edition | `2/3` ghosted | `PHYSICAL` | Outline-only border + tag-icon overlay |

## Motion

- Hover lift on cover plates: `translate-y-[-2px] shadow` over 180ms ease-out. Respect `prefers-reduced-motion`.
- Nav active state: instant; no slide.
- Theme toggle: 240ms cross-fade on background + foreground only; no layout movement.
- No bounce, no elastic, no page-load orchestration.

## Component vocabulary

Built in `apps/web/src/lib/components/`:

- **ui/** — `button.svelte`, `input.svelte`, `label.svelte`, `select.svelte`, `kbd.svelte`, `skeleton.svelte`, `format-label.svelte`, `icon-button.svelte`. Shadcn-style: each has variant + size props via `tailwind-variants`.
- **app/** — `app-sidebar.svelte`, `app-topbar.svelte`, `theme-toggle.svelte`, `command-trigger.svelte`, `user-menu.svelte`.
- **library/** — `book-cover.svelte` (handles per-format aspect), `book-card.svelte`, `continue-reading-rail.svelte`, `library-grid.svelte`, `density-toggle.svelte`, `library-filters.svelte`.

## Anti-patterns (do not introduce)

- Nested cards. The book-detail hero is not a card inside a card.
- Colored format badges. Format goes in caps-mono + aspect, never as a colored pill.
- Gradient buttons or gradient text.
- Modal-first metadata editing. Editing happens inline; modals only for destructive confirmations.
- Spinners on content. Use skeletons that match the grid shape.
- Custom CSS outside `app.css`'s `@theme` and a tiny `@layer base` block. All component styling stays in Tailwind utility classes.
