# Purpose
Convert the `info` section of a request into a single informational task when the user asks about project context.

## Public Methods
- `createInfoTasks(sectionLines): Task[]` – Join the section text, return a context query task when non-empty, or an empty list otherwise.
- `executeTask(task): Promise<void>` – Query `specsContext` for relevant documents and print their contents to the console.

## Dependencies
- `../task` – Task factory.
- `../../services/specsContext` – Retrieve relevant requirements/specs/design specs for informational responses.
