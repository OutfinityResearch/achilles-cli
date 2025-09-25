# Purpose
Translate the `Memory` section into tasks that instruct the executor to rewrite `.achilles/memory` when needed.

## Public Methods
- `createMemoryTasks(sectionLines): Task[]` – Parse explicit task lines when available or fall back to a single update task targeting `.achilles/memory` with the raw content.
- `executeTask(task, services): Promise<void>` – Build the memory update prompt, call the LLM, persist the refreshed memory, and display the diff vs. prior content.

## Dependencies
- `../parsers` – Shared task line parser.
- `../task` – Task creation helper.
- `../agent-utils` – Provides `runModel` for LLM invocation.
- `../../services/contextStorage` – Load and persist memory.
- `../../services/diff` – Render the before/after diff.
