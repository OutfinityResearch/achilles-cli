# Purpose
Render coloured, chapter-aware diffs between two markdown documents so users can understand planned specification changes.

## Public Methods
- `diff(oldString, newString): string` – Groups changes by markdown heading, showing cyan chapter headers, green additions, red removals, and dim grey unchanged lines via ANSI colour codes.

## Dependencies
- `./markdownParser` – Splits markdown into chapter maps prior to diffing.
