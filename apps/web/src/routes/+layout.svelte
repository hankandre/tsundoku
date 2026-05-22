<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types";
  import { page } from "$app/state";
  import { initI18n } from "$lib/i18n";
  import AppSidebar from "$lib/components/app/app-sidebar.svelte";
  import AppTopbar from "$lib/components/app/app-topbar.svelte";

  initI18n();

  let {
    children,
    data,
  }: { children: Snippet; data: LayoutData } = $props();

  let mobileOpen = $state(false);

  type Surface = "bare" | "auth" | "shell";
  function pickSurface(p: string): Surface {
    if (p.startsWith("/pdf-reader") || p.startsWith("/ebook-reader") || p.startsWith("/cbx-reader")) return "bare";
    if (p === "/login" || p === "/setup") return "auth";
    return "shell";
  }
  const surface = $derived(pickSurface(page.url.pathname));
</script>

{#if surface === "bare"}
  {@render children()}
{:else if surface === "auth"}
  <div class="min-h-screen bg-background">
    {@render children()}
  </div>
{:else}
  <div class="flex min-h-screen bg-background">
    <AppSidebar
      user={data.user}
      libraries={data.sidebar?.libraries ?? []}
      shelves={data.sidebar?.shelves ?? []}
      magicShelves={data.sidebar?.magicShelves ?? []}
      {mobileOpen}
      onCloseMobile={() => (mobileOpen = false)}
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar user={data.user} onMobileNav={() => (mobileOpen = true)} />
      <main class="flex-1 px-4 py-6 md:px-8 md:py-10">
        <div class="mx-auto max-w-7xl">
          {@render children()}
        </div>
      </main>
    </div>
  </div>
{/if}
