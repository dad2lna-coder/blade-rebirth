<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../build/session";
  import { onSessionLines } from "../build/sessionBus.js";

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

  const snapshot = $derived.by(() => {
    void tick;
    const state = live.state || {};
    const lines = Array.isArray(state.lines) ? state.lines : [];
    let male = 0;
    let female = 0;
    for (const line of lines) {
      const sex = (line as { sex?: string }).sex;
      if (sex === "M") male += 1;
      else if (sex === "F") female += 1;
    }
    const ft = num(state.ftM) + num(state.ftF);
    const pt = num(state.ptM) + num(state.ptF);
    const ltso = num(state.ltsoM) + num(state.ltsoF);
    const stso = num(state.stsoM) + num(state.stsoF);
    return {
      start: dateLabel(state.startDate),
      weeks: num(state.weekCount),
      open: typeof state.open === "string" ? state.open : "",
      close: typeof state.close === "string" ? state.close : "",
      lines: lines.length,
      male,
      female,
      ft,
      pt,
      ltso,
      stso,
      fte: ft + pt + ltso + stso,
      esti: num(state.esti),
      msti: num(state.msti),
      shifts: Array.isArray(state.shifts) ? state.shifts.length : 0,
    };
  });

  const hours = $derived(
    snapshot.open && snapshot.close ? `${snapshot.open}–${snapshot.close}` : "—",
  );
</script>

<section class="present" aria-label="Present">
  <header class="head">
    <h2>Present</h2>
    <p>
      {#if snapshot.lines}
        {snapshot.lines} lines from this session.
      {:else}
        No lines yet. Generate or import on Build.
      {/if}
    </p>
  </header>

  <div class="figures" aria-label="Session snapshot">
    <div>
      <span>Period</span>
      <b>{snapshot.start || "Not set"}</b>
    </div>
    <div>
      <span>Weeks</span>
      <b>{snapshot.weeks}</b>
    </div>
    <div>
      <span>Hours</span>
      <b>{hours}</b>
    </div>
    <div>
      <span>Lines</span>
      <b>{snapshot.lines}</b>
    </div>
    <div>
      <span>Line M / F</span>
      <b>{snapshot.male}/{snapshot.female}</b>
    </div>
    <div>
      <span>Shifts</span>
      <b>{snapshot.shifts}</b>
    </div>
    <div>
      <span>FTE</span>
      <b>{snapshot.fte}</b>
    </div>
    <div>
      <span>FT / PT</span>
      <b>{snapshot.ft}/{snapshot.pt}</b>
    </div>
    <div>
      <span>LTSO / STSO</span>
      <b>{snapshot.ltso}/{snapshot.stso}</b>
    </div>
    <div>
      <span>ESTI / MSTI</span>
      <b>{snapshot.esti}/{snapshot.msti}</b>
    </div>
  </div>

  <p class="hint">Read-only snapshot of the shared session. No slideshow.</p>
</section>

<style>
  .present {
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
  p {
    margin: 0;
  }

  h2 {
    font-size: 16px;
    font-weight: 500;
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
