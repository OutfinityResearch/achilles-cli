# Purpose
Bootstrap the planning workflow by configuring LLM credentials and launching the interactive `PlanningCLI`. Acts as the CLI entry point invoked by `bin/planner`.

## Public Methods
- `main(): Promise<void>` – Awaits LLM configuration, instantiates `PlanningCLI`, and starts the CLI. Handles configuration failures by logging user-facing guidance before exiting.

## Dependencies
- `./services/LLMConfiguration` – Resolves provider, API key, and model names.
- `./planning` – Exposes the `PlanningCLI` orchestrator.
