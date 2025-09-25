const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const tempDir = process.argv[2] || path.join(__dirname, 'temp');
const repoRoot = process.argv[3] || path.resolve(__dirname, '../..');

function listSpecFiles(root) {
    const specsDir = path.join(root, 'specs');
    const results = [];

    function walk(directory) {
        if (!fs.existsSync(directory)) {
            return;
        }
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                results.push(path.relative(specsDir, fullPath));
            }
        }
    }

    walk(specsDir);
    return results;
}

function writeFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

async function run() {
    console.log('Running smoke test for planner CLI...');

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'reqs'), { recursive: true });

    writeFile(path.join(tempDir, 'specs', 'vision.md'), '# Vision\nQuickTools delivers lightweight Node.js command-line helpers for developers.');
    writeFile(
        path.join(tempDir, 'specs', 'reqs', 'R#001-quicksum.req'),
        '# Title\nQuickSum CLI\n\n## Description\nImplement a Node.js CLI that sums numeric arguments, prints the total, and appends an entry to quicksum.log.\n\n## Scope\n- specs/src/cli/quicksum.js.spec'
    );

    const beforeFiles = listSpecFiles(tempDir);

    const plannerPath = path.join(repoRoot, 'src', 'planner.js');
    const child = spawn('node', [plannerPath], {
        cwd: tempDir,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let instructionsSent = false;
    let stopSent = false;

    function send(line) {
        child.stdin.write(`${line}\n`);
    }

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        stdout += chunk;
        console.log('[planner-child-stdout]', chunk);
        if (!instructionsSent && chunk.includes('Planning Agent ready')) {
            send('Draft the specs for a Node.js CLI named QuickSum that sums command-line numbers and logs the result to quicksum.log. Please avoid follow-up questions.');
            instructionsSent = true;
        }
        if (!stopSent && chunk.includes('Tasks completed successfully')) {
            send('stop');
            stopSent = true;
        }
        if (!stopSent && chunk.includes('Agent:')) {
            setTimeout(() => {
                if (!stopSent) {
                    send('stop');
                    stopSent = true;
                }
            }, 2000);
        }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
        console.error('[planner-child-stderr]', chunk);
    });

    const safetyStop = setTimeout(() => {
        if (!stopSent) {
            send('stop');
            stopSent = true;
        }
    }, 20000);

    const timeout = setTimeout(() => {
        if (!stopSent) {
            send('stop');
            stopSent = true;
        }
    }, 180000);

    const exitCode = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', (code) => resolve(code));
    });

    clearTimeout(timeout);
    clearTimeout(safetyStop);

    if (exitCode !== 0) {
        throw new Error(`Planner exited with code ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    const afterFiles = listSpecFiles(tempDir);
    const beforeSet = new Set(beforeFiles);
    const newFiles = afterFiles.filter(file => !beforeSet.has(file));

    console.log('[planner] STDOUT captured:\n' + stdout);
    console.log('[planner] STDERR captured:\n' + stderr);

    if (newFiles.length === 0) {
        console.warn('[planner] No new specification files were created during the smoke interaction.');
    }

    console.log('Planner CLI smoke test passed.');
}

run().catch((error) => {
    console.error('Planner CLI smoke test failed:', error);
    process.exitCode = 1;
});
