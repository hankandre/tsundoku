<script lang="ts">
  import { enhance } from "$app/forms";
  import { onDestroy } from "svelte";
  import DirectoryPicker from "$lib/components/DirectoryPicker.svelte";
  import type { ActionData, PageData } from "./$types";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();

  let editing = $state(false);
  let managingPaths = $state(false);
  let scanning = $state(false);
  let pickerOpen = $state(false);
  let pendingPath = $state("");

  // Active scan task subscription. The API publishes TaskRecord events on
  // /queue/task-progress; we filter by the id our ?/scan action returned.
  let activeTaskId = $state<string | null>(null);
  let scanProgress = $state<{
    status: "queued" | "running" | "completed" | "failed";
    progress: number;
    detail?: string;
  } | null>(null);
  let socket: WebSocket | null = null;

  function connectWs(taskId: string) {
    activeTaskId = taskId;
    scanProgress = { status: "queued", progress: 0 };
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const token = data.accessToken ? `?token=${encodeURIComponent(data.accessToken)}` : "";
    socket = new WebSocket(`${proto}//${location.host}/ws${token}`);
    socket.addEventListener("open", () => {
      socket?.send(JSON.stringify({ type: "subscribe", topic: "/queue/task-progress" }));
    });
    socket.addEventListener("message", (e) => {
      let msg: { type?: string; topic?: string; payload?: unknown };
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.type !== "event" || msg.topic !== "/queue/task-progress") return;
      const t = msg.payload as {
        id: string;
        status: "queued" | "running" | "completed" | "failed";
        progress?: number;
        detail?: string;
      };
      if (t.id !== taskId) return;
      scanProgress = {
        status: t.status,
        progress: t.progress ?? 0,
        detail: t.detail,
      };
      if (t.status === "completed" || t.status === "failed") {
        closeWs();
      }
    });
    socket.addEventListener("close", () => { socket = null; });
  }
  function closeWs() {
    try { socket?.close(); } catch { /* noop */ }
    socket = null;
  }
  onDestroy(closeWs);

  $effect(() => {
    if (form?.taskId && form.taskId !== activeTaskId) connectWs(form.taskId);
  });
</script>

<section class="space-y-8">
  <header class="flex flex-wrap items-baseline justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{data.library.name}</h1>
      <p class="text-sm text-muted-foreground">
        {data.books.totalElements} books · {data.library.paths.length} path{data.library.paths.length === 1 ? "" : "s"}
      </p>
    </div>
    <div class="flex gap-2 items-center">
      <form method="POST" action="?/scan" use:enhance={() => {
        scanning = true;
        return ({ update }) => update().finally(() => { scanning = false; });
      }}>
        <button
          type="submit"
          disabled={scanning || (scanProgress?.status === "running")}
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {scanning ? "Starting…" : scanProgress?.status === "running" ? "Scanning…" : "Scan now"}
        </button>
      </form>
      <button
        type="button"
        onclick={() => (editing = !editing)}
        class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
      >
        {editing ? "Cancel" : "Edit"}
      </button>
      <button
        type="button"
        onclick={() => (managingPaths = !managingPaths)}
        class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
      >
        {managingPaths ? "Done" : "Manage paths"}
      </button>
    </div>
  </header>

  {#if scanProgress}
    <div class="rounded-lg border border-border bg-card p-4 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium">
          Scan: <span class="text-muted-foreground">{scanProgress.status}</span>
        </span>
        <span class="text-muted-foreground tabular-nums">{Math.round(scanProgress.progress * 100)}%</span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          class="h-full bg-primary transition-all"
          style:width={`${Math.min(100, scanProgress.progress * 100)}%`}
        ></div>
      </div>
      {#if scanProgress.detail}
        <p class="text-xs text-muted-foreground truncate">{scanProgress.detail}</p>
      {/if}
    </div>
  {/if}

  {#if editing}
    <div class="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 class="text-lg font-medium">Edit library</h2>
      <form
        method="POST"
        action="?/update"
        use:enhance={() => ({ update }) => update().finally(() => { editing = false; })}
        class="space-y-4"
      >
        <div class="space-y-1.5">
          <label for="lib-name" class="text-sm font-medium">Name</label>
          <input
            id="lib-name"
            name="name"
            type="text"
            required
            value={data.library.name}
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label for="lib-org" class="text-sm font-medium">Organization mode</label>
          <select
            id="lib-org"
            name="organizationMode"
            value={data.library.organizationMode}
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="BOOK_PER_FILE">One book per file</option>
            <option value="BOOK_PER_DIRECTORY">One book per directory</option>
            <option value="AUTO_DETECT">Auto-detect</option>
          </select>
        </div>
        {#if form?.error}
          <p class="text-sm text-destructive">{form.error}</p>
        {/if}
        <button
          type="submit"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Save
        </button>
      </form>
    </div>
  {/if}

  {#if managingPaths}
    <div class="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 class="text-lg font-medium">Paths</h2>
      {#if data.library.paths.length === 0}
        <p class="text-sm text-muted-foreground">No paths configured.</p>
      {:else}
        <ul class="divide-y divide-border rounded-md border border-border">
          {#each data.library.paths as p (p.id)}
            <li class="flex items-center justify-between gap-2 px-3 py-2">
              <code class="text-sm truncate">{p.path}</code>
              <form
                method="POST"
                action="?/removePath"
                use:enhance={() => ({ update }) => update()}
                onsubmit={(e) => {
                  if (!confirm(`Remove path "${p.path}" from this library? Books indexed from it remain until next scan.`)) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="pathId" value={p.id} />
                <button
                  type="submit"
                  class="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
      <form
        method="POST"
        action="?/addPath"
        use:enhance={() => ({ update }) =>
          update().finally(() => {
            pendingPath = "";
          })}
        class="flex gap-2"
      >
        <input
          name="path"
          type="text"
          placeholder="/data/books"
          required
          bind:value={pendingPath}
          class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onclick={() => (pickerOpen = true)}
          class="rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
        >
          Browse
        </button>
        <button
          type="submit"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Add
        </button>
      </form>
      <DirectoryPicker
        open={pickerOpen}
        initialPath={pendingPath || "/"}
        onSelect={(p) => (pendingPath = p)}
        onClose={() => (pickerOpen = false)}
      />
    </div>
  {/if}

  {#if data.books.content.length === 0}
    <p class="text-muted-foreground text-sm">No books in this library yet. Add paths and run a scan to populate it.</p>
  {:else}
    <ul class="divide-y divide-border rounded-lg border border-border bg-card">
      {#each data.books.content as b (b.id)}
        <li>
          <a href={`/books/${b.id}`} class="flex items-baseline gap-3 px-4 py-2 hover:bg-muted">
            <span class="font-medium truncate">{b.title ?? b.fileName}</span>
            {#if b.authors.length}
              <span class="text-sm text-muted-foreground truncate">
                {b.authors.join(", ")}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="pt-4 border-t border-border">
    <form
      method="POST"
      action="?/delete"
      use:enhance={() => ({ update }) => update()}
      onsubmit={(e) => {
        if (!confirm(`Delete library "${data.library.name}"? This removes the library and all of its books from tsundoku — files on disk are not touched.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        class="text-xs text-muted-foreground hover:text-destructive"
      >
        Delete library
      </button>
    </form>
  </div>
</section>
