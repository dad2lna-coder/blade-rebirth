<script lang="ts">
  import { untrack } from "svelte";
  import {
    adjustTarget,
    approveDfo,
    approveParity,
    createModalUi,
    dfoClassKey,
    formatRdos,
    generateAll,
    generateOneClass,
    getModalClassOptions,
    parityBands,
    parityClassKey,
    primeModal,
    runDfoPropose,
    runParityCheck,
    selectDfoClass,
    selectParityClass,
    selectTargetClass,
    setDfoChecked,
    setParityChecked,
    targetModel,
    toggleParityBand,
    weekdayBands,
  } from "./generateModal";
  import type { SetupSession } from "./types";

  let {
    open,
    session,
    ignoreGender = false,
    onIgnoreGender,
    onclose,
  }: {
    open: boolean;
    session: SetupSession;
    ignoreGender?: boolean;
    onIgnoreGender?: (checked: boolean) => void;
    onclose: () => void;
  } = $props();

  let ui = $state(createModalUi());
  let closeBtn: HTMLButtonElement | undefined = $state();

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  $effect(() => {
    if (!open) return;
    untrack(() => primeModal(session, ui));
  });

  $effect(() => {
    if (!open) return;
    const shell = document.querySelector<HTMLElement>(".shell");
    const previousOverflow = document.body.style.overflow;
    if (shell) shell.inert = true;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onclose();
    };
    window.addEventListener("keydown", onKey);
    closeBtn?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      if (shell) shell.inert = false;
      document.body.style.overflow = previousOverflow;
    };
  });

  function toggleIgnore(event: Event) {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    session.state.ignoreGender = checked;
    ui.perShiftTargets = {};
    ui.revision++;
    onIgnoreGender?.(checked);
  }

  const options = $derived(getModalClassOptions(session.state.extraPositions));
  const targets = $derived.by(() => {
    void ui.revision;
    return targetModel(session, ui);
  });
  const bands = $derived.by(() => {
    void ui.revision;
    return weekdayBands(session);
  });
  const parityOptions = $derived.by(() => {
    void ui.revision;
    return {
      classKey: parityClassKey(session, ui),
      bands: parityBands(session, ui),
      result: ui.parityResult,
      checked: ui.parityChecked,
    };
  });
  const dfo = $derived.by(() => {
    void ui.revision;
    return {
      classKey: dfoClassKey(session, ui),
      result: ui.dfoResult,
      checked: ui.dfoChecked,
    };
  });
</script>

