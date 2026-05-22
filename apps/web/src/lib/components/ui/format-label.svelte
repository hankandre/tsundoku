<script lang="ts" module>
  export type BookFormat =
    | "PDF"
    | "EPUB"
    | "CBX"
    | "MOBI"
    | "AZW3"
    | "FB2"
    | "AUDIOBOOK"
    | "PHYSICAL";

  export function formatLabel(format: BookFormat | string | null | undefined): string {
    if (!format) return "—";
    if (format === "AUDIOBOOK") return "AUDIO";
    if (format === "CBX") return "CBZ";
    return format;
  }

  /** Aspect ratio class for a cover at the given format. */
  export function formatAspectClass(format: BookFormat | string | null | undefined): string {
    if (format === "AUDIOBOOK") return "aspect-square";
    return "aspect-[2/3]";
  }
</script>

<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    format,
    class: className,
  }: { format: BookFormat | string | null | undefined; class?: string } = $props();
</script>

<span
  class={cn(
    "inline-flex items-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
    className,
  )}
>
  {formatLabel(format)}
</span>
