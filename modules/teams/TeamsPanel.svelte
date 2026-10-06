<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../build/session";
  import { notifySessionLines, onSessionLines } from "../build/sessionBus.js";
  import { autoFormTeams, collectPool, writeTeams } from "./form.js";

  let tick = $state(0);
  let stsoPer = $state(1);
  let ltsoPer = $state(1);
  let tsoPer = $state(6);
  let startWindowMin = $state(30);
  let allowOneRdo = $state(false);
  let note = $state("");

  const live = session as typeof session & {
    state: Record<string, unknown>;
    teams?: { teams?: Array<{ id?: string; name?: string; phase?: string; members?: unknown[] }> };
  };

  onMount(() => onSessionLines(() => {
    tick += 1;
  }));

  const view = $derived.by(() => {
    void tick;
    const pool = collectPool(live) as Array<Record<string, any>>;
    const byId = new Map(pool.map((person) => [person.id, person]));
    const teams = ((live.teams && live.teams.teams) || []).map((team, index) => {
      const members = (team.members || []).map((id) => byId.get(id) || byId.get(Number(id))).filter(Boolean);
      return {
        key: team.id || String(index),
        name: team.name || team.id || "Team",
        phase: team.phase || (members[0] && members[0].startMin < 14 * 60 ? "AM" : "PM"),
        members,
      };
    });
    const assigned = new Set(teams.flatMap((team) => team.members.map((person) => person.id)));
    return {
      lines: pool.length,
      teams,
      am: teams.filter((team) => team.phase !== "PM"),
      pm: teams.filter((team) => team.phase === "PM"),
      open: pool.filter((person) => !assigned.has(person.id)),
    };
  });

  function form() {
    const next = autoFormTeams(live, { stsoPer, ltsoPer, tsoPer, startWindowMin, allowOneRdo });
    writeTeams(live, next);
    note = next.length ? next.length + " teams formed from RDO and start." : "No STSO lines to anchor teams.";
    notifySessionLines();
  }

  function clearTeams() {
    writeTeams(live, []);
    note = "Teams cleared.";
    notifySessionLines();
  }

  function savedTeams() {
    return ((live.teams && live.teams.teams) || []).map((team) => ({
      ...team,
      members: Array.isArray(team.members) ? team.members.slice() : [],
    }));
  }

  function removeMember(teamId: string, lineId: unknown) {
    const next = savedTeams()
      .map((team) => team.id === teamId
        ? { ...team, members: team.members.filter((id) => String(id) !== String(lineId)) }
        : team)
      .filter((team) => team.members.length);
    writeTeams(live, next);
    note = "Removed from team. Line stays in the session.";
    notifySessionLines();
  }

  function disband(teamId: string) {
    writeTeams(live, savedTeams().filter((team) => team.id !== teamId));
    note = "Team disbanded. Lines stay in the session.";
    notifySessionLines();
  }

  function newTeam() {
    const teams = savedTeams();
    const n = teams.length + 1;
    teams.push({ id: "T" + Date.now(), name: String(n).padStart(2, "0"), members: [], phase: "AM" });
    writeTeams(live, teams);
    note = "Empty team added.";
    notifySessionLines();
  }

  function place(lineId: unknown, targetId: string) {
    if (!targetId) return;
    const id = lineId;
    const next = savedTeams().map((team) => {
      const members = team.members.filter((member) => String(member) !== String(id));
      if (team.id === targetId) members.push(id);
      return { ...team, members };
    });
    writeTeams(live, next);
    note = "Assignment saved on this session.";
    notifySessionLines();
  }
</script>

