#!/usr/bin/env node
/**
 * @file planner.js
 * @description Entry point for the refactored planning agent.
 */

const { configure } = require('./services/LLMConfiguration');
const { PlanningCLI } = require('./planning');

async function main() {
    try {
        await configure();
        const cli = new PlanningCLI();
        await cli.initialize();
    } catch (error) {
        if (error && error.code === 'LLM_CONFIG_MISSING') {
            console.error(error.message);
        } else {
            console.error('[Planner] Fatal error:', error);
        }
        process.exit(1);
    }
}

main();
