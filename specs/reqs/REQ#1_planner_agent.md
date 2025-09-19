# Requirement: Planner Agent (achilles-planner)

## 1. User Story
As a developer, I want to interact with a planning agent to create and refine the specifications for my project, so that I can ensure the project structure and goals are well-defined before writing code.

## 2. Functional Requirements
- The `achilles-planner` must operate in a continuous loop, reading user input from `stdin`.
- Before contacting the LLM it must load the current project vision, every requirement (with filenames and content), and all module specs so the model always sees the authoritative workspace state.
- User and agent preferences that do not belong in specs must be persisted in `.achilles/memory`; conversational transcripts must accumulate in `.achilles/.history/history.md`; inspirational ideas must reside in `.achilles/.ideas/ideas.md`. These files must be reloaded into context on every turn.
- Each user or agent utterance is appended to the history log automatically.
- The planner must include the memory, history log, and idea bank content in the messages it sends to the LLM.
- Based on user input and the current context, the agent will use an LLM to determine the user's intent, which can be:
    - Answering a question about the specifications.
    - Asking clarifying questions.
    - Creating or updating one or more specification documents.
- When the user needs only an informational answer, the planner will return a plan-less summary response (no confirmation prompt) describing the current state.
- If an action plan is decided, the agent must present the proposed changes (as a diff) to the user for confirmation.
- The agent will only execute the plan after explicit user approval.
- When reviewing the diff, the agent must also preview proposed changes to memory, history, and idea files.
- After executing the plan, the agent should suggest follow-up topics or questions.
- The agent must gracefully handle non-JSON LLM responses by falling back to conversational messaging instead of crashing.
- The agent must be able to handle interruptions and context resets (e.g., if the user types "stop" or "start over").
- Action plans can contain the following actions: `create`, `update`, `delete` (for spec files), plus `update_memory`, `update_history`, and `update_ideas` which replace the entire corresponding `.achilles` file contents.
- The planner must track the highest existing requirement number and expose the next available index to the LLM; new requirements must use that sequential identifier (e.g., REQ#15_...). Updates to requirements must reference existing numbers only. When refactoring or splitting requirements, the planner may propose renaming an existing requirement (via a delete+create pair) but should explain the rationale clearly.
- The planner must validate plans before confirmation; if an `update`/`delete` references a missing spec it must flag the issue, attempt to regenerate the plan once automatically, and otherwise report a friendly error.
- The agent should minimise clarification questions by making sensible assumptions, stating them explicitly, and asking for confirmation instead of repeatedly re-asking the user.

## 3. Impacted Modules
- `src/achilles-planner.js`: The main file for the planner agent.
- `src/services/LLMAgentClient.js`: Used to interact with the LLM.
- `src/services/specsManager.js`: Used to read and write specification files.
- `src/services/diff.js`: Used to display proposed changes to the user.
- `src/services/contextStorage.js`: Persists user memory, history, and idea bank files.
