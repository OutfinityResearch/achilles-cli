# Purpose
Generate tasks for requirement files based on the `Requirements` request section.

## Public Methods
- `createRequirementTasks(sectionLines): Task[]` – Convert bullet-formatted lines into tasks anchored to `.req` targets using the shared parser.
- `executeTask(task, services): Promise<void>` – Load the requirement file, call the LLM to create/update content, persist the result, or delete the requirement, and print diffs.

## Dependencies
- `../parsers` – Task line parser.
- `../agent-utils` – Shared document execution helper.
- `../../services/specsManager` – CRUD operations for requirement files.
- `../../services/specsContext` – Refresh cached requirement context after changes.
