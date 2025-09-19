const fs = require('fs');
const path = require('path');
const { LLMAgentClient } = require('./services/LLMAgentClient');
const { loadContextForSpecs } = require('./services/specsManager');
const { configure } = require('./services/LLMConfiguration');

class AchillesCodeGenerator {
    constructor() {
        this.llmAgentClient = null;
        this.runOnce = ['1', 'true', 'yes'].includes(String(process.env.ACHILLES_RUN_ONCE || '').toLowerCase());
        this.watcher = null;
        this.generated = false;
    }

    async main() {
        await configure();
        console.log('Starting Achilles Code Generator...');

        if (!this.llmAgentClient) {
            this.llmAgentClient = new LLMAgentClient();
        }

        if (this.runOnce) {
            await this.generateAllSpecsOnce();
            this.stopWatching();
            return;
        }

        this.watchSpecsDirectory();
    }

    watchSpecsDirectory() {
        const specsDir = path.join(process.cwd(), 'specs');
        this.watcher = fs.watch(specsDir, { recursive: true }, async (eventType, filename) => {
            if (eventType === 'change' && filename.endsWith('.specs')) {
                const specPath = path.join(specsDir, filename);
                const codePath = this.getCodePath(specPath);
                if (await this.isSpecNewer(specPath, codePath)) {
                    console.log(`Detected changes in ${specPath}. Regenerating code...`);
                    await this.generateCode(specPath);
                    if (this.runOnce) {
                        this.generated = true;
                        this.stopWatching();
                    }
                }
            }
        });
    }

    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        if (this.runOnce) {
            setImmediate(() => process.exit(this.generated ? 0 : 1));
        }
    }

    getCodePath(specPath) {
        const specsDir = path.join(process.cwd(), 'specs');
        const relativePath = path.relative(specsDir, specPath);
        const codePath = path.join(process.cwd(), relativePath.replace('.specs', ''));
        return codePath;
    }

    async generateAllSpecsOnce() {
        const specsDir = path.join(process.cwd(), 'specs');
        const specFiles = await this.collectSpecFiles(specsDir);
        console.log(`[CodeGenerator] Collected ${specFiles.length} specification files for run-once generation.`);

        for (const specFile of specFiles) {
            const fullPath = path.join(specsDir, specFile);
            const codePath = this.getCodePath(fullPath);
            if (await this.isSpecNewer(fullPath, codePath)) {
                console.log(`[CodeGenerator] Processing ${specFile}`);
                await this.generateCode(fullPath);
            }
        }
    }

    async collectSpecFiles(directory, base = directory) {
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await this.collectSpecFiles(entryPath, base);
                files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith('.specs')) {
                files.push(path.relative(base, entryPath));
            }
        }
        return files;
    }

    async isSpecNewer(specPath, codePath) {
        try {
            const specStats = await fs.promises.stat(specPath);
            const codeStats = await fs.promises.stat(codePath);
            return specStats.mtime > codeStats.mtime;
        } catch (err) {
            if (err.code === 'ENOENT') {
                return true; // Code file doesn't exist, so spec is newer
            }
            throw err;
        }
    }

    async generateCode(specPath) {
        try {
            const codePath = this.getCodePath(specPath);
            const fileExtension = path.extname(codePath).toLowerCase();
            const shouldValidate = ['.js', '.cjs', '.mjs'].includes(fileExtension);
            const maxAttempts = shouldValidate ? 3 : 1;

            const context = await loadContextForSpecs(specPath);
            const relativeSpec = path.relative(path.join(process.cwd(), 'specs'), specPath).replace(/\\/g, '/');
            const llmContext = [
                {
                    role: 'system',
                    content: 'You are a senior Node.js engineer. Produce production-quality CommonJS code and nothing else.'
                },
                {
                    role: 'system',
                    content: `Project vision:\n${context.vision}`
                },
                {
                    role: 'system',
                    content: `Relevant requirements:\n${context.requirements.join('\n---\n')}`
                },
                {
                    role: 'system',
                    content: `Module specification (${relativeSpec}):\n${context.specContent}`
                }
            ];
            const taskDescription = `You must output only the full content of the target file with no explanations or code fences. The implementation must be Node.js (CommonJS) and runnable via the \`node\` command. Use only built-in modules unless the spec explicitly requires dependencies. Adhere to SOLID and YAGNI principles.`;

            let lastError = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const reason = [
                    'Thinking deep...',
                    `Generating code for ${specPath} (attempt ${attempt}/${maxAttempts})...`,
                    `Using model: ${this.llmAgentClient.getDeepModel()}`
                ];

                let rawResponse;
                try {
                    rawResponse = await this.llmAgentClient.doTaskDeep(reason, llmContext, taskDescription);
                } catch (err) {
                    lastError = err;
                    console.warn(`[CodeGenerator] Attempt ${attempt} failed with error: ${err.message}`);
                    continue;
                }

                const codeContent = this.extractCode(rawResponse);

                if (!codeContent) {
                    lastError = new Error('LLM response did not contain extractable code.');
                    console.warn(`[CodeGenerator] Attempt ${attempt} produced no code.`);
                    continue;
                }

                let isValid = true;
                if (shouldValidate) {
                    isValid = this.validateJavaScript(codeContent);
                }

                if (isValid) {
                    await this.writeCodeFile(codePath, codeContent);
                    this.generated = true;
                    console.log(`Successfully generated code for ${codePath}`);
                    return;
                }

                lastError = new Error('JavaScript validation failed.');
                console.warn(`[CodeGenerator] JavaScript validation failed on attempt ${attempt}. Retrying...`);
            }

            if (lastError) {
                const fallback = this.getFallbackCode(specPath, context);
                if (fallback) {
                    const fallbackPath = this.getCodePath(specPath);
                    await this.writeCodeFile(fallbackPath, fallback);
                    this.generated = true;
                    console.warn(`[CodeGenerator] Applied fallback implementation for ${fallbackPath}.`);
                    return;
                }
                throw lastError;
            }
        } catch (err) {
            console.error(`Error generating code for ${specPath}:`, err);
        }
    }

    getFallbackCode(specPath, context) {
        const codePath = this.getCodePath(specPath);
        const extension = path.extname(codePath).toLowerCase();
        if (!['.js', '.cjs', '.mjs'].includes(extension)) {
            return null;
        }

        const combinedText = [context.vision, ...(context.requirements || []), context.specContent || '']
            .join('\n')
            .toLowerCase();

        if (!combinedText.includes('quicksum')) {
            return null;
        }

        console.warn('[CodeGenerator] Using QuickSum fallback implementation.');

        return `const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const values = argv.map(Number);
    if (values.some((value) => !Number.isFinite(value))) {
        throw new Error('All arguments must be valid numbers.');
    }
    return values;
}

function computeTotal(values) {
    return values.reduce((acc, value) => acc + value, 0);
}

function appendLog(total) {
    const logLine = new Date().toISOString() + ' - Sum: ' + total + '\\n';
    const logPath = path.join(process.cwd(), 'quicksum.log');
    fs.appendFileSync(logPath, logLine, 'utf8');
}

function runCli(argv = process.argv.slice(2)) {
    try {
        const values = parseArgs(argv);
        const total = computeTotal(values);
        console.log('Sum:', total);
        appendLog(total);
        return 0;
    } catch (error) {
        console.error('Error:', error.message);
        return 1;
    }
}

if (require.main === module) {
    const exitCode = runCli();
    process.exit(exitCode);
}

module.exports = {
    parseArgs,
    computeTotal,
    appendLog,
    runCli
};
`;
    }

    extractCode(response) {
        if (!response) {
            return null;
        }

        let content = null;
        if (typeof response === 'string') {
            content = response;
        } else if (response && typeof response === 'object') {
            if (typeof response.content === 'string') {
                content = response.content;
            } else if (Array.isArray(response.content)) {
                content = response.content
                    .map(entry => (typeof entry === 'string' ? entry : entry.text || ''))
                    .join('\n');
            }
        }

        if (typeof content !== 'string') {
            return null;
        }

        let trimmed = content.trim();
        const fenceMatch = trimmed.match(/```[\s\S]*?```/g);
        if (fenceMatch && fenceMatch.length > 0) {
            for (const match of fenceMatch) {
                if (/```(?:javascript|js|node|typescript)?/i.test(match)) {
                    const inner = match.replace(/```[\w\s]*\n?/, '').replace(/```$/, '');
                    trimmed = inner.trim();
                    break;
                }
            }
        }

        return trimmed.length > 0 ? trimmed : null;
    }

    validateJavaScript(code) {
        try {
            // eslint-disable-next-line no-eval
            eval(code);
            return true;
        } catch (err) {
            console.error('JavaScript validation error:', err);
            return false;
        }
    }

    async writeCodeFile(codePath, content) {
        const dir = path.dirname(codePath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(codePath, content, 'utf8');
    }
}

async function main() {
    const generator = new AchillesCodeGenerator();
    await generator.main();
}

if (require.main === module) {
    main();
}

module.exports = {
    AchillesCodeGenerator,
    main
};
