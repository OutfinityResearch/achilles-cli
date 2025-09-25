# Purpose
Coordinate the planning CLI by loading context, parsing user requests, generating ordered tasks, and dispatching them to specialised agents that interact with the LLM and filesystem.

## Public Methods
- `constructor()` – Prepare the intent engine, readline interface slots, and the specialised agent registry.
- `initialize(): Promise<void>` – Load context, instantiate `LLMAgentClient`, configure readline handlers, and print the onboarding prompt.
- `handleInput(rawInput): Promise<void>` – Parse user text into sections, render the canonical markdown document, build tasks via sub-agents, summarise planned work, and route work to the appropriate agent executors.
- `refreshContext(): Promise<void>` – Reload planner context after tasks run.
- `executeTasks(tasks): Promise<void>` – Iterate the ordered tasks, logging progress and delegating to agent-specific handlers.
- `buildAgentServices()` – Provide shared dependencies (LLM client, dispatcher, context references) to agent executors.

## Dependencies
- `readline` – Terminal UI for user interaction.
- `./intent` – Load context and split input into sections.
- `./agents/*` – Generate and execute section-specific tasks.
- `./agent-utils` / `./prompts` – Shared helpers for LLM interactions and diff reporting.
- `../services/LLMAgentClient` – Obtain LLM access for downstream operations.
