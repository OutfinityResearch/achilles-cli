# Purpose
Aggregate specification documents into consumable deliverables such as the Architecture Handbook and Design Specifications by orchestrating the `htmldoc` agent.

## Public Methods
- `main(): Promise<void>` – Entry point that loads specs, invokes the documentation generator, and writes outputs to the configured artefact locations.

## Dependencies
- `./services/LLMConfiguration` – Ensure LLM credentials are available before generation.
- `./services/specsManager` – Read vision, requirements, specs, and design specs for inclusion in generated documents.
- `./services/LLMAgentClient` – Optionally refine narratives via LLM prompts.
