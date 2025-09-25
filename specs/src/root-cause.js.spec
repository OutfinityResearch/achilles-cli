# Purpose
Investigate reported behaviours or incidents, enumerate potential root causes, and propose planner updates that keep specifications aligned with reality.

## Public Methods
- `readDescription(): Promise<string>` – Gather the behaviour description from CLI arguments or prompt the user.
- `buildPrompt(description, contextBundle): string` – Construct the LLM prompt that references relevant requirements/specs/design specs.
- `main(): Promise<void>` – Orchestrate configuration, context gathering, LLM analysis, and console output.

## Dependencies
- `./services/LLMConfiguration` – Ensure LLM credentials are configured.
- `./services/LLMAgentClient` – Execute the analysis prompt.
- `./services/specsContext` – Retrieve relevant specification context for the behaviour.
- `readline` – Prompt for behaviour descriptions when no CLI argument is supplied.
