/**
 * @file designSpecsAgent.js
 * @description Manages .ds design specification tasks.
 */

const { parseTaskLines } = require('../parsers');
const { executeDocumentTask } = require('../agent-utils');
const {
    loadDesignSpec,
    createDesignSpec,
    updateDesignSpec,
    deleteDesignSpec
} = require('../../services/specsManager');
const { specsContext } = require('../../services/specsContext');

function createDesignSpecsTasks(sectionLines) {
    return parseTaskLines(sectionLines, { agent: 'designSpecs', section: 'Design Specifications' });
}

function normalizeTarget(target) {
    if (target.startsWith('specs/')) {
        return target;
    }
    return `specs/${target}`;
}

async function executeTask(task, services) {
    const designPath = normalizeTarget(task.target);
    await executeDocumentTask({
        task: { ...task, target: designPath },
        services,
        loadCurrent: () => loadDesignSpec(designPath),
        saveContent: async (content) => {
            if (task.type === 'create') {
                await createDesignSpec(designPath, content);
            } else {
                await updateDesignSpec(designPath, content);
            }
            await specsContext.reloadDesignSpec(designPath);
        },
        deleteContent: async () => {
            await deleteDesignSpec(designPath);
            specsContext.invalidateAll();
        },
        hintFiles: [designPath],
        onAfterSave: (content) => updateDesignSpecCache(services.plannerContext, designPath, content),
        onAfterDelete: () => removeDesignSpecCache(services.plannerContext, designPath)
    });
}

module.exports = {
    createDesignSpecsTasks,
    executeTask
};

function updateDesignSpecCache(plannerContext, designPath, content) {
    if (!plannerContext || !Array.isArray(plannerContext.designSpecDetails)) {
        return;
    }
    const relative = designPath.replace(/^specs\//, '');
    const index = plannerContext.designSpecDetails.findIndex((item) => item.path === relative);
    if (index >= 0) {
        plannerContext.designSpecDetails[index] = { path: relative, content };
    } else {
        plannerContext.designSpecDetails.push({ path: relative, content });
    }
}

function removeDesignSpecCache(plannerContext, designPath) {
    if (!plannerContext || !Array.isArray(plannerContext.designSpecDetails)) {
        return;
    }
    const relative = designPath.replace(/^specs\//, '');
    const index = plannerContext.designSpecDetails.findIndex((item) => item.path === relative);
    if (index !== -1) {
        plannerContext.designSpecDetails.splice(index, 1);
    }
}