<section class="teams" aria-label="Teams">
  <header class="head">
    <h2>Teams</h2>
    <p>
      {#if view.lines}
        {view.lines} ops lines · {view.teams.length} teams · {view.open.length} unassigned
      {:else}
        No lines yet. Generate or import on Build.
      {/if}
    </p>
  </header>

  <form class="form" onsubmit={(event) => { event.preventDefault(); form(); }}>
    <label>STSO <input type="number" min="0" max="20" bind:value={stsoPer} /></label>
    <label>LTSO <input type="number" min="0" max="20" bind:value={ltsoPer} /></label>
    <label>TSO <input type="number" min="0" max="50" bind:value={tsoPer} /></label>
    <label>Start window <input type="number" min="0" max="180" step="15" bind:value={startWindowMin} /></label>
    <label class="check"><input type="checkbox" bind:checked={allowOneRdo} /> Allow 1 matching RDO</label>
    <button type="submit">Auto-form</button>
    <button type="button" onclick={newTeam}>New team</button>
    <button type="button" onclick={clearTeams}>Clear</button>
  </form>
  {#if note}<p class="hint">{note}</p>{/if}

  {#each [{ title: "AM", rows: view.am }, { title: "PM", rows: view.pm }] as band (band.title)}
    <h3>{band.title}</h3>
    {#if band.rows.length}
      <div class="lists">
        {#each band.rows as team (team.key)}
          <article>
            <header>
              <b>{team.name}</b>
              <span>{team.members.length}</span>
              <button type="button" onclick={() => disband(team.key)}>Disband</button>
            </header>
            <ul>
              {#each team.members as person (person.id)}
                <li>
                  <span>{person.lineCode} · {person.role} · {person.sex} · {person.start || "—"} · {person.rdoLabel}</span>
                  <select aria-label="Move to" onchange={(event) => place(person.id, (event.currentTarget as HTMLSelectElement).value)}>
                    <option value="">Move to…</option>
                    {#each view.teams as target (target.key)}
                      {#if target.key !== team.key}
                        <option value={target.key}>{target.name}</option>
                      {/if}
                    {/each}
                  </select>
                  <button type="button" onclick={() => removeMember(team.key, person.id)}>Remove</button>
                </li>
              {/each}
            </ul>
          </article>
        {/each}
      </div>
    {:else}
      <p class="hint">No {band.title} teams.</p>
    {/if}
  {/each}

  <h3>Unassigned</h3>
  {#if view.open.length}
    <ul class="open">
      {#each view.open as person (person.id)}
        <li>
          <span>{person.lineCode} · {person.role} · {person.sex} · {person.start || "—"} · {person.rdoLabel}</span>
          <select aria-label="Assign to" onchange={(event) => place(person.id, (event.currentTarget as HTMLSelectElement).value)}>
            <option value="">Assign to…</option>
            {#each view.teams as target (target.key)}
              <option value={target.key}>{target.name}</option>
            {/each}
          </select>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="hint">{view.lines ? "Everyone is on a team." : "No lines yet."}</p>
  {/if}
</section>

<style>
  .teams {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .head,
  .form,
  .lists {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .head {
    flex-direction: column;
    gap: 4px;
  }

  h2,
  h3,
  p,
  ul {
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
  li {
    color: var(--muted);
    font-size: 13px;
  }

  .form label,
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 12px;
    min-height: 44px;
  }

  input,
  select,
  button {
    min-height: 44px;
    padding: 6px 8px;
    background: var(--panel-2);
    border: 1px solid var(--line);
    color: var(--ink);
    font: inherit;
  }

  button[type="submit"] {
    background: var(--fill);
    border-color: var(--fill);
    color: var(--fill-ink);
  }

  .lists {
    align-items: flex-start;
  }

  article {
    min-width: 14rem;
    flex: 1 1 16rem;
    border: 1px solid var(--line);
    background: var(--bg);
    padding: 8px;
  }

  article header,
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  article header button,
  li button,
  li select {
    min-height: 32px;
    padding: 4px 8px;
    background: transparent;
  }

  article ul,
  .open {
    padding: 0;
    list-style: none;
  }

  li {
    padding: 4px 0;
    border-bottom: 1px solid var(--line);
  }
</style>
