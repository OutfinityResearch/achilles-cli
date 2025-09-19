const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const tempDir = process.argv[2];
const repoRoot = process.argv[3] || path.resolve(__dirname, '../../..');

function writeFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

async function run() {
    console.log('Running smoke test for achilles-doc-generator...');

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'reqs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'src'), { recursive: true });

    writeFile(path.join(tempDir, 'specs', 'vision.md'), '# Vision\nQuickTools provides tiny Node.js utilities to make command-line workflows easier.');
    writeFile(path.join(tempDir, 'specs', 'reqs', 'REQ#1_quicksum.md'), '# Requirement: QuickSum\n- Summarise command-line numbers and log the totals using Node.js.');
    writeFile(path.join(tempDir, 'specs', 'src', 'cli.quicksum.js.specs'), '# Module Spec: cli/quicksum.js\n- Run as `node quicksum.js <numbers>`\n- Output total and append to quicksum.log');

    const docGeneratorPath = path.join(repoRoot, 'src', 'achilles-doc-generator.js');
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

    console.log('achilles-doc-generator smoke test passed.');
}

run().catch((error) => {
    console.error('achilles-doc-generator smoke test failed:', error);
    process.exitCode = 1;
});
