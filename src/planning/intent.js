/**
 * @file intent.js
 * @description Responsible for loading planning context and translating user input into structured sections.
 */

const {
    loadVision,
    loadAllRequirementDetails,
    loadAllSpecDetails,
    loadAllDesignSpecDetails,
    listSpecFiles,
    listDesignSpecFiles
} = require('../services/specsManager');
const {
    ensureStructure,
    loadMemory,
    loadSuggestions,
    loadHistory
} = require('../services/contextStorage');

const SECTION_KEYS = [
    { key: 'info', aliases: ['info', 'information'] },
    { key: 'vision', aliases: ['vision'] },
    { key: 'Requirements', aliases: ['requirements', 'cerinte', 'requirement'] },
    { key: 'Memory', aliases: ['memory', 'memorie'] },
    { key: 'Specs', aliases: ['specs', 'specificatii', 'specifications'] },
    { key: 'Design Specifications', aliases: ['design specifications', 'design-specifications', 'ds', 'designspecs'] },
    { key: 'Ideas', aliases: ['ideas', 'suggestions'] }
];

const SECTION_ORDER = SECTION_KEYS.map((section) => section.key);

function normaliseSectionHeading(line) {
    const trimmed = line.trim().replace(/:$/, '').toLowerCase();
    for (const section of SECTION_KEYS) {
        if (section.aliases.some((alias) => trimmed === alias || trimmed === `${alias}s`)) {
            return section.key;
        }
    }
    return null;
}

function splitIntoSections(input) {
    const sections = {};
    SECTION_ORDER.forEach((key) => {
        sections[key] = [];
    });

    const lines = (input || '').split(/\r?\n/);
    let currentSection = 'info';

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line) {
            sections[currentSection].push('');
            continue;
        }

        const colonIndex = rawLine.indexOf(':');
        const label = colonIndex >= 0 ? rawLine.slice(0, colonIndex) : rawLine;
        const headingKey = normaliseSectionHeading(label);
        if (headingKey) {
            currentSection = headingKey;
            if (colonIndex >= 0) {
                const remaining = rawLine.slice(colonIndex + 1).trim();
                if (remaining) {
                    sections[currentSection].push(remaining);
                }
            }
            continue;
        }

        sections[currentSection].push(rawLine);
    }

    return sections;
}

function ideasFromSection(lines) {
    const ideas = [];
    const ideaRegex = /^[-*]?\s*\[(accepted|rejected|ignored)\]\s*(.+)$/i;
    lines.forEach((line) => {
        const match = line.match(ideaRegex);
        if (match) {
            ideas.push({
                status: match[1].toLowerCase(),
                text: match[2].trim()
            });
        }
    });
    return ideas;
}

function buildMarkdown(sections) {
    const pieces = SECTION_ORDER.map((key) => {
        const body = (sections[key] || []).join('\n').trim();
        return `## ${key}\n${body}`.trim();
    });
    return pieces.join('\n\n');
}

class IntentEngine {
    constructor() {
        this.context = null;
    }

    async loadContext() {
        await ensureStructure();
        const [vision, memory, history, requirementDetails, specDetails, designSpecDetails, specFiles, designSpecFiles, suggestions] = await Promise.all([
            loadVision(),
            loadMemory(),
            loadHistory(),
            loadAllRequirementDetails(),
            loadAllSpecDetails(),
            loadAllDesignSpecDetails(),
            listSpecFiles(),
            listDesignSpecFiles(),
            loadSuggestions()
        ]);

        this.context = {
            vision,
            memory,
            history,
            requirementDetails,
            specDetails,
            designSpecDetails,
            specFiles,
            designSpecFiles,
            suggestions
        };
        return this.context;
    }

    getContext() {
        if (!this.context) {
            throw new Error('Intent context has not been loaded. Call loadContext() first.');
        }
        return this.context;
    }

    analyseInput(input) {
        const sections = splitIntoSections(input);
        const ideas = ideasFromSection(sections['Ideas']);
        const markdown = buildMarkdown(sections);

        return {
            sections,
            markdown,
            ideas,
            intent: 'plan'
        };
    }
}

module.exports = {
    IntentEngine,
    SECTION_ORDER
};
