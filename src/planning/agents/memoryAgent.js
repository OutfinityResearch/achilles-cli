/**
 * @file memoryAgent.js
 * @description Handles operations on the shared memory file.
 */

const { createTask } = require('../task');
const { parseTaskLines } = require('../parsers');
const { runModel } = require('../agent-utils');
const { diff } = require('../../services/diff');
const { loadMemory, saveMemory } = require('../../services/contextStorage');

function createMemoryTasks(sectionLines) {
    const tasks = parseTaskLines(sectionLines, { agent: 'memory', section: 'Memory' });
    if (tasks.length > 0) {
        return tasks;
    }

    const text = Array.isArray(sectionLines) ? sectionLines.join('\n').trim() : '';
    if (!text) {
        return [];
    }

    return [
        createTask({
            agent: 'memory',
            type: 'update',
            target: '.achilles/memory',
            description: text,
            section: 'Memory'
        })
    ];
}

async function executeTask(task, services) {
    const current = await loadMemory();
    const prompt = [
        'You manage the project long-term memory.',
        `Current memory:\n${current || '(empty)'}`,
        `Instruction:\n${task.description || task.raw}`,
        'Provide the refreshed memory content.'
    ].join('\n\n');

    const updated = await runModel(services, ['Refreshing memory...'], prompt);
    if (!updated) {
        console.warn('[Planner] Memory update skipped – empty response.');
        return;
    }

    const trimmed = updated.trim();
    await saveMemory(trimmed);
    if (services && services.plannerContext) {
        services.plannerContext.memory = trimmed;
    }
    const diffText = diff(current, trimmed);
    console.log(diffText);
}

module.exports = {
    createMemoryTasks,
    executeTask
};
