const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const tempDir = process.argv[2];
const repoRoot = process.argv[3] || path.resolve(__dirname, '../../..');

function writeFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

async function run() {
    console.log('Running smoke test for achilles-codeGenerator...');

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'reqs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'src', 'cli'), { recursive: true });

    writeFile(path.join(tempDir, 'specs', 'vision.md'), '# Vision\nQuickSum CLI helps developers sanity-check simple arithmetic from the terminal using Node.js.');
    writeFile(path.join(tempDir, 'specs', 'reqs', 'REQ#1_quicksum.md'), '# Requirement: QuickSum CLI\n- Implemented in Node.js (CommonJS).\n- Accept any number of numeric arguments.\n- Output their total to stdout.\n- Append the result to a local log file named quicksum.log.');

    const specPath = path.join(tempDir, 'specs', 'src', 'cli', 'quicksum.js.specs');
    writeFile(specPath, '# Module Spec: cli/quicksum.js\n\n## Behaviour\n- Parse numbers from process arguments.\n- Validate inputs are finite numbers.\n- Print the sum and append the message `Sum: <value>` to quicksum.log in the current directory.\n- Log entries must include ISO timestamps.\n- Exit with code 0 on success, 1 on invalid input.\n\n## Implementation Notes\n- Use Node.js built-in modules only.\n- Export functions for reuse: parseArgs, computeTotal, appendLog, runCli.');

    const generatorPath = path.join(repoRoot, 'src', 'achilles-codeGenerator.js');
    const child = spawn('node', [generatorPath], {
        cwd: tempDir,
        env: { ...process.env, ACHILLES_RUN_ONCE: 'true' },
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

    console.log('achilles-codeGenerator smoke test passed.');
}

run().catch((error) => {
    console.error('achilles-codeGenerator smoke test failed:', error);
    process.exitCode = 1;
});
