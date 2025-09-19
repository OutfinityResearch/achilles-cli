# Requirement: Module Spec Constraints

## 1. Non-Functional Requirements
- To ensure maintainable and scalable code, module specifications have constraints on their granularity.
- **Granularity:** A single module specification should generally not describe more than one primary class or approximately ten functions.
- If this limit is exceeded, the `achilles-planner` agent should propose refactoring the module into smaller, more focused sub-modules by creating new spec files.

## 2. Impacted Modules
- `src/achilles-planner.js`: Will be responsible for enforcing these constraints when creating or updating module specification documents.
