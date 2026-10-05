<section class="plan" aria-label="Plan">
  <header class="head">
    <p class="kicker">Period</p>
    <h2>Timeline</h2>
  </header>

  <div class="rail" role="list" aria-label="Bid period timeline">
    <div class="node" role="listitem">
      <span class="dot" aria-hidden="true"></span>
      <span>Start</span>
    </div>
    <div class="span" aria-hidden="true"></div>
    <div class="node" role="listitem">
      <span class="dot" aria-hidden="true"></span>
      <span>End</span>
    </div>
  </div>

  <p class="unwired">Not wired yet.</p>
</section>

<style>
  .plan {
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

  .rail {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    max-width: 42rem;
    padding: 16px 0 4px;
  }

  .node {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ink);
  }

  .dot {
    width: 10px;
    height: 10px;
    border: 1px solid var(--line);
    background: var(--fill);
  }

  .span {
    height: 1px;
    background: var(--line);
  }

  .unwired {
    margin: 0;
    color: var(--muted);
  }
</style>
