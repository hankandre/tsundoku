<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();

  let pending = $state(false);
</script>

<section class="max-w-sm mx-auto space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold tracking-tight">Welcome to tsundoku</h1>
    <p class="text-sm text-muted-foreground">
      Create the first administrator account to get started.
    </p>
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
    class="space-y-4"
  >
    <div class="space-y-1.5">
      <label for="username" class="text-sm font-medium">Username</label>
      <input
        id="username"
        name="username"
        type="text"
        required
        autocomplete="username"
        value={form?.username ?? ""}
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <div class="space-y-1.5">
      <label for="name" class="text-sm font-medium">Display name <span class="text-muted-foreground">(optional)</span></label>
      <input
        id="name"
        name="name"
        type="text"
        autocomplete="name"
        value={form?.name ?? ""}
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <div class="space-y-1.5">
      <label for="email" class="text-sm font-medium">Email <span class="text-muted-foreground">(optional)</span></label>
      <input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        value={form?.email ?? ""}
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <div class="space-y-1.5">
      <label for="password" class="text-sm font-medium">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minlength="8"
        autocomplete="new-password"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <p class="text-xs text-muted-foreground">At least 8 characters.</p>
    </div>

    <div class="space-y-1.5">
      <label for="confirm" class="text-sm font-medium">Confirm password</label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        required
        minlength="8"
        autocomplete="new-password"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    {#if form?.error}
      <p class="text-sm text-destructive">{form.error}</p>
    {/if}

    <button
      type="submit"
      disabled={pending}
      class="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creating account…" : "Create administrator"}
    </button>
  </form>
</section>
