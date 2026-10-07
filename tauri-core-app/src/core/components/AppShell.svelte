<script>
  import ModuleRenderer from "./ModuleRenderer.svelte";
  let { stages = [] } = $props();
  let active = $state(stages[0] ? stages[0].id : "");
</script>

<header class="mast">
  <strong>BLADE</strong>
  <nav>
    {#each stages as stage (stage.id)}
      <button type="button" aria-current={active === stage.id} onclick={() => (active = stage.id)}>
        {stage.label}
      </button>
    {/each}
  </nav>
</header>
<main>
  <ModuleRenderer id={active} />
</main>
