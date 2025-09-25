# Purpose
Share common execution helpers for planner agents, including LLM invocation and document update workflows.

## Public Methods
- `executeDocumentTask({ task, services, loadCurrent, saveContent, deleteContent, hintFiles, onAfterSave, onAfterDelete })` – Handles load/prompt/save/diff logic for vision/requirements/specs/designSpecs agents.
- `runModel(services, reason, prompt): Promise<string>` – Call the configured LLM client using either the fast or deep model.
- `normalizeDocumentContent(agent, content): string` – Ensure generated markdown includes required sections, bullet formatting, and converts JSON payloads when necessary.

## Dependencies
- `../services/specsContext` – Retrieve relevant documents for prompts.
- `./prompts` – Build SOP-compliant prompts and render diffs.
*** End Patch
