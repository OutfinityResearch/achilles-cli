/**
 * @file requirementsAgent.js
 * @description Handles requirement specification updates.
 */

const { parseTaskLines } = require('../parsers');
const { executeDocumentTask } = require('../agent-utils');
const {
    loadRequirement,
    createRequirement,
    updateRequirement,
    deleteRequirement
} = require('../../services/specsManager');
const { specsContext } = require('../../services/specsContext');

function createRequirementTasks(sectionLines) {
    return parseTaskLines(sectionLines, { agent: 'requirements', section: 'Requirements' });
}

function normalizeTarget(target) {
    return target.replace(/^specs\/?reqs\//i, '').replace(/^reqs\//i, '');
}

async function executeTask(task, services) {
    const filename = normalizeTarget(task.target);
    await executeDocumentTask({
        task,
        services,
        loadCurrent: () => loadRequirement(filename),
        saveContent: async (content) => {
            if (task.type === 'create') {
                await createRequirement(filename, content);
            } else {
                await updateRequirement(filename, content);
            }
            specsContext.invalidateAll();
        },
        deleteContent: async () => {
            await deleteRequirement(filename);
            specsContext.invalidateAll();
        },
        hintFiles: [`specs/reqs/${filename}`],
        onAfterSave: (content) => updateRequirementCache(services.plannerContext, filename, content),
        onAfterDelete: () => removeRequirementCache(services.plannerContext, filename)
    });
}

function updateRequirementCache(plannerContext, filename, content) {
    if (!plannerContext || !Array.isArray(plannerContext.requirementDetails)) {
        return;
    }
    const entryIndex = plannerContext.requirementDetails.findIndex((item) => item.path === filename);
    if (entryIndex >= 0) {
        plannerContext.requirementDetails[entryIndex] = { path: filename, content };
    } else {
        plannerContext.requirementDetails.push({ path: filename, content });
    }
    syncRequirementBodies(plannerContext);
}

function removeRequirementCache(plannerContext, filename) {
    if (!plannerContext || !Array.isArray(plannerContext.requirementDetails)) {
        return;
    }
    const index = plannerContext.requirementDetails.findIndex((item) => item.path === filename);
    if (index !== -1) {
        plannerContext.requirementDetails.splice(index, 1);
    }
    syncRequirementBodies(plannerContext);
}

function syncRequirementBodies(plannerContext) {
    if (!plannerContext) {
        return;
    }
    plannerContext.requirements = Array.isArray(plannerContext.requirementDetails)
        ? plannerContext.requirementDetails.map((item) => item.content)
        : [];
}

module.exports = {
    createRequirementTasks,
    executeTask
};
