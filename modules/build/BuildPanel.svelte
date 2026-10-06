<script lang="ts">
  import { onMount } from "svelte";
  import GenerateModal from "./GenerateModal.svelte";
  import { session } from "./session";
  import { onSessionLines } from "./sessionBus.js";
  import { applySession, clearSession, exportSession } from "./sessionIo.js";
  import { setupStore } from "./stores/setupStore.js";
  import { parseStartDate, toDateInputValue } from "./period/dates.js";
  import { ensurePositionGender, plannedHeadcount } from "./fte/gender.js";
  import type { SetupSession } from "./types";

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ROLES = ["STSO", "LTSO", "TSO"] as const;
  const PHASES = ["auto", "opening", "am", "pm", "closing"] as const;

  const live = session as SetupSession & {
    state: Record<string, any>;
    shiftSeq?: number;
  };

  if (!live.state.startDate) live.state.startDate = parseStartDate(null);
  if (live.state.functionCoverage.poolTsoDfoPt == null) live.state.functionCoverage.poolTsoDfoPt = 0;
  if (!Array.isArray(live.state.functionCoverage.requirementShiftIds)) {
    live.state.functionCoverage.requirementShiftIds = [];
  }

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let fileEl: HTMLInputElement | undefined = $state();
  let tick = $state(0);
  let bandNote = $state("");
  let ioNote = $state("");

  let start = $state(toDateInputValue(live.state.startDate));
  let weeks = $state(int(live.state.weekCount, 1));
  let seed = $state(live.state.generateSeed != null ? String(live.state.generateSeed) : "random");
  let openTime = $state(String(live.state.open || "03:30"));
  let closeTime = $state(String(live.state.close || "23:00"));

  let ftM = $state(int(live.state.ftM));
  let ftF = $state(int(live.state.ftF));
  let ptM = $state(int(live.state.ptM));
  let ptF = $state(int(live.state.ptF));
  let ptHours = $state(int(live.state.ptHoursPerDay, 4));
  let ptDays = $state(int(live.state.ptDaysPerWeek, 3));
  let ltsoM = $state(int(live.state.ltsoM));
  let ltsoF = $state(int(live.state.ltsoF));
  let stsoM = $state(int(live.state.stsoM));
  let stsoF = $state(int(live.state.stsoF));
  let esti = $state(int(live.state.esti));
  let msti = $state(int(live.state.msti));
  const seeded = ensurePositionGender(live.state);
  let gender = $state({
    FT: { ...seeded.FT },
    PT: { ...seeded.PT },
    LTSO: { ...seeded.LTSO },
    STSO: { ...seeded.STSO },
  });

  let shifts = $state(live.state.shifts as any[]);
  let extras = $state((live.state.extraPositions || []) as any[]);
  let fc = $state(live.state.functionCoverage);
  let cert = $state(live.state.certPool);

  live.state.shifts = shifts;
  live.state.extraPositions = extras;
  live.state.functionCoverage = fc;
  live.state.certPool = cert;

  function int(value: unknown, fallback = 0) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value: unknown, min: number, max: number, fallback: number) {
    const n = int(value, fallback);
    return Math.max(min, Math.min(max, n));
  }

  function policy(key: "FT" | "PT" | "LTSO" | "STSO", male: number, female: number) {
    const row = gender[key];
    return {
      ignoreGender: !!row.ignoreGender,
      dropM: Math.min(Math.max(0, male), Math.max(0, row.dropM || 0)),
      dropF: Math.min(Math.max(0, female), Math.max(0, row.dropF || 0)),
    };
  }

  function setGender(key: "FT" | "PT" | "LTSO" | "STSO", patch: { ignoreGender?: boolean; dropM?: number; dropF?: number }) {
    gender[key] = { ...gender[key], ...patch };
  }

  function num(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function commit() {
    live.state.startDate = parseStartDate(start || null);
    live.state.weekCount = clamp(weeks, 1, 8, 1);
    live.state.generateSeed = seed.trim() || "random";
    live.state.open = openTime || "03:30";
    live.state.close = closeTime || "23:00";
    live.state.ftM = Math.max(0, ftM);
    live.state.ftF = Math.max(0, ftF);
    live.state.ptM = Math.max(0, ptM);
    live.state.ptF = Math.max(0, ptF);
    live.state.ptHoursPerDay = clamp(ptHours, 1, 12, 4);
    live.state.ptDaysPerWeek = clamp(ptDays, 1, 6, 3);
    live.state.ltsoM = Math.max(0, ltsoM);
    live.state.ltsoF = Math.max(0, ltsoF);
    live.state.stsoM = Math.max(0, stsoM);
    live.state.stsoF = Math.max(0, stsoF);
    live.state.esti = Math.max(0, esti);
    live.state.msti = Math.max(0, msti);
    live.state.positionGender = {
      FT: policy("FT", ftM, ftF),
      PT: policy("PT", ptM, ptF),
      LTSO: policy("LTSO", ltsoM, ltsoF),
      STSO: policy("STSO", stsoM, stsoF),
    };
    for (const pos of extras) {
      pos.ignoreGender = !!pos.ignoreGender;
      pos.dropM = Math.min(int(pos.m), Math.max(0, int(pos.dropM)));
      pos.dropF = Math.min(int(pos.f), Math.max(0, int(pos.dropF)));
    }
    const store = setupStore as Record<string, unknown>;
    store.fte = {
      ftM: live.state.ftM,
      ftF: live.state.ftF,
      ptM: live.state.ptM,
      ptF: live.state.ptF,
      ptHoursPerDay: live.state.ptHoursPerDay,
      ptDaysPerWeek: live.state.ptDaysPerWeek,
      ltsoM: live.state.ltsoM,
      ltsoF: live.state.ltsoF,
      stsoM: live.state.stsoM,
      stsoF: live.state.stsoF,
      esti: live.state.esti,
      msti: live.state.msti,
    };
    store.period = {
      open: live.state.open,
      close: live.state.close,
      weeks: live.state.weekCount,
      start,
      seed: live.state.generateSeed,
    };
    store.extraPositions = extras;
    store.functionCoverage = fc;
    store.certPool = cert;
  }

  $effect(commit);

  function read(event: Event) {
    return (event.currentTarget as HTMLInputElement).value;
  }

  function req(role: string, shiftId: string) {
    return fc.requirements?.[role]?.[shiftId] || { min: 0, max: 0 };
  }

  function setReq(role: string, shiftId: string, field: "min" | "max", raw: string) {
    if (!fc.requirements[role]) fc.requirements[role] = {};
    if (!fc.requirements[role][shiftId]) fc.requirements[role][shiftId] = { min: 0, max: 0 };
    const row = fc.requirements[role][shiftId];
    row[field] = Math.max(0, int(raw));
    if (row.max < row.min) row.max = row.min;
  }

  function addShift() {
    const seq = live.shiftSeq || shifts.length + 1;
    live.shiftSeq = seq + 1;
    shifts.push({
      id: "S" + seq,
      name: "Shift",
      start: "08:00",
      end: "16:30",
      paid: 8,
      force: 0,
      ltsoForce: 0,
      stsoForce: 0,
      rdoHard: [],
      phase: "auto",
      dayTimes: null,
    });
  }

  function removeShift(id: string) {
    const index = shifts.findIndex((shift) => shift.id === id);
    if (index >= 0) shifts.splice(index, 1);
    fc.requirementShiftIds = fc.requirementShiftIds.filter((shiftId: string) => shiftId !== id);
    for (const role of ROLES) {
      if (fc.requirements?.[role]) delete fc.requirements[role][id];
    }
  }

  function toggleRdo(shift: any, day: number, checked: boolean) {
    const next = new Set<number>((shift.rdoHard || []).map(Number));
    if (checked) next.add(day);
    else next.delete(day);
    shift.rdoHard = [...next].sort((a, b) => a - b);
  }

  function toggleDayTime(shift: any, day: number, checked: boolean) {
    const next = { ...(shift.dayTimes || {}) };
    if (checked) next[String(day)] = next[String(day)] || { start: shift.start, end: shift.end };
    else delete next[String(day)];
    shift.dayTimes = Object.keys(next).length ? next : null;
  }

  function setDayTime(shift: any, day: number, field: "start" | "end", value: string) {
    const key = String(day);
    const current = (shift.dayTimes && shift.dayTimes[key]) || { start: shift.start, end: shift.end };
    shift.dayTimes = { ...(shift.dayTimes || {}), [key]: { ...current, [field]: value } };
  }

  function addExtra() {
    extras.push({
      id: "extra-" + Date.now() + "-" + (extras.length + 1),
      name: "Position",
      m: 0,
      f: 0,
      ignoreGender: false,
      dropM: 0,
      dropF: 0,
      opsFte: false,
      bands: [{ start: "04:00", end: "20:30", min: 1 }],
      shiftCounts: {},
    });
  }

  function removeExtra(id: string) {
    const index = extras.findIndex((pos) => pos.id === id);
    if (index >= 0) extras.splice(index, 1);
  }

  function shiftCount(pos: any, id: string) {
    return pos.shiftCounts && pos.shiftCounts[id] != null ? int(pos.shiftCounts[id]) : 0;
  }

  function setShiftCount(pos: any, id: string, raw: string) {
    if (!pos.shiftCounts) pos.shiftCounts = {};
    pos.shiftCounts[id] = Math.max(0, int(raw));
  }

  function addBand() {
    const used = new Set(fc.requirementShiftIds || []);
    const next = shifts.find((shift) => shift.id && !used.has(shift.id));
    bandNote = "";
    if (!next) {
      bandNote = shifts.length
        ? "All shifts are already listed."
        : "Add a shift before adding a coverage band.";
      return;
    }
    fc.requirementShiftIds = [...(fc.requirementShiftIds || []), next.id];
    for (const role of ROLES) {
      if (!fc.requirements[role]) fc.requirements[role] = {};
      fc.requirements[role][next.id] = { min: 0, max: 0 };
    }
  }

  function removeBand(shiftId: string) {
    fc.requirementShiftIds = fc.requirementShiftIds.filter((id: string) => id !== shiftId);
    for (const role of ROLES) {
      if (fc.requirements?.[role]) delete fc.requirements[role][shiftId];
    }
  }

  function moveBand(fromId: string, toId: string) {
    if (!toId || fromId === toId) return;
    if (fc.requirementShiftIds.includes(toId)) return;
    fc.requirementShiftIds = fc.requirementShiftIds.map((id: string) => (id === fromId ? toId : id));
    for (const role of ROLES) {
      const row = fc.requirements?.[role]?.[fromId] || { min: 0, max: 0 };
      if (!fc.requirements[role]) fc.requirements[role] = {};
      fc.requirements[role][toId] = { min: int(row.min), max: int(row.max) };
      delete fc.requirements[role][fromId];
    }
  }

  function setMap(key: "DFO" | "BAG" | "PAX", value: string) {
    cert.functionMap[key] = value === "none" ? "" : value;
  }

  function openModal() {
    commit();
    open = true;
  }

  function closeModal() {
    open = false;
    const shell = document.querySelector<HTMLElement>(".shell");
    if (shell) shell.inert = false;
    document.body.style.overflow = "";
    trigger?.focus();
    tick += 1;
  }

  const preview = $derived(
    "BAG STSO " +
      int(fc.poolStsoBagM) +
      "/" +
      int(fc.poolStsoBagF) +
      " LTSO " +
      int(fc.poolLtsoBagM) +
      "/" +
      int(fc.poolLtsoBagF) +
      " TSO " +
      int(fc.poolTsoBagM) +
      "/" +
      int(fc.poolTsoBagF) +
      " · DFO STSO " +
      int(fc.poolStsoDfoM) +
      "/" +
      int(fc.poolStsoDfoF) +
      " LTSO " +
      int(fc.poolLtsoDfoM) +
      "/" +
      int(fc.poolLtsoDfoF) +
      " TSO " +
      int(fc.poolTsoDfoM) +
      "/" +
      int(fc.poolTsoDfoF) +
      " PT " +
      int(fc.poolTsoDfoPt),
  );

  const result = $derived.by(() => {
    void tick;
    const lines = (live.state.lines || []) as Array<Record<string, unknown>>;
    const counts: Record<string, number> = {};
    for (const line of lines) {
      const key = String(line.function || "—");
      counts[key] = (counts[key] || 0) + 1;
    }
    return {
      lines: lines.length,
      counts,
      issues: [...((live.state.issues || []) as string[])],
      seed: live.state.activeSeed,
      mode: live.state.mode,
    };
  });

  function hydrate() {
    start = toDateInputValue(live.state.startDate);
    weeks = int(live.state.weekCount, 1);
    seed = live.state.generateSeed != null ? String(live.state.generateSeed) : "random";
    openTime = String(live.state.open || "03:30");
    closeTime = String(live.state.close || "23:00");
    ftM = int(live.state.ftM);
    ftF = int(live.state.ftF);
    ptM = int(live.state.ptM);
    ptF = int(live.state.ptF);
    ptHours = int(live.state.ptHoursPerDay, 4);
    ptDays = int(live.state.ptDaysPerWeek, 3);
    ltsoM = int(live.state.ltsoM);
    ltsoF = int(live.state.ltsoF);
    stsoM = int(live.state.stsoM);
    stsoF = int(live.state.stsoF);
    esti = int(live.state.esti);
    msti = int(live.state.msti);
    const nextGender = ensurePositionGender(live.state);
    gender = {
      FT: { ...nextGender.FT },
      PT: { ...nextGender.PT },
      LTSO: { ...nextGender.LTSO },
      STSO: { ...nextGender.STSO },
    };
    shifts = live.state.shifts as any[];
    extras = (live.state.extraPositions || []) as any[];
    fc = live.state.functionCoverage;
    cert = live.state.certPool;
    live.state.shifts = shifts;
    live.state.extraPositions = extras;
    live.state.functionCoverage = fc;
    live.state.certPool = cert;
    tick += 1;
  }

  function downloadSession() {
    commit();
    const filename = exportSession(live);
    ioNote = "Exported " + filename + ".";
  }

  function pickImport() {
    if (!fileEl) return;
    fileEl.value = "";
    fileEl.click();
  }

  function onImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applySession(live, JSON.parse(String(reader.result || "")));
        hydrate();
        ioNote = "Imported " + (live.state.lines.length ? "config and results" : "config only") + " · " + live.state.lines.length + " line(s).";
      } catch (err) {
        live.state.issues = ["Import failed: " + (err instanceof Error ? err.message : "Invalid JSON")];
        ioNote = "Import failed.";
        tick += 1;
      }
    };
    reader.readAsText(file);
  }

  function clearSessionForm() {
    if (!confirm("Clear the session to empty defaults? Period, FTE, shifts, coverage, certs, and lines will reset.")) return;
    clearSession(live);
    hydrate();
    ioNote = "Cleared session.";
  }

  onMount(() => onSessionLines(() => {
    tick += 1;
  }));
