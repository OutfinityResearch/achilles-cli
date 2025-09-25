# Purpose
Translate the `vision` section into tasks that update `specs/vision.md` using either explicit instructions or free-form text.

## Public Methods
- `createVisionTasks(sectionLines): Task[]` – Delegate to shared parsing helpers for structured lines or fall back to a single `update` task with the raw section content when no explicit tasks are found.
- `executeTask(task, services): Promise<void>` – Load the current vision, call the LLM with the SOP prompt, write the updated document, and emit a diff (delete operations clear the file).

## Dependencies
- `../parsers` – Shared bullet/colon parsing helper.
- `../task` – Task creation helper.
- `../agent-utils` – Shared helpers for document execution.
- `../../services/specsManager` – Load/update the vision file.
- `../../services/specsContext` – Invalidate cached context after updates.
