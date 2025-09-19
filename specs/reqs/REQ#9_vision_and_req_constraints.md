# Requirement: Vision and Requirement Constraints

## 1. Non-Functional Requirements
- To maintain clarity and focus, all vision and requirement documents are subject to constraints.
- **Conciseness:** These documents should be kept concise, ideally between one to two pages.
- **Cohesion:** Each requirement document should be unitary and coherent. If a requirement becomes too large or complex, the `achilles-planner` agent should propose splitting it into multiple, smaller requirements.

## 2. Impacted Modules
- `src/achilles-planner.js`: Will be responsible for enforcing these constraints when creating or updating vision and requirement documents.
