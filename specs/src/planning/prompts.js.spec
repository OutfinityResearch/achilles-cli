# Purpose
Provide reusable helpers for constructing LLM prompts that follow the SOP and for rendering diffs during planner execution.

## Public Methods
- `buildDocumentPrompt(task, plannerContext, contextualDocs, existingContent): string` – Construct the full instruction prompt for document updates.
- `summariseManagedFiles(plannerContext): string` – List managed requirement/spec/design-spec files for inclusion in prompts.
- `renderDiff(oldContent, newContent): string` – Produce a coloured diff using the shared diff service.

## Dependencies
- `../services/diff` – Render chapter-aware diffs.
*** End Patch
