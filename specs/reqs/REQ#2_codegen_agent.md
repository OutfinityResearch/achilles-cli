# Requirement: Code Generation Agent (achilles-codeGenerator)

## 1. User Story
As a developer, I want an autonomous agent that automatically generates or updates the source code based on the latest specifications, so that the code and documentation are always synchronized.

## 2. Functional Requirements
- The `achilles-codeGenerator` must continuously monitor the `specs` directory.
- It must identify any module specification file (`.specs`) that has a more recent timestamp than its corresponding code file.
- For each outdated code file, the agent will load a comprehensive context for the LLM, including:
    - The project vision (`specs/vision.md`).
    - All relevant requirements documents that mention the module.
    - The detailed module specification itself.
- The agent will then instruct the LLM to generate the full content of the code file as Node.js (CommonJS) JavaScript that runs with the `node` command.
- For JavaScript outputs, the agent should perform a quick validation (e.g., via `eval`) and retry generation up to three times when validation fails. Other languages may skip validation.
- For JavaScript files, the generated code must undergo a syntax validation check (e.g., using `eval` or a programmatic linter) before being saved.
- The agent should log its actions, showing what code is being generated.
- For automated smoke tests, setting the environment variable `ACHILLES_RUN_ONCE` should make the agent stop watching after the first successful regeneration so the process can terminate cleanly.

## 3. Impacted Modules
- `src/achilles-codeGenerator.js`: The main file for the code generation agent.
- `src/services/LLMAgentClient.js`: Used to interact with the LLM.
- `src/services/specsManager.js`: Used to read specification files.
