<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import { cn } from "$lib/utils";
  import { settingsGroups } from "$lib/components/admin-settings/sections";

  let { children }: { children: Snippet } = $props();

  const isIndex = $derived(page.url.pathname === "/admin/settings");
  const isActive = (href: string) => {
    const path = page.url.pathname;
    return path === href || path.startsWith(href + "/");
  };
</script>

<div class="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
  <!-- Rail: lg+ only. The sub-lg index renders its own list inline (see +page.svelte). -->
  <aside
    class="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-2"
    aria-label="Settings sections"
  >
    <nav class="space-y-6 text-sm">
      {#each settingsGroups as group (group.label)}
        <div>
          <h2
            class="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {group.label}
          </h2>
          <ul class="space-y-0.5">
            {#each group.sections as section (section.href)}
              {@const active = isActive(section.href)}
              <li>
                <a
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  data-sveltekit-preload-data="hover"
                  class={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
                  )}
                >
                  <span class="flex-1 truncate">{section.label}</span>
                  {#if section.comingSoon}
                    <span
                      class={cn(
                        "font-mono text-[9px] uppercase tracking-[0.16em]",
                        active ? "text-sidebar-accent-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      soon
                    </span>
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>
  </aside>

  <div class="min-w-0">
    {#if !isIndex}
      <a
        href="/admin/settings"
        class="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <ChevronLeft size={14} />
        All settings
      </a>
    {/if}
    {@render children()}
  </div>
</div>
