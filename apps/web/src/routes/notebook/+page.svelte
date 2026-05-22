<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Notebook · tsundoku</title>
</svelte:head>

<section class="space-y-6 max-w-3xl">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Notebook</h1>
    <p class="text-sm text-muted-foreground">
      Free-form notes. Optional tags and book associations.
    </p>
  </header>

  <div class="rounded-lg border border-border bg-card p-5 space-y-3">
    <h2 class="text-lg font-medium">New entry</h2>
    <form method="POST" action="?/create" use:enhance class="space-y-3">
      <input
        name="title"
        type="text"
        placeholder="Title (optional)"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <textarea
        name="content"
        required
        rows="5"
        placeholder="Write a thought…"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      ></textarea>
      <input
        name="tags"
        type="text"
        placeholder="Tags (comma-separated)"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
        Save
      </button>
    </form>
  </div>

  {#if form?.error}
    <p class="text-sm text-destructive">{form.error}</p>
  {/if}

  {#if data.entries.length === 0}
    <p class="text-sm text-muted-foreground">No entries yet.</p>
  {:else}
    <ul class="space-y-3">
      {#each data.entries as e (e.id)}
        <li class="rounded-lg border border-border bg-card p-4 space-y-2">
          {#if e.title}
            <h3 class="font-medium">{e.title}</h3>
          {/if}
          <p class="text-sm whitespace-pre-wrap">{e.content}</p>
          {#if e.tags.length}
            <div class="flex flex-wrap gap-1">
              {#each e.tags as t (t)}
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
              {/each}
            </div>
          {/if}
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>{new Date(e.updatedAt).toLocaleString()}</span>
            <form method="POST" action="?/delete" use:enhance
              onsubmit={(ev) => { if (!confirm("Delete this entry?")) ev.preventDefault(); }}
            >
              <input type="hidden" name="id" value={e.id} />
              <button type="submit" class="hover:text-destructive">Delete</button>
            </form>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
