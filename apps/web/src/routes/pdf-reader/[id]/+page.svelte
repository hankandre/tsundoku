<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { makeBrowserClient } from "$lib/rpc";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fileUrl = $derived(
    `/api/v1/files/${data.bookId}/stream${data.accessToken ? `?token=${encodeURIComponent(data.accessToken)}` : ""}`,
  );
  const rpc = $derived(makeBrowserClient(data.accessToken));

  let sessionId = $state<string | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  async function startSession() {
    try {
      const r = await rpc.api.v1.books[":id"].sessions.start.$post({
        param: { id: data.bookId },
        json: { startLocation: null },
      });
      if (r.ok) {
        const { sessionId: sid } = await r.json();
        sessionId = sid;
      }
    } catch {
      // best-effort
    }
  }
  async function endSession() {
    if (!sessionId) return;
    try {
      await rpc.api.v1.books[":id"].sessions.end.$post({
        param: { id: data.bookId },
        json: { sessionId, endLocation: null },
      });
    } catch {
      // best-effort
    }
    sessionId = null;
  }

  function saveProgress(page: number) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await rpc.api.v1.books[":id"].progress.$put({
          param: { id: data.bookId },
          json: { pdfProgress: page },
        });
      } catch {
        // best-effort
      }
    }, 1500);
  }

  // PDF.js viewer running inside <object> doesn't expose page changes to us,
  // so we use a manual page input. A full pdfjs-dist viewer comes later.
  let manualPage = $state<number | "">("");

  onMount(() => {
    void startSession();
    const onUnload = () => {
      void endSession();
    };
    window.addEventListener("beforeunload", onUnload);
    onDestroy(() => {
      window.removeEventListener("beforeunload", onUnload);
      void endSession();
      if (saveTimer) clearTimeout(saveTimer);
    });
  });
</script>

<svelte:head>
  <title>PDF reader · tsundoku</title>
</svelte:head>

<section class="h-[calc(100vh-9rem)] space-y-2">
  <div class="flex items-center gap-2 text-sm">
    <label for="page" class="text-muted-foreground">Current page</label>
    <input
      id="page"
      type="number"
      min="1"
      bind:value={manualPage}
      onchange={() => {
        if (typeof manualPage === "number") saveProgress(manualPage);
      }}
      class="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
    />
    <span class="text-xs text-muted-foreground">
      Progress is recorded when you update this field.
    </span>
  </div>
  <object
    data={fileUrl}
    type="application/pdf"
    aria-label="PDF document"
    class="w-full h-[calc(100%-2.5rem)] rounded-md border border-border"
  >
    <p class="p-4 text-sm text-muted-foreground">
      Your browser cannot display PDFs inline.
      <a href={fileUrl} class="text-primary underline">Download the file</a> instead.
    </p>
  </object>
</section>
