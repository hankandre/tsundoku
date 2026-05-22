<script lang="ts">
  import { Popover } from "bits-ui";
  import { toast } from "svelte-sonner";
  import type { Snippet } from "svelte";
  import * as Command from "$lib/components/ui/command";
  import Plus from "@lucide/svelte/icons/plus";
  import { cn } from "$lib/utils";
  import {
    type Shelf,
    persistBookShelves,
    fetchAllShelves,
    fetchBookShelves,
    createShelf,
  } from "./shelves-api";

  type Props = {
    bookId: string;
    /** All shelves available to the user. Bindable so newly-created shelves propagate up. */
    shelves: Shelf[];
    /** Shelf ids the book is currently on. Bindable; the picker mutates this optimistically. */
    current: string[];
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    /** Controlled open state — bind to drive from a keyboard shortcut. */
    open?: boolean;
    /** If true, fetch shelves + membership on first open (book-card use). */
    lazy?: boolean;
    /** Trigger snippet receives bits-ui's forwarded props and the open state. */
    trigger: Snippet<[{ props: Record<string, unknown>; open: boolean }]>;
  };

  let {
    bookId,
    shelves = $bindable(),
    current = $bindable(),
    align = "start",
    side = "bottom",
    sideOffset = 6,
    open = $bindable(false),
    lazy = false,
    trigger,
  }: Props = $props();

  let query = $state("");
  let creating = $state(false);
  let hydrated = $state(!lazy);

  const lc = (s: string) => s.toLowerCase();
  const filtered = $derived(
    !query.trim()
      ? shelves
      : shelves.filter((s) => lc(s.name).includes(lc(query.trim()))),
  );
  const exactMatch = $derived(
    !!query.trim() && shelves.some((s) => lc(s.name) === lc(query.trim())),
  );
  const canCreate = $derived(!!query.trim() && !exactMatch);

  $effect(() => {
    if (!open || hydrated || creating) return;
    void hydrate();
  });

  async function hydrate() {
    try {
      const [all, member] = await Promise.all([fetchAllShelves(), fetchBookShelves(bookId)]);
      shelves = all;
      current = member;
    } catch {
      // Silent — the picker still works against whatever the parent passed.
    } finally {
      hydrated = true;
    }
  }

  async function toggle(shelfId: string) {
    const has = current.includes(shelfId);
    const next = has ? current.filter((id) => id !== shelfId) : [...current, shelfId];
    const before = current;
    current = next;
    try {
      await persistBookShelves(bookId, next);
    } catch (err) {
      current = before;
      toast.error("Couldn't update shelves", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  }

  async function createAndAssign() {
    const name = query.trim();
    if (!name || creating) return;
    creating = true;
    try {
      const created = await createShelf(name);
      shelves = [...shelves, { ...created, bookCount: 0 }];
      const next = [...current, created.id];
      current = next;
      await persistBookShelves(bookId, next);
      query = "";
      toast.success(`Created “${created.name}”`);
    } catch (err) {
      toast.error("Couldn't create shelf", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      creating = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target?.dataset?.slot !== "command-input") return;
    if (!canCreate) return;
    e.preventDefault();
    void createAndAssign();
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      {@render trigger({ props, open })}
    {/snippet}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      {align}
      {side}
      {sideOffset}
      class={cn(
        "z-50 w-72 origin-(--bits-popover-content-transform-origin)",
        "rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
        "outline-none",
      )}
    >
      <Command.Root onkeydown={onKeydown}>
        <Command.Input
          placeholder={shelves.length === 0 ? "Name a new shelf…" : "Filter shelves…"}
          bind:value={query}
        />
        <Command.List class="px-1 pb-1">
          {#if shelves.length === 0 && !canCreate}
            <Command.Empty class="text-muted-foreground">
              No shelves yet. Type a name and press Enter.
            </Command.Empty>
          {:else if filtered.length === 0 && !canCreate}
            <Command.Empty class="text-muted-foreground">No matches.</Command.Empty>
          {/if}

          {#each filtered as shelf (shelf.id)}
            {@const checked = current.includes(shelf.id)}
            <Command.Item
              value={shelf.name}
              data-checked={checked}
              onSelect={() => toggle(shelf.id)}
            >
              <span class="truncate">{shelf.name}</span>
              {#if typeof shelf.bookCount === "number"}
                <span class="ml-auto pr-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {shelf.bookCount}
                </span>
              {/if}
            </Command.Item>
          {/each}

          {#if canCreate}
            <Command.Item
              value={`__create__${query.trim()}`}
              onSelect={createAndAssign}
              class="text-foreground"
            >
              <Plus class="size-3.5" />
              <span class="truncate">
                Create <span class="font-medium">“{query.trim()}”</span>
              </span>
              {#if creating}
                <span class="ml-auto font-mono text-[10px] text-muted-foreground">…</span>
              {/if}
            </Command.Item>
          {/if}
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
