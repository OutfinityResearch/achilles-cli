# Purpose
Manage the Ideas section by persisting suggestion backlog entries and creating follow-up work for accepted ideas.

## Public Methods
- `createSuggestionTasks(sectionLines): Task[]` – Parse idea lines (`- [status] target: detail`), encode suggestion metadata, remove rejected ideas, and attach follow-up instructions for accepted entries based on file extensions.
- `executeTask(task, services): Promise<void>` – Update `.achilles/.suggestions/suggestions.md`, drop rejected ideas, and use `services.dispatch` to trigger follow-up work for accepted entries.

## Dependencies
- `path` – Normalise target names when deriving agent ownership.
- `../task` – Task creation helper.
- `../../services/contextStorage` – Read/write the suggestion backlog.
