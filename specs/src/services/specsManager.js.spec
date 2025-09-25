# Purpose
Centralise filesystem access for project specifications, enforcing directory rules for vision, requirements (`.req`), module specs (`.spec`), and design specs (`.ds`) while offering CRUD helpers and discovery utilities.

## Public Methods
- `createVision(content) / updateVision(content)` – Persist the project vision under `specs/vision.md`.
- `loadVision(): Promise<string>` – Read the vision document, returning an empty string when absent.
- `listRequirements(): Promise<string[]>` – Enumerate requirement filenames inside `specs/reqs/`.
- `loadAllRequirements(): Promise<string[]>` – Read raw requirement bodies for prompting.
- `loadAllRequirementDetails(): Promise<Array<{ path, content }>>` – Return requirement metadata for context.
- `createRequirement(filename, content)` / `updateRequirement(...)` / `deleteRequirement(filename)` / `loadRequirement(filename)` – Manage individual `.req` files, validating modern naming and warning on legacy formats.
- `createSpecs(specPath, content)` / `updateSpecs(...)` / `loadSpecs(specPath)` / `deleteSpecs(specPath)` – Manage `.spec` files while preventing directory traversal.
- `createDesignSpec(designPath, content)` / `updateDesignSpec(...)` / `loadDesignSpec(designPath)` / `deleteDesignSpec(designPath)` – Manage `.ds` files mirroring source layout.
- `listSpecFiles(): Promise<string[]>` / `listDesignSpecFiles(): Promise<string[]>` – Collect relative spec/design spec paths under `specs/`.
- `loadAllSpecDetails()` / `loadAllDesignSpecDetails()` – Return `{ path, content }` arrays for prompt assembly.
- `loadContextForSpecs(specPath)` – Bundle vision, requirement contents, the requested spec file, and related design specs.
- `extractRequirementNumber(fileName): number | null` – Parse sequential requirement identifiers from modern or legacy filenames.
- `getNextRequirementNumber(): Promise<number>` – Compute the next available requirement index.

## Dependencies
- `fs` / `fs.promises` – Filesystem IO.
- `path` – Path resolution and safety checks.
