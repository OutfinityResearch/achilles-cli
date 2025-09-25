#!/usr/bin/env node
/**
 * @file root-cause.js
 * @description Root cause analysis agent that proposes hypotheses and planner follow-ups for reported behaviours.
 */

const readline = require('readline');
const { configure } = require('./services/LLMConfiguration');
const { LLMAgentClient } = require('./services/LLMAgentClient');
const { specsContext } = require('./services/specsContext');

async function main() {
    const description = await readDescription();
    if (!description) {
        console.error('Please provide a behaviour description (bug report, failing scenario, etc.).');
        process.exit(1);
    }

    await configure();
    await specsContext.refresh();

    const contextBundle = await specsContext.buildContext(description, { limit: 5 });
    const llm = new LLMAgentClient();

    const prompt = buildPrompt(description, contextBundle);
    const analysis = await llm.doTaskDeep(
        [
            'Analysing reported behaviour...',
            'Searching for probable causes...',
            'Formulating planner follow-up actions...'
        ],
        [],
        prompt
    );

    console.log('\n=== Root Cause Report ===');
    console.log(typeof analysis === 'string' ? analysis.trim() : JSON.stringify(analysis, null, 2));
}

async function readDescription() {
    const fromArgs = process.argv.slice(2).join(' ').trim();
    if (fromArgs) {
        return fromArgs;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const description = await new Promise((resolve) => {
        rl.question('Describe the behaviour to analyse:\n', (answer) => {
            rl.close();
            resolve((answer || '').trim());
        });
    });
    return description;
}

function buildPrompt(description, contextBundle) {
    const requirementContext = contextBundle.requirements
        .map((req) => `### Requirement: ${req.path}\n${req.content}`)
        .join('\n\n') || '(no related requirements found)';
    const specContext = contextBundle.specs
        .map((spec) => `### Spec: ${spec.path}\n${spec.content}`)
        .join('\n\n') || '(no related specs found)';
    const designSpecContext = contextBundle.designSpecs
        .map((ds) => `### Design Spec: ${ds.path}\n${ds.content}`)
        .join('\n\n') || '(no related design specs found)';

    return [
        'You are the rootCause agent for the planning workflow.',
        'Analyse the reported behaviour, propose the most likely root causes, and outline validation steps.',
        'Where appropriate, recommend updates for the planning agent (e.g., new requirements/spec changes) using bullet lists.',
        'Respond in markdown with the following sections:',
        '## Behaviour Summary – Paraphrase the input.',
        '## Hypotheses – Numbered list of potential root causes.',
        '## Validation – Steps or experiments to confirm/refute the hypotheses.',
        '## Recommended Planner Updates – Suggested changes to specs/requirements/memory (include file names).',
        '',
        `### Behaviour Input\n${description}`,
        '',
        '### Relevant Requirements',
        requirementContext,
        '',
        '### Relevant Specs',
        specContext,
        '',
        '### Relevant Design Specs',
        designSpecContext
    ].join('\n');
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Root cause analysis failed:', error.message || error);
        process.exit(1);
    });
}

module.exports = {
    buildPrompt,
    readDescription
};
