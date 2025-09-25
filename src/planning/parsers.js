/**
 * @file parsers.js
 * @description Shared parsing helpers for planner agents.
 */

const { createTask } = require('./task');

function detectTaskType(description) {
    if (!description) {
        return 'update';
    }

    const lowered = description.trim().toLowerCase();
    if (lowered.startsWith('delete') || lowered.startsWith('remove')) {
        return 'delete';
    }
    if (lowered.startsWith('create') || lowered.startsWith('add')) {
        return 'create';
    }
    if (lowered.startsWith('info') || lowered.startsWith('explain') || lowered.startsWith('show')) {
        return 'info';
    }
    if (lowered.startsWith('update') || lowered.startsWith('modify')) {
        return 'update';
    }
    return 'update';
}

function parseTaskLines(lines, { agent, section }) {
    if (!Array.isArray(lines)) {
        return [];
    }

    const tasks = [];
    lines.forEach((rawLine) => {
        if (typeof rawLine !== 'string') {
            return;
        }
        const trimmed = rawLine.trim();
        if (!trimmed) {
            return;
        }

        const withoutBullet = trimmed.replace(/^[-*]\s+/, '');
        const separatorIndex = withoutBullet.indexOf(':');
        if (separatorIndex === -1) {
            return;
        }

        const target = withoutBullet.slice(0, separatorIndex).trim();
        const description = withoutBullet.slice(separatorIndex + 1).trim();
        if (!target) {
            return;
        }

        const type = detectTaskType(description);
        tasks.push(createTask({
            agent,
            type,
            target,
            description,
            section,
            raw: rawLine
        }));
    });

    return tasks;
}

module.exports = {
    parseTaskLines
};
