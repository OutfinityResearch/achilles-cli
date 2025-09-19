# Requirement: User Interaction

## 1. User Story
As a developer, I want a smooth and transparent interaction with the `achilles-planner`, with the ability to interrupt processes and get clear feedback on the agent's operations.

## 2. Functional Requirements
- The user must have the ability to interrupt any process, including the action plan confirmation sub-loop.
- The `achilles-planner` must detect user input that signals a desire to abandon the current discussion (e.g., "stop," "nevermind," "let's start over").
- Upon detecting such an intent, the agent must ask for a final confirmation ("Are you sure you want to discard this entire discussion?") before resetting its context.
- Before every call to an LLM, a brief message must be printed to the console stating the purpose of the call (e.g., "Analyzing input to generate an action plan...").
- The command-line interface must provide editable history navigation: pressing the up/down arrows cycles through previous prompts for quick reuse and editing.
- Confirmation prompts must understand common affirmative/negative responses in English and Romanian (e.g., `yes`, `da`, `nu`) and keep asking until a clear answer is received.
- The planner should prefer making reasonable assumptions and asking for confirmation instead of repeatedly prompting the user for minor clarifications.
- When the user paste multi-line input, the CLI must buffer it and submit it as a single message rather than triggering multiple turns.
- All planner output and internal status messages must be presented in English to maintain consistency across the project.
- Launching the planner without flags must use the deep LLM model by default; passing `-fast` at startup temporarily switches to the fast model for that session.

## 3. Impacted Modules
- `src/achilles-planner.js`: The main file for the planner agent, which handles the main interaction loop.
