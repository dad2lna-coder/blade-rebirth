<script>
  import AppShell from "./core/components/AppShell.svelte";

  const stages = [
    { id: "plan", label: "Plan" },
    { id: "build", label: "Build" },
    { id: "lines", label: "Lines" },
    { id: "coverage", label: "Coverage" },
    { id: "reports", label: "Reports" },
    { id: "demand", label: "Demand" },
    { id: "ship", label: "Ship" },
    { id: "present", label: "Present" },
    { id: "teams", label: "Teams" }
  ];
</script>

<AppShell {stages} />
