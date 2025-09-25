/**
 * @file visionAgent.js
 * @description Manages updates to the project vision document.
 */

const { createTask } = require('../task');
const { parseTaskLines } = require('../parsers');
const { executeDocumentTask } = require('../agent-utils');
const { loadVision, updateVision } = require('../../services/specsManager');
const { specsContext } = require('../../services/specsContext');

function createVisionTasks(sectionLines) {
    const tasks = parseTaskLines(sectionLines, { agent: 'vision', section: 'vision' });
    if (tasks.length > 0) {
        return tasks;
    }

    const text = Array.isArray(sectionLines) ? sectionLines.join('\n').trim() : '';
    if (!text) {
        return [];
    }

    return [
        createTask({
            agent: 'vision',
            type: 'update',
            target: 'specs/vision.md',
            description: text,
            section: 'vision'
        })
    ];
}

async function executeTask(task, services) {
    await executeDocumentTask({
        task,
        services,
        loadCurrent: () => loadVision(),
        saveContent: async (content) => {
            await updateVision(content);
            specsContext.invalidateAll();
        },
        deleteContent: async () => {
            await updateVision('');
            specsContext.invalidateAll();
        },
        onAfterSave: (content) => {
            services.plannerContext.vision = content;
        },
        onAfterDelete: () => {
            services.plannerContext.vision = '';
        }
    });
}

module.exports = {
    createVisionTasks,
    executeTask
};
