<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../build/session";
  import { onSessionLines } from "../build/sessionBus.js";

  let tick = $state(0);

  const live = session as typeof session & {
    state: Record<string, unknown>;
    teams?: { teams?: Array<{ id?: string; name?: string; members?: unknown[] }> };
  };

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
    const teams = (live.teams && live.teams.teams) || [];
    let assigned = 0;
    const rows = teams.map((team, index) => {
      const members = Array.isArray(team.members) ? team.members.length : 0;
      assigned += members;
      return {
        key: team.id || String(index),
        name: team.name || team.id || "Team",
        members,
      };
    });
    return {
      start: dateLabel(state.startDate),
      weeks: num(state.weekCount),
      open: typeof state.open === "string" ? state.open : "",
      close: typeof state.close === "string" ? state.close : "",
      lines: lines.length,
      teamCount: rows.length,
      assigned,
      rows,
      fte: num(state.ftM) + num(state.ftF) + num(state.ptM) + num(state.ptF) + num(state.ltsoM) + num(state.ltsoF) + num(state.stsoM) + num(state.stsoF),
    };
  });

  const hours = $derived(
    snapshot.open && snapshot.close ? `${snapshot.open}–${snapshot.close}` : "—",
  );
</script>

<section class="teams" aria-label="Teams">
  <header class="head">
    <h2>Teams</h2>
    <p>
      {#if snapshot.lines}
        {snapshot.lines} lines in this session.
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
      <span>Teams</span>
      <b>{snapshot.teamCount}</b>
    </div>
    <div>
      <span>Assigned</span>
      <b>{snapshot.assigned}</b>
    </div>
    <div>
      <span>FTE</span>
      <b>{snapshot.fte}</b>
    </div>
  </div>

  {#if snapshot.rows.length}
    <h3>On session</h3>
    <div class="figures" aria-label="Team totals">
      {#each snapshot.rows as team (team.key)}
        <div>
          <span>{team.name}</span>
          <b>{team.members}</b>
        </div>
      {/each}
    </div>
  {:else}
    <p class="hint">No teams on this session.</p>
  {/if}

  <p class="hint">Read-only. No roster edits.</p>
</section>

<style>
  .teams {
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
