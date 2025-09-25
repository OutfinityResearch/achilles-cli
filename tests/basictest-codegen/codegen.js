const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const tempDir = process.argv[2] || path.join(__dirname, 'temp');
const repoRoot = process.argv[3] || path.resolve(__dirname, '../..');

function writeFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

async function run() {
    console.log('Running smoke test for the code generator...');

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'reqs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'src', 'cli'), { recursive: true });

    writeFile(
        path.join(tempDir, 'specs', 'vision.md'),
        '# Title\nQuickSum Demo\n\n## Purpose\nProvide a reference CLI that sums command-line numbers and records the results.\n\n## Technology\nNode.js (CommonJS) with local filesystem storage.'
    );
    writeFile(
        path.join(tempDir, 'specs', 'reqs', 'R#001-quicksum.req'),
        '# Title\nQuickSum CLI Behaviour\n\n## Description\nThe QuickSum CLI must accept any number of numeric arguments, output their total, and append a log entry containing the sum with an ISO timestamp. It must exit with status 1 when inputs are invalid.\n\n## Scope\n- specs/src/cli/quicksum.js.spec'
    );

    const specPath = path.join(tempDir, 'specs', 'src', 'cli', 'quicksum.js.spec');
    writeFile(
        specPath,
        '# Purpose\nImplement the QuickSum CLI utilities for parsing arguments, computing totals, logging, and running the CLI.\n\n## Public Methods\n- `parseArgs(args: string[]): number[]` – Convert CLI arguments to an array of finite numbers, throwing on invalid input.\n- `computeTotal(values: number[]): number` – Return the sum of provided numbers.\n- `appendLog(value: number): Promise<void>` – Append the formatted sum with ISO timestamp to quicksum.log in the cwd.\n- `runCli(): Promise<void>` – Parse process arguments, compute the total, print it, log it, and set the exit code appropriately.\n\n## Dependencies\n- `fs/promises`\n- `path`'
    );

    const generatorPath = path.join(repoRoot, 'src', 'code-generator.js');
    const child = spawn('node', [generatorPath], {
        cwd: tempDir,
        env: { ...process.env, CODEGEN_RUN_ONCE: 'true' },
        stdio: ['pipe', 'pipe', 'pipe']
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

    console.log(`[codegen] Process exited with code ${exitCode}`);

    if (exitCode !== 0) {
        throw new Error(`Code generator exited with code ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    console.log('[codegen] STDOUT captured:\n' + stdout);
    console.log('[codegen] STDERR captured:\n' + stderr);

    const generatedFile = path.join(tempDir, 'src', 'cli', 'quicksum.js');
    if (!fs.existsSync(generatedFile)) {
        throw new Error('Generated CLI file does not exist.');
    }

    const generatedContent = fs.readFileSync(generatedFile, 'utf8');
    assert.ok(generatedContent.length > 0, 'Generated file should not be empty');

    const cliResult = spawnSync(process.execPath, [generatedFile, '10', '20', '5'], { cwd: tempDir, encoding: 'utf8' });

    console.log('[codegen] CLI stdout:\n' + (cliResult.stdout || ''));
    console.log('[codegen] CLI stderr:\n' + (cliResult.stderr || ''));

    assert.strictEqual(cliResult.status, 0, `Generated CLI should exit successfully. STDERR: ${cliResult.stderr}`);

    const logPath = path.join(tempDir, 'quicksum.log');
    assert.ok(fs.existsSync(logPath), 'Expected quicksum.log to be created');
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.match(logContent, /35/, 'Log file should record the computed total');

    console.log('Code generator smoke test passed.');
}

run().catch((error) => {
    console.error('Code generator smoke test failed:', error);
    process.exitCode = 1;
});
