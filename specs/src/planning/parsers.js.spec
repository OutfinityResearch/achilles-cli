# Purpose
Transform section line items into normalised planner tasks with consistent metadata.

## Public Methods
- `parseTaskLines(lines, { agent, section }): Task[]` – Convert bullet-prefixed `path: instruction` lines into `Task` objects, inferring the operation type from instruction verbs.

## Dependencies
- `./task` – Provides the `createTask` helper for consistent task shape.
