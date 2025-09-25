# Purpose
Produce tasks for detailed design specification files referenced in the `Design Specifications` section.

## Public Methods
- `createDesignSpecsTasks(sectionLines): Task[]` – Interpret each `.ds` line using the shared parser to generate agent tasks.
- `executeTask(task, services): Promise<void>` – Load the `.ds` document, call the LLM to update or create content, persist through `specsManager`, refresh caches, and show diffs.

## Dependencies
- `../parsers` – Task line parser.
- `../agent-utils` – Shared document execution helper.
- `../../services/specsManager` – CRUD operations for `.ds` design specs.
- `../../services/specsContext` – Refresh design spec caches after writes.
