#!/usr/bin/env node
/**
 * @file specs-decompiler.js
 * @description LLM-assisted tool that derives markdown specifications from source files.
 */

const path = require('path');
const fs = require('fs/promises');
const { configure } = require('./services/LLMConfiguration');
const { LLMAgentClient } = require('./services/LLMAgentClient');
const {
    createSpecs,
    updateSpecs,
    loadSpecs,
    loadContextForSpecs
} = require('./services/specsManager');
const { parseMarkdownChapters } = require('./services/markdownParser');
const { diff } = require('./services/diff');

async function main() {
    const targetArg = process.argv[2];
    if (!targetArg) {
        console.error('Usage: specs-decompiler <path-to-source-file>');
        process.exit(1);
    }

    const workspaceRoot = process.cwd();
    const absoluteSourcePath = path.resolve(workspaceRoot, targetArg);
    const specPath = toSpecPath(workspaceRoot, absoluteSourcePath);
    const relativeSpecPath = path.relative(workspaceRoot, specPath).replace(/\\/g, '/');

    try {
        const source = await fs.readFile(absoluteSourcePath, 'utf8');
        await configure();
        const llm = new LLMAgentClient();

        const context = await loadContextForSpecs(relativeSpecPath);
        const existingSpec = await loadSpecs(relativeSpecPath);

        const prompt = buildPrompt({
            sourcePath: path.relative(workspaceRoot, absoluteSourcePath).replace(/\\/g, '/'),
            sourceCode: source,
            specPath: relativeSpecPath,
            context,
            existingSpec
        });

        const result = await llm.doTaskDeep(
            [
                'Reviewing current specifications...',
                'Analysing source code structure...',
                'Drafting updated module specification...'
            ],
            [],
            prompt
        );

        const generated = typeof result === 'string' ? result.trim() : JSON.stringify(result, null, 2);
        const normalized = normalizeSpecMarkdown(generated);

        if (!existingSpec) {
            await createSpecs(relativeSpecPath, normalized);
            console.log(`Specification created: ${relativeSpecPath}`);
        } else {
            await updateSpecs(relativeSpecPath, normalized);
            console.log(`Specification updated: ${relativeSpecPath}`);
            const difference = diff(existingSpec, normalized);
            console.log(difference);
        }
    } catch (error) {
        console.error('Failed to decompile specification:', error.message || error);
        process.exit(1);
    }
}

function toSpecPath(root, absoluteSourcePath) {
    const relative = path.relative(root, absoluteSourcePath).replace(/\\/g, '/');
    return path.join(root, 'specs', `${relative}.spec`);
}

function buildPrompt({ sourcePath, sourceCode, specPath, context, existingSpec }) {
    const lines = [
        'You are specsDecompiler, an assistant that writes markdown specifications for JavaScript modules used by the planning agent.',
        'Each specification must use the following structure:',
        '# Purpose',
        '## Public Methods',
        '## Dependencies',
        'List public methods as bullet points with short descriptions. List dependencies as bullet points too.',
        '',
        `Project vision:\n${context.vision}`,
        '',
        'Relevant requirements:\n' + (Array.isArray(context.requirements) && context.requirements.length
            ? context.requirements.join('\n---\n')
            : '(none)')
    ];

    if (Array.isArray(context.designSpecs) && context.designSpecs.length > 0) {
        lines.push('\nRelated design specifications:');
        context.designSpecs.forEach((design) => {
            lines.push(`\n### ${design.path}\n${design.content}`);
        });
    }

    if (existingSpec && existingSpec.trim()) {
        lines.push('\nExisting specification (update it if still relevant):');
        lines.push(existingSpec);
    }

    lines.push('\nSource file path: ' + sourcePath);
    lines.push('Source code:\n```javascript\n' + sourceCode + '\n```');
    lines.push(`\nProduce the full markdown specification for ${specPath}. Return markdown only, no explanations.`);

    return lines.join('\n');
}

function normalizeSpecMarkdown(content) {
    let output = content;
    const chapters = parseMarkdownChapters(output);
    if (!/^#\s+Purpose/m.test(output)) {
        output = `# Purpose\n${chapters.Purpose || 'Describe the module responsibility.'}\n\n${output}`.trim();
    }
    if (!/^##\s+Public Methods/m.test(output)) {
        output += '\n\n## Public Methods\n- (document public API)';
    }
    if (!/^##\s+Dependencies/m.test(output)) {
        output += '\n\n## Dependencies\n- (list dependencies)';
    }

    // Ensure bullet lists are formatted properly.
    output = normalizeBulletList(output, 'Public Methods');
    output = normalizeBulletList(output, 'Dependencies');
    return output.trim();
}

function normalizeBulletList(content, heading) {
    const regex = new RegExp(`^##\s+${escapeRegExp(heading)}\s*\n([\s\S]*?)(?=^#{1,6}\s|\s*$)`, 'm');
    if (!regex.test(content)) {
        return content;
    }
    return content.replace(regex, (match, body) => {
        const lines = body
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => (line.startsWith('-') ? line : `- ${line}`));
        const normalizedBody = lines.length ? lines.join('\n') : '- (none)';
        return `## ${heading}\n${normalizedBody}\n`;
    });
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (require.main === module) {
    main();
}

module.exports = {
    toSpecPath,
    buildPrompt,
    normalizeSpecMarkdown
};
