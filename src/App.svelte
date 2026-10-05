<script lang="ts">
  import { onMount } from "svelte";
  import { isTabId, TABS, type TabId } from "./lib/tabs";
  import { applyTheme, readTheme, type ThemeName } from "./lib/theme";
  import SetupPanel from "./lib/setup/SetupPanel.svelte";

  let active = $state<TabId>(tabFromLocation());
  let theme = $state<ThemeName>(readTheme());
  let now = $state(new Date());

  function tabFromLocation(): TabId {
    if (typeof location === "undefined") return "setup";
    const id = location.hash.replace(/^#/, "");
    return isTabId(id) ? id : "setup";
  }

  function select(id: TabId) {
    active = id;
    const next = `#${id}`;
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

  onMount(() => {
    active = tabFromLocation();
    theme = readTheme();

    const onHash = () => {
      active = tabFromLocation();
    };

    const onKey = (event: KeyboardEvent) => {
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

      if (document.getElementById("generate-modal")?.classList.contains("is-open")) {
        if (event.key === "Escape") return;
        if (
          /^F[1-6]$/.test(event.key) ||
          event.key === "ArrowRight" ||
          event.key === "ArrowLeft"
        ) {
          event.preventDefault();
        }
        return;
      }

      const fn = /^F([1-6])$/.exec(event.key);
      if (fn) {
        event.preventDefault();
        select(TABS[Number(fn[1]) - 1].id);
        return;
      }

      if (
        (event.key === "ArrowRight" || event.key === "ArrowLeft") &&
        target instanceof HTMLElement &&
        target.getAttribute("role") === "tab"
      ) {
        event.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === active);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next = TABS[(index + delta + TABS.length) % TABS.length];
        select(next.id);
        document.getElementById(`tab-${next.id}`)?.focus();
      }
    };

    const clock = window.setInterval(() => {
      now = new Date();
    }, 1000);

    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

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

  <div class="tabs" role="tablist" aria-label="Sections">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class="tab"
        id="tab-{tab.id}"
        role="tab"
        aria-selected={active === tab.id}
        aria-controls="mount-{tab.id}"
        tabindex={active === tab.id ? 0 : -1}
        onclick={() => select(tab.id)}
      >
        <span class="fkey">[{tab.key}]</span>
        {tab.label}
      </button>
    {/each}
  </div>

  <main class="stage">
    {#each TABS as tab (tab.id)}
      <div
        class="mount"
        id="mount-{tab.id}"
        data-mount={tab.id}
        role="tabpanel"
        aria-labelledby="tab-{tab.id}"
        hidden={active !== tab.id}
      >
        {#if tab.id === "setup"}
          <SetupPanel />
        {:else}
          <p class="unwired">Not wired yet</p>
        {/if}
      </div>
    {/each}
  </main>

  <footer class="foot">
    <span>Mount <b>{active}</b></span>
    <span>Keys <b>F1-F6</b></span>
  </footer>
</div>