</script>

{#snippet count(id: string, label: string, value: number, apply: (n: number) => void, min = 0, max = 999)}
  <label>
    {label}
    <input
      type="number"
      {id}
      {min}
      {max}
      {value}
      oninput={(event) => apply(clamp(read(event), min, max, min))}
    />
  </label>
{/snippet}

{#snippet genderControls(id: string, key: "FT" | "PT" | "LTSO" | "STSO", male: number, female: number)}
  {@const row = policy(key, male, female)}
  {@const plan = plannedHeadcount(male, female, row)}
  <label class="check">
    <input
      type="checkbox"
      id={"cfg-ignore-" + id}
      checked={row.ignoreGender}
      onchange={(event) => setGender(key, { ignoreGender: (event.currentTarget as HTMLInputElement).checked })}
    />
    Ignore gender
  </label>
  {@render count(
    "cfg-drop-m-" + id,
    "Remove from count M",
    row.dropM,
    (n) => setGender(key, { dropM: n }),
    0,
    Math.max(0, male),
  )}
  {@render count(
    "cfg-drop-f-" + id,
    "Remove from count F",
    row.dropF,
    (n) => setGender(key, { dropF: n }),
    0,
    Math.max(0, female),
  )}
  <p class="tally" aria-label={id + " counted headcount"}>{plan.M}/{plan.F}/{plan.T}</p>
{/snippet}

<section class="build" aria-label="Build">
  <div class="mount" id="mount-setup" data-mount="#mount-setup">
<section class="setup" aria-label="Setup">
  <div class="setup-toolbar">
    <button
      bind:this={trigger}
      type="button"
      id="btn-generate"
      class="generate"
      aria-haspopup="dialog"
      aria-controls="generate-modal"
      aria-expanded={open}
      onclick={openModal}>[GEN] GENERATE</button
    >
    <button type="button" class="btn" id="btn-export" onclick={downloadSession}>[EXP] EXPORT</button>
    <button type="button" class="btn" id="btn-import" onclick={pickImport}>[IMP] IMPORT</button>
    <button type="button" class="btn danger" id="btn-clear" onclick={clearSessionForm}>[CLR] CLEAR</button>
    <input
      bind:this={fileEl}
      type="file"
      id="file-import"
      accept="application/json,.json"
      hidden
      onchange={onImportFile}
    />
  </div>
  {#if ioNote}<p class="hint" role="status">{ioNote}</p>{/if}

  <p class="lede">
    <strong>BLADE</strong> staffing balancer. <strong>FT / PT</strong> are operational TSO.
    <strong>LTSO / STSO</strong> are management. ESTI and MSTI are training counts, not a second PT path.
  </p>

  <section class="card" aria-labelledby="period-title">
    <h2 id="period-title">Schedule period</h2>
    <div class="sex">
      <label>
        Schedule start
        <input type="date" id="cfg-start" value={start} oninput={(event) => (start = read(event))} />
      </label>
      {@render count("cfg-weeks", "Weeks", weeks, (n) => (weeks = n), 1, 8)}
      <label>
        Seed
        <input
          type="text"
          id="cfg-seed"
          value={seed}
          spellcheck="false"
          autocomplete="off"
          oninput={(event) => (seed = read(event))}
        />
      </label>
      <label>
        Open
        <input type="time" id="cfg-open" value={openTime} oninput={(event) => (openTime = read(event))} />
      </label>
      <label>
        Close
        <input type="time" id="cfg-close" value={closeTime} oninput={(event) => (closeTime = read(event))} />
      </label>
    </div>
    <p class="hint">Seed <span class="mono">random</span> draws a new pattern. A number repeats that pattern.</p>
  </section>

  <details class="card" open>
    <summary>FTE</summary>
    <div class="block">
      <div class="fte-pos">
        <div class="fte-head">
          <h3>FT TSO</h3>
          {@render genderControls("ft", "FT", ftM, ftF)}
        </div>
        <div class="sex">
          {@render count("cfg-ft-m", "Male", ftM, (n) => (ftM = n))}
          {@render count("cfg-ft-f", "Female", ftF, (n) => (ftF = n))}
        </div>
      </div>
      <div class="fte-pos">
        <div class="fte-head">
          <h3>PT TSO</h3>
          {@render genderControls("pt", "PT", ptM, ptF)}
        </div>
        <div class="sex">
          {@render count("cfg-pt-m", "Male", ptM, (n) => (ptM = n))}
          {@render count("cfg-pt-f", "Female", ptF, (n) => (ptF = n))}
          {@render count("cfg-pt-hours", "Hours/day", ptHours, (n) => (ptHours = n), 1, 12)}
          {@render count("cfg-pt-days", "Days/week", ptDays, (n) => (ptDays = n), 1, 6)}
        </div>
      </div>
      <div class="fte-pos">
        <div class="fte-head">
          <h3>LTSO</h3>
          {@render genderControls("ltso", "LTSO", ltsoM, ltsoF)}
        </div>
        <div class="sex">
          {@render count("cfg-ltso-m", "Male", ltsoM, (n) => (ltsoM = n))}
          {@render count("cfg-ltso-f", "Female", ltsoF, (n) => (ltsoF = n))}
        </div>
      </div>
      <div class="fte-pos">
        <div class="fte-head">
          <h3>STSO</h3>
          {@render genderControls("stso", "STSO", stsoM, stsoF)}
        </div>
        <div class="sex">
          {@render count("cfg-stso-m", "Male", stsoM, (n) => (stsoM = n))}
          {@render count("cfg-stso-f", "Female", stsoF, (n) => (stsoF = n))}
        </div>
      </div>
      <p class="hint">Ignore gender skips sex on that position only. Remove from count still builds the line, and leaves it out of counted M and F. The figure is counted M / counted F / total lines.</p>
      <h3>Training</h3>
      <div class="sex">
        {@render count("cfg-esti", "ESTI", esti, (n) => (esti = n))}
        {@render count("cfg-msti", "MSTI", msti, (n) => (msti = n))}
      </div>
      <div class="row-actions">
        <button type="button" class="btn" id="btn-add-position" onclick={addExtra}>+ Add position</button>
      </div>
      {#each extras as pos (pos.id)}
        <div class="extra">
          <div class="sex">
            <label>
              Name
              <input type="text" data-extra-name={pos.id} value={pos.name} oninput={(event) => (pos.name = read(event).trim() || "Position")} />
            </label>
            <label class="check">
              <input
                type="checkbox"
                id={"extra-ignore-" + pos.id}
                checked={!!pos.ignoreGender}
                onchange={(event) => (pos.ignoreGender = (event.currentTarget as HTMLInputElement).checked)}
              />
              Ignore gender
            </label>
            {@render count(
              "extra-drop-m-" + pos.id,
              "Remove from count M",
              Math.min(int(pos.dropM), int(pos.m)),
              (n) => (pos.dropM = n),
              0,
              int(pos.m),
            )}
            {@render count(
              "extra-drop-f-" + pos.id,
              "Remove from count F",
              Math.min(int(pos.dropF), int(pos.f)),
              (n) => (pos.dropF = n),
              0,
              int(pos.f),
            )}
            <p class="tally">{plannedHeadcount(pos.m, pos.f, pos).M}/{plannedHeadcount(pos.m, pos.f, pos).F}/{plannedHeadcount(pos.m, pos.f, pos).T}</p>
            {@render count("extra-m-" + pos.id, "Male", int(pos.m), (n) => (pos.m = n))}
            {@render count("extra-f-" + pos.id, "Female", int(pos.f), (n) => (pos.f = n))}
            <label>
              Ops FTE
              <select
                data-extra-ops={pos.id}
                value={pos.opsFte ? "yes" : "no"}
                onchange={(event) => (pos.opsFte = (event.currentTarget as HTMLSelectElement).value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <button type="button" class="btn" onclick={() => removeExtra(pos.id)}>Remove</button>
            <button
              type="button"
              class="btn"
              onclick={() => pos.bands.push({ start: "04:00", end: "20:30", min: 1 })}
            >+ Band</button>
          </div>
          {#if shifts.length}
            <div class="sex">
              <span class="hint">Park on shifts</span>
              {#each shifts as shift (shift.id)}
                <label>
                  {(shift.name || shift.id) + (shift.start ? " " + shift.start : "")}
                  <input
                    type="number"
                    min="0"
                    max="99"
                    data-extra-shift-count={pos.id}
                    data-extra-shift-id={shift.id}
                    value={shiftCount(pos, shift.id)}
                    oninput={(event) => setShiftCount(pos, shift.id, read(event))}
                  />
                </label>
              {/each}
            </div>
          {:else}
            <p class="hint">Add shifts to park this type on a start time.</p>
          {/if}
          <div class="scroll">
            <table>
              <thead>
                <tr><th>Start</th><th>End</th><th>Min</th><th></th></tr>
              </thead>
              <tbody>
                {#each pos.bands as band, index (pos.id + "-" + index)}
                  <tr>
                    <td><input type="time" value={band.start} oninput={(event) => (band.start = read(event))} /></td>
                    <td><input type="time" value={band.end} oninput={(event) => (band.end = read(event))} /></td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={int(band.min)}
                        oninput={(event) => (band.min = Math.max(0, int(read(event))))}
                      />
                    </td>
                    <td>
                      <button type="button" class="btn" onclick={() => pos.bands.splice(index, 1)}>Remove</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    </div>
  </details>

  <details class="card" open>
    <summary>Function coverage</summary>
    <p class="hint">
      BAG and DFO pools run together. Each is Male/Female × STSO/LTSO/TSO, carved from FTE.
      Min/max below are counts of shifts (lines) per role — not instantaneous headcount.
      Leftover ops lines are PAX. PT TSO under DFO is the max PT lines that may be DFO.
    </p>
    <div class="pools">
      <div>
        <h3>BAG pool</h3>
        <h4>STSO</h4>
        <div class="sex">
          {@render count("fc-pool-bag-stso-m", "Male", int(fc.poolStsoBagM), (n) => (fc.poolStsoBagM = n))}
          {@render count("fc-pool-bag-stso-f", "Female", int(fc.poolStsoBagF), (n) => (fc.poolStsoBagF = n))}
        </div>
        <h4>LTSO</h4>
        <div class="sex">
          {@render count("fc-pool-bag-ltso-m", "Male", int(fc.poolLtsoBagM), (n) => (fc.poolLtsoBagM = n))}
          {@render count("fc-pool-bag-ltso-f", "Female", int(fc.poolLtsoBagF), (n) => (fc.poolLtsoBagF = n))}
        </div>
        <h4>TSO</h4>
        <div class="sex">
          {@render count("fc-pool-bag-tso-m", "Male", int(fc.poolTsoBagM), (n) => (fc.poolTsoBagM = n))}
          {@render count("fc-pool-bag-tso-f", "Female", int(fc.poolTsoBagF), (n) => (fc.poolTsoBagF = n))}
        </div>
      </div>
      <div>
        <h3>DFO pool</h3>
        <h4>STSO</h4>
        <div class="sex">
          {@render count("fc-pool-dfo-stso-m", "Male", int(fc.poolStsoDfoM), (n) => (fc.poolStsoDfoM = n))}
          {@render count("fc-pool-dfo-stso-f", "Female", int(fc.poolStsoDfoF), (n) => (fc.poolStsoDfoF = n))}
        </div>
        <h4>LTSO</h4>
        <div class="sex">
          {@render count("fc-pool-dfo-ltso-m", "Male", int(fc.poolLtsoDfoM), (n) => (fc.poolLtsoDfoM = n))}
          {@render count("fc-pool-dfo-ltso-f", "Female", int(fc.poolLtsoDfoF), (n) => (fc.poolLtsoDfoF = n))}
        </div>
        <h4>TSO</h4>
        <div class="sex">
          {@render count("fc-pool-dfo-tso-m", "Male", int(fc.poolTsoDfoM), (n) => (fc.poolTsoDfoM = n))}
          {@render count("fc-pool-dfo-tso-f", "Female", int(fc.poolTsoDfoF), (n) => (fc.poolTsoDfoF = n))}
          {@render count("fc-pool-dfo-pt", "PT TSO", int(fc.poolTsoDfoPt), (n) => (fc.poolTsoDfoPt = n))}
        </div>
      </div>
    </div>
    <div class="sex">
      {@render count("fc-phase-thr", "Phase threshold (min)", int(fc.phaseThresholdMin), (n) => (fc.phaseThresholdMin = n), 0, 120)}
      <label class="check">
        <input
          type="checkbox"
          id="fc-ampm-split"
          checked={fc.amPmSplit !== false}
          onchange={(event) => (fc.amPmSplit = (event.currentTarget as HTMLInputElement).checked)}
        />
        50/50 AM–PM split
      </label>
      <label>
        Shortfall bias
        <select
          id="fc-bias"
          value={fc.bias || "none"}
          onchange={(event) => (fc.bias = (event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="none">None</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <button type="button" class="btn" id="fc-add-band" onclick={addBand}>+ Add shift</button>
    </div>
    {#if bandNote}<p class="hint">{bandNote}</p>{/if}
    <div class="scroll" id="fc-bands-wrap">
      <table>
        <thead>
          <tr>
            <th>Shift</th><th>Start</th><th>End</th>
            <th>STSO min</th><th>STSO max</th>
            <th>LTSO min</th><th>LTSO max</th>
            <th>TSO min</th><th>TSO max</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="fc-bands-tbody">
          {#each fc.requirementShiftIds as shiftId (shiftId)}
            {@const shift = shifts.find((item) => item.id === shiftId)}
            <tr>
              <td>
                <select value={shiftId} onchange={(event) => moveBand(shiftId, (event.currentTarget as HTMLSelectElement).value)}>
                  {#each shifts as option (option.id)}
                    <option value={option.id} disabled={option.id !== shiftId && fc.requirementShiftIds.includes(option.id)}>
                      {(option.name || option.id) + " (" + (option.start || "?") + "–" + (option.end || "?") + ")"}
                    </option>
                  {/each}
                  {#if !shift}
                    <option value={shiftId}>{shiftId} (missing)</option>
                  {/if}
                </select>
              </td>
              <td>{shift?.start || "—"}</td>
              <td>{shift?.end || "—"}</td>
              {#each ROLES as role (role)}
                <td>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={req(role, shiftId).min}
                    oninput={(event) => setReq(role, shiftId, "min", read(event))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={req(role, shiftId).max}
                    oninput={(event) => setReq(role, shiftId, "max", read(event))}
                  />
                </td>
              {/each}
              <td><button type="button" class="btn" onclick={() => removeBand(shiftId)}>Remove</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="hint" id="fc-preview">{preview}</p>
  </details>

  <details class="card" open>
    <summary>Cert pools</summary>
    <p class="hint">
      Second label on each ops line. Function stays DFO / BAG / PAX. Function map wins — every mapped
      function keeps that pool even if the hour goes over the target. B target is best-effort for the
      hours a person actually works. Anyone still unlabeled becomes A.
    </p>
    <div class="sex">
      {@render count(
        "cfg-cert-pool-b-pct",
        "B target %",
        int(cert.targetBPercent),
        (n) => (cert.targetBPercent = n),
        0,
        100,
      )}
    </div>
    <h3>Function map</h3>
    <div class="sex">
      {#each ["DFO", "BAG", "PAX"] as key (key)}
        <label>
          {key}
          <select
            id={"cfg-cert-map-" + key.toLowerCase()}
            value={cert.functionMap[key] || "none"}
            onchange={(event) => setMap(key as "DFO" | "BAG" | "PAX", (event.currentTarget as HTMLSelectElement).value)}
          >
            <option value="none">none</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
      {/each}
    </div>
  </details>

  <section class="card" aria-labelledby="shifts-title">
    <div class="section-head">
      <h2 id="shifts-title">Shifts</h2>
      <button type="button" class="btn" id="btn-add-shift" onclick={addShift}>+ Add shift</button>
    </div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Start</th><th>End</th><th>Phase</th><th>Paid h</th>
            <th>TSO force</th><th>LTSO force</th><th>STSO force</th>
            <th>Hard RDOs (Sun–Sat)</th><th>Day times</th><th></th>
          </tr>
        </thead>
        <tbody id="shifts-tbody">
          {#each shifts as shift (shift.id)}
            <tr data-shift-id={shift.id}>
              <td><input type="text" data-f="name" value={shift.name} oninput={(event) => (shift.name = read(event))} /></td>
              <td><input type="time" data-f="start" value={shift.start} oninput={(event) => (shift.start = read(event))} /></td>
              <td><input type="time" data-f="end" value={shift.end} oninput={(event) => (shift.end = read(event))} /></td>
              <td>
                <select data-f="phase" value={shift.phase || "auto"} onchange={(event) => (shift.phase = (event.currentTarget as HTMLSelectElement).value)}>
                  {#each PHASES as phase (phase)}
                    <option value={phase}>{phase}</option>
                  {/each}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  data-f="paid"
                  min="1"
                  step="0.5"
                  value={shift.paid}
                  oninput={(event) => (shift.paid = Math.max(0.5, num(read(event), 8)))}
                />
              </td>
              <td><input type="number" data-f="force" min="0" value={int(shift.force)} oninput={(event) => (shift.force = Math.max(0, int(read(event))))} /></td>
              <td><input type="number" data-f="ltsoForce" min="0" value={int(shift.ltsoForce)} oninput={(event) => (shift.ltsoForce = Math.max(0, int(read(event))))} /></td>
              <td><input type="number" data-f="stsoForce" min="0" value={int(shift.stsoForce)} oninput={(event) => (shift.stsoForce = Math.max(0, int(read(event))))} /></td>
              <td>
                <div class="rdos">
                  {#each DAYS as label, day (label)}
                    <label class="rdo" title={label}>
                      <input
                        type="checkbox"
                        data-rdo={day}
                        checked={(shift.rdoHard || []).map(Number).includes(day)}
                        onchange={(event) => toggleRdo(shift, day, (event.currentTarget as HTMLInputElement).checked)}
                      />
                      <span>{label.slice(0, 1)}</span>
                    </label>
                  {/each}
                </div>
              </td>
              <td>
                <details>
                  <summary>{shift.dayTimes ? "Overrides" : "Base hours"}</summary>
                  <div class="days">
                    {#each DAYS as label, day (label + shift.id)}
                      <div class="day">
                        <label class="check">
                          <input
                            type="checkbox"
                            checked={!!(shift.dayTimes && shift.dayTimes[String(day)])}
                            onchange={(event) => toggleDayTime(shift, day, (event.currentTarget as HTMLInputElement).checked)}
                          />
                          {label}
                        </label>
                        <input
                          type="time"
                          disabled={!(shift.dayTimes && shift.dayTimes[String(day)])}
                          value={(shift.dayTimes && shift.dayTimes[String(day)]?.start) || shift.start}
                          oninput={(event) => setDayTime(shift, day, "start", read(event))}
                        />
                        <input
                          type="time"
                          disabled={!(shift.dayTimes && shift.dayTimes[String(day)])}
                          value={(shift.dayTimes && shift.dayTimes[String(day)]?.end) || shift.end}
                          oninput={(event) => setDayTime(shift, day, "end", read(event))}
                        />
                      </div>
                    {/each}
                  </div>
                </details>
              </td>
              <td><button type="button" class="btn" onclick={() => removeShift(shift.id)}>Remove</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <div id="issues" aria-live="polite">
    {#if result.lines}
      <p class="result">
        {result.lines} lines
        {#if result.mode && result.mode !== "—"} · {result.mode}{/if}
        {#if result.seed != null} · seed {result.seed}{/if}
        {#each Object.entries(result.counts) as [name, count] (name)}
          · {name} {count}
        {/each}
      </p>
    {/if}
    {#if result.issues.length}
      <ul class="issues">
        {#each result.issues as issue, index (index + issue)}
          <li>{issue}</li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

  </div>
</section>

<GenerateModal {open} {session} onclose={closeModal} />

<style>
  .build,
  .mount {
    min-height: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .setup {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .setup-toolbar,
  .section-head,
  .row-actions,
  .sex,
  .rdos,
  .day,
  .days {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: end;
  }

  .section-head {
    align-items: center;
    justify-content: space-between;
  }

  .fte-pos {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fte-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
  }

  .fte-head h3,
  .tally {
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .tally {
    margin: 0;
    color: var(--ink);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .generate,
  .btn {
    min-height: 44px;
    padding: 8px 14px;
  }

  .generate {
    background: var(--fill);
    border: 1px solid var(--fill);
    color: var(--fill-ink);
    font-weight: 500;
  }

  .btn,
  summary {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ink);
  }

  .danger {
    color: var(--mark);
  }

  summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 8px 12px;
    cursor: pointer;
    font-weight: 500;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--line);
    min-width: 0;
    max-width: 100%;
  }

  h2,
  h3,
  h4,
  p {
    margin: 0;
  }

  h2,
  h3,
  h4 {
    font-weight: 500;
  }

  h2 {
    font-size: 16px;
  }

  h3 {
    font-size: 14px;
  }

  h4,
  .hint,
  .lede {
    color: var(--muted);
    font-size: 13px;
  }

  .lede strong {
    color: var(--ink);
    font-weight: 500;
  }

  .mono {
    color: var(--ink);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
  }

  .check,
  .rdo {
    flex-direction: row;
    align-items: center;
    min-height: 44px;
    color: var(--ink);
    font-size: 14px;
  }

  input,
  select {
    font: inherit;
    color: var(--ink);
    background: var(--panel-2);
    border: 1px solid var(--line);
    min-height: 44px;
    padding: 6px 8px;
    max-width: 100%;
  }

  input[type="number"] {
    width: 5.5rem;
  }

  input[type="checkbox"] {
    min-height: 0;
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--fill);
  }

  .scroll {
    overflow-x: auto;
    max-width: 100%;
    min-width: 0;
  }

  table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
  }

  th,
  td {
    border-bottom: 1px solid var(--line);
    padding: 6px;
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  .pools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .extra {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }

  .days {
    flex-direction: column;
    align-items: stretch;
    margin-top: 8px;
  }

  .rdos {
    gap: 4px;
    align-items: center;
  }

  .result {
    color: var(--ink);
  }

  .issues {
    margin: 0;
    padding-left: 1.2em;
    color: var(--muted);
  }

  @media (max-width: 720px) {
    .pools {
      grid-template-columns: 1fr;
    }
  }
</style>
