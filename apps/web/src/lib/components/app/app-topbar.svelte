<script lang="ts">
  import Menu from "@lucide/svelte/icons/menu";
  import CommandTrigger from "./command-trigger.svelte";
  import UserMenu from "./user-menu.svelte";

  type Props = {
    user: { username: string; isAdmin?: boolean } | null | undefined;
    onMobileNav?: () => void;
  };
  let { user, onMobileNav }: Props = $props();
</script>

<header class="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
  <div class="flex h-14 items-center gap-3 px-4 md:px-6">
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
      aria-label="Open navigation"
      onclick={() => onMobileNav?.()}
    >
      <Menu size={18} />
    </button>

    <!-- Wordmark in the topbar only when the sidebar wordmark is hidden (mobile). -->
    <a
      href="/"
      class="font-display text-2xl leading-none tracking-tight text-foreground md:hidden"
      aria-label="tsundoku — home"
    >
      tsundoku
    </a>

    <div class="ml-auto flex items-center gap-2">
      {#if user}
        <CommandTrigger />
      {/if}
      <UserMenu {user} />
    </div>
  </div>
</header>
