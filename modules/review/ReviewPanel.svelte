<script lang="ts">
  import CoveragePanel from "./coverage/CoveragePanel.svelte";
  import LinesPanel from "./lines/LinesPanel.svelte";
  import ReportsPanel from "./reports/ReportsPanel.svelte";
  import type { Component } from "svelte";

  let { sub = "lines" }: { sub?: string } = $props();

  const mounts: Record<string, Component> = {
    lines: LinesPanel,
    coverage: CoveragePanel,
    reports: ReportsPanel,
  };

  const Panel = $derived(mounts[sub] ?? LinesPanel);
  const mountId = $derived(
    sub === "coverage" ? "mount-coverage" : sub === "reports" ? "mount-reports" : "mount-lines",
  );
</script>

<section class="review" aria-label="Review">
  <div class="mount" id={mountId} data-mount={"#" + mountId}>
    <Panel />
  </div>
</section>

<style>
  .review,
  .mount {
    min-height: 100%;
  }
</style>
