<script lang="ts">
  import { enhance } from "$app/forms";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import type { ActionData, PageData } from "./$types";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();

  let pending = $state(false);
</script>

<div class="grid min-h-screen lg:grid-cols-2">
  <!-- Editorial side: hero panel, hidden on small screens -->
  <aside
    class="relative hidden overflow-hidden bg-card lg:flex lg:flex-col lg:justify-between lg:p-12"
    aria-hidden="true"
  >
    <div class="flex items-center gap-2">
      <span class="font-display text-2xl tracking-tight">tsundoku</span>
    </div>

    <div class="space-y-6 max-w-md">
      <p class="font-display text-3xl leading-snug">
        “A pile of books a reader has every intention of reading, in their own time, however slowly.”
      </p>
      <div class="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <BookOpen size={12} />
        <span>EPUB · CBZ · AUDIO · PHYSICAL</span>
      </div>
    </div>

    <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      積ん読 · a private pile, on your own machine
    </div>

    <!-- Subtle paper texture rendered with overlapping tinted blocks (no images) -->
    <div
      class="pointer-events-none absolute inset-0 -z-0 opacity-60"
      style="background-image: radial-gradient(120% 80% at 80% 10%, oklch(0.448 0.142 26 / 0.06), transparent 60%), radial-gradient(80% 60% at 0% 100%, oklch(0.448 0.142 26 / 0.04), transparent 60%);"
    ></div>
  </aside>

  <!-- Form side -->
  <section class="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
    <div class="w-full max-w-sm space-y-8">
      <header class="space-y-2">
        <h1 class="font-display text-4xl tracking-tight">Sign in</h1>
        <p class="text-sm text-muted-foreground">to your tsundoku.</p>
      </header>

      <form
        method="POST"
        use:enhance={() => {
          pending = true;
          return ({ update }) =>
            update().finally(() => {
              pending = false;
            });
        }}
        class="space-y-5"
      >
        <div class="space-y-1.5">
          <Label for="username" class="text-xs font-medium text-muted-foreground">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            required
            autocomplete="username"
            value={form?.username ?? ""}
            class="h-10"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="password" class="text-xs font-medium text-muted-foreground">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autocomplete="current-password"
            class="h-10"
          />
        </div>

        {#if form?.error}
          <p class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {form.error}
          </p>
        {/if}

        <Button type="submit" disabled={pending} size="lg" class="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {#if data.oidcEnabled}
        <div class="relative">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-border"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="bg-background px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              or
            </span>
          </div>
        </div>
        <Button variant="outline" size="lg" href="/api/v1/auth/oidc/redirect" class="w-full">
          Sign in with single sign-on
        </Button>
      {/if}
    </div>
  </section>
</div>
