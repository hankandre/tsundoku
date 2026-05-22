<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import Home from "@lucide/svelte/icons/house";
  import LibraryIcon from "@lucide/svelte/icons/library";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Users from "@lucide/svelte/icons/users";
  import BookMarked from "@lucide/svelte/icons/book-marked";
  import Bookmark from "@lucide/svelte/icons/bookmark";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import NotebookPen from "@lucide/svelte/icons/notebook-pen";
  import Upload from "@lucide/svelte/icons/upload";
  import Inbox from "@lucide/svelte/icons/inbox";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import X from "@lucide/svelte/icons/x";
  import type { Component } from "svelte";
  import { cn } from "$lib/utils";

  type SidebarLibrary = { id: number | string; name: string; count?: number; icon?: string };
  type SidebarShelf = { id: number | string; name: string; count?: number };

  type Props = {
    user: { username: string; isAdmin?: boolean } | null | undefined;
    libraries?: SidebarLibrary[];
    shelves?: SidebarShelf[];
    magicShelves?: SidebarShelf[];
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
  };

  let {
    user,
    libraries = [],
    shelves = [],
    magicShelves = [],
    mobileOpen = false,
    onCloseMobile,
  }: Props = $props();

  const isActive = (href: string, exact = false) => {
    const path = page.url.pathname;
    if (href === "/" || exact) return path === href;
    return path === href || path.startsWith(href + "/");
  };

  // Persisted open/closed state for each collapsible group. Default to open.
  type GroupKey = "libraries" | "shelves" | "magic" | "add";
  const STORAGE_PREFIX = "tsundoku-sidebar-";
  const defaultOpen: Record<GroupKey, boolean> = {
    libraries: true,
    shelves: true,
    magic: true,
    add: false,
  };
  let open = $state<Record<GroupKey, boolean>>({ ...defaultOpen });

  // Auto-open a group when one of its routes is active, so users don't lose
  // context. $effect-based so it re-applies on every navigation, not just
  // first paint.
  const librariesHasActive = $derived(
    isActive("/libraries") || libraries.some((l) => isActive(`/libraries/${l.id}`)),
  );
  const shelvesHasActive = $derived(
    isActive("/shelves") || shelves.some((s) => isActive(`/shelves/${s.id}`)),
  );
  const magicHasActive = $derived(
    isActive("/magic-shelves") ||
      magicShelves.some((s) => isActive(`/magic-shelves/${s.id}`)),
  );
  const addHasActive = $derived(isActive("/upload") || isActive("/bookdrop"));

  onMount(() => {
    (Object.keys(defaultOpen) as GroupKey[]).forEach((k) => {
      try {
        const v = localStorage.getItem(STORAGE_PREFIX + k);
        if (v === "1") open[k] = true;
        else if (v === "0") open[k] = false;
      } catch {
        // ignore
      }
    });
  });

  $effect(() => {
    if (librariesHasActive) open.libraries = true;
  });
  $effect(() => {
    if (shelvesHasActive) open.shelves = true;
  });
  $effect(() => {
    if (magicHasActive) open.magic = true;
  });
  $effect(() => {
    if (addHasActive) open.add = true;
  });

  function toggle(key: GroupKey) {
    open[key] = !open[key];
    try {
      localStorage.setItem(STORAGE_PREFIX + key, open[key] ? "1" : "0");
    } catch {
      // ignore
    }
  }
</script>

