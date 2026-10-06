<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../../build/session";
  import { onSessionLines } from "../../build/sessionBus.js";

  let tick = $state(0);

  const live = session as typeof session & { state: Record<string, unknown> };

  onMount(() => onSessionLines(() => {
    tick += 1;
  }));

  function num(value: unknown) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function dateLabel(value: unknown) {
    if (value == null || value === "") return "";
    if (typeof value === "string") return value.slice(0, 10);
    if (typeof value === "object") {
      const dated = value as { toISODate?: () => string; toFormat?: (fmt: string) => string };
      if (typeof dated.toISODate === "function") return String(dated.toISODate() || "").slice(0, 10);
      if (typeof dated.toFormat === "function") return String(dated.toFormat("yyyy-MM-dd") || "").slice(0, 10);
    }
    return "";
  }

  const summary = $derived.by(() => {
    void tick;
    const state = live.state || {};
    const lines = Array.isArray(state.lines) ? state.lines : [];
    let male = 0;
    let female = 0;
    let shortfall = 0;
    for (const line of lines) {
      const row = line as { sex?: string; isShortfall?: boolean };
      if (row.isShortfall) shortfall += 1;
      if (row.sex === "M") male += 1;
      else if (row.sex === "F") female += 1;
    }
    const ftM = num(state.ftM);
    const ftF = num(state.ftF);
    const ptM = num(state.ptM);
    const ptF = num(state.ptF);
    const ltsoM = num(state.ltsoM);
    const ltsoF = num(state.ltsoF);
    const stsoM = num(state.stsoM);
    const stsoF = num(state.stsoF);
    const extras = Array.isArray(state.extraPositions) ? state.extraPositions : [];
    return {
      start: dateLabel(state.startDate),
      weeks: num(state.weekCount),
      open: typeof state.open === "string" && state.open ? state.open : "",
      close: typeof state.close === "string" && state.close ? state.close : "",
      lines: lines.length,
      male,
      female,
      shortfall,
      fte: [
        { key: "ft", label: "FT", m: ftM, f: ftF },
        { key: "pt", label: "PT", m: ptM, f: ptF },
        { key: "ltso", label: "LTSO", m: ltsoM, f: ltsoF },
        { key: "stso", label: "STSO", m: stsoM, f: stsoF },
      ],
      fteTotal: ftM + ftF + ptM + ptF + ltsoM + ltsoF + stsoM + stsoF,
      esti: num(state.esti),
      msti: num(state.msti),
      extras: extras.map((pos, index) => {
        const row = pos as { id?: string; name?: string; m?: number; f?: number };
        return {
          key: row.id || String(index),
          label: row.name || "Position",
          m: num(row.m),
          f: num(row.f),
        };
      }),
    };
  });

  const hasLines = $derived(summary.lines > 0);
  const hours = $derived(
    summary.open && summary.close ? `${summary.open}–${summary.close}` : "",
  );
</script>

<section class="reports" aria-label="Reports">
  <header class="head">
    <h2>Reports</h2>
    <p>
      {#if hasLines}
        {summary.lines} lines in this session.
      {:else}
        No lines yet. Generate or import on Build.
      {/if}
    </p>
  </header>

  <div class="figures" aria-label="Session summary">
    <div>
      <span>Period</span>
      <b>{summary.start || "Not set"}</b>
    </div>
    <div>
      <span>Weeks</span>
      <b>{summary.weeks}</b>
    </div>
    <div>
      <span>Hours</span>
      <b>{hours || "—"}</b>
    </div>
    <div>
      <span>Lines</span>
      <b>{summary.lines}</b>
    </div>
    <div>
      <span>Line M / F</span>
      <b>{summary.male}/{summary.female}</b>
    </div>
    <div>
      <span>FTE total</span>
      <b>{summary.fteTotal}</b>
    </div>
  </div>

  <h3>FTE on session</h3>
  <div class="figures" aria-label="FTE totals">
    {#each summary.fte as row (row.key)}
      <div>
        <span>{row.label}</span>
        <b>{row.m}/{row.f}/{row.m + row.f}</b>
      </div>
    {/each}
    <div>
      <span>ESTI</span>
      <b>{summary.esti}</b>
    </div>
    <div>
      <span>MSTI</span>
      <b>{summary.msti}</b>
    </div>
  </div>

  {#if summary.extras.length}
    <h3>Extra positions</h3>
    <div class="figures" aria-label="Extra position totals">
      {#each summary.extras as row (row.key)}
        <div>
          <span>{row.label}</span>
          <b>{row.m}/{row.f}/{row.m + row.f}</b>
        </div>
      {/each}
    </div>
  {/if}

  <p class="hint">
    Counts are the period, lines, and FTE already on this session. M / F / total.
    {#if summary.shortfall}
      {summary.shortfall} shortfall {summary.shortfall === 1 ? "line" : "lines"} included in the line count.
    {/if}
  </p>
</section>

<style>
  .reports {
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
  .hint {
    color: var(--muted);
    font-size: 13px;
  }

  .figures {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .figures div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 5.5rem;
    padding: 8px;
    border: 1px solid var(--line);
    background: var(--bg);
  }

  .figures span {
    color: var(--muted);
    font-size: 12px;
  }
</style>
