# Product

## Register

product

## Users

Self-hosters running tsundoku on their home server or NAS to manage a personal media library of ebooks, comics (CBZ/CBR), audiobooks, and metadata records for physical books. They are:

- **Technically literate** — they chose to self-host, comfortable with Docker, file paths, OIDC, OPDS, ISBNs, and CFI positions.
- **Collectors and readers** — they care about their library as an object, not just a queue. Their library is mixed-format (an EPUB of one volume next to a CBZ of another, an audiobook companion, a paper-only edition tracked for completeness).
- **Returning, not exploring** — sessions are short and intentional: "open the book I was reading," "scan the new drop folder," "fix this book's metadata," "send this to my Kobo." Not "browse for hours."
- **Solo or small household** — single-tenant or a few accounts (partner, kids with age-rating limits). No social layer, no public sharing, no reviews-as-content.

Context: a tab open on a desktop while doing something else, a phone in bed before sleep, a tablet on the couch reading a comic, a Kobo or KOReader they sync to. They expect the app to remember where they are and get out of their way.

## Product Purpose

Tsundoku is a **personal library OS** — one place to *house*, *find*, *read*, and *push to other devices* a multi-format book collection. It exists because:

- Calibre is desktop-only and looks like 2008.
- Goodreads is social-network noise around the wrong thing.
- Komga, Audiobookshelf, and Kavita each solve one format; nothing serious unifies all four.
- The upstream (Booklore) covers the features but presents them as a generic enterprise PrimeNG dashboard.

Success looks like: a user opens tsundoku, sees their actual shelves (not a SaaS dashboard), and is reading in two clicks. Adding a book is invisible (drop folder, scan, done). Metadata is fixable inline. Reading state syncs across the web reader, Kobo, KOReader, and the OPDS feed. The app is good enough that a self-hoster shows it off to friends because *it looks like a tool worth having*, not because they tolerate the UI.

## The name

**Tsundoku** (積ん読) is the Japanese word for the pile of books a reader keeps acquiring with every intention of reading. It is not a tidy library; it is the slightly guilty stack on the nightstand, the second shelf gone double-deep, the EPUBs queued for a quiet weekend. Naming the product *tsundoku* is a deliberate choice: this is the home of the unread-but-intended-to-be-read alongside the finished. The interface should never shame the user for the pile; it should make the pile easy to live with, to browse, and to occasionally read.

The product still talks about "libraries" (filesystem-roots-being-scanned) and "shelves" (curated collections) because those are concrete features. But the *atmosphere* is "the pile" — accruing, personal, unembarrassed.

## Brand Personality

Three words: **bookish, calm, exacting.**

- **Bookish** — the product is unembarrassed to be about books. Covers and spines are the dominant texture. Typography is treated like book design, not dashboard design. The atmosphere is a private reading room with an accruing pile, not a SaaS dashboard.
- **Calm** — the home of someone's pile should not feel urgent. Restrained color, generous space around content, motion that whispers, no notification badges or growth-loop nudges. No "📚 You haven't read X in N days" guilt-marketing.
- **Exacting** — the moment a power user needs to do something precise (rule-build a magic shelf, edit ISBN-13, configure metadata-provider priority, audit-log a permission change), the interface gets dense, monospace, keyboard-driven, and trustworthy. The calm reading surface and the dense admin surface are the same product, both deliberate.

Voice: short, literal, no marketing prose. "Scan now," not "Refresh your library 🚀." Labels read like a catalog, not a CTA. The word *pile* is available when the metaphor wants it ("new to the pile", "still in the pile") — the word *library* belongs to the filesystem feature.

## Anti-references

What this should NOT look like:

- **PrimeNG enterprise dashboards** (the legacy Booklore Angular UI). Grayscale-on-grayscale, icon-only sidebars, generic Material chrome, dialogs for everything. The current upstream visual ceiling — we move away from it deliberately.
- **Vercel/shadcn template starters** (the current Phase-0 scaffold). Flat top-nav of 9 muted text links, single max-w-6xl column, white-on-white card with `API health: ok · vdevelopment` exposed to logged-out users. Identity-free.
- **Goodreads-style social bookshelves** — stars, friend activity, reviews-as-content. We are not social.
- **Calibre desktop chrome** — left tree + right table, multi-pane density modeled on a 2008 desktop app.
- **AI-generated SaaS dashboard tropes** — neon-on-near-black, glassmorphism, gradient hero-metric cards, "Total Books 1,243 ↑ 12%" telemetry-as-decoration.
- **Audible / Kindle store** — commercial bookstore vibe, jacket-grid with buy buttons and ratings dominant. We are the inverse: a private library, not a storefront.

## Design Principles

1. **The collection is the interface.** Covers, spines, and titles fill the screen before chrome does. Nav, filters, and metadata recede; the books advance. If you remove the books from any screen, the screen should feel emptied — not still-designed-but-empty.
2. **Two atmospheres, one product.** A reading-room surface (browse, detail, read) that is calm, warm-neutral, generous, low-chroma — and an operator surface (admin, scan jobs, magic-shelf rule builder, audit log) that is dense, monospace-leaning, keyboard-first, and unapologetically technical. Same tokens, different application. Never blur them into a single mid-tone.
3. **Format is visible.** An EPUB, a CBZ, an audiobook, and a physical-only record are visually distinct at a glance — through aspect ratio, mark, or treatment, not just a colored badge tacked into a corner. A library that's 60% comics should look different from one that's 60% audiobooks.
4. **State persists and shows.** Where the user was in a book, last scan time, unfinished metadata refreshes, library health, pending Kobo sync — these are first-class, not buried in tabs. The home surface answers "where was I?" before "what's new?"
5. **Density on demand, not by default.** The default browse view is generous and visual. The same data can collapse to a dense table when the user is doing librarian work (bulk metadata, audit). The transition is one control, not a different screen language.
6. **Single-tenant honesty.** No empty social graph, no "Invite team," no growth nudges, no telemetry-by-default. Settings respect the self-hoster: the app is theirs, on their box. (Telemetry is opt-in, and the recent fix `cac557b7` confirms this is a real product value.)

## Accessibility & Inclusion

- **WCAG 2.2 AA minimum** for all non-reader surfaces. Reader surfaces target AA on chrome, with user-controlled type size, weight, line height, and theme on the content.
- **Keyboard-first** — every primary action reachable without a mouse, including reader navigation, shelf assignment, and metadata edit. Visible focus rings, never `outline: none` without replacement.
- **Reduced motion respected** — `prefers-reduced-motion` disables cover-hover lift, page-flip transitions in readers, and decorative animation. State-conveying motion (e.g., scan progress) remains but goes to static indicators.
- **Color-blind safe** — book-format distinction is never carried by hue alone (aspect ratio, label, or mark always co-encodes).
- **Dyslexia-friendly reading** — the EPUB reader exposes a high-readability font (OpenDyslexic or similar) as a user-selectable option alongside Inter / serif body / sans body, plus letter-spacing and line-height controls. (Already supported by the existing custom-fonts admin feature.)
- **Age-rating gating respected in UI** — `maxAgeRating` on a user must visibly suppress covers/titles above that rating, not just hide records server-side.
- **Internationalization** — `svelte-i18n` is already wired; layout must tolerate 1.5× string expansion and right-to-left mirroring without overflow.
