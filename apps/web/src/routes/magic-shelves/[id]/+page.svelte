<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { beforeNavigate } from "$app/navigation";
  import { onMount, untrack } from "svelte";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import RuleBuilder from "$lib/components/magic-shelves/RuleBuilder.svelte";
  import {
    EMPTY_RULES,
    FIELDS,
    OPERATORS_BY_KIND,
    formatRules,
    type GroupRule,
    type LeafRule,
  } from "$lib/magic-shelves/types";
  import { makeBrowserClient } from "$lib/rpc";
  import { cn } from "$lib/utils";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Working copies of name + rules. Re-initialize when the shelf id changes
  // (navigating between magic shelves) without throwing away in-flight edits
  // on the current one.
  let name = $state(data.shelf.name);
  let rules = $state<GroupRule>((data.shelf.rules as GroupRule) ?? EMPTY_RULES);
  let savedName = $state(data.shelf.name);
  let savedRulesSerialized = $state(JSON.stringify(data.shelf.rules ?? EMPTY_RULES));
  let lastShelfId = $state(data.shelf.id);

  $effect(() => {
    if (data.shelf.id !== untrack(() => lastShelfId)) {
      lastShelfId = data.shelf.id;
      name = data.shelf.name;
      rules = (data.shelf.rules as GroupRule) ?? EMPTY_RULES;
      savedName = data.shelf.name;
      savedRulesSerialized = JSON.stringify(data.shelf.rules ?? EMPTY_RULES);
      // Reset the preview to the server-rendered books for the new shelf.
      previewBooks = data.books.content;
      previewTotal = data.books.totalElements;
    }
  });

  // Serialized rules drive the debounced preview + the hidden form field +
  // the dirty check. Computed once per render.
  const serializedRules = $derived(JSON.stringify(rules));
  const dirty = $derived(name !== savedName || serializedRules !== savedRulesSerialized);

  // Saved preview state, kept in sync with the live preview fetch below.
  let previewBooks = $state<typeof data.books.content>(data.books.content);
  let previewTotal = $state(data.books.totalElements);
  let previewInFlight = $state(false);
  let previewError = $state<string | null>(null);

  // Animation hook: increments every time the count snaps to a new value, so
  // we can re-trigger the ease-out-quart fade in CSS via a `key` change.
  let countAnimKey = $state(0);

  // Live preview: debounced 400ms after the last rules edit, cancellable.
  // The brief calls for "the rule is provably doing something" — this is
  // the proof. Save-only would feel disconnected.
  const browserRpc = makeBrowserClient(data.accessToken);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeController: AbortController | null = null;

  $effect(() => {
    // Read the serialized rules so the effect re-runs on every edit.
    const payload = serializedRules;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runPreview(payload), 400);
    previewInFlight = true;
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  async function runPreview(payload: string) {
    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;
    try {
      const res = await browserRpc.api.v1["magic-shelves"].preview.$post(
        { json: { rules: JSON.parse(payload) as GroupRule, size: 6 } },
        { init: { signal: controller.signal } },
      );
      if (!res.ok) {
        previewError = `Preview failed (${res.status})`;
        previewInFlight = false;
        return;
      }
      const body = await res.json();
      if (controller.signal.aborted) return;
      previewBooks = body.content;
      previewTotal = body.totalElements;
      previewError = null;
      previewInFlight = false;
      countAnimKey += 1;
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      previewError = "Preview unavailable";
      previewInFlight = false;
    }
  }

  // Dirty-form guard: warn on cross-route navigation and on tab-close.
  // A save in flight intentionally re-fetches the page data; that's a
  // legitimate navigation we shouldn't prompt about.
  beforeNavigate((nav) => {
    if (saving) return;
    if (!dirty) return;
    if (nav.to?.url.pathname === `/magic-shelves/${data.shelf.id}`) return;
    if (!confirm("Discard unsaved changes to this magic shelf?")) {
      nav.cancel();
    }
  });
  onMount(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  });

  // Keyboard shortcuts. ⌘N adds a rule, ⌘↵ saves. Both ignore plain typing
  // inside inputs except when the modifier is held.
  let formEl = $state<HTMLFormElement | undefined>();

  function addRule() {
    const first = FIELDS[0]!;
    const op = OPERATORS_BY_KIND[first.kind][0]!;
    const newRule: LeafRule = { type: "rule", field: first.name, operator: op, value: "" };
    rules = { ...rules, rules: [...rules.rules, newRule] };
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        addRule();
      } else if (key === "enter") {
        e.preventDefault();
        formEl?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Saved indicator: lit for ~4s after a successful save, then fades.
  let savedAt = $state<Date | null>(null);
  let savedIndicatorVisible = $state(false);
  $effect(() => {
    if (!savedAt) return;
    savedIndicatorVisible = true;
    const t = setTimeout(() => (savedIndicatorVisible = false), 4000);
    return () => clearTimeout(t);
  });

  let saving = $state(false);

  function coverUrl(bookId: string): string {
    return `/api/v1/books/${bookId}/cover${data.accessToken ? `?token=${encodeURIComponent(data.accessToken)}` : ""}`;
  }
</script>

<svelte:head>
  <title>{name || data.shelf.name} · Magic shelves · tsundoku</title>
</svelte:head>

<section class="space-y-8">
  <header class="space-y-1">
    <div class="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <a href="/magic-shelves" class="hover:text-foreground">Magic shelves</a>
      <span aria-hidden="true">·</span>
      {#key countAnimKey}
        <span
          class={cn(
            "tabular-nums transition-opacity duration-200",
            previewInFlight && "opacity-50",
          )}
          style="animation: count-snap 240ms cubic-bezier(0.25, 1, 0.5, 1);"
        >
          {previewTotal}
        </span>
      {/key}
      <span>{previewTotal === 1 ? "match" : "matches"}</span>
      {#if dirty}
        <span class="ml-2 text-amber-600 dark:text-amber-400">· unsaved</span>
      {/if}
    </div>
    <h1 class="flex items-center gap-2 font-display text-3xl tracking-tight">
      <Sparkles size={20} class="text-muted-foreground" aria-hidden="true" />
      {name || data.shelf.name}
    </h1>
  </header>

  <form
    bind:this={formEl}
    method="POST"
    action="?/save"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        // Mark the current edits as the new "saved" baseline BEFORE the
        // re-fetch — otherwise the beforeNavigate dirty guard intercepts
        // update()'s data invalidation and shows a discard prompt.
        savedName = name;
        savedRulesSerialized = serializedRules;
        savedAt = new Date();
        await update({ reset: false });
        saving = false;
      };
    }}
    class="space-y-6"
  >
    <!-- Name -->
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-3">
      <label for="shelf-name" class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Name
      </label>
      <input
        id="shelf-name"
        name="name"
        type="text"
        required
        bind:value={name}
        class="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>

    <!-- Rule builder. No surrounding card per the operator-console brief. -->
    <RuleBuilder bind:rules />

    <!-- Hidden field carries the typed payload. Never a textarea the user
         can hand-edit; the no-raw-JSON convention is enforced here. -->
    <input type="hidden" name="rules" value={serializedRules} />

    <!-- Action row. Save left, saved indicator inline, delete link tucked right. -->
    <div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <button
        type="submit"
        disabled={saving || !dirty}
        class={cn(
          "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dirty
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "bg-muted text-muted-foreground",
          saving && "opacity-60",
        )}
      >
        {saving ? "Saving…" : "Save changes"}
        {#if dirty}
          <kbd class="hidden font-mono text-[9px] uppercase tracking-wider opacity-70 sm:inline">⌘↵</kbd>
        {/if}
      </button>
      <span
        aria-live="polite"
        class={cn(
          "font-mono text-[11px] text-muted-foreground transition-opacity duration-500",
          savedIndicatorVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {#if savedAt}
          Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓
        {/if}
      </span>
      {#if form && "error" in form && form.error}
        <span class="text-sm text-destructive">{form.error}</span>
      {/if}
      {#if previewError}
        <span class="ml-auto font-mono text-[11px] text-destructive">{previewError}</span>
      {/if}
    </div>
  </form>

  <!-- Preview ledger: dense, auditing-oriented. Below the builder so the
       eye flows: rules above → results below. -->
  <section aria-labelledby="preview-heading" class="space-y-3 border-t border-border pt-6">
    <div class="flex items-baseline justify-between">
      <h2 id="preview-heading" class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Preview
      </h2>
      <a
        href="/books?magicShelfId={data.shelf.id}"
        class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        View all →
      </a>
    </div>

    {#if previewBooks.length === 0}
      <p class="border-y border-dashed border-border py-6 text-center text-xs italic text-muted-foreground">
        {#if formatRules(rules) === "every book"}
          Every book in your libraries matches. Add a rule above to narrow it down.
        {:else}
          0 matches — this rule excludes everything you can see.
        {/if}
      </p>
    {:else}
      <ul class="divide-y divide-border">
        {#each previewBooks as b (b.id)}
          <li class="flex items-center gap-3 py-2">
            <!-- 24×36 paper-edge thumb per DESIGN.md (rounded-none). Falls
                 back to a quiet ghost panel on cover-miss. -->
            <div class="relative h-9 w-6 shrink-0 overflow-hidden bg-muted/60 ring-1 ring-border">
              <img
                src={coverUrl(b.id)}
                alt=""
                class="h-full w-full object-cover"
                loading="lazy"
                onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
              />
            </div>
            <a
              href={`/books/${b.id}`}
              class="min-w-0 flex-1 truncate text-sm hover:text-primary"
            >
              {b.title ?? b.fileName}
            </a>
            {#if b.authors.length}
              <span class="hidden truncate text-xs text-muted-foreground sm:inline max-w-[28ch]">
                {b.authors.join(", ")}
              </span>
            {/if}
            <span class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {b.bookType}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Delete: quiet, footer-anchored. -->
  <form
    method="POST"
    action="?/delete"
    use:enhance
    onsubmit={(e) => {
      if (!confirm(`Delete magic shelf "${data.shelf.name}"? Your books aren't affected.`)) {
        e.preventDefault();
      }
    }}
    class="border-t border-border pt-4"
  >
    <button
      type="submit"
      class="text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-2"
    >
      Delete this magic shelf
    </button>
  </form>
</section>

<style>
  @keyframes count-snap {
    from {
      opacity: 0.4;
      transform: translateY(-1px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
