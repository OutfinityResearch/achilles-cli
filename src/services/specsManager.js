/**
 * @file specsManager.js
 * @description Manages specification files.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const REQUIREMENT_FILENAME_PATTERN = /^R#\d{3}-[a-z0-9\-]+\.req$/i;
const LEGACY_REQUIREMENT_FILENAME_PATTERN = /^REQ#\d+[_-][a-z0-9_\-]+\.(md|req)$/i;
const SPEC_FILENAME_PATTERN = /\.spec$/i;
const DESIGN_SPEC_FILENAME_PATTERN = /\.ds$/i;

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
    const normalizedBase = path.resolve(base);
    if (!resolved.startsWith(normalizedBase)) {
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
    try {
        return await fsp.readFile(filePath, 'utf-8');
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return '';
        }
        throw error;
    }
}

async function deleteFileIfExists(filePath) {
    try {
        await fsp.rm(filePath, { force: true });
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return;
        }
        throw error;
    }
}

async function loadVision() {
    return readFileIfExists(path.join(getSpecsDir(), 'vision.md'));
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

function assertRequirementFilename(filename) {
    if (REQUIREMENT_FILENAME_PATTERN.test(filename)) {
        return;
    }
    if (LEGACY_REQUIREMENT_FILENAME_PATTERN.test(filename)) {
        console.warn(`[specsManager] Requirement filename ${filename} matches legacy pattern. Consider migrating to R#XXX-name.req.`);
        return;
    }
    throw new Error(`Requirement filenames must match R#XXX-name.req. Received: ${filename}`);
}

function assertSpecFilename(specPath) {
    if (!SPEC_FILENAME_PATTERN.test(specPath)) {
        throw new Error(`Specification files must end with .spec. Received: ${specPath}`);
    }
}

function assertDesignSpecFilename(designSpecPath) {
    if (!DESIGN_SPEC_FILENAME_PATTERN.test(designSpecPath)) {
        throw new Error(`Design specification files must end with .ds. Received: ${designSpecPath}`);
    }
}

async function loadAllRequirements() {
    const files = await listRequirements();
    const reqsDir = getReqsDir();
    const contents = [];
    for (const file of files) {
        const content = await readFileIfExists(path.join(reqsDir, file));
        contents.push(content);
    }
    return contents;
}

async function loadAllRequirementDetails() {
    const files = await listRequirements();
    const reqsDir = getReqsDir();
    const details = [];
    for (const file of files) {
        const content = await readFileIfExists(path.join(reqsDir, file));
        details.push({ path: file, content });
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
    assertRequirementFilename(filename);
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
    assertSpecFilename(specPath);
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

async function deleteSpecs(specPath) {
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(specPath);
    const filePath = resolveUnder(specsDir, relative);
    await deleteFileIfExists(filePath);
}

async function createDesignSpec(designSpecPath, content) {
    assertDesignSpecFilename(designSpecPath);
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(designSpecPath);
    const filePath = resolveUnder(specsDir, relative);
    await createOrUpdateFile(filePath, content);
}

async function updateDesignSpec(designSpecPath, content) {
    await createDesignSpec(designSpecPath, content);
}

async function loadDesignSpec(designSpecPath) {
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(designSpecPath);
    const filePath = resolveUnder(specsDir, relative);
    return readFileIfExists(filePath);
}

async function deleteDesignSpec(designSpecPath) {
    const specsDir = getSpecsDir();
    const relative = stripSpecsPrefix(designSpecPath);
    const filePath = resolveUnder(specsDir, relative);
    await deleteFileIfExists(filePath);
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
            accumulator.push(relativePath.replace(/\\/g, '/'));
        }
    }

    return accumulator;
}

async function listSpecFiles() {
    const specsDir = getSpecsDir();
    const files = await walkSpecsDirectory(specsDir, [], specsDir);
    return files.filter((file) => SPEC_FILENAME_PATTERN.test(file)).sort();
}

async function listDesignSpecFiles() {
    const specsDir = getSpecsDir();
    const files = await walkSpecsDirectory(specsDir, [], specsDir);
    return files.filter((file) => DESIGN_SPEC_FILENAME_PATTERN.test(file)).sort();
}

async function loadAllSpecDetails() {
    const specsDir = getSpecsDir();
    const files = await listSpecFiles();
    const details = [];
    for (const relativePath of files) {
        const content = await readFileIfExists(path.join(specsDir, relativePath));
        details.push({
            path: relativePath,
            content
        });
    }
    return details;
}

async function loadAllDesignSpecDetails() {
    const specsDir = getSpecsDir();
    const files = await listDesignSpecFiles();
    const details = [];
    for (const relativePath of files) {
        const content = await readFileIfExists(path.join(specsDir, relativePath));
        details.push({
            path: relativePath,
            content
        });
    }
    return details;
}

async function loadContextForSpecs(specPath) {
    const specsDir = getSpecsDir();
    const reqsDir = getReqsDir();
    const vision = await loadVision();
    const requirementFiles = await listRequirements();
    const requirements = await Promise.all(
        requirementFiles.map((file) => readFileIfExists(path.join(reqsDir, file)))
    );
    const normalized = stripSpecsPrefix(specPath);
    const absoluteSpecPath = path.isAbsolute(specPath) ? specPath : path.join(specsDir, normalized);
    const specContent = await readFileIfExists(absoluteSpecPath);

    const baseWithoutExtension = normalized.endsWith('.spec')
        ? normalized.slice(0, -'.spec'.length)
        : normalized;
    const designSpecs = [];
    const allDesignSpecs = await listDesignSpecFiles();
    const matchingPrefix = `${baseWithoutExtension}.`;
    for (const designRelative of allDesignSpecs) {
        if (designRelative.startsWith(matchingPrefix)) {
            const absoluteDesignPath = path.join(specsDir, designRelative);
            const content = await readFileIfExists(absoluteDesignPath);
            designSpecs.push({ path: designRelative, content });
        }
    }

    return {
        vision,
        requirements,
        specContent,
        designSpecs
    };
}

function extractRequirementNumber(fileName) {
    const normalized = fileName || '';
    const modern = normalized.match(/^R#(\d+)/i);
    if (modern) {
        return Number.parseInt(modern[1], 10);
    }
    const legacy = normalized.match(/^REQ#(\d+)/i);
    if (legacy) {
        return Number.parseInt(legacy[1], 10);
    }
    return null;
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
    createDesignSpec,
    updateDesignSpec,
    loadDesignSpec,
    deleteDesignSpec,
    listSpecFiles,
    listDesignSpecFiles,
    loadAllSpecDetails,
    loadAllDesignSpecDetails,
    loadContextForSpecs,
    loadAllRequirementDetails,
    extractRequirementNumber,
    getNextRequirementNumber
};
