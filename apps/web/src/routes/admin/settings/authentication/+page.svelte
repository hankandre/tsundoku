<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Badge } from "$lib/components/ui/badge";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type ProviderForm = {
    providerName: string;
    issuerUri: string;
    clientId: string;
    clientSecret: string;
    scopes: string;
    claim_username: string;
    claim_email: string;
    claim_name: string;
    claim_groups: string;
  };

  function blankProvider(): ProviderForm {
    return {
      providerName: "",
      issuerUri: "",
      clientId: "",
      clientSecret: "",
      scopes: "openid profile email",
      claim_username: "preferred_username",
      claim_email: "email",
      claim_name: "name",
      claim_groups: "groups",
    };
  }

  function providerFromData(): ProviderForm {
    const p = data.oidc.provider;
    if (!p) return blankProvider();
    return {
      providerName: p.providerName ?? "",
      issuerUri: p.issuerUri ?? "",
      clientId: p.clientId ?? "",
      clientSecret: "",
      scopes: p.scopes ?? "openid profile email",
      claim_username: p.claimMapping?.username ?? "preferred_username",
      claim_email: p.claimMapping?.email ?? "email",
      claim_name: p.claimMapping?.name ?? "name",
      claim_groups: p.claimMapping?.groups ?? "groups",
    };
  }

  let provider = $state(providerFromData());
  let oidcEnabled = $state(data.oidc.enabled);
  let autoProvisionEnabled = $state(data.oidc.autoProvision?.enabled ?? false);
  let allowLocalLinking = $state(data.oidc.autoProvision?.allowLocalLinking ?? true);
  let sessionDurationHours = $state(data.oidc.sessionDurationHours);
  let submitting = $state(false);

  const sourceBadge = $derived(
    data.oidc.source === "settings"
      ? { label: "Database", tone: "default" as const }
      : data.oidc.source === "env"
        ? { label: "Environment", tone: "secondary" as const }
        : { label: "Not configured", tone: "outline" as const },
  );

  const secretPlaceholder = $derived(
    data.oidc.provider?.clientSecretSet
      ? "•••••••• (leave blank to keep)"
      : "Paste the client secret",
  );

  const savedAtLabel = $derived.by(() => {
    if (!form?.ok || !form.savedAt) return null;
    const d = new Date(form.savedAt);
    return d.toLocaleTimeString();
  });
</script>

<svelte:head>
  <title>Authentication · Settings · tsundoku</title>
</svelte:head>

<header class="mb-8 flex flex-col gap-1">
  <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
    Section · Identity
  </span>
  <div class="flex items-center gap-3">
    <h1 class="font-display text-3xl tracking-tight">Authentication</h1>
    <Badge variant={sourceBadge.tone}>{sourceBadge.label}</Badge>
  </div>
  <p class="mt-1 max-w-[68ch] text-sm text-muted-foreground">
    Local username and password is always on. OpenID Connect can supplement or replace it.
  </p>
</header>

<!-- Status strip: dense, no card box. -->
<dl
  class="mb-8 grid gap-x-8 gap-y-4 border-y border-border py-4 sm:grid-cols-3"
