# Requirement: LLM Configuration Service

## 1. User Story
As a developer, I want the application to automatically handle LLM API key configuration, either by prompting me for a key or by using a `.env` file, so that I don't have to manually set environment variables every time I run an agent.

## 2. Functional Requirements
- A new service, `LLMConfiguration.js`, will be created.
- At startup, each agent will use this service to ensure that a valid LLM API key is available.
- The service will first search for a `.env` file in the current directory and its parent directories. If found, it will load the environment variables from it.
- The repository will include a `.env` template (ignored by Git) that lists every supported provider key plus fast/deep model slots so developers can enable a provider by filling in the desired entry.
- If no `.env` file is found, the service will prompt the user to select a provider, enter an API key and a preferred model.
- The service will validate the key by making a short API call.
- If the key is invalid, the service will re-prompt the user until a valid key is provided.
- Once a valid key is obtained, the service will set normalized runtime environment variables (`ACHILLES_LLM_PROVIDER`, `ACHILLES_LLM_API_KEY`, `ACHILLES_LLM_FAST_MODEL`, `ACHILLES_LLM_DEEP_MODEL`) so the rest of the system reads configuration from a single location.
- If a new key is provided via prompt, the service will create a `.env` file in the current directory and save the key there.

## 3. Impacted Modules
- `src/services/LLMConfiguration.js`: The new service for managing LLM configuration.
- `src/achilles-planner.js`, `src/achilles-codeGenerator.js`, `src/achilles-doc-generator.js`: Will be updated to use the new service.
