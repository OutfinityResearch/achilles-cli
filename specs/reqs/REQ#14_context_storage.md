# Requirement: Planner Context Storage

## 1. User Story
As a developer, I want the planner to remember my preferences and past discussions without polluting the formal specifications, so recurring sessions feel coherent and productive.

## 2. Functional Requirements
- Persistent context data must live inside a hidden `.achilles/` directory at the workspace root.
- The following artefacts are required:
    - `.achilles/memory` for long-lived user preferences and operating notes.
    - `.achilles/.history/history.md` for chronological logs of every user/agent turn.
    - `.achilles/.ideas/ideas.md` for inspirational ideas the agent can surface after a flow completes.
- The planner must ensure the directory structure exists before reading or writing any of these artefacts and should handle missing files gracefully (treat as empty).
- Each new user or agent message must append a line to the history file automatically.
- The planner must support explicit `update_memory`, `update_history`, and `update_ideas` plan actions that replace the corresponding file content entirely.
- The LLM context for each request must include the latest memory, history, and ideas content so hallucinations about stored preferences are minimized.
- When an idea or flow is completed, the planner may surface relevant entries from `.achilles/.ideas/ideas.md` to the user for inspiration.

## 3. Impacted Modules
- `src/achilles-planner.js`: Loads, updates, and shares context artefacts with the LLM.
- `src/services/contextStorage.js`: Provides the persistence utilities for `.achilles/` files.
