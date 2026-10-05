<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../setup-panel/session";
  import { onSessionLines } from "../setup-panel/sessionBus.js";
  import { rowMatches, rowsFromSession } from "./rows.js";

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let tick = $state(0);
  let search = $state("");
  let role = $state("ALL");
  let shiftId = $state("");
  let sex = $state("");
  let teamId = $state("");
  let duty = $state("");
  let sortKey = $state("line");
  let sortDir = $state<"asc" | "desc">("asc");

  const live = session as typeof session & {
    state: Record<string, any>;
    teams?: { teams?: Array<{ id?: string; name?: string }> };
    getShift?: (id: string) => { id: string; name?: string; start?: string; end?: string } | undefined;
  };

  onMount(() => onSessionLines(() => {
    tick += 1;
  }));

  const allRows = $derived.by(() => {
    void tick;
    return rowsFromSession(live) as Array<Record<string, any>>;
  });

  const shiftOptions = $derived.by(() => {
    void tick;
    return (live.state.shifts || []) as Array<{ id: string; name?: string; start?: string; end?: string }>;
  });

  const teamOptions = $derived.by(() => {
    void tick;
    return ((live.teams && live.teams.teams) || []) as Array<{ id?: string; name?: string }>;
  });

  const rows = $derived.by(() => {
    const filtered = allRows.filter((row) =>
      rowMatches(row, { search, role, shift: shiftId, sex, team: teamId, duty }),
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return av.localeCompare(bv, undefined, { numeric: true }) * dir;
    });
  });

  function toggleSort(key: string) {
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortDir = "asc";
    }
  }

  function mark(key: string) {
    return sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  }

  function dutyClass(value: unknown) {
    const text = String(value || "OFF");
    if (text === "-") return "dash";
    return text.toLowerCase();
  }

  function shiftLabel(shift: { name?: string; id: string; start?: string; end?: string }) {
    const name = shift.name || shift.id;
    if (shift.start && shift.end) return `${name} (${shift.start}–${shift.end})`;
    return name;
  }
</script>

<section class="lines" aria-label="Lines">
  <header class="head">
    <h2>Bid lines</h2>
    <p>{rows.length} of {allRows.length}</p>
  </header>

  <div class="filters">
    <label>
      Search
      <input type="text" placeholder="Line code" bind:value={search} />
    </label>
    <label>
      Role
      <select bind:value={role}>
        <option value="ALL">All</option>
        <option value="STSO">STSO</option>
        <option value="LTSO">LTSO</option>
        <option value="TSO">TSO (FT/PT)</option>
      </select>
    </label>
    <label>
      Shift
      <select bind:value={shiftId}>
        <option value="">All shifts</option>
        {#each shiftOptions as shift (shift.id)}
          <option value={shift.id}>{shiftLabel(shift)}</option>
        {/each}
      </select>
    </label>
    <label>
      Sex
      <select bind:value={sex}>
        <option value="">All</option>
        <option value="M">M</option>
        <option value="F">F</option>
      </select>
    </label>
    <label>
      Team
      <select bind:value={teamId}>
        <option value="">All</option>
        <option value="__none__">Unassigned</option>
        {#each teamOptions as team (team.id)}
          <option value={team.id}>{team.name || team.id}</option>
        {/each}
      </select>
    </label>
    <label>
      Duty
      <select bind:value={duty}>
        <option value="">All duties</option>
        <option value="BAG">BAG</option>
        <option value="PAX">PAX</option>
        <option value="DFO">DFO</option>
        <option value="-">-</option>
        <option value="TRAINING">TRAINING</option>
        <option value="OFF">OFF / RDO</option>
      </select>
    </label>
  </div>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th><button type="button" onclick={() => toggleSort("team")}>Team{mark("team")}</button></th>
          <th><button type="button" onclick={() => toggleSort("line")}>Line{mark("line")}</button></th>
          <th><button type="button" onclick={() => toggleSort("shift")}>Shift{mark("shift")}</button></th>
          <th><button type="button" onclick={() => toggleSort("start")}>Start{mark("start")}</button></th>
          <th>End</th>
          <th><button type="button" onclick={() => toggleSort("position")}>Position{mark("position")}</button></th>
          <th>Emp</th>
          <th>Sex</th>
          <th><button type="button" onclick={() => toggleSort("function")}>Duty{mark("function")}</button></th>
          <th>Cert</th>
          <th>RDOs</th>
          <th>Paid</th>
          {#each DAYS as day (day)}
            <th>{day}</th>
          {/each}
          <th>Hrs</th>
        </tr>
      </thead>
      <tbody>
        {#if rows.length}
          {#each rows as row (row.id)}
            <tr>
              <td>{row.team || "—"}</td>
              <td>{row.line}</td>
              <td>{row.shift}</td>
              <td>{row.start}</td>
              <td>{row.end}</td>
              <td>{row.position}</td>
              <td>{row.emp}</td>
              <td>{row.sex}</td>
              <td>{row.function || "—"}</td>
              <td>{row.certPool || "—"}</td>
              <td>{row.rdos}</td>
              <td>{row.paid}</td>
              {#each DAYS as _day, index (index)}
                <td class="day {dutyClass(row.dayDuties[index])}">{row.dayDuties[index]}</td>
              {/each}
              <td>{row.hours}</td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td class="empty" colspan="20">
              {allRows.length ? "No lines match these filters." : "Generate on Build to list lines."}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>

<style>
  .lines {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    max-width: 100%;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
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
  .empty {
    color: var(--muted);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: end;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
  }

  input,
  select,
  th button {
    font: inherit;
    color: var(--ink);
    background: var(--panel-2);
    border: 1px solid var(--line);
    min-height: 44px;
    padding: 6px 8px;
  }

  th button {
    background: transparent;
    border: 0;
    min-height: 36px;
    padding: 0;
    font-weight: 500;
  }

  .scroll {
    overflow: auto;
    max-width: 100%;
    min-width: 0;
    max-height: 70vh;
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
    vertical-align: middle;
  }

  th {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    position: sticky;
    top: 0;
    background: var(--panel);
  }

  .day {
    text-align: center;
    font-size: 12px;
  }

  .bag {
    color: var(--fill-ink);
    background: var(--mark);
  }

  .dfo {
    color: var(--ready);
    font-weight: 500;
  }

  .pax {
    color: var(--ink);
  }

  .training,
  .off,
  .dash,
  .rdo {
    color: var(--muted);
  }

  .empty {
    text-align: center;
    padding: 24px 8px;
    white-space: normal;
  }
</style>
