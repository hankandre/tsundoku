<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import RuleBuilder from "$lib/components/magic-shelves/RuleBuilder.svelte";
  import { EMPTY_RULES, type GroupRule } from "$lib/magic-shelves/types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Local working copies so unsaved edits don't fight the server-supplied
  // values. We re-init when the shelf id changes (navigating between shelves).
  let name = $state(data.shelf.name);
  let rules = $state<GroupRule>((data.shelf.rules as GroupRule) ?? EMPTY_RULES);
  let lastShelfId = $state(data.shelf.id);
  $effect(() => {
    if (data.shelf.id !== lastShelfId) {
      lastShelfId = data.shelf.id;
      name = data.shelf.name;
      rules = (data.shelf.rules as GroupRule) ?? EMPTY_RULES;
    }
  });

  let serializedRules = $derived(JSON.stringify(rules));
  let savedAt = $state<Date | null>(null);
</script>

<svelte:head>
  <title>{data.shelf.name} · Magic shelves · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header class="space-y-1">
    <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <a href="/magic-shelves" class="hover:text-foreground">Magic shelves</a> ·
      {data.shelf.bookCount} {data.shelf.bookCount === 1 ? "match" : "matches"}
    </div>
    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
      <Sparkles size={18} class="text-muted-foreground" />
      {data.shelf.name}
    </h1>
  </header>

  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      return async ({ update }) => {
        await update({ reset: false });
        savedAt = new Date();
      };
    }}
    class="space-y-4"
  >
    <div class="space-y-2">
      <label for="shelf-name" class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Name
      </label>
      <input
        id="shelf-name"
        name="name"
        type="text"
        required
        bind:value={name}
        class="w-full max-w-md rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
    </div>

    <div class="space-y-2">
      <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rules</span>
      <RuleBuilder bind:rules />
      <!-- Hidden field carries the typed payload — never a textarea the user
           can hand-edit, per the project's no-raw-JSON convention. -->
      <input type="hidden" name="rules" value={serializedRules} />
    </div>

    <div class="flex items-center gap-3">
      <button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">
        Save changes
      </button>
      {#if savedAt}
        <span class="text-xs text-muted-foreground">
          Saved {savedAt.toLocaleTimeString()}
        </span>
      {/if}
      {#if form && "error" in form && form.error}
        <span class="text-sm text-destructive">{form.error}</span>
      {/if}
    </div>
  </form>

  <div class="space-y-2">
    <div class="flex items-baseline justify-between">
      <h2 class="text-base font-medium">Matching books</h2>
      <span class="text-xs text-muted-foreground">
        Showing {data.books.content.length} of {data.books.totalElements}
      </span>
    </div>
    {#if data.books.content.length === 0}
      <p class="rounded-md border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        No books match these rules yet. Save changes to refresh — the preview
        reflects the rules currently stored on the shelf.
      </p>
    {:else}
      <ul class="divide-y divide-border rounded-md border border-border">
        {#each data.books.content as b (b.id)}
          <li>
            <a href={`/books/${b.id}`} class="flex items-baseline gap-3 px-3 py-2 hover:bg-muted">
              <span class="font-medium truncate">{b.title ?? b.fileName}</span>
              {#if b.authors.length}
                <span class="text-sm text-muted-foreground truncate">
                  {b.authors.join(", ")}
                </span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <form
    method="POST"
    action="?/delete"
    use:enhance
    onsubmit={(e) => {
      if (!confirm(`Delete magic shelf "${data.shelf.name}"?`)) e.preventDefault();
    }}
  >
    <button type="submit" class="text-xs text-muted-foreground hover:text-destructive">
      Delete this magic shelf
    </button>
  </form>
</section>
