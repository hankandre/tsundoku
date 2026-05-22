<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Badge } from "$lib/components/ui/badge";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const permissionLabels: Record<string, string> = {
    upload: "Upload",
    download: "Download",
    editMetadata: "Edit metadata",
    manipulateLibrary: "Manage libraries",
    admin: "Administrator",
  };
  const permissionKeys = Object.keys(permissionLabels);
</script>

<svelte:head>
  <title>Users · Admin · tsundoku</title>
</svelte:head>

<section class="space-y-10">
  <header class="flex flex-col gap-1">
    <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      Section · People
    </span>
    <h2 class="font-display text-2xl tracking-tight">Users</h2>
    <p class="text-sm text-muted-foreground">
      Manage accounts, permissions, and per-user library access.
    </p>
  </header>

  <!-- User list -->
  <div class="overflow-hidden rounded-lg border border-border bg-card">
    <table class="w-full text-sm">
      <thead class="border-b border-border bg-muted/30 text-left">
        <tr>
          <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Account</th>
          <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Identity</th>
          <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Permissions</th>
          <th class="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.users as u (u.id)}
          <tr class="border-t border-border align-top">
            <td class="px-4 py-3">
              <div class="font-medium">{u.username}</div>
              {#if u.permissions.admin}
                <Badge variant="default" class="mt-1">Admin</Badge>
              {/if}
            </td>
            <td class="px-4 py-3">
              <div>{u.name ?? "—"}</div>
              {#if u.email}
                <div class="font-mono text-xs text-muted-foreground">{u.email}</div>
              {/if}
            </td>
            <td class="px-4 py-3">
              <form method="POST" action="?/updatePermissions" use:enhance class="space-y-2">
                <input type="hidden" name="id" value={u.id} />
                <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                  {#each permissionKeys as p (p)}
                    <label class="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        name={p}
                        checked={(u.permissions as Record<string, boolean>)[p]}
                        class="h-3.5 w-3.5 rounded border-input"
                      />
                      {permissionLabels[p]}
                    </label>
                  {/each}
                </div>
                <Button type="submit" size="sm" variant="ghost" class="h-7 px-2 text-xs">
                  Save permissions
                </Button>
              </form>
            </td>
            <td class="px-4 py-3 text-right">
              <form
                method="POST"
                action="?/delete"
                use:enhance
                onsubmit={(e) => {
                  if (!confirm(`Delete user "${u.username}"?`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={u.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  class="h-8 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </form>
            </td>
          </tr>
          {#if !u.permissions.admin && data.libraries.length > 0}
            <tr class="border-t border-border bg-muted/20">
              <td class="px-4 py-3"></td>
              <td colspan="3" class="px-4 py-3">
                <form method="POST" action="?/setLibraries" use:enhance class="space-y-2">
                  <input type="hidden" name="id" value={u.id} />
                  <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Library access
                  </div>
                  <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                    {#each data.libraries as lib (lib.id)}
                      <label class="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          name="libraryIds"
                          value={lib.id}
                          checked={data.accessByUser[u.id]?.includes(lib.id)}
                          class="h-3.5 w-3.5 rounded border-input"
                        />
                        {lib.name}
                      </label>
                    {/each}
                  </div>
                  <Button type="submit" size="sm" variant="ghost" class="h-7 px-2 text-xs">
                    Save library access
                  </Button>
                </form>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Create user -->
  <section class="space-y-4">
    <header>
      <h3 class="font-display text-lg tracking-tight">New user</h3>
      <p class="text-sm text-muted-foreground">
        Create a local account. They'll be able to sign in with username + password immediately.
      </p>
    </header>

    <form
      method="POST"
      action="?/create"
      use:enhance
      class="space-y-4 rounded-lg border border-border bg-card p-6"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label for="u-username">Username</Label>
          <Input id="u-username" name="username" type="text" required />
        </div>
        <div class="space-y-1.5">
          <Label for="u-password">Password (≥8 chars)</Label>
          <Input id="u-password" name="password" type="password" minlength={8} required />
        </div>
        <div class="space-y-1.5">
          <Label for="u-name">Display name</Label>
          <Input id="u-name" name="name" type="text" />
        </div>
        <div class="space-y-1.5">
          <Label for="u-email">Email</Label>
          <Input id="u-email" name="email" type="email" />
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAdmin" class="h-3.5 w-3.5 rounded border-input" />
        Grant administrator access
      </label>
      {#if form?.error}
        <p class="text-sm text-destructive">{form.error}</p>
      {/if}
      <div class="flex items-center justify-end border-t border-border pt-4">
        <Button type="submit">Create user</Button>
      </div>
    </form>
  </section>
</section>
