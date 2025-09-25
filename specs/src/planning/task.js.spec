# Purpose
Provide a helper for building planner task objects with guaranteed identifiers and default metadata.

## Public Methods
- `createTask({ agent, type, target, description?, section?, raw?, meta? }): Task` – Validate required fields, assign a unique `task-<n>` id, default optional properties, and return a plain task object marked `pending`.

## Dependencies
- None beyond Node runtime.
