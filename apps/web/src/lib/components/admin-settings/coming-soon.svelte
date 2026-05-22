<script lang="ts">
  type Props = {
    eyebrow: string;
    title: string;
    description: string;
    issue?: string;
  };
  let { eyebrow, title, description, issue }: Props = $props();
</script>

<header class="mb-8 flex flex-col gap-1">
  <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
    {eyebrow}
  </span>
  <div class="flex items-center gap-3">
    <h1 class="font-display text-3xl tracking-tight">{title}</h1>
    <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      coming soon
    </span>
  </div>
</header>

<div class="max-w-[68ch] space-y-4 text-sm leading-relaxed text-muted-foreground">
  <p>{description}</p>
  {#if issue}
    <p>
      Tracked in
      <a
        href={issue}
        class="font-mono text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
      >
        {issue.replace(/^https?:\/\//, "")}
      </a>
    </p>
  {/if}
</div>
