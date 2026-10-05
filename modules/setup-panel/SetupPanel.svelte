<script lang="ts">
  import GenerateModal from "./GenerateModal.svelte";
  import { session } from "./session";
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  function openModal() {
    open = true;
  }

  function closeModal() {
    open = false;
    const shell = document.querySelector<HTMLElement>(".shell");
    if (shell) shell.inert = false;
    document.body.style.overflow = "";
    trigger?.focus();
  }
</script>

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
  </div>
  <p class="unwired">Not wired yet</p>
</section>

<GenerateModal {open} {session} onclose={closeModal} />

<style>
  .setup {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100%;
  }

  .setup-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .generate {
    min-height: 44px;
    padding: 8px 14px;
    background: var(--fill);
    border: 1px solid var(--fill);
    color: var(--fill-ink);
    font-weight: 500;
  }
</style>
