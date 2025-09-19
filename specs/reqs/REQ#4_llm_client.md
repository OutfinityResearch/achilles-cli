# Requirement: LLM Agent Client

## 1. User Story
As a developer, I need a dedicated service to handle all communication with LLM APIs, so that I can easily switch between providers and models without changing the agent's logic.

## 2. Functional Requirements
- A service module, `LLMAgentClient.js`, must be created.
- The service must auto-configure itself using standard environment variables for various providers (e.g., `GEMINI_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `CLAUDE_API_KEY`).
- The service will expose two primary functions:
    - `doTaskFast(context, taskDescription)`: Utilizes a faster, cost-effective model suitable for simple tasks like understanding intent or answering basic questions.
    - `doTaskDeep(context, taskDescription)`: Utilizes the provider's most powerful model, reserved for complex tasks like generating detailed specifications or writing production-quality code.

## 3. Impacted Modules
- `src/services/LLMAgentClient.js`: The implementation of the LLM client service.
