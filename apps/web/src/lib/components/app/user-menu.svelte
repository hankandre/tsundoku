<script lang="ts">
  import { onMount } from "svelte";
  import UserIcon from "@lucide/svelte/icons/user";
  import UserCircle from "@lucide/svelte/icons/user-round";
  import LogOut from "@lucide/svelte/icons/log-out";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Check from "@lucide/svelte/icons/check";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { cn } from "$lib/utils";

  type Props = {
    user: { username: string; isAdmin?: boolean } | null | undefined;
  };
  let { user }: Props = $props();

  // Theme: light / dark. Source-of-truth lives on <html data-theme>, persisted in localStorage.
  // Mirrors theme-toggle.svelte so this menu can replace it in the topbar.
  let theme = $state<"light" | "dark">("light");

  onMount(() => {
    const current = document.documentElement.getAttribute("data-theme");
    theme = current === "dark" ? "dark" : "light";
  });

  function setTheme(next: "light" | "dark") {
    if (theme === next) return;
    theme = next;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("tsundoku-theme", next);
    } catch {
      // ignore — private mode etc.
    }
  }
</script>

{#if user}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      class={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 text-xs",
        "transition-colors hover:bg-accent hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label="Open user menu"
    >
      <UserIcon size={12} class="text-muted-foreground" />
      <span class="font-medium">{user.username}</span>
      {#if user.isAdmin}
        <span class="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
          admin
        </span>
      {/if}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content align="end" sideOffset={6} class="w-60">
      <div class="px-2 pt-2 pb-1">
        <div class="text-sm font-medium leading-tight">{user.username}</div>
        <div class="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {user.isAdmin ? "Administrator" : "Reader"}
        </div>
      </div>

      <DropdownMenu.Separator />

      <DropdownMenu.Group>
        <DropdownMenu.GroupHeading
          class="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Theme
        </DropdownMenu.GroupHeading>
        <DropdownMenu.Item onSelect={() => setTheme("light")}>
          <Sun class="opacity-80" />
          <span>Daylight</span>
          {#if theme === "light"}
            <Check class="ml-auto opacity-80" />
          {/if}
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => setTheme("dark")}>
          <Moon class="opacity-80" />
          <span>Study lamp</span>
          {#if theme === "dark"}
            <Check class="ml-auto opacity-80" />
          {/if}
        </DropdownMenu.Item>
      </DropdownMenu.Group>

      <DropdownMenu.Separator />

      <DropdownMenu.Item>
        {#snippet child({ props })}
          <a href="/account" {...props}>
            <UserCircle class="opacity-80" />
            <span>Account</span>
          </a>
        {/snippet}
      </DropdownMenu.Item>

      {#if user.isAdmin}
        <DropdownMenu.Item>
          {#snippet child({ props })}
            <a href="/admin/settings" {...props}>
              <ShieldCheck class="opacity-80" />
              <span>Admin</span>
            </a>
          {/snippet}
        </DropdownMenu.Item>
      {/if}

      <DropdownMenu.Separator />

      <DropdownMenu.Item>
        {#snippet child({ props })}
          <a href="/logout" {...props} data-sveltekit-preload-data="off">
            <LogOut class="opacity-80" />
            <span>Sign out</span>
          </a>
        {/snippet}
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else}
  <a
    href="/login"
    class="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
  >
    Sign in
  </a>
{/if}
