# Purpose
Resolve the active LLM provider, ensure fast/deep models are configured, and expose their names to the runtime while generating a `.env` template when configuration is absent.

## Public Methods
- `configure(): Promise<void>` – Locate and load the nearest `.env`, verify that a provider has API key plus fast/deep models, create a template when missing, set `ACHILLES_LLM_*` environment variables, and log the chosen provider/models.

## Dependencies
- `fs` – Inspect and write configuration files.
- `path` – Traverse directories looking for `.env`.
