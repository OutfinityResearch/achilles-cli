# Purpose
Create tasks for module specification files referenced in the `Specs` section.

## Public Methods
- `createSpecsTasks(sectionLines): Task[]` – Use the shared parser to interpret each `path: instruction` line as a `.spec` task.
- `executeTask(task, services): Promise<void>` – Load the target `.spec`, construct the SOP prompt, update or delete the file via `specsManager`, refresh the specs context cache, and output a diff.

## Dependencies
- `../parsers` – Task line parser.
- `../agent-utils` – Shared document execution helper.
- `../../services/specsManager` – CRUD operations for `.spec` files.
- `../../services/specsContext` – Refresh spec caches after writes.
