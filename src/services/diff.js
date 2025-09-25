/**
 * @file diff.js
 * @description Chapter-aware markdown diff helper used by the planning agent.
 */

const { parseMarkdownChapters } = require('./markdownParser');

const COLOR_RESET = '\u001b[0m';
const COLOR_ADDED = '\u001b[32m';
const COLOR_REMOVED = '\u001b[31m';
const COLOR_HEADER = '\u001b[36m';
const COLOR_UNCHANGED = '\u001b[90m';

function colorize(color, text) {
    return `${color}${text}${COLOR_RESET}`;
}

function diffLines(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;
    const lcs = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = m - 1; i >= 0; i -= 1) {
        for (let j = n - 1; j >= 0; j -= 1) {
            if (oldLines[i] === newLines[j]) {
                lcs[i][j] = lcs[i + 1][j + 1] + 1;
            } else {
                lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
    }

    const ops = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (oldLines[i] === newLines[j]) {
            ops.push({ type: 'same', value: oldLines[i] });
            i += 1;
            j += 1;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            ops.push({ type: 'remove', value: oldLines[i] });
            i += 1;
        } else {
            ops.push({ type: 'add', value: newLines[j] });
            j += 1;
        }
    }

    while (i < m) {
        ops.push({ type: 'remove', value: oldLines[i] });
        i += 1;
    }

    while (j < n) {
        ops.push({ type: 'add', value: newLines[j] });
        j += 1;
    }

    return ops;
}

/**
 * Displays a diff between two markdown documents grouped by chapter.
 * Deletions are printed in red, additions in green, and unchanged lines in grey.
 *
 * @param {string} oldString - The original markdown string.
 * @param {string} newString - The new markdown string.
 * @returns {string} - The formatted diff string with ANSI colour codes.
 */
function diff(oldString, newString) {
    const oldDoc = parseMarkdownChapters(oldString || '');
    const newDoc = parseMarkdownChapters(newString || '');
    const chapterNames = new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)]);

    if (chapterNames.size === 0 && (oldString || '').trim() === (newString || '').trim()) {
        return 'No changes.';
    }

    const sections = [];
    for (const chapter of Array.from(chapterNames).sort((a, b) => a.localeCompare(b))) {
        const oldChapter = (oldDoc[chapter] || '').split(/\r?\n/);
        const newChapter = (newDoc[chapter] || '').split(/\r?\n/);
        const operations = diffLines(oldChapter, newChapter);

        sections.push(colorize(COLOR_HEADER, `## ${chapter}`));

        if (operations.length === 0) {
            sections.push(colorize(COLOR_UNCHANGED, '  (no changes)'));
            continue;
        }

        for (const op of operations) {
            if (op.type === 'same') {
                sections.push(colorize(COLOR_UNCHANGED, `  ${op.value}`));
            } else if (op.type === 'add') {
                sections.push(colorize(COLOR_ADDED, `+ ${op.value}`));
            } else if (op.type === 'remove') {
                sections.push(colorize(COLOR_REMOVED, `- ${op.value}`));
            }
        }
    }

    return sections.join('\n');
}

module.exports = { diff };
