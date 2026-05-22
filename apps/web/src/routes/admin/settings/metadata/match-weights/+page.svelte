<script lang="ts">
  import ComingSoon from "$lib/components/admin-settings/coming-soon.svelte";
</script>

<svelte:head>
  <title>Match weights · Settings · tsundoku</title>
</svelte:head>

<ComingSoon
  eyebrow="Section · Metadata"
  title="Match weights"
  description="Tune how strongly title, author, ISBN, and series fields contribute to automatic metadata matching. Useful when imported files have noisy or partial filenames."
/>
