/**
 * @file specsContext.js
 * @description In-memory contextual cache for specification documents.
 */

const {
    listSpecFiles,
    listDesignSpecFiles,
    loadAllSpecDetails,
    loadAllDesignSpecDetails,
    loadAllRequirementDetails,
    loadSpecs,
    loadDesignSpec
} = require('./specsManager');

class TokenIndex {
    constructor() {
        this.docs = new Map();
        this.termMap = new Map();
    }

    add(id, tokens) {
        const unique = new Set(tokens);
        this.docs.set(id, unique);
        unique.forEach((token) => {
            if (!this.termMap.has(token)) {
                this.termMap.set(token, new Set());
            }
            this.termMap.get(token).add(id);
        });
    }

    update(id, tokens) {
        this.remove(id);
        this.add(id, tokens);
    }

    remove(id) {
        const existing = this.docs.get(id);
        if (!existing) {
            return;
        }
        existing.forEach((token) => {
            const bucket = this.termMap.get(token);
            if (bucket) {
                bucket.delete(id);
                if (bucket.size === 0) {
                    this.termMap.delete(token);
                }
            }
        });
        this.docs.delete(id);
    }

    clear() {
        this.docs.clear();
        this.termMap.clear();
    }

    search(queryTokens, limit = 5) {
        const scores = new Map();
        queryTokens.forEach((token) => {
            const bucket = this.termMap.get(token);
            if (!bucket) {
                return;
            }
            bucket.forEach((id) => {
                scores.set(id, (scores.get(id) || 0) + 1);
            });
        });

        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, limit)
            .map(([id, score]) => ({ id, score }));
    }
}

class SpecsContext {
    constructor() {
        this.specs = new Map();
        this.designSpecs = new Map();
        this.requirements = [];
        this.loaded = false;
        this.specIndex = new TokenIndex();
        this.designSpecIndex = new TokenIndex();
        this.requirementIndex = new TokenIndex();
    }

    async refresh() {
        const [specDetails, designDetails, requirementDetails] = await Promise.all([
            loadAllSpecDetails(),
            loadAllDesignSpecDetails(),
            loadAllRequirementDetails()
        ]);

        this.specs.clear();
        this.specIndex.clear();
        specDetails.forEach(({ path, content }) => {
            this.specs.set(path, content);
            this.specIndex.add(path, this.tokenize(`${path} ${content}`));
        });

        this.designSpecs.clear();
        this.designSpecIndex.clear();
        designDetails.forEach(({ path, content }) => {
            this.designSpecs.set(path, content);
            this.designSpecIndex.add(path, this.tokenize(`${path} ${content}`));
        });

        this.requirements = requirementDetails;
        this.requirementIndex.clear();
        requirementDetails.forEach(({ path, content }) => {
            this.requirementIndex.add(path, this.tokenize(`${path} ${content}`));
        });
        this.loaded = true;
    }

    async ensureLoaded() {
        if (!this.loaded) {
            await this.refresh();
        }
    }

    tokenize(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s\-_.]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    computeScore(textTokens, targetTokens) {
        if (textTokens.length === 0 || targetTokens.length === 0) {
            return 0;
        }

        let score = 0;
        const targetMap = new Map();
        targetTokens.forEach((token) => {
            targetMap.set(token, (targetMap.get(token) || 0) + 1);
        });

        textTokens.forEach((token) => {
            if (targetMap.has(token)) {
                score += targetMap.get(token);
            }
        });

        return score;
    }

    rankEntries(text, entries, options = {}, index = null) {
        const queryTokens = this.tokenize(text);
        const hints = new Set((options.hintFiles || []).map((file) => file.toLowerCase()));
        const results = [];
        const candidateScores = new Map();

        if (index && queryTokens.length > 0) {
            const indexed = index.search(queryTokens, (options.limit || 5) * 2);
            indexed.forEach(({ id, score }) => {
                candidateScores.set(id, (candidateScores.get(id) || 0) + score * 2);
            });
        }

        entries.forEach(({ path, content }) => {
            const targetTokens = this.tokenize(`${path} ${content}`);
            const simpleScore = this.computeScore(queryTokens, targetTokens);
            if (simpleScore > 0 || candidateScores.has(path)) {
                candidateScores.set(path, (candidateScores.get(path) || 0) + simpleScore);
            }
            if (hints.has(path.toLowerCase())) {
                candidateScores.set(path, (candidateScores.get(path) || 0) + 5);
            }
        });

        candidateScores.forEach((score, path) => {
            const entry = entries.find((item) => item.path === path);
            if (entry) {
                results.push({ path, content: entry.content, score });
            }
        });

        results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
        const limit = options.limit || 5;
        return results.slice(0, limit);
    }

    async getRelevantSpecsForText(text, options = {}) {
        await this.ensureLoaded();
        const entries = Array.from(this.specs.entries()).map(([path, content]) => ({ path, content }));
        const ranked = this.rankEntries(text, entries, options, this.specIndex);
        ranked.forEach((entry) => {
            console.log(`[SpecsContext] Considering spec ${entry.path} (score=${entry.score})`);
        });
        return ranked;
    }

    async getRelevantDesignSpecsForText(text, options = {}) {
        await this.ensureLoaded();
        const entries = Array.from(this.designSpecs.entries()).map(([path, content]) => ({ path, content }));
        const ranked = this.rankEntries(text, entries, options, this.designSpecIndex);
        ranked.forEach((entry) => {
            console.log(`[SpecsContext] Considering design spec ${entry.path} (score=${entry.score})`);
        });
        return ranked;
    }

    async getRelevantRequirementsForText(text, options = {}) {
        await this.ensureLoaded();
        const ranked = this.rankEntries(text, this.requirements, options, this.requirementIndex);
        ranked.forEach((entry) => {
            console.log(`[SpecsContext] Considering requirement ${entry.path} (score=${entry.score})`);
        });
        return ranked;
    }

    async buildContext(text, options = {}) {
        const [specs, designSpecs, requirements] = await Promise.all([
            this.getRelevantSpecsForText(text, options),
            this.getRelevantDesignSpecsForText(text, options),
            this.getRelevantRequirementsForText(text, options)
        ]);

        return { specs, designSpecs, requirements };
    }

    async reloadSpec(path) {
        const normalized = path.replace(/\\/g, '/');
        const content = await loadSpecs(normalized);
        this.specs.set(normalized, content);
        this.specIndex.update(normalized, this.tokenize(`${normalized} ${content}`));
    }

    async reloadDesignSpec(path) {
        const normalized = path.replace(/\\/g, '/');
        const content = await loadDesignSpec(normalized);
        this.designSpecs.set(normalized, content);
        this.designSpecIndex.update(normalized, this.tokenize(`${normalized} ${content}`));
    }

    invalidateAll() {
        this.loaded = false;
        this.specIndex.clear();
        this.designSpecIndex.clear();
        this.requirementIndex.clear();
    }
}

const specsContext = new SpecsContext();

module.exports = {
    specsContext,
    SpecsContext
};
