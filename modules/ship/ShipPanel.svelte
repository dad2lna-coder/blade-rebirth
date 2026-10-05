<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "../setup-panel/session";
  import { onSessionLines } from "../setup-panel/sessionBus.js";
  import {
    EBID_COLUMNS,
    EBID_HEADERS,
    rowToCells,
    rowsFromCsv,
    rowsFromJsonPayload,
    rowsFromScheduler,
    runQa,
    suggestForm,
    toCsv,
  } from "./ebid.js";

  type SourceKind = "live" | "csv" | "json";
  type TabName = "lines" | "qa" | "info";

  let airport = $state("");
  let eventId = $state("");
  let startDate = $state("");
  let endDate = $state("");
  let shiftType = $state("Airport");
  let kind = $state<SourceKind>("live");
  let label = $state("LIVE LINES");
  let csvText = $state("");
  let jsonData = $state<unknown>(null);
  let rows = $state<Record<string, unknown>[]>([]);
  let query = $state("");
  let status = $state("");
  let tab = $state<TabName>("lines");
  let fileEl = $state<HTMLInputElement | undefined>();

  function grabFile(node: HTMLInputElement) {
    fileEl = node;
    return () => {
      fileEl = undefined;
    };
  }

  function watchPanel(node: HTMLElement) {
    const parent = node.closest("[role='tabpanel']");
    const obs = parent
      ? new MutationObserver(() => {
          if (!parent.hasAttribute("hidden") && kind === "live") refreshLive();
        })
      : null;
    if (parent && obs) obs.observe(parent, { attributes: true, attributeFilter: ["hidden"] });
    return () => obs?.disconnect();
  }

  const qa = $derived(runQa(rows));
  const visible = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.bidLineId,
        row.workgroup,
        row.title,
        row.patDown,
        row.schedType,
        row.certification,
        row.shiftTime,
        row.rdos,
        row.publicComments,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  });
  const issues = $derived((qa.issues || []).slice(0, 80));
  const distinctGroups = $derived.by(() => {
    const distinct = (qa.distinct || {}) as Record<string, Record<string, number>>;
    return Object.keys(distinct).map((name) => {
      const counts = distinct[name] || {};
      const keys = Object.keys(counts).sort(
        (a, b) => counts[b] - counts[a] || a.localeCompare(b),
      );
      return { name, keys, counts };
    });
  });

  function colLetter(index: number): string {
    let n = index + 1;
    let out = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function readForm() {
    return {
      airportCode: airport.trim().toUpperCase(),
      bidEventId: eventId.trim(),
      startDate,
      endDate,
      shiftTypeMode: shiftType || "Airport",
    };
  }

  function fillBlanks() {
    const seed = suggestForm(session);
    if (!airport && seed.airportCode) airport = seed.airportCode;
    if (!eventId && seed.bidEventId) eventId = seed.bidEventId;
    if (!startDate && seed.startDate) startDate = seed.startDate;
    if (!endDate && seed.endDate) endDate = seed.endDate;
  }

  function seedAll() {
    const seed = suggestForm(session);
    airport = seed.airportCode || "";
    eventId = seed.bidEventId || "";
    startDate = seed.startDate || "";
    endDate = seed.endDate || "";
    shiftType = "Airport";
  }

  function refreshLive() {
    if (kind !== "live") return;
    fillBlanks();
    const next = rowsFromScheduler(session, readForm());
    rows = next;
    label = "LIVE LINES";
    const liveCount = Array.isArray(session.state?.lines) ? session.state.lines.length : 0;
    status = next.length
      ? next.length + " line(s) from this session."
      : "Session has " + liveCount + " line(s).";
  }

  function apply() {
    if (kind === "csv") {
      const parsed = rowsFromCsv(csvText, readForm());
      if (parsed.error) {
        status = parsed.error;
        return;
      }
      rows = parsed.rows;
      label = "CSV IMPORT";
      status = parsed.rows.length + " line(s) from the imported CSV.";
      return;
    }
    if (kind === "json") {
      const parsed = rowsFromJsonPayload(jsonData, readForm());
      if (parsed.error) {
        status = parsed.error;
        return;
      }
      rows = parsed.rows;
      label = "JSON IMPORT";
      status = parsed.rows.length + " line(s) from the imported JSON.";
      return;
    }
    refreshLive();
  }

  function useLive() {
    kind = "live";
    csvText = "";
    jsonData = null;
    seedAll();
    refreshLive();
    status = "Using the lines in this session.";
  }

  function exportCsv() {
    if (!rows.length) {
      status = "Nothing to export. Generate lines or import a fallback file.";
      return;
    }
    const report = runQa(rows);
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (eventId.trim() || "eBid") + "_45Col_Import.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    status =
      "Exported " +
      rows.length +
      " line(s), 45 columns A–AS." +
      (report.errors ? " QA still has " + report.errors + " error(s)." : "");
  }

  function onFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const name = file.name.toLowerCase();
      const tryJson = name.endsWith(".json") || /^\s*[{[]/.test(text);
      if (tryJson) {
        try {
          const data = JSON.parse(text);
          const parsed = rowsFromJsonPayload(data, readForm());
          if (!parsed.error) {
            kind = "json";
            jsonData = data;
            label = "JSON IMPORT";
            fillBlanks();
            if (data.config && data.config.startDate && !startDate) {
              startDate = String(data.config.startDate).slice(0, 10);
            }
            rows = rowsFromJsonPayload(data, readForm()).rows;
            status =
              "Fallback import " + file.name + " · " + rows.length + " line(s). Live lines are unchanged.";
            return;
          }
          if (name.endsWith(".json")) {
            status = parsed.error;
            return;
          }
        } catch {
          if (name.endsWith(".json")) {
            status = "Could not read that JSON.";
            return;
          }
        }
      }
      const parsed = rowsFromCsv(text, readForm());
      if (parsed.error) {
        status = parsed.error;
        return;
      }
      kind = "csv";
      csvText = text;
      label = "CSV IMPORT";
      rows = parsed.rows;
      status =
        "Fallback import " + file.name + " · " + rows.length + " line(s). Live lines are unchanged.";
    };
    reader.readAsText(file);
  }

  onMount(() => {
    refreshLive();
    const stop = onSessionLines(() => {
      if (kind === "live") refreshLive();
    });
    return stop;
  });
</script>

<section class="ship" aria-label="Ship" {@attach watchPanel}>
  <header class="head">
    <p class="kicker">eBid</p>
    <h2>45-column sheet</h2>
  </header>

  <form class="sheet" onsubmit={(event) => { event.preventDefault(); apply(); }}>
    <label>
      Airport
      <input bind:value={airport} maxlength="3" autocapitalize="characters" spellcheck="false" />
    </label>
    <label>
      Event
      <input bind:value={eventId} maxlength="100" spellcheck="false" />
    </label>
    <label>
      Start
      <input type="date" bind:value={startDate} />
    </label>
    <label>
      End
      <input type="date" bind:value={endDate} />
    </label>
    <label>
      Day type
      <select bind:value={shiftType}>
        <option>Airport</option>
        <option>Training</option>
        <option>Admin/Avail</option>
        <option>PandemicMix</option>
      </select>
    </label>
    <div class="actions">
      <button type="submit">Apply</button>
      <button type="button" onclick={useLive}>Use live lines</button>
      <button type="button" onclick={exportCsv}>Export 45-col</button>
      <button type="button" onclick={() => fileEl?.click()}>Import</button>
      <input
        {@attach grabFile}
        class="file"
        type="file"
        accept=".json,.csv,text/csv,application/json"
        onchange={onFile}
      />
    </div>
  </form>

  <p class="meta">
    <span class="badge">{label}</span>
    <span>{status || "Generate on Build, then open Ship."}</span>
  </p>

  <div class="subtabs" role="tablist" aria-label="eBid sheet">
    <button type="button" role="tab" aria-selected={tab === "lines"} onclick={() => (tab = "lines")}>
      Bid lines
    </button>
    <button type="button" role="tab" aria-selected={tab === "qa"} onclick={() => (tab = "qa")}>QA</button>
    <button type="button" role="tab" aria-selected={tab === "info"} onclick={() => (tab = "info")}>
      Info
    </button>
  </div>

  {#if tab === "lines"}
    <div class="lines">
      <label class="search">
        Find
        <input bind:value={query} placeholder="Line, team, cert, RDO" />
      </label>
      <p class="count">
        {rows.length}{query ? " · " + visible.length + " match" : ""}
      </p>
      <div class="scroll">
        <table>
          <thead>
            <tr class="letters">
              {#each EBID_HEADERS as _header, index (index)}
                <th>{colLetter(index)}</th>
              {/each}
            </tr>
            <tr>
              {#each EBID_HEADERS as header, index (index)}
                <th>{header}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#if !visible.length}
              <tr>
                <td colspan="45" class="empty">
                  {rows.length
                    ? "No lines match that search."
                    : "No lines in this session. Generate on Build, then come back — or import a JSON / lines CSV as a fallback."}
                </td>
              </tr>
            {:else}
              {#each visible as row (String(row.bidLineId) + ":" + String(row.sourceId))}
                {@const cells = rowToCells(row)}
                <tr>
                  {#each cells as cell, index (index)}
                    <td class:rdo={index >= 27 && index <= 40 && cells[index - 14] === "RDO" && !cell}
                      >{cell == null ? "" : cell}</td
                    >
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {:else if tab === "qa"}
    <div class="qa">
      {#if qa.empty}
        <p class="empty">No lines to check. Totals stay at zero until this session has lines.</p>
      {:else}
        <div class="stats">
          <p><span>Lines</span><b>{qa.total}</b></p>
          <p><span>Schedule</span><b>{qa.ft} FT / {qa.pt} PT</b></p>
          <p><span>Pat down</span><b>{qa.male} M / {qa.female} F</b></p>
          <p><span>Rule breaks</span><b>{qa.errors} error / {qa.warnings} warn</b></p>
        </div>
        {#if !issues.length}
          <p class="pass">
            No rule breaks. RDO shift types are blank, cert pools sit in column 13, and the row is 45 columns
            (A–AS).
          </p>
        {:else}
          <ul class="issues">
            {#each issues as issue, index (issue.code + ":" + issue.lineId + ":" + index)}
              <li class:fail={issue.level === "error"}>
                <span>{issue.level === "error" ? "Fail" : "Warn"}</span>
                {issue.lineId ? "Line " + issue.lineId + " — " : ""}{issue.message}
              </li>
            {/each}
          </ul>
          {#if qa.issues.length > issues.length}
            <p class="empty">{qa.issues.length - issues.length} more not shown.</p>
          {/if}
        {/if}
        <div class="distinct">
          {#each distinctGroups as group (group.name)}
            <section>
              <h3>{group.name} · {group.keys.length}</h3>
              {#each group.keys as key (key)}
                <p><span>{key}</span><b>{group.counts[key]}</b></p>
              {/each}
            </section>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="scroll">
      <table class="rules">
        <thead>
          <tr>
            <th>Col</th>
            <th>Header</th>
            <th>Values</th>
            <th>Rule</th>
          </tr>
        </thead>
        <tbody>
          {#each EBID_COLUMNS as col (col.id)}
            <tr>
              <td>{col.id}</td>
              <td>{col.header}</td>
              <td>{col.values}</td>
              <td>{col.desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .ship {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 100%;
  }

  .head,
  .sheet,
  .actions,
  .subtabs,
  .stats,
  .distinct {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .head {
    flex-direction: column;
    gap: 4px;
  }

  .kicker,
  h2,
  h3,
  p {
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

  .sheet label,
  .search {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
    min-width: 8rem;
  }

  input,
  select,
  button {
    min-height: 44px;
    padding: 8px 10px;
    background: var(--panel-2);
    border: 1px solid var(--line);
    color: var(--ink);
  }

  button {
    background: transparent;
  }

  button[type="submit"] {
    background: var(--fill);
    border-color: var(--fill);
    color: var(--fill-ink);
  }

  .file {
    display: none;
  }

  .meta,
  .count,
  .empty,
  .pass {
    color: var(--muted);
  }

  .badge {
    border: 1px solid var(--line);
    padding: 2px 8px;
    color: var(--ink);
  }

  .subtabs {
    border-bottom: 1px solid var(--line);
  }

  .subtabs button {
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--muted);
  }

  .subtabs button[aria-selected="true"] {
    color: var(--ink);
    border-bottom-color: var(--fill);
  }

  .scroll {
    overflow: auto;
    max-height: 62vh;
    border: 1px solid var(--line);
  }

  table {
    border-collapse: collapse;
    min-width: 140rem;
    font-size: 12px;
  }

  .rules {
    min-width: 48rem;
  }

  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
    border-right: 1px solid color-mix(in srgb, var(--line) 35%, transparent);
    text-align: left;
    white-space: nowrap;
    vertical-align: top;
  }

  .rules td:last-child {
    white-space: normal;
    max-width: 28rem;
  }

  .letters th {
    color: var(--muted);
    font-weight: 400;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--panel);
  }

  .letters th {
    top: 0;
  }

  thead tr:nth-child(2) th {
    top: 28px;
  }

  .rdo {
    color: var(--muted);
  }

  .stats p,
  .distinct p {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    min-width: 10rem;
    padding: 8px 10px;
    border: 1px solid var(--line);
  }

  .distinct {
    align-items: flex-start;
  }

  .distinct section {
    min-width: 14rem;
  }

  h3 {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  .issues {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .issues li {
    display: flex;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 40%, transparent);
  }

  .issues span {
    color: var(--muted);
  }

  .fail span {
    color: var(--fill);
  }

  .pass {
    color: var(--ready);
  }

  @media (max-width: 720px) {
    .sheet label,
    .search {
      flex: 1 1 100%;
    }

    table {
      min-width: 120rem;
    }
  }
</style>
