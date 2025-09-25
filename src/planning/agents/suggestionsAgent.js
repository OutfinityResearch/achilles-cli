/**
 * @file suggestionsAgent.js
 * @description Handles suggestion lifecycle and execution.
 */

const path = require('path');
const { createTask } = require('../task');
const { loadSuggestions, saveSuggestions } = require('../../services/contextStorage');

function detectAgentFromTarget(target) {
    if (!target) {
        return null;
    }

    const lower = target.toLowerCase();
    if (lower === 'specs/vision.md' || lower.endsWith('vision.md')) {
        return 'vision';
    }
    if (lower.endsWith('.req')) {
        return 'requirements';
    }
    if (lower.endsWith('.spec')) {
        return 'specs';
    }
    if (lower.endsWith('.ds')) {
        return 'designSpecs';
    }
    if (lower.includes('memory')) {
        return 'memory';
    }
    return null;
}

function createSuggestionTasks(sectionLines) {
    if (!Array.isArray(sectionLines)) {
        return [];
    }

    const ideaRegex = /^[-*]?\s*\[(accepted|rejected|ignored)\]\s*([^:]+?)(?:\s*:\s*(.*))?$/i;
    const tasks = [];
    const persistedEntries = [];

    sectionLines.forEach((line) => {
        if (typeof line !== 'string' || !line.trim()) {
            return;
        }
        const match = line.match(ideaRegex);
        if (!match) {
            persistedEntries.push(line.trim());
            return;
        }

        const status = match[1].toLowerCase();
        const target = match[2].trim();
        const description = (match[3] || '').trim();
        const agent = detectAgentFromTarget(target);

        const meta = { status, target, description };
        if (status === 'accepted' && agent) {
            meta.followUp = {
                agent,
                target,
                description: description || `Implement accepted idea for ${path.basename(target)}`
            };
        }

        persistedEntries.push(`- [${status}] ${target}${description ? `: ${description}` : ''}`);
        tasks.push(createTask({
            agent: 'suggestions',
            type: 'suggestion',
            target: '.achilles/.suggestions/suggestions.md',
            description: description || `Update suggestion ${target}`,
            section: 'Ideas',
            raw: line,
            meta
        }));
    });

    if (tasks.length === 0 && persistedEntries.length > 0) {
        tasks.push(createTask({
            agent: 'suggestions',
            type: 'suggestion',
            target: '.achilles/.suggestions/suggestions.md',
            description: 'Persist suggestions',
            section: 'Ideas',
            raw: persistedEntries.join('\n'),
            meta: { status: 'ignored', entries: persistedEntries }
        }));
    }

    return tasks;
}

async function executeTask(task, services) {
    const suggestions = await loadSuggestions();
    const meta = task.meta || {};
    let entries = suggestions.trim() ? suggestions.split(/\r?\n/).filter((line) => line.trim()) : [];
    if (meta.entries) {
        entries = meta.entries.slice();
    } else {
        entries = entries.filter((line) => !line.includes(meta.target));
        if (meta.status === 'accepted' || meta.status === 'ignored') {
            const formatted = `- [${meta.status}] ${meta.target}${meta.description ? `: ${meta.description}` : ''}`;
            entries.push(formatted);
        }
    }

    const joined = entries.join('\n');
    await saveSuggestions(joined);
    console.log('[Planner] Suggestions updated.');
    if (services && services.plannerContext) {
        services.plannerContext.suggestions = joined;
    }

    if (meta.followUp && typeof services.dispatch === 'function') {
        const followTask = {
            id: `${task.id}-follow`,
            agent: meta.followUp.agent,
            type: 'update',
            target: meta.followUp.target,
            description: meta.followUp.description,
            section: 'Ideas',
            raw: task.raw,
            meta: {}
        };
        console.log(`[Planner] Executing follow-up for accepted suggestion targeting ${followTask.target}.`);
        await services.dispatch(followTask);
    }
}

module.exports = {
    createSuggestionTasks,
    executeTask
};
