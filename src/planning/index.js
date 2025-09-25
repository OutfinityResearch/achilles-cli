/**
 * @file index.js
 * @description CLI orchestrator for the refactored planning agent.
 */

const readline = require('readline');
const { IntentEngine, SECTION_ORDER } = require('./intent');
const infoAgent = require('./agents/infoAgent');
const visionAgent = require('./agents/visionAgent');
const requirementsAgent = require('./agents/requirementsAgent');
const memoryAgent = require('./agents/memoryAgent');
const specsAgent = require('./agents/specsAgent');
const designSpecsAgent = require('./agents/designSpecsAgent');
const suggestionsAgent = require('./agents/suggestionsAgent');
const { LLMAgentClient } = require('../services/LLMAgentClient');

class PlanningCLI {
    constructor() {
        this.intentEngine = new IntentEngine();
        this.context = null;
        this.llmClient = null;
        this.rl = null;
        this.useFast = Boolean(process.env.PLANNER_USE_FAST);
        this.agentHandlers = {
            info: infoAgent,
            vision: visionAgent,
            requirements: requirementsAgent,
            memory: memoryAgent,
            specs: specsAgent,
            designSpecs: designSpecsAgent,
            suggestions: suggestionsAgent
        };
    }

    async initialize() {
        this.context = await this.intentEngine.loadContext();
        this.llmClient = new LLMAgentClient();
        this.setupInterface();
        this.printWelcome();
    }

    setupInterface() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });

        this.rl.on('line', async (input) => {
            await this.handleInput(input);
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log('Planner stopped. Bye!');
            process.exit(0);
        });
    }

    printWelcome() {
        const suggestionsCount = (this.context.suggestions || '')
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .length;

        console.log('Planning Agent ready.');
        console.log('Structure each request using the following markdown chapters:');
        console.log(SECTION_ORDER.map((chapter) => `- ${chapter}`).join('\n'));
        console.log('Within each chapter, list tasks as "file.ext: instruction".');
        console.log('In the Ideas chapter, format entries as "- [status] path/to/file: detail".');
        console.log(`You currently have ${suggestionsCount} suggestions recorded.`);
        console.log('Type "stop" to exit.');
        this.rl.prompt();
    }

    async handleInput(rawInput) {
        const trimmed = (rawInput || '').trim();
        if (!trimmed) {
            return;
        }
        if (trimmed.toLowerCase() === 'stop') {
            this.rl.close();
            return;
        }

        const { sections, markdown } = this.intentEngine.analyseInput(rawInput);
        console.log('\n[Planner] Parsed request document:');
        console.log(markdown);

        const tasks = [
            ...infoAgent.createInfoTasks(sections.info),
            ...visionAgent.createVisionTasks(sections.vision),
            ...requirementsAgent.createRequirementTasks(sections.Requirements),
            ...memoryAgent.createMemoryTasks(sections.Memory),
            ...specsAgent.createSpecsTasks(sections.Specs),
            ...designSpecsAgent.createDesignSpecsTasks(sections['Design Specifications']),
            ...suggestionsAgent.createSuggestionTasks(sections.Ideas)
        ].filter(Boolean);

        if (tasks.length === 0) {
            console.log('[Planner] No actionable tasks detected.');
            return;
        }

        console.log('\n[Planner] Task summary:');
        tasks.forEach((task) => {
            console.log(`- Thinking about ${task.target} (${task.agent}) :: ${task.description}`);
        });

        await this.executeTasks(tasks);
        await this.refreshContext();
    }

    async refreshContext() {
        this.context = await this.intentEngine.loadContext();
    }

    buildAgentServices() {
        const services = {
            llmClient: this.llmClient,
            useFast: this.useFast,
            plannerContext: this.context,
            dispatch: async (followUpTask) => {
                await this.executeTask(followUpTask, services);
            }
        };
        return services;
    }

    async executeTasks(tasks) {
        const services = this.buildAgentServices();
        for (const task of tasks) {
            await this.executeTask(task, services);
        }
        console.log('\n[Planner] Tasks completed successfully.');
    }

    async executeTask(task, services) {
        console.log(`\n[Planner] Thinking about ${task.target} (${task.agent})...`);
        const handler = this.agentHandlers[task.agent];
        if (!handler || typeof handler.executeTask !== 'function') {
            console.warn(`[Planner] No handler implemented for agent ${task.agent}.`);
            return;
        }
        await handler.executeTask(task, services);
    }
}

module.exports = {
    PlanningCLI
};
