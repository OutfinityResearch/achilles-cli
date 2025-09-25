const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function getWorkspaceRoot() {
  if (process.env.ACHILLES_WORKSPACE_DIR) {
    return path.resolve(process.env.ACHILLES_WORKSPACE_DIR);
  }
  return process.cwd();
}

function getAchillesDir() {
  return path.join(getWorkspaceRoot(), '.achilles');
}

function getMemoryPath() {
  return path.join(getAchillesDir(), 'memory');
}

function getHistoryDir() {
  return path.join(getAchillesDir(), '.history');
}

function getHistoryPath() {
  return path.join(getHistoryDir(), 'history.md');
}

function getLegacyIdeasDir() {
  return path.join(getAchillesDir(), '.ideas');
}

function getLegacyIdeasPath() {
  return path.join(getLegacyIdeasDir(), 'ideas.md');
}

function getSuggestionsDir() {
  return path.join(getAchillesDir(), '.suggestions');
}

function getSuggestionsPath() {
  return path.join(getSuggestionsDir(), 'suggestions.md');
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function ensureStructure() {
  await ensureDir(getAchillesDir());
  await ensureDir(getHistoryDir());
  await ensureDir(getSuggestionsDir());
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

async function writeFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, content, 'utf-8');
}

async function appendFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fsp.appendFile(filePath, content, 'utf-8');
}

async function loadMemory() {
  return readFileIfExists(getMemoryPath());
}

async function saveMemory(content) {
  await writeFile(getMemoryPath(), content || '');
}

async function loadHistory() {
  return readFileIfExists(getHistoryPath());
}

async function saveHistory(content) {
  await writeFile(getHistoryPath(), content || '');
}

async function appendHistoryEntry(entry) {
  const line = entry.endsWith('\n') ? entry : `${entry}\n`;
  await appendFile(getHistoryPath(), line);
}

async function loadSuggestions() {
  const primary = await readFileIfExists(getSuggestionsPath());
  if (primary && primary.trim()) {
    return primary;
  }

  // Backwards compatibility with previous ideas storage.
  const legacy = await readFileIfExists(getLegacyIdeasPath());
  if (!legacy) {
    return '';
  }

  await saveSuggestions(legacy);
  return legacy;
}

async function saveSuggestions(content) {
  await writeFile(getSuggestionsPath(), content || '');
}

module.exports = {
  ensureStructure,
  loadMemory,
  saveMemory,
  loadHistory,
  saveHistory,
  appendHistoryEntry,
  loadSuggestions,
  saveSuggestions
};
