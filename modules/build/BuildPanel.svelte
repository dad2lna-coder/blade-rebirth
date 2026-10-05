<script lang="ts">
  import SetupPanel from "../setup-panel/SetupPanel.svelte";
</script>

<section class="build" aria-label="Build">
  <div class="mount" id="mount-setup" data-mount="#mount-setup">
    <SetupPanel />
  </div>
</section>

<style>
  .build,
  .mount {
    min-height: 100%;
  }
</style>
