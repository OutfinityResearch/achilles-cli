# Requirement: LLM Call User Experience

## 1. User Story
As a developer, when an agent makes a call to an LLM, I want to see a clear indication of what the agent is doing and that it is making progress, so that I don't feel like the application is stuck.

## 2. Functional Requirements
- The `doTaskFast` and `doTaskDeep` functions in `LLMAgentClient.js` will accept a new first argument: `reason`.
- The `reason` argument can be a string or an array of strings.
- Before making the API call, the agent will print the `reason` messages to the console with a delay of a few seconds between each message.
- The first message should always be "Thinking fast..." or "Thinking deep...".
- The agent should also log the model that is being used for the API call.
- All mocks for `LLMAgentClient` should be removed, and real API calls should be implemented.

## 3. Impacted Modules
- `src/services/LLMAgentClient.js`: Will be updated to implement the new functionality.
- All files that call `doTaskFast` or `doTaskDeep` will need to be updated to include the new `reason` argument.
