# Purpose
Maintain an indexed in-memory cache of requirements, specs, and design specs so planner tasks can fetch the most relevant documents with informative logging.

## Public Methods
- `refresh(): Promise<void>` – Reload all documents from disk into memory and rebuild search indices.
- `ensureLoaded(): Promise<void>` – Lazily populate the cache before servicing queries.
- `getRelevantSpecsForText(text, options?): Promise<Array<{ path, content, score }>>` – Return top-ranked `.spec` matches while logging candidate scores.
- `getRelevantDesignSpecsForText(text, options?)` – Same as above for `.ds` files.
- `getRelevantRequirementsForText(text, options?)` – Retrieve relevant requirements.
- `buildContext(text, options?)` – Fetch relevant requirements, specs, and design specs in parallel.
- `reloadSpec(path)` / `reloadDesignSpec(path)` – Refresh single documents after edits.
- `invalidateAll()` – Mark the cache stale so it refreshes on next use.

## Dependencies
- `./specsManager` – Load document contents and listings.
- Internal token index (FlexSearch-compatible heuristics implemented in-memory) – Score and rank documents.
