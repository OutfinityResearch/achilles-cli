/**
 * @file specsManager.js
 * @description Manages specification files.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function getWorkspaceRoot() {
    if (process.env.ACHILLES_WORKSPACE_DIR) {
        return path.resolve(process.env.ACHILLES_WORKSPACE_DIR);
    }
    return process.cwd();
}

function getSpecsDir() {
    return path.join(getWorkspaceRoot(), 'specs');
}

function getReqsDir() {
    return path.join(getSpecsDir(), 'reqs');
}

function stripSpecsPrefix(targetPath) {
    if (targetPath.startsWith('specs/')) {
        return targetPath.slice('specs/'.length);
    }
    if (targetPath.startsWith('./specs/')) {
        return targetPath.slice('./specs/'.length);
    }
    return targetPath;
}

function resolveUnder(base, target) {
    const resolved = path.resolve(base, target);
    if (!resolved.startsWith(path.resolve(base))) {
        throw new Error(`Path ${target} escapes base directory ${base}`);
    }
    return resolved;
}

async function ensureDirForFile(filePath) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function createOrUpdateFile(filePath, content) {
    await ensureDirForFile(filePath);
    await fsp.writeFile(filePath, content, 'utf-8');
}

async function readFileIfExists(filePath) {
    return fsp.readFile(filePath, 'utf-8');
}

async function deleteFileIfExists(filePath) {
    await fsp.rm(filePath, { force: true });
}

async function loadVision() {
    try {
        return await fsp.readFile(path.join(getSpecsDir(), 'vision.md'), 'utf-8');
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return '';
        }
        throw error;
    }
}

async function listRequirements() {
    try {
        return await fsp.readdir(getReqsDir());
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function loadAllRequirements() {
    const files = await listRequirements();
    const reqsDir = getReqsDir();
    return Promise.all(files.map(file => fsp.readFile(path.join(reqsDir, file), 'utf-8')));
}

async function loadAllRequirementDetails() {
    const files = await listRequirements();
    const reqsDir = getReqsDir();
    const details = [];
    for (const file of files) {
        try {
            const content = await fsp.readFile(path.join(reqsDir, file), 'utf-8');
            details.push({
                path: file,
                content
            });
        } catch (error) {
            if (error && error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }
    }
    return details;
}

async function createVision(content) {
    await createOrUpdateFile(path.join(getSpecsDir(), 'vision.md'), content);
}

async function updateVision(content) {
    await createVision(content);
}

async function createRequirement(filename, content) {
    const filePath = resolveUnder(getReqsDir(), filename);
    await createOrUpdateFile(filePath, content);
}

async function updateRequirement(filename, content) {
    await createRequirement(filename, content);
}

async function loadRequirement(filename) {
    const filePath = resolveUnder(getReqsDir(), filename);
    return readFileIfExists(filePath);
}

async function deleteRequirement(filename) {
    const filePath = resolveUnder(getReqsDir(), filename);
    await deleteFileIfExists(filePath);
}

async function createSpecs(specPath, content) {
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(specPath);
    const filePath = resolveUnder(specsDir, relative);
    await createOrUpdateFile(filePath, content);
}

async function updateSpecs(specPath, content) {
    await createSpecs(specPath, content);
}

async function loadSpecs(specPath) {
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(specPath);
    const filePath = resolveUnder(specsDir, relative);
    return readFileIfExists(filePath);
}

async function walkSpecsDirectory(dir, accumulator, root) {
    let entries;
    try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return accumulator;
        }
        throw error;
    }

    for (const entry of entries) {
        if (entry.name === 'reqs') {
            continue;
        }

        const entryPath = path.join(dir, entry.name);
        const relativePath = path.relative(root, entryPath);

        if (entry.isDirectory()) {
            await walkSpecsDirectory(entryPath, accumulator, root);
        } else {
            accumulator.push(relativePath);
        }
    }

    return accumulator;
}

async function listSpecFiles() {
    const specsDir = getSpecsDir();
    const files = await walkSpecsDirectory(specsDir, [], specsDir);
    return files.sort();
}

async function loadAllSpecDetails() {
    const specsDir = getSpecsDir();
    const files = await listSpecFiles();
    const details = [];
    for (const relativePath of files) {
        try {
            const content = await fsp.readFile(path.join(specsDir, relativePath), 'utf-8');
            details.push({
                path: relativePath,
                content
            });
        } catch (error) {
            if (error && error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }
    }
    return details;
}

async function deleteSpecs(specPath) {
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(specPath);
    const filePath = resolveUnder(specsDir, relative);
    await deleteFileIfExists(filePath);
}

async function loadContextForSpecs(specPath) {
    const specsDir = getSpecsDir();
    const reqsDir = getReqsDir();
    const vision = await loadVision();
    const requirementFiles = await listRequirements();
    const requirements = await Promise.all(
        requirementFiles.map(file => fsp.readFile(path.join(reqsDir, file), 'utf-8'))
    );
    const normalized = stripSpecsPrefix(specPath);
    const absoluteSpecPath = path.isAbsolute(specPath) ? specPath : path.join(specsDir, normalized);
    const specContent = await fsp.readFile(absoluteSpecPath, 'utf-8');

    return {
        vision,
        requirements,
        specContent
    };
}

function extractRequirementNumber(fileName) {
    const match = fileName.match(/^REQ#(\d+)/i);
    if (!match) {
        return null;
    }
    return Number.parseInt(match[1], 10);
}

async function getNextRequirementNumber() {
    const files = await listRequirements();
    let maxNumber = 0;
    for (const file of files) {
        const num = extractRequirementNumber(file);
        if (typeof num === 'number' && Number.isFinite(num)) {
            maxNumber = Math.max(maxNumber, num);
        }
    }
    return maxNumber + 1;
}

module.exports = {
    createVision,
    updateVision,
    loadVision,
    listRequirements,
    loadAllRequirements,
    createRequirement,
    updateRequirement,
    loadRequirement,
    deleteRequirement,
    createSpecs,
    updateSpecs,
    loadSpecs,
    deleteSpecs,
    loadContextForSpecs,
    loadAllRequirementDetails,
    listSpecFiles,
    loadAllSpecDetails,
    extractRequirementNumber,
    getNextRequirementNumber
};
