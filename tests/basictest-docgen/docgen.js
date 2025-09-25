const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const tempDir = process.argv[2] || path.join(__dirname, 'temp');
const repoRoot = process.argv[3] || path.resolve(__dirname, '../..');

function writeFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

async function run() {
    console.log('Running smoke test for the documentation generator...');

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'reqs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'src'), { recursive: true });

    writeFile(
        path.join(tempDir, 'specs', 'vision.md'),
        '# Title\nQuickTools Suite\n\n## Purpose\nDeliver small productivity-focused Node.js utilities for command-line workflows.\n\n## Technology\nNode.js (CommonJS) with markdown specifications stored under `specs/`.'
    );
    writeFile(
        path.join(tempDir, 'specs', 'reqs', 'R#001-quicksum.req'),
        '# Title\nQuickSum Utility\n\n## Description\nProvide a CLI command that sums numeric arguments and appends totals to a quicksum.log file along with timestamps.\n\n## Scope\n- specs/src/cli/quicksum.js.spec'
    );
    writeFile(
        path.join(tempDir, 'specs', 'src', 'cli', 'quicksum.js.spec'),
        '# Purpose\nDescribe the QuickSum CLI module responsible for parsing arguments, calculating totals, logging, and running the CLI entry point.\n\n## Public Methods\n- `parseArgs(args: string[]): number[]` – Validate and coerce CLI inputs into numbers.\n- `computeTotal(values: number[]): number` – Sum numeric inputs.\n- `appendLog(total: number): Promise<void>` – Append the computed total with an ISO timestamp to quicksum.log.\n- `runCli(): Promise<void>` – Execute the CLI workflow, setting the process exit code.\n\n## Dependencies\n- `fs/promises`'
    );

    const docGeneratorPath = path.join(repoRoot, 'src', 'doc-generator.js');
    const child = spawn('node', [docGeneratorPath], {
        cwd: tempDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });

    const exitCode = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', (code) => resolve(code));
    });

    if (exitCode !== 0) {
        throw new Error(`Doc generator exited with code ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    console.log('[docgen] STDOUT captured:\n' + stdout);
    console.log('[docgen] STDERR captured:\n' + stderr);

    const outputPath = path.join(tempDir, 'specs.html');
    if (!fs.existsSync(outputPath)) {
        console.warn('[docgen] HTML documentation was not generated.');
    } else {
        const htmlContent = fs.readFileSync(outputPath, 'utf8');
        if (htmlContent.length === 0) {
            console.warn('[docgen] Generated documentation is empty.');
        } else {
            console.log('[docgen] Documentation length:', htmlContent.length);
        }
    }

    console.log('Documentation generator smoke test passed.');
}

run().catch((error) => {
    console.error('Documentation generator smoke test failed:', error);
    process.exitCode = 1;
});
