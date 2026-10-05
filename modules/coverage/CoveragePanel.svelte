<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../setup-panel/session";
  import { onSessionLines } from "../setup-panel/sessionBus.js";
  import { computeHourlyByDow, dutySnapshot, shiftMix, slotLabel } from "./counts.js";

  let tick = $state(0);
  let stso = $state(false);
  let ltso = $state(false);
  let tso = $state(true);
  let funcView = $state("all");

  const live = session as typeof session & { state: Record<string, any> };

  onMount(() => onSessionLines(() => {
    tick += 1;
  }));

  const view = $derived({ stso, ltso, tso, funcView });

  const hourly = $derived.by(() => {
    void tick;
    return computeHourlyByDow(live, view);
  });

  const duties = $derived.by(() => {
    void tick;
    return dutySnapshot(live);
  });

  const mix = $derived.by(() => {
    void tick;
    return shiftMix(live);
  });

  const hasLines = $derived.by(() => {
    void tick;
    return Array.isArray(live.state.lines) && live.state.lines.length > 0;
  });

  const daySum = $derived(
    hourly.dayTotals.reduce((sum: number, day: { t: number }) => sum + day.t, 0),
  );
</script>

<section class="coverage" aria-label="Coverage">
  <header class="head">
    <h2>Coverage</h2>
    <p>
      {#if hasLines}
        Sun–Sat headcount {daySum} · BAG {duties.BAG} · DFO {duties.DFO} · PAX {duties.PAX}
        · 30-min {hourly.lo}–{hourly.hi} (avg {hourly.avg.toFixed(1)})
      {:else}
        Generate on Build to count the live lines.
      {/if}
    </p>
  </header>

  <div class="filters" role="group" aria-label="Coverage filters">
    <label class="check"><input type="checkbox" bind:checked={stso} /> STSO</label>
    <label class="check"><input type="checkbox" bind:checked={ltso} /> LTSO</label>
    <label class="check"><input type="checkbox" bind:checked={tso} /> TSO</label>
    <label class="check"><input type="radio" name="cov-func" value="all" bind:group={funcView} /> All</label>
    <label class="check"><input type="radio" name="cov-func" value="dfo" bind:group={funcView} /> DFO</label>
    <label class="check"><input type="radio" name="cov-func" value="bag" bind:group={funcView} /> Baggage</label>
    <label class="check"><input type="radio" name="cov-func" value="pax" bind:group={funcView} /> PAX</label>
  </div>

  <p class="hint">Ops lines only. Dash duty and training stay out of the count. Cells are M/F/Total.</p>

  <div class="totals" aria-label="Weekday headcount">
    {#each hourly.days as label, index (label)}
      <div>
        <span>{label}</span>
        <b>{hourly.dayTotals[index].m}/{hourly.dayTotals[index].f}/{hourly.dayTotals[index].t}</b>
      </div>
    {/each}
  </div>

  <h3>30-minute headcount</h3>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          {#each hourly.days as label (label)}
            <th>{label}</th>
          {/each}
          <th>Avg T</th>
        </tr>
      </thead>
      <tbody>
        {#if hasLines}
          {#each hourly.slots as slot, si (slot)}
            {@const row = hourly.matrix[si]}
            {@const avg = row.reduce((sum: number, cell: { t: number }) => sum + cell.t, 0) / 7}
            <tr>
              <td>{slotLabel(slot)}</td>
              {#each row as cell, day (day)}
                <td class:zero={cell.t === 0} class:low={cell.t > 0 && cell.t < hourly.avg * 0.75} class:high={cell.t > hourly.avg * 1.25}>
                  {cell.m}/{cell.f}/{cell.t}
                </td>
              {/each}
              <td>{avg.toFixed(1)}</td>
            </tr>
          {/each}
        {:else}
          <tr><td class="empty" colspan="9">No lines yet.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>

  <h3>Shift mix</h3>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th>Shift</th>
          <th>Window</th>
          <th>FT M/F</th>
          <th>PT M/F</th>
          <th>LTSO M/F</th>
          <th>STSO M/F</th>
          <th>TSO tot</th>
          <th>All</th>
        </tr>
      </thead>
      <tbody>
        {#if mix.length}
          {#each mix as row (row.id)}
            <tr>
              <td>{row.name}</td>
              <td>{row.window}</td>
              <td>{row.ftM}/{row.ftF}</td>
              <td>{row.ptM}/{row.ptF}</td>
              <td>{row.ltsoM}/{row.ltsoF}</td>
              <td>{row.stsoM}/{row.stsoF}</td>
              <td>{row.tso}</td>
              <td>{row.all}</td>
            </tr>
          {/each}
        {:else}
          <tr><td class="empty" colspan="8">No lines yet.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>

<style>
  .coverage {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    max-width: 100%;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2,
  h3 {
    font-weight: 500;
  }

  h2 {
    font-size: 16px;
  }

  h3 {
    font-size: 14px;
  }

  p,
  .hint,
  .empty {
    color: var(--muted);
    font-size: 13px;
  }

  .filters,
  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
  }

  .check {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--ink);
  }

  input {
    accent-color: var(--fill);
    width: 1.1rem;
    height: 1.1rem;
  }

  .totals div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 4.5rem;
    padding: 8px;
    border: 1px solid var(--line);
    background: var(--bg);
  }

  .totals span {
    color: var(--muted);
    font-size: 12px;
  }

  .scroll {
    overflow: auto;
    max-width: 100%;
    min-width: 0;
    max-height: 50vh;
  }

  table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
  }

  th,
  td {
    border-bottom: 1px solid var(--line);
    padding: 6px 8px;
    text-align: left;
    white-space: nowrap;
  }

  th {
    position: sticky;
    top: 0;
    background: var(--panel);
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  .zero {
    color: var(--muted);
  }

  .low {
    color: var(--mark);
  }

  .high {
    color: var(--ink);
    background: color-mix(in srgb, var(--fill) 28%, transparent);
  }

  .empty {
    text-align: center;
    padding: 16px 8px;
  }
</style>
