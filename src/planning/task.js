/**
 * @file task.js
 * @description Task representations used by the planning agents.
 */

let taskCounter = 0;

/**
 * Creates a structured task description.
 *
 * @param {object} options - Task configuration.
 * @param {string} options.agent - Agent responsible for executing the task (e.g. "vision", "specs").
 * @param {string} options.type - Task type: info | create | update | delete.
 * @param {string} options.target - The file or resource affected by the task.
 * @param {string} options.description - Short free-form description of the change.
 * @param {string} [options.section] - The originating request section name.
 * @param {string} [options.raw] - The raw task text as received from the request.
 * @param {object} [options.meta] - Additional agent-specific metadata.
 * @returns {Task}
*/
function createTask({ agent, type, target, description, section = '', raw = '', meta = {} }) {
    if (!agent || !type || !target) {
        throw new Error('Task definition requires agent, type and target.');
    }

    taskCounter += 1;
    return {
        id: `task-${taskCounter}`,
        agent,
        type,
        target,
        description: description || '',
        section,
        raw,
        meta,
        status: 'pending'
    };
}

module.exports = {
    createTask
};