<div
  use:portal
  id="generate-modal"
  class="setup-modal"
  class:is-open={open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="generate-modal-title"
  aria-hidden={open ? "false" : "true"}
  inert={!open}
>
  <div class="setup-card">
    <header class="setup-head">
      <h2 id="generate-modal-title">Setup & Schedule Generator</h2>
      <button
        bind:this={closeBtn}
        type="button"
        class="setup-btn setup-btn-quiet"
        id="generate-modal-close"
        aria-label="Close"
        onclick={() => onclose()}>✕</button
      >
    </header>

    <section class="setup-block" aria-label="Generate actions">
      <div class="setup-row">
        <button
          type="button"
          class="setup-btn setup-btn-fill"
          id="btn-generate-all"
          onclick={() => generateAll(session, ui)}>[GEN] Full Roster Generate</button
        >
        <label class="ignore">
          <input
            type="checkbox"
            id="generate-ignore-gender"
            checked={ignoreGender}
            onchange={toggleIgnore}
          />
          Ignore gender
        </label>
        <p class="setup-note">When on, generate does not assign or balance by sex. Headcount is still male + female. Useful for PT.</p>
        <span class="setup-or">Or Generate Single Class:</span>
        <div id="generate-class-buttons" class="setup-row">
          {#each options as opt (opt.key)}
            <button
              type="button"
              class="setup-btn setup-btn-fill btn-generate-class"
              data-class-key={opt.key}
              onclick={() => generateOneClass(session, ui, opt.key)}
            >
              Generate {opt.label} Only
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="setup-block" aria-labelledby="generate-targets-title">
      <div class="setup-split">
        <div class="setup-row">
          <h3 id="generate-targets-title">Per-Shift Class Targets & Steppers</h3>
          <label>
            Target Class:
            <select
              id="generate-target-class-select"
              value={targets.classKey}
              onchange={(event) => selectTargetClass(session, ui, event.currentTarget.value)}
            >
              {#each targets.options as opt (opt.key)}
                <option value={opt.key}>{opt.label}</option>
              {/each}
            </select>
          </label>
        </div>
        <p id="generate-target-headcount-info">{targets.info}</p>
      </div>

      <div class="setup-scroll">
        <table class="setup-table">
          <thead>
            <tr>
              <th>Shift</th>
              <th class="num">Male Target</th>
              <th class="num">Female Target</th>
              <th class="num">Class Total</th>
            </tr>
          </thead>
          <tbody id="generate-shift-targets-tbody">
            {#if targets.rows.length === 0}
              <tr>
                <td colspan="4" class="empty">No shifts defined yet.</td>
              </tr>
            {:else}
              {#each targets.rows as row (row.shiftId)}
                <tr data-shift-id={row.shiftId}>
                  <td>
                    <strong>{row.name}</strong>
                    {#if row.time}<span class="time"> ({row.time})</span>{/if}
                  </td>
                  <td class="num">
                    <span class="stepper">
                      <button
                        type="button"
                        class="setup-btn btn-target-m-down"
                        data-shift-id={row.shiftId}
                        disabled={row.sexLocked}
                        onclick={() => adjustTarget(session, ui, row.shiftId, "m-down")}>-</button
                      >
                      <span class="count">{row.male}</span>
                      <button
                        type="button"
                        class="setup-btn btn-target-m-up"
                        data-shift-id={row.shiftId}
                        disabled={!row.maleUp}
                        onclick={() => adjustTarget(session, ui, row.shiftId, "m-up")}>+</button
                      >
                    </span>
                  </td>
                  <td class="num">
                    <span class="stepper">
                      <button
                        type="button"
                        class="setup-btn btn-target-f-down"
                        data-shift-id={row.shiftId}
                        disabled={row.sexLocked}
                        onclick={() => adjustTarget(session, ui, row.shiftId, "f-down")}>-</button
                      >
                      <span class="count">{row.female}</span>
                      <button
                        type="button"
                        class="setup-btn btn-target-f-up"
                        data-shift-id={row.shiftId}
                        disabled={!row.femaleUp}
                        onclick={() => adjustTarget(session, ui, row.shiftId, "f-up")}>+</button
                      >
                    </span>
                  </td>
                  <td class="num">
                    <span class="stepper">
                      <button
                        type="button"
                        class="setup-btn btn-target-tot-down"
                        data-shift-id={row.shiftId}
                        onclick={() => adjustTarget(session, ui, row.shiftId, "tot-down")}>-</button
                      >
                      <span class="count total">{row.total}</span>
                      <button
                        type="button"
                        class="setup-btn btn-target-tot-up"
                        data-shift-id={row.shiftId}
                        disabled={!row.totalUp}
                        onclick={() => adjustTarget(session, ui, row.shiftId, "tot-up")}>+</button
                      >
                    </span>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </section>

    <section class="setup-block" aria-labelledby="generate-bands-title">
      <h3 id="generate-bands-title">Weekday Band Duty Counts (Male / Female / Total)</h3>
      <div class="setup-scroll">
        <table class="setup-table">
          <thead>
            <tr>
              <th>Band / Shift</th>
              <th class="num">Sun</th>
              <th class="num">Mon</th>
              <th class="num">Tue</th>
              <th class="num">Wed</th>
              <th class="num">Thu</th>
              <th class="num">Fri</th>
              <th class="num">Sat</th>
            </tr>
          </thead>
          <tbody id="generate-weekday-bands-tbody">
            {#if bands.empty}
              <tr>
                <td colspan="8" class="empty">No lines generated yet. Click Generate to populate.</td>
              </tr>
            {:else}
              {#each bands.rows as row (row.label)}
                <tr>
                  <td><strong>{row.label}</strong></td>
                  {#each row.cells as cell, index (index)}
                    <td class="num">{cell}</td>
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </section>

    <details class="setup-block setup-fold">
      <summary>RDO Parity (Fairness) Report</summary>
      <p class="lead">
        Identifies RDO pattern share imbalances between sexes for the selected class across chosen
        band groups. Proposals swap RDO patterns between lines without moving shift or sex.
      </p>
      <div class="setup-row setup-tools">
        <label>
          Parity Class:
          <select
            id="generate-parity-class-select"
            value={parityOptions.classKey}
            onchange={(event) => selectParityClass(ui, event.currentTarget.value)}
          >
            {#each options as opt (opt.key)}
              <option value={opt.key}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <div class="setup-row">
          <span class="setup-or">Bands:</span>
          <div id="generate-parity-bands-select" class="band-picks">
            {#each parityOptions.bands as band (band.key)}
              <label class="check">
                <input
                  type="checkbox"
                  class="parity-band-cb"
                  data-band-key={band.key}
                  checked={band.checked}
                  onchange={(event) => toggleParityBand(ui, band.key, event.currentTarget.checked)}
                />
                {band.label}
              </label>
            {/each}
          </div>
        </div>
        <button
          type="button"
          class="setup-btn setup-btn-fill"
          id="btn-generate-check-parity"
          onclick={() => runParityCheck(session, ui)}>Check Parity</button
        >
      </div>

      <div id="generate-parity-results-wrap" class="results" hidden={parityOptions.result == null}>
        <p id="generate-parity-summary">{parityOptions.result?.summary || ""}</p>
        <div class="setup-scroll">
          <table class="setup-table">
            <thead>
              <tr>
                <th>Line A (Sex, Shift, RDO Before)</th>
                <th>Line B (Sex, Shift, RDO Before)</th>
                <th>Proposed RDO Swap</th>
              </tr>
            </thead>
            <tbody id="generate-parity-proposals-tbody">
              {#if (parityOptions.result?.proposals || []).length === 0}
                <tr>
                  <td colspan="3" class="empty">No RDO pattern swaps needed. Patterns are balanced.</td>
                </tr>
              {:else}
                {#each parityOptions.result?.proposals || [] as proposal, index (index)}
                  <tr
                    data-pair-idx={index}
                    data-line-a-id={proposal.lineA.id}
                    data-line-b-id={proposal.lineB.id}
                  >
                    <td>
                      <label class="check">
                        <input
                          type="checkbox"
                          class="parity-swap-cb"
                          checked={parityOptions.checked[index] !== false}
                          onchange={(event) => setParityChecked(ui, index, event.currentTarget.checked)}
                        />
                        <strong>{proposal.lineA.lineCode || proposal.lineA.id}</strong>
                        ({proposal.lineA.sex}, {proposal.lineA.shiftName || proposal.lineA.shiftId}) RDO:
                        {formatRdos(proposal.rdoA_before)}
                      </label>
                    </td>
                    <td>
                      <strong>{proposal.lineB.lineCode || proposal.lineB.id}</strong>
                      ({proposal.lineB.sex}, {proposal.lineB.shiftName || proposal.lineB.shiftId}) RDO:
                      {formatRdos(proposal.rdoB_before)}
                    </td>
                    <td><strong class="note">{proposal.note}</strong></td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
        <div class="setup-end">
          <button
            type="button"
            class="setup-btn setup-btn-fill"
            id="btn-generate-approve-parity"
            onclick={() => approveParity(session, ui)}>Approve RDO Swaps</button
          >
        </div>
      </div>
    </details>

    <details class="setup-block setup-fold">
      <summary>DFO Cert Balance</summary>
      <p class="lead">
        If DFO cert counts differ across shifts, proposes moving certs between same-sex people without
        moving lines. If cert counts match, proposes a baggage day reshuffle.
      </p>
      <div class="setup-row setup-tools">
        <label>
          DFO Class:
          <select
            id="generate-dfo-class-select"
            value={dfo.classKey}
            onchange={(event) => selectDfoClass(ui, event.currentTarget.value)}
          >
            {#each options as opt (opt.key)}
              <option value={opt.key}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <button
          type="button"
          class="setup-btn setup-btn-fill"
          id="btn-generate-propose-dfo"
          onclick={() => runDfoPropose(session, ui)}>Propose DFO Fix</button
        >
      </div>

      <div id="generate-dfo-results-wrap" class="results" hidden={dfo.result == null}>
        <p id="generate-dfo-summary">{dfo.result?.summary || ""}</p>
        <div class="setup-scroll">
          <table class="setup-table">
            <thead>
              <tr>
                <th class="pick"></th>
                <th>Item / Line</th>
                <th>Sex</th>
                <th>Shift</th>
                <th>Proposed Change</th>
              </tr>
            </thead>
            <tbody id="generate-dfo-proposals-tbody">
              {#if dfo.result?.mode === "baggage_reshuffle"}
                <tr>
                  <td class="num">
                    <input type="checkbox" class="dfo-cert-swap-cb" checked disabled />
                  </td>
                  <td><strong>Baggage Duty Rotation</strong></td>
                  <td>All</td>
                  <td>Matched per shift ({dfo.result.certCountPerShift || 0} certs)</td>
                  <td>
                    <strong class="note">Reshuffle baggage duty days across work days (resolveBagDuties)</strong>
                  </td>
                </tr>
              {:else if (dfo.result?.proposals || []).length === 0}
                <tr>
                  <td colspan="5" class="empty">No DFO cert moves required. Shift cert counts match.</td>
                </tr>
              {:else}
                {#each dfo.result?.proposals || [] as proposal, index (index)}
                  <tr data-prop-idx={index}>
                    <td class="num">
                      <input
                        type="checkbox"
                        class="dfo-cert-swap-cb"
                        checked={dfo.checked[index] !== false}
                        onchange={(event) => setDfoChecked(ui, index, event.currentTarget.checked)}
                      />
                    </td>
                    <td>
                      <strong>
                        {proposal.donorLine.lineCode || proposal.donorLine.id} → {proposal.receiverLine.lineCode ||
                          proposal.receiverLine.id}
                      </strong>
                    </td>
                    <td><span class="sex">{proposal.sex}</span></td>
                    <td>
                      {(proposal.donorShift?.name || proposal.donorShift?.id || "")}
                      ({proposal.donorLine.lineCode || proposal.donorLine.id}) & {(proposal.receiverShift?.name ||
                        proposal.receiverShift?.id || "")}
                      ({proposal.receiverLine.lineCode || proposal.receiverLine.id})
                    </td>
                    <td><strong class="note">{proposal.note}</strong></td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
        <div class="setup-end">
          <button
            type="button"
            class="setup-btn setup-btn-fill"
            id="btn-generate-approve-dfo"
            onclick={() => approveDfo(session, ui)}>Approve Fix</button
          >
        </div>
      </div>
    </details>

    <div class="setup-end">
      <button type="button" class="setup-btn" id="btn-generate-modal-done" onclick={() => onclose()}>Done</button>
    </div>
  </div>
</div>

<style>
  .setup-modal {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 40;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgb(0 0 0 / 62%);
  }

  .setup-modal.is-open {
    display: flex;
  }

  .setup-card {
    width: min(960px, 100%);
    max-height: min(90vh, 100%);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--ink);
  }

  .setup-head,
  .setup-split,
  .setup-row,
  .setup-end {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }

  .setup-head,
  .setup-split {
    justify-content: space-between;
  }

  .setup-end {
    justify-content: flex-end;
  }

  h2,
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.3;
  }

  h3 {
    font-size: 14px;
  }

  .setup-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--panel-2);
    border: 1px solid var(--line);
  }

  .setup-fold > summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: 500;
  }

  .lead,
  #generate-target-headcount-info,
  #generate-parity-summary,
  #generate-dfo-summary,
  .time,
  .setup-or {
    margin: 0;
    color: var(--muted);
  }

  .setup-or {
    font-weight: 500;
  }

  #generate-target-headcount-info,
  #generate-parity-summary,
  #generate-dfo-summary {
    font-weight: 500;
    font-size: 13px;
  }

  .setup-btn {
    min-height: 44px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ink);
  }

  .setup-btn-fill {
    background: var(--fill);
    border-color: var(--fill);
    color: var(--fill-ink);
  }

  .setup-btn:disabled {
    opacity: 0.45;
  }

  select {
    min-height: 44px;
    padding: 8px;
    font: inherit;
    color: var(--ink);
    background: var(--panel);
    border: 1px solid var(--line);
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .setup-scroll {
    overflow: auto;
    max-height: 30vh;
    border: 1px solid var(--line);
    background: var(--panel);
  }

  .setup-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th,
  td {
    padding: 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: var(--muted);
    font-weight: 500;
    background: var(--panel-2);
  }

  .num {
    text-align: center;
    white-space: nowrap;
  }

  .empty {
    text-align: center;
    color: var(--muted);
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .count {
    display: inline-block;
    min-width: 2rem;
    text-align: center;
    font-weight: 500;
  }

  .count.total {
    min-width: 2.5rem;
    font-weight: 500;
  }

  .band-picks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 15vh;
    overflow: auto;
    padding: 8px;
    border: 1px solid var(--line);
    background: var(--panel);
  }

  .check {
    font-weight: 400;
    font-size: 13px;
    white-space: nowrap;
  }

  .ignore {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-weight: 500;
  }

  .setup-note {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .results[hidden] {
    display: none;
  }

  .note {
    color: var(--mark);
  }

  .sex {
    display: inline-block;
    min-width: 1.75rem;
    padding: 0 6px;
    text-align: center;
    border: 1px solid var(--line);
  }

  .pick {
    width: 44px;
  }

  @media (max-width: 720px) {
    .setup-modal {
      padding: 8px;
    }

    .setup-card {
      padding: 12px;
    }

    .setup-split,
    .setup-head {
      align-items: stretch;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .setup-modal {
      scroll-behavior: auto;
    }
  }
</style>
