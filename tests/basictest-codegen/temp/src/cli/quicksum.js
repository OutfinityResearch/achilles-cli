const fs = require('fs');
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
    const logLine = new Date().toISOString() + ' - Sum: ' + total + '\n';
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
