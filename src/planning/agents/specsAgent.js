/**
 * @file specsAgent.js
 * @description Handles tasks targeting .spec files.
 */

const { parseTaskLines } = require('../parsers');
const { executeDocumentTask } = require('../agent-utils');
const {
    loadSpecs,
    createSpecs,
    updateSpecs,
    deleteSpecs
} = require('../../services/specsManager');
const { specsContext } = require('../../services/specsContext');

function createSpecsTasks(sectionLines) {
    return parseTaskLines(sectionLines, { agent: 'specs', section: 'Specs' });
}

function normalizeTarget(target) {
    if (target.startsWith('specs/')) {
        return target;
    }
    return `specs/${target}`;
}

async function executeTask(task, services) {
    const specPath = normalizeTarget(task.target);
    await executeDocumentTask({
        task: { ...task, target: specPath },
        services,
        loadCurrent: () => loadSpecs(specPath),
        saveContent: async (content) => {
            if (task.type === 'create') {
                await createSpecs(specPath, content);
            } else {
                await updateSpecs(specPath, content);
            }
            await specsContext.reloadSpec(specPath);
        },
        deleteContent: async () => {
            await deleteSpecs(specPath);
            specsContext.invalidateAll();
        },
        hintFiles: [specPath],
        onAfterSave: (content) => updateSpecCache(services.plannerContext, specPath, content),
        onAfterDelete: () => removeSpecCache(services.plannerContext, specPath)
    });
}

module.exports = {
    createSpecsTasks,
    executeTask
};

function updateSpecCache(plannerContext, specPath, content) {
    if (!plannerContext || !Array.isArray(plannerContext.specDetails)) {
        return;
    }
    const relative = specPath.replace(/^specs\//, '');
    const index = plannerContext.specDetails.findIndex((item) => item.path === relative);
    if (index >= 0) {
        plannerContext.specDetails[index] = { path: relative, content };
    } else {
        plannerContext.specDetails.push({ path: relative, content });
    }
}

function removeSpecCache(plannerContext, specPath) {
    if (!plannerContext || !Array.isArray(plannerContext.specDetails)) {
        return;
    }
    const relative = specPath.replace(/^specs\//, '');
    const index = plannerContext.specDetails.findIndex((item) => item.path === relative);
    if (index !== -1) {
        plannerContext.specDetails.splice(index, 1);
    }
}
