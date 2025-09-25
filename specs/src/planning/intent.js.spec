# Purpose
Load planner context (vision, memory, requirements, specs, design specs, suggestions) and transform raw user input into the canonical seven-section request structure.

## Public Methods
- `constructor()` – Initialise the cached context placeholder.
- `loadContext(): Promise<PlannerContext>` – Ensure `.achilles/` directories exist, load all relevant documents and file lists, and store them in memory.
- `getContext(): PlannerContext` – Return the cached context, throwing if `loadContext()` has not run.
- `analyseInput(input): { sections, markdown, ideas, intent }` – Split text into sections, extract idea metadata, and render the canonical markdown representation.

## Dependencies
- `../services/specsManager` – Load vision, requirement, spec, and design spec data.
- `../services/contextStorage` – Read persistent memory, history, and suggestions.
