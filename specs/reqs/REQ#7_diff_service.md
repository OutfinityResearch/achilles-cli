# Requirement: Diff Service

## 1. User Story
As a developer, when the `achilles-planner` proposes changes to a specification file, I want to see a clear and compact diff of the changes so that I can easily approve or reject them.

## 2. Functional Requirements
- A `diff.js` service must be implemented.
- This service will display changes between an old file and a new proposal in a compact and elegant format.

## 3. Impacted Modules
- `src/services/diff.js`: The implementation of the diff service.
- `src/achilles-planner.js`: Will use the `diff.js` service to display proposed changes.