>
  <div>
    <dt class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      Local login
    </dt>
    <dd class="mt-1 flex items-center gap-1.5 text-sm">
      <CheckCircle2 size={14} class="text-primary" />
      Always available
    </dd>
  </div>
  <div>
    <dt class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      OIDC
    </dt>
    <dd class="mt-1 text-sm">
      {data.oidc.enabled ? "Enabled" : "Disabled"}
    </dd>
    {#if data.oidc.env.forceDisabled}
      <p class="mt-1 text-xs text-destructive">
        FORCE_DISABLE_OIDC is set; UI changes will not enable OIDC.
      </p>
    {/if}
  </div>
  <div class="min-w-0">
    <dt class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      Redirect URI
    </dt>
    <dd class="mt-1 break-all font-mono text-xs">
      {data.oidc.env.redirectUri ?? "OIDC_REDIRECT_URI not set"}
    </dd>
  </div>
</dl>

<form
  method="POST"
  use:enhance={() => {
    submitting = true;
    return async ({ update }) => {
      await update();
      submitting = false;
    };
  }}
  class="space-y-10"
>
  <!-- Provider -->
  <fieldset class="space-y-4">
    <legend class="flex items-center gap-2 text-base font-medium">
      <KeyRound size={16} class="text-muted-foreground" />
      Provider
    </legend>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-1.5 sm:col-span-2">
        <Label for="issuerUri">Issuer URI</Label>
        <Input
          id="issuerUri"
          name="issuerUri"
          type="url"
          placeholder="https://auth.example.com"
          bind:value={provider.issuerUri}
        />
        <p class="text-xs text-muted-foreground">
          The OIDC discovery document is fetched from
          <span class="font-mono">/.well-known/openid-configuration</span> under this URL.
        </p>
      </div>
      <div class="space-y-1.5">
        <Label for="providerName">Display name</Label>
        <Input
          id="providerName"
          name="providerName"
          type="text"
          placeholder="Authentik, Keycloak, etc."
          bind:value={provider.providerName}
        />
      </div>
      <div class="space-y-1.5">
        <Label for="clientId">Client ID</Label>
        <Input id="clientId" name="clientId" type="text" bind:value={provider.clientId} />
      </div>
      <div class="space-y-1.5 sm:col-span-2">
        <Label for="clientSecret">Client secret</Label>
        <Input
          id="clientSecret"
          name="clientSecret"
          type="password"
          autocomplete="new-password"
          placeholder={secretPlaceholder}
          bind:value={provider.clientSecret}
        />
        <p class="text-xs text-muted-foreground">
          Leave blank to keep the current secret. Paste a new value to rotate.
        </p>
      </div>
      <div class="space-y-1.5 sm:col-span-2">
        <Label for="scopes">Scopes</Label>
        <Input
          id="scopes"
          name="scopes"
          type="text"
          placeholder="openid profile email"
          bind:value={provider.scopes}
        />
      </div>
    </div>
  </fieldset>

  <!-- Claim mapping -->
  <fieldset class="space-y-4">
    <legend class="text-base font-medium">Claim mapping</legend>
    <p class="text-sm text-muted-foreground">
      Which claim names to read from the id_token. Defaults follow the OIDC core spec.
    </p>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label for="claim_username">Username claim</Label>
        <Input
          id="claim_username"
          name="claim_username"
          type="text"
          bind:value={provider.claim_username}
        />
      </div>
      <div class="space-y-1.5">
        <Label for="claim_email">Email claim</Label>
        <Input
          id="claim_email"
          name="claim_email"
          type="text"
          bind:value={provider.claim_email}
        />
      </div>
      <div class="space-y-1.5">
        <Label for="claim_name">Name claim</Label>
        <Input
          id="claim_name"
          name="claim_name"
          type="text"
          bind:value={provider.claim_name}
        />
      </div>
      <div class="space-y-1.5">
        <Label for="claim_groups">Groups claim</Label>
        <Input
          id="claim_groups"
          name="claim_groups"
          type="text"
          bind:value={provider.claim_groups}
        />
      </div>
    </div>
  </fieldset>

  <!-- Behavior -->
  <fieldset class="space-y-4">
    <legend class="text-base font-medium">Behavior</legend>

    <div class="flex items-start justify-between gap-4 border-b border-border pb-4">
      <div class="space-y-0.5">
        <div class="text-sm font-medium">Enable OIDC sign-in</div>
        <p class="max-w-[60ch] text-xs text-muted-foreground">
          Adds a "Sign in with {provider.providerName || "OIDC"}" button to the login page.
        </p>
      </div>
      <Switch
        name="enabled"
        bind:checked={oidcEnabled}
        disabled={data.oidc.env.forceDisabled}
        aria-label="Enable OIDC sign-in"
      />
    </div>

    <div class="flex items-start justify-between gap-4 border-b border-border pb-4">
      <div class="space-y-0.5">
        <div class="text-sm font-medium">Auto-provision new users</div>
        <p class="max-w-[60ch] text-xs text-muted-foreground">
          Create a local account the first time someone authenticates through OIDC. Off means
          OIDC sign-in only works for users that already exist.
        </p>
      </div>
      <Switch
        name="autoProvision_enabled"
        bind:checked={autoProvisionEnabled}
        aria-label="Auto-provision new users"
      />
    </div>

    <div class="flex items-start justify-between gap-4">
      <div class="space-y-0.5">
        <div class="text-sm font-medium">Allow linking to local accounts</div>
        <p class="max-w-[60ch] text-xs text-muted-foreground">
          When an OIDC username matches an existing local account, link them together instead
          of creating a duplicate.
        </p>
      </div>
      <Switch
        name="autoProvision_allowLocalLinking"
        bind:checked={allowLocalLinking}
        aria-label="Allow linking to local accounts"
      />
    </div>
  </fieldset>

  <!-- Sessions (merged from former Sessions section). -->
  <fieldset class="space-y-4">
    <legend class="text-base font-medium">Sessions</legend>
    <div class="space-y-1.5">
      <Label for="sessionDurationHours">Duration (hours)</Label>
      <Input
        id="sessionDurationHours"
        name="sessionDurationHours"
        type="number"
        min="1"
        max="8760"
        class="w-32"
        bind:value={sessionDurationHours}
        aria-describedby="sessionDurationHours-help sessionDurationHours-error"
        aria-invalid={form?.field === "sessionDurationHours" ? "true" : undefined}
      />
      <p id="sessionDurationHours-help" class="text-xs text-muted-foreground">
        How long an OIDC-issued session stays valid before requiring re-authentication.
        Tsundoku rotates refresh tokens; this is the upper bound.
      </p>
      {#if form?.field === "sessionDurationHours" && form.error}
        <p id="sessionDurationHours-error" class="text-xs text-destructive">{form.error}</p>
      {/if}
    </div>
  </fieldset>

  <div class="flex items-center justify-between gap-4 border-t border-border pt-5">
    <div class="min-w-0 text-sm" aria-live="polite">
      {#if form?.error && !form.field}
        <span class="text-destructive">{form.error}</span>
      {:else if form?.ok && savedAtLabel}
        <span class="text-muted-foreground">Saved {savedAtLabel}</span>
      {/if}
    </div>
    <Button type="submit" disabled={submitting}>
      {submitting ? "Saving…" : "Save authentication"}
    </Button>
  </div>
</form>