<!-- Mobile overlay -->
{#if mobileOpen}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
    aria-label="Close navigation"
    onclick={() => onCloseMobile?.()}
  ></button>
{/if}

<aside
  class={cn(
    "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
    "transition-transform duration-200 ease-out md:translate-x-0 md:static md:z-auto",
    mobileOpen ? "translate-x-0" : "-translate-x-full",
  )}
  aria-label="Primary navigation"
>
  <div class="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-5">
    <a href="/" class="font-display text-xl leading-none tracking-tight">
      tsundoku
    </a>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
      aria-label="Close navigation"
      onclick={() => onCloseMobile?.()}
    >
      <X size={16} />
    </button>
  </div>

  <nav class="flex-1 overflow-y-auto px-3 py-4">
    {#snippet navLink(
      href: string,
      icon: Component<{ size?: number | string; class?: string }>,
      label: string,
      count?: number,
      exact = false,
    )}
      {@const active = isActive(href, exact)}
      {@const Icon = icon}
      <a
        {href}
        class={cn(
          "group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
        aria-current={active ? "page" : undefined}
        onclick={() => onCloseMobile?.()}
      >
        <Icon size={15} class="shrink-0 opacity-80 group-hover:opacity-100" />
        <span class="flex-1 truncate">{label}</span>
        {#if count !== undefined && count !== null}
          <span
            class={cn(
              "font-mono text-[10px] tabular-nums tracking-wide",
              active ? "text-sidebar-accent-foreground/80" : "text-muted-foreground",
            )}
          >
            {count}
          </span>
        {/if}
      </a>
    {/snippet}

    {#snippet collapsibleGroupHeader(
      key: GroupKey,
      label: string,
      href: string | null,
      total?: number,
    )}
      {@const isOpen = open[key]}
      {@const labelActive = href ? isActive(href, true) : false}
      <div class="group/header flex items-center rounded-md transition-colors hover:bg-sidebar-accent">
        <button
          type="button"
          class="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/55 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onclick={() => toggle(key)}
          aria-expanded={isOpen}
          aria-controls={`sidebar-group-${key}`}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${label} section`}
        >
          <ChevronRight
            size={13}
            class={cn(
              "stroke-[2.5] transition-transform duration-200 ease-out",
              isOpen && "rotate-90",
            )}
          />
        </button>
        {#if href}
          <a
            {href}
            class={cn(
              "flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              labelActive
                ? "text-foreground"
                : "text-sidebar-foreground/70 group-hover/header:text-foreground",
            )}
            aria-current={labelActive ? "page" : undefined}
            onclick={() => {
              open[key] = true;
              onCloseMobile?.();
            }}
          >
            <span class="flex-1 text-left">{label}</span>
            {#if total !== undefined && total !== null}
              <span class="font-mono text-[10px] tabular-nums tracking-wide normal-case text-sidebar-foreground/55">
                {total}
              </span>
            {/if}
          </a>
        {:else}
          <button
            type="button"
            class="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/70 transition-colors group-hover/header:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            onclick={() => toggle(key)}
          >
            <span class="flex-1 text-left">{label}</span>
            {#if total !== undefined && total !== null}
              <span class="font-mono text-[10px] tabular-nums tracking-wide normal-case text-sidebar-foreground/55">
                {total}
              </span>
            {/if}
          </button>
        {/if}
      </div>
    {/snippet}

    <div class="space-y-0.5">
      {@render navLink("/", Home, "Dashboard")}
      {@render navLink("/books", BookOpen, "All books")}
      {@render navLink("/authors", Users, "Authors")}
      {@render navLink("/series", BookMarked, "Series")}
      {@render navLink("/notebook", NotebookPen, "Notebook")}
    </div>

    <!-- Libraries -->
    <div class="mt-6">
      {@render collapsibleGroupHeader(
        "libraries",
        "Libraries",
        "/libraries",
        libraries.length || undefined,
      )}
      <div
        id="sidebar-group-libraries"
        class={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open.libraries ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div class="min-h-0 overflow-hidden">
          <div class="mt-1 space-y-0.5">
            {#each libraries as lib (lib.id)}
              {@render navLink(`/libraries/${lib.id}`, LibraryIcon, lib.name, lib.count)}
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Shelves -->
    <div class="mt-4">
      {@render collapsibleGroupHeader(
        "shelves",
        "Shelves",
        "/shelves",
        shelves.length || undefined,
      )}
      <div
        id="sidebar-group-shelves"
        class={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open.shelves ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div class="min-h-0 overflow-hidden">
          <div class="mt-1 space-y-0.5">
            {#each shelves as s (s.id)}
              {@render navLink(`/shelves/${s.id}`, Bookmark, s.name, s.count)}
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Magic shelves -->
    <div class="mt-4">
      {@render collapsibleGroupHeader(
        "magic",
        "Magic shelves",
        "/magic-shelves",
        magicShelves.length || undefined,
      )}
      <div
        id="sidebar-group-magic"
        class={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open.magic ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div class="min-h-0 overflow-hidden">
          <div class="mt-1 space-y-0.5">
            {#each magicShelves as s (s.id)}
              {@render navLink(`/magic-shelves/${s.id}`, Sparkles, s.name, s.count)}
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Add -->
    <div class="mt-4">
      {@render collapsibleGroupHeader("add", "Add", null)}
      <div
        id="sidebar-group-add"
        class={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open.add ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div class="min-h-0 overflow-hidden">
          <div class="mt-1 space-y-0.5">
            {@render navLink("/upload", Upload, "Upload")}
            {@render navLink("/bookdrop", Inbox, "Bookdrop")}
          </div>
        </div>
      </div>
    </div>

  </nav>
</aside>
