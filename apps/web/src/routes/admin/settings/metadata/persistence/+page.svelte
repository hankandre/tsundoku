<script lang="ts">
  import ComingSoon from "$lib/components/admin-settings/coming-soon.svelte";
</script>

<svelte:head>
  <title>Metadata persistence · Settings · tsundoku</title>
</svelte:head>

<ComingSoon
  eyebrow="Section · Metadata"
  title="Metadata persistence"
  description="Choose whether metadata edits are written back to the source file (OPF sidecars, embedded EPUB OPF, ID3 tags) or kept only in the tsundoku database. Per-field overrides and rollback behavior will live here."
/>
