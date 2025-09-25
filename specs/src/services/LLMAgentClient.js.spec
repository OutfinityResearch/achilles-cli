# Purpose
Provide a reusable HTTP client for calling chat-completion style LLM endpoints with either the configured fast or deep model, including streaming-friendly logging and prompt previews.

## Public Methods
- `constructor()` – Reads provider, API key, and model names from environment variables and prepares endpoint metadata.
- `doTaskFast(reason, context, taskDescription): Promise<string>` – Executes a task with the fast model, printing "thinking" progress until the response is received.
- `doTaskDeep(reason, context, taskDescription): Promise<string>` – Same as `doTaskFast` but for the deep model.
- `getFastModel(): string` – Returns the fast model identifier.
- `getDeepModel(): string` – Returns the deep model identifier.
- `getProvider(): string` – Returns the configured provider name.

## Dependencies
- `https` (Node core) – Issues POST requests to provider-specific chat endpoints.
