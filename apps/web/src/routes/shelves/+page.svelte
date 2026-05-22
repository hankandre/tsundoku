<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="space-y-8">
  <header class="flex items-baseline justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Shelves</h1>
      <p class="text-sm text-muted-foreground">Hand-curated groups of books.</p>
    </div>
    <a
      href="/magic-shelves"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <Sparkles size={14} /> Magic shelves
    </a>
  </header>

  <div class="rounded-lg border border-border bg-card p-5 space-y-3">
    <h2 class="text-lg font-medium">New shelf</h2>
    <form
      method="POST"
      action="?/create"
      use:enhance
      class="flex gap-2 items-end"
    >
      <div class="flex-1">
        <label for="shelf-name" class="block text-xs text-muted-foreground mb-1">Name</label>
        <input
          id="shelf-name"
          name="name"
          type="text"
          required
          placeholder="To Read"
          class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">
        Create
      </button>
    </form>
  </div>

  <div class="space-y-3">
    <h2 class="text-base font-medium">Your shelves</h2>
    {#if data.shelves.length === 0}
      <p class="text-sm text-muted-foreground">No shelves yet.</p>
    {:else}
      <ul class="divide-y divide-border rounded-md border border-border">
        {#each data.shelves as s (s.id)}
          <li class="flex items-center justify-between px-3 py-2">
            <a href={`/shelves/${s.id}`} class="flex-1 hover:text-foreground">
              <span class="font-medium">{s.name}</span>
              <span class="text-xs text-muted-foreground ml-2">{s.bookCount} books</span>
            </a>
            <form method="POST" action="?/delete" use:enhance
              onsubmit={(e) => {
                if (!confirm(`Delete shelf "${s.name}"? Books remain in your library.`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" class="text-xs text-muted-foreground hover:text-destructive">
                Delete
              </button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if form && "error" in form && form.error}
    <p class="text-sm text-destructive">{form.error}</p>
  {/if}
</section>
