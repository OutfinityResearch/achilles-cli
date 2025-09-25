# Purpose
Automate regeneration of source files from specification documents by watching the `specs/` tree, comparing timestamps, and invoking the LLM to produce updated code.

## Public Methods
- `constructor()` – Initialise configuration flags, LLM client placeholders, and watcher state.
- `main(): Promise<void>` – Configure LLM access, run a one-off generation pass when `CODEGEN_RUN_ONCE` is set, or start the long-running watcher loop.
- `watchSpecsDirectory()` / `stopWatching()` – Manage recursive filesystem watchers for `.spec` documents.
- `generateAllSpecsOnce(): Promise<void>` – Walk the specs directory, detect outdated code, and regenerate as needed.
- `collectSpecFiles(directory, base): Promise<string[]>` – Recursively gather `.spec` files.
- `isSpecNewer(specPath, codePath): Promise<boolean>` – Compare timestamps to decide regeneration.
- `generateCode(specPath): Promise<void>` – Assemble context (vision, requirements, spec, and related design specs), call the deep LLM, validate outputs, and write code to disk with retries.
- `getCodePath(specPath): string` – Map a spec path to its corresponding source file.
- `writeCodeFile(codePath, content): Promise<void>` – Persist generated source with UTF-8 encoding.

## Dependencies
- `fs` / `fs.promises` – Directory watching, file IO, and timestamp comparisons.
- `path` – Path resolution between specs and source files.
- `./services/LLMConfiguration` – Configure LLM provider credentials before generation.
- `./services/LLMAgentClient` – Execute LLM code-generation calls.
- `./services/specsManager` – Load spec context for generation prompts.
