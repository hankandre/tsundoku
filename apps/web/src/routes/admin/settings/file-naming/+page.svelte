<script lang="ts">
  import ComingSoon from "$lib/components/admin-settings/coming-soon.svelte";

  const description =
    "Pattern templates that tsundoku uses when renaming or moving files into managed libraries " +
    "(for example: {author}/{series}/{title}.{ext}). Affects scan-time renames and downloads.";
</script>

<svelte:head>
  <title>File naming · Settings · tsundoku</title>
</svelte:head>

<ComingSoon eyebrow="Section · Integrations" title="File naming" {description} />
