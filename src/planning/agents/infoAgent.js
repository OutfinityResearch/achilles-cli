/**
 * @file infoAgent.js
 * @description Handles informational queries about project context.
 */

const { createTask } = require('../task');
const { specsContext } = require('../../services/specsContext');

function createInfoTasks(sectionLines) {
    if (!Array.isArray(sectionLines)) {
        return [];
    }

    const text = sectionLines.join('\n').trim();
    if (!text) {
        return [];
    }

    return [
        createTask({
            agent: 'info',
            type: 'info',
            target: 'context',
            description: text,
            section: 'info'
        })
    ];
}

async function executeTask(task) {
    const query = task.description || task.raw;
    const contextBundle = await specsContext.buildContext(query, { limit: 5 });

    const printEntries = (label, entries) => {
        console.log(`\n[Info] ${label}:`);
        if (!entries || entries.length === 0) {
            console.log('  (none)');
            return;
        }
        entries.forEach((entry) => {
            console.log(`  ### ${entry.path}`);
            console.log(entry.content || '(empty)');
        });
    };

    printEntries('Relevant requirements', contextBundle.requirements);
    printEntries('Relevant specs', contextBundle.specs);
    printEntries('Relevant design specs', contextBundle.designSpecs);
}

module.exports = {
    createInfoTasks,
    executeTask
};
