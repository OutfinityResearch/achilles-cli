# Purpose
Analyse JavaScript source files and regenerate their Markdown specifications via an LLM so that documentation reflects the latest implementation.

## Public Methods
- `toSpecPath(root, absoluteSourcePath): string` – Resolve the specs mirror path for the supplied source file.
- `buildPrompt({ sourcePath, sourceCode, specPath, context, existingSpec }): string` – Produce the LLM prompt describing the module, existing specs, and project context.
- `normalizeSpecMarkdown(content): string` – Enforce the canonical Purpose/Public Methods/Dependencies structure and bullet formatting.
- `main(): Promise<void>` – CLI entry point that configures the LLM, gathers context, generates/updates the spec via `specsManager`, and prints diffs.

## Dependencies
- `path` / `fs/promises` – Resolve paths and read source files.
- `./services/LLMConfiguration` / `./services/LLMAgentClient` – Configure and call the LLM.
- `./services/specsManager` – Load existing specs, context, and persist updates.
- `./services/markdownParser` – Validate LLM output as markdown and support schema checks.
- `./services/diff` – Display the delta between previous and regenerated specs.
