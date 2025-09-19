# Product Vision: Achilles-CLI

## 1. Introduction
Achilles-CLI is an advanced, command-line operated assistant powered by a Large Language Model (LLM), designed to accelerate and structure the software development process, particularly for creating other AI agents and general software.

## 2. Overall Vision
The core idea is to have a "planner agent" (`achilles-planner`) that helps create specifications in a `specs` subfolder, structured on three levels:
- **Vision:** A high-level overview of the system (`specs/vision.md`).
- **Requirements:** Documents in `specs/reqs/` containing user stories or non-functional specifications, implementation guidelines without excessive detail, and a list of impacted modules (files) with a description of how they are affected.
- **Module Specifications:** Detailed technical documents for each code file, located in a path within `specs` that mirrors the source code's location (e.g., `specs/src/module.js.specs`). These specs contain comprehensive details like classes, functions, dependencies, and implementation logic.

A second agent, `achilles-codeGenerator`, then uses these specifications to generate the actual code.
