# Purpose
Persist planner context artefacts (`memory`, `history`, suggestion backlog) under `.achilles/` and provide helpers for reading/writing them.

## Public Methods
- `ensureStructure(): Promise<void>` – Create `.achilles/`, `.achilles/.history/`, and `.achilles/.suggestions/` directories.
- `loadMemory(): Promise<string>` / `saveMemory(content)` – Read or overwrite the shared memory file.
- `loadHistory(): Promise<string>` / `saveHistory(content)` / `appendHistoryEntry(entry)` – Manage the conversation history log.
- `loadSuggestions(): Promise<string>` / `saveSuggestions(content)` – Read or write the suggestions backlog, migrating legacy `.ideas/ideas.md` on first use.

## Dependencies
- `fs` / `fs.promises` – Filesystem IO.
- `path` – Resolve workspace-relative paths.
