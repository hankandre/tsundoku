<script lang="ts">
  import { onMount } from "svelte";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import { Button } from "$lib/components/ui/button";

  let theme = $state<"light" | "dark">("light");

  onMount(() => {
    const current = document.documentElement.getAttribute("data-theme");
    theme = current === "dark" ? "dark" : "light";
  });

  function toggle() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("tsundoku-theme", theme);
    } catch {
      // ignore — private mode etc.
    }
  }

  const label = $derived(theme === "dark" ? "Switch to daylight" : "Switch to study lamp");
</script>

<Button variant="ghost" size="icon" onclick={toggle} aria-label={label} title={label}>
  {#if theme === "dark"}
    <Sun />
  {:else}
    <Moon />
  {/if}
</Button>
