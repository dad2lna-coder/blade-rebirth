<section class="ship" aria-label="Ship">
  <header class="head">
    <p class="kicker">eBid</p>
    <h2>45-column sheet</h2>
  </header>
  <p class="unwired">Not wired yet.</p>
</section>

<style>
  .ship {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 100%;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kicker,
  h2,
  .unwired {
    margin: 0;
  }

  .kicker,
  .unwired {
    color: var(--muted);
    font-size: 12px;
  }

  h2 {
    font-size: 22px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .unwired {
    font-size: 15px;
  }
</style>
