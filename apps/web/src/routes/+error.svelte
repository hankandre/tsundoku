<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
</script>

<section class="flex min-h-[60vh] flex-col items-start justify-center space-y-6 max-w-xl">
  <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
    Error · {page.status}
  </span>
  <h1 class="font-display text-5xl leading-tight tracking-tight">
    {#if page.status === 404}
      That page isn't on the shelf.
    {:else if page.status === 401 || page.status === 403}
      You'll need to sign in first.
    {:else}
      Something went sideways.
    {/if}
  </h1>
  {#if page.error?.message}
    <p class="font-mono text-xs text-muted-foreground">
      {page.error.message}
    </p>
  {/if}
  <div class="flex flex-wrap gap-3">
    <Button href="/" size="lg">Back to dashboard</Button>
    {#if page.status === 401 || page.status === 403}
      <Button variant="outline" size="lg" href="/login">Sign in</Button>
    {/if}
  </div>
</section>
