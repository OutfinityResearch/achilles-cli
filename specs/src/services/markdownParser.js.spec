# Purpose
Convert markdown documents to and from chapter-indexed structures for downstream diffing and prompt composition.

## Public Methods
- `parseMarkdownChapters(markdown): Record<string,string>` – Split the document using headings (`#`–`######`) and return a map of heading text to body content.
- `buildMarkdownFromChapters(chapters): string` – Serialise a chapter map back into markdown using level-2 headings with blank lines between sections.

## Dependencies
- None (pure string manipulation).
