const { specsContext } = require('../services/specsContext');
const { buildDocumentPrompt, renderDiff } = require('./prompts');
const { parseMarkdownChapters } = require('../services/markdownParser');

const REQUIRED_SECTIONS = {
    vision: [
        { heading: 'Title', level: '#', placeholder: 'Project name.' },
        { heading: 'Purpose', level: '##', placeholder: 'Describe the business purpose and audience.' },
        { heading: 'Technology', level: '##', placeholder: 'List key technologies and platforms.' }
    ],
    requirements: [
        { heading: 'Title', level: '#', placeholder: 'Short requirement name.' },
        { heading: 'Description', level: '##', placeholder: 'Detail the user story or non-functional requirement.' },
        { heading: 'Scope', level: '##', placeholder: '- ALL' }
    ],
    specs: [
        { heading: 'Purpose', level: '#', placeholder: 'Explain the module responsibility.' },
        { heading: 'Public Methods', level: '##', placeholder: '- (describe exported functions)' },
        { heading: 'Dependencies', level: '##', placeholder: '- (list required modules)' }
    ]
};

async function executeDocumentTask({
    task,
    services,
    loadCurrent,
    saveContent,
    deleteContent,
    hintFiles = [],
    onAfterSave,
    onAfterDelete
}) {
    const currentContent = loadCurrent ? await loadCurrent() : '';

    if (task.type === 'delete') {
        if (deleteContent) {
            await deleteContent();
            console.log(`[Planner] Deleted ${task.target}.`);
            if (typeof onAfterDelete === 'function') {
                await onAfterDelete();
            }
        } else {
            console.warn(`[Planner] No delete handler for ${task.target}.`);
        }
        return;
    }

    const contextBundle = await specsContext.buildContext(`${task.description} ${task.target}`, {
        hintFiles: [task.target].concat(hintFiles).filter(Boolean)
    });
    const prompt = buildDocumentPrompt(task, services.plannerContext, contextBundle, currentContent);
    const reason = [`Updating ${task.target}...`];
    const generated = await runModel(services, reason, prompt);

    if (!generated) {
        console.warn(`[Planner] Model did not return content for ${task.target}.`);
        return;
    }

    const newContent = normalizeDocumentContent(task.agent, generated.trim());
    if (!saveContent) {
        console.warn(`[Planner] No save handler for ${task.target}.`);
        return;
    }

    await saveContent(newContent);
    if (typeof onAfterSave === 'function') {
        await onAfterSave(newContent);
    }
    const diffText = renderDiff(currentContent, newContent);
    console.log(diffText);
}

async function runModel(services, reason, prompt) {
    const { llmClient, useFast } = services;
    if (!llmClient) {
        console.warn('[Planner] LLM client is not available.');
        return '';
    }
    try {
        if (useFast) {
            return await llmClient.doTaskFast(reason, [], prompt);
        }
        return await llmClient.doTaskDeep(reason, [], prompt);
    } catch (error) {
        console.error('[Planner] LLM request failed:', error.message || error);
        return '';
    }
}

function normalizeDocumentContent(agent, content) {
    let output = maybeConvertJson(agent, content);
    const required = REQUIRED_SECTIONS[agent];
    if (required) {
        required.forEach((section) => {
            if (!hasSection(output, section)) {
                output = appendSection(output, section);
            }
        });
    }

    if (agent === 'requirements') {
        output = normalizeScopeSection(output);
    }
    if (agent === 'specs') {
        output = normalizeBulletSection(output, 'Public Methods');
        output = normalizeBulletSection(output, 'Dependencies');
    }

    // Minimal sanity check: ensure resulting markdown still parses.
    parseMarkdownChapters(output); // throws on invalid JSON; we ignore result, just validation.

    return output.trim();
}

function maybeConvertJson(agent, content) {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return content;
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return content;
        }
        const sections = REQUIRED_SECTIONS[agent];
        if (!sections) {
            return content;
        }
        const remainingKeys = new Set(Object.keys(parsed));
        let markdown = '';
        sections.forEach((section, index) => {
            const candidateKeys = [section.heading, section.heading.toLowerCase(), section.heading.replace(/\s+/g, '_')];
            let value;
            for (const key of candidateKeys) {
                if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                    value = parsed[key];
                    remainingKeys.delete(key);
                    break;
                }
            }
            const body = stringifySectionValue(value, section.placeholder || 'TODO');
            const spacer = index === 0 ? '' : '\n\n';
            markdown += `${spacer}${section.level} ${section.heading}\n${body}`;
        });

        // Append any leftover fields for reference.
        if (remainingKeys.size > 0) {
            markdown += '\n\n## Additional Notes\n';
            remainingKeys.forEach((key) => {
                const value = stringifySectionValue(parsed[key], '');
                markdown += `- ${key}: ${value}\n`;
            });
        }

        return markdown.trim();
    } catch (error) {
        return content;
    }
}

function stringifySectionValue(value, fallback) {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : fallback;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return fallback;
        }
        return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n');
    }
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join('\n');
    }
    return String(value);
}

function hasSection(content, section) {
    const regex = new RegExp(`^${escapeRegExp(section.level)}\s+${escapeRegExp(section.heading)}\b`, 'm');
    return regex.test(content);
}

function appendSection(content, section) {
    const spacer = content.trim().length ? '\n\n' : '';
    return `${content.trim()}${spacer}${section.level} ${section.heading}\n${section.placeholder || 'TODO'}\n`;
}

function normalizeScopeSection(content) {
    return replaceSection(content, 'Scope', '##', (body) => {
        const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
            return '- ALL';
        }
        return lines.map((line) => (line.startsWith('-') ? line : `- ${line}`)).join('\n');
    });
}

function normalizeBulletSection(content, heading) {
    return replaceSection(content, heading, '##', (body) => {
        const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
            return '- (none provided)';
        }
        return lines.map((line) => (line.startsWith('-') ? line : `- ${line}`)).join('\n');
    });
}

function replaceSection(content, heading, level, transform) {
    const regex = new RegExp(`^${escapeRegExp(level)}\s+${escapeRegExp(heading)}\s*\n([\s\S]*?)(?=^#{1,6}\s|\s*$)`, 'm');
    if (!regex.test(content)) {
        return content;
    }
    return content.replace(regex, (match, body) => {
        const transformed = transform(body || '') || '';
        return `${level} ${heading}\n${transformed}\n`;
    });
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    executeDocumentTask,
    runModel,
    normalizeDocumentContent
};
