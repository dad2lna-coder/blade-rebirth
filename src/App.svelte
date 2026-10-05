<script lang="ts">
  import { onMount } from "svelte";
  import {
    hashFor,
    locationState,
    panels,
    TABS,
    type TabId,
  } from "./lib/tabs";
  import { applyTheme, readTheme, type ThemeName } from "./lib/theme";

  let active = $state<TabId>(locationState(locationHash()).tab);
  let sub = $state<string | null>(locationState(locationHash()).sub);
  let theme = $state<ThemeName>(readTheme());
  let now = $state(new Date());

  const activeTab = $derived(TABS.find((tab) => tab.id === active) ?? TABS[0]);
  const subs = $derived(activeTab?.subs ?? []);

  function locationHash(): string {
    return typeof location === "undefined" ? "" : location.hash;
  }

  function select(id: TabId, nextSub: string | null = null) {
    const tab = TABS.find((item) => item.id === id);
    active = id;
    sub = nextSub ?? tab?.subs[0]?.id ?? null;
    const next = hashFor(id, sub);
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function chooseTheme(next: ThemeName) {
    theme = next;
    applyTheme(next);
  }

  const dateLabel = $derived(
    new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now),
  );

  const timeLabel = $derived(
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );

  function onHash() {
    const next = locationState(location.hash);
    active = next.tab;
    sub = next.sub;
  }

  function onKey(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    const fn = /^F(\d+)$/.exec(event.key);
    const fnIndex = fn ? Number(fn[1]) - 1 : -1;
    const isTabKey = fnIndex >= 0 && fnIndex < TABS.length;
    const isArrow = event.key === "ArrowRight" || event.key === "ArrowLeft";

    if (document.getElementById("generate-modal")?.classList.contains("is-open")) {
      if (event.key === "Escape") return;
      if (isTabKey || isArrow) event.preventDefault();
      return;
    }

    if (isTabKey) {
      event.preventDefault();
      select(TABS[fnIndex].id);
      return;
    }

    if (!(target instanceof HTMLElement) || target.getAttribute("role") !== "tab") return;
    if (!isArrow) return;

    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const inSub = target.closest(".subtabs");

    if (inSub && subs.length) {
      const index = subs.findIndex((item) => item.id === sub);
      const next = subs[(index + delta + subs.length) % subs.length];
      select(active, next.id);
      document.getElementById(`sub-${next.id}`)?.focus();
      return;
    }

    const index = TABS.findIndex((tab) => tab.id === active);
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  onMount(() => {
    const clock = window.setInterval(() => {
      now = new Date();
    }, 1000);
    return () => window.clearInterval(clock);
  });
</script>

<svelte:window onhashchange={onHash} onkeydown={onKey} />

<div class="shell">
  <header class="mast">
    <div class="brand">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
        <path fill="currentColor" d="M4 27 15 4h4L8 27z" />
        <path fill="currentColor" opacity="0.55" d="M15 27 23 7h5l-8 20z" />
      </svg>
      <div>
        <h1 class="brand-title">BLADE <span class="rev">rebirth</span></h1>
        <p class="brand-sub">Workforce allocation</p>
      </div>
    </div>

    <fieldset class="theme" role="radiogroup">
      <legend>Theme</legend>
      <button
        type="button"
        class="theme-btn"
        role="radio"
        aria-checked={theme === "dark"}
        onclick={() => chooseTheme("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        class="theme-btn"
        role="radio"
        aria-checked={theme === "presentation"}
        onclick={() => chooseTheme("presentation")}
      >
        Presentation
      </button>
    </fieldset>
  </header>

  <div class="meta">
    <span>Date <b>{dateLabel}</b></span>
    <span>Local time <b>{timeLabel}</b></span>
    <span class="status">Shell</span>
  </div>

  <div class="tabs" role="tablist" aria-label="Stages">
    {#each TABS as tab, index (tab.id)}
      <button
        type="button"
        class="tab"
        id="tab-{tab.id}"
        role="tab"
        aria-selected={active === tab.id}
        aria-controls={tab.mountId}
        tabindex={active === tab.id ? 0 : -1}
        onclick={() => select(tab.id)}
      >
        {#if index < 5}
          <span class="fkey">{String(index + 1).padStart(2, "0")}</span>
        {/if}
        {tab.label}
      </button>
    {/each}
  </div>

  {#if subs.length}
    <div class="subtabs" role="tablist" aria-label="Review">
      {#each subs as item (item.id)}
        <button
          type="button"
          class="subtab"
          id="sub-{item.id}"
          role="tab"
          aria-selected={sub === item.id}
          aria-controls={item.mountId}
          tabindex={sub === item.id ? 0 : -1}
          onclick={() => select(active, item.id)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}

  <main class="stage">
    {#each TABS as tab (tab.id)}
      {@const Panel = panels[tab.id]}
      <div
        class="mount"
        id={tab.mountId}
        data-mount={tab.mount}
        role="tabpanel"
        aria-labelledby="tab-{tab.id}"
        hidden={active !== tab.id}
      >
        {#if Panel}
          {#if tab.id === "review"}
            <Panel sub={sub ?? "lines"} />
          {:else}
            <Panel />
          {/if}
        {:else}
          <p class="unwired">Not wired yet.</p>
        {/if}
      </div>
    {/each}
  </main>

  <footer class="foot">
    <span>Mount <b>{sub ? `${active}/${sub}` : active}</b></span>
    <span>Keys <b>F1-F{TABS.length}</b></span>
  </footer>
</div>
