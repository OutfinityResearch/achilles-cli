/**
 * @file markdownParser.js
 * @description Utilities for parsing markdown documents into chapter-based structures.
 */

/**
 * Parses a markdown document into a map where each chapter heading becomes a key.
 * The parser considers headings from level 1 to level 6 as chapter delimiters.
 *
 * @param {string} markdown - The markdown text to parse.
 * @returns {Record<string, string>} - An object keyed by chapter title.
 */
function parseMarkdownChapters(markdown) {
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
        return {};
    }

    const lines = markdown.split(/\r?\n/);
    const chapters = {};
    let currentHeading = null;
    let buffer = [];

    const flushBuffer = () => {
        if (!currentHeading) {
            return;
        }
        chapters[currentHeading] = buffer.join('\n').trim();
        buffer = [];
    };

    const headingRegex = /^#{1,6}\s+(.+?)\s*#*$/;

    for (const line of lines) {
        const headingMatch = line.match(headingRegex);
        if (headingMatch) {
            flushBuffer();
            currentHeading = headingMatch[1].trim();
            if (!chapters[currentHeading]) {
                chapters[currentHeading] = '';
            }
            buffer = [];
        } else {
            buffer.push(line);
        }
    }

    flushBuffer();
    return chapters;
}

/**
 * Builds a markdown document from a map of chapter -> content pairs.
 * Headings use level-2 markers (##) to align with the planning specification format.
 *
 * @param {Record<string, string>} chapters - The chapter map to serialize.
 * @returns {string} - A markdown document string.
 */
function buildMarkdownFromChapters(chapters) {
    if (!chapters || typeof chapters !== 'object') {
        return '';
    }

    const sections = [];
    for (const [chapter, content] of Object.entries(chapters)) {
        const body = typeof content === 'string' ? content.trim() : '';
        sections.push(`## ${chapter}\n${body}`.trim());
    }

    return sections.join('\n\n');
}

module.exports = {
    parseMarkdownChapters,
    buildMarkdownFromChapters
};
