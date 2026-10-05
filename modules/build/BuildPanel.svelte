<script lang="ts">
  const slots = [
    { id: "period", label: "Period", state: "Not wired yet" },
    { id: "fte", label: "FTE", state: "Not wired yet" },
    { id: "fc", label: "Function coverage", state: "Not wired yet" },
    { id: "generate", label: "Generate", state: "Later" },
  ];
</script>

<section class="build" aria-label="Build">
  <header class="head">
    <p class="kicker">Setup</p>
    <h2>Force and coverage</h2>
  </header>

  <ol class="slots">
    {#each slots as slot (slot.id)}
      <li>
        <span>{slot.label}</span>
        <b>{slot.state}</b>
      </li>
    {/each}
  </ol>
</section>

<style>
  .build {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 100%;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kicker,
  h2 {
    margin: 0;
  }

  .kicker {
    color: var(--muted);
    font-size: 12px;
  }

  h2 {
    font-size: 22px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .slots {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    max-width: 28rem;
    border-top: 1px solid var(--line);
  }

  li {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    min-height: 44px;
    align-items: center;
    border-bottom: 1px solid var(--line);
  }

  b {
    font-weight: 500;
    color: var(--muted);
  }
</style>
