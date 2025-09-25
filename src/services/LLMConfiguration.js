const fs = require('fs');
const path = require('path');

const PROVIDERS = {
    codestral: {
        apiKeyVar: 'CODESTRAL_API_KEY',
        fastModelVar: 'CODESTRAL_FAST_MODEL',
        deepModelVar: 'CODESTRAL_DEEP_MODEL',
        defaultFastModel: 'codestral-latest',
        defaultDeepModel: 'codestral-latest'
    },
    mistral: {
        apiKeyVar: 'MISTRAL_API_KEY',
        fastModelVar: 'MISTRAL_FAST_MODEL',
        deepModelVar: 'MISTRAL_DEEP_MODEL',
        defaultFastModel: 'mistral-small-latest',
        defaultDeepModel: 'mistral-large-latest'
    },
    gemini: {
        apiKeyVar: 'GEMINI_API_KEY',
        fastModelVar: 'GEMINI_FAST_MODEL',
        deepModelVar: 'GEMINI_DEEP_MODEL',
        defaultFastModel: 'gemini-1.5-pro',
        defaultDeepModel: 'gemini-1.5-pro'
    },
    openai: {
        apiKeyVar: 'OPENAI_API_KEY',
        fastModelVar: 'OPENAI_FAST_MODEL',
        deepModelVar: 'OPENAI_DEEP_MODEL',
        defaultFastModel: 'gpt-4.1-mini',
        defaultDeepModel: 'gpt-4.1'
    },
    claude: {
        apiKeyVar: 'CLAUDE_API_KEY',
        fastModelVar: 'CLAUDE_FAST_MODEL',
        deepModelVar: 'CLAUDE_DEEP_MODEL',
        defaultFastModel: 'claude-3.5-sonnet',
        defaultDeepModel: 'claude-3.5-sonnet'
    }
};

function findEnvFile() {
    let currentDir = process.cwd();
    while (currentDir !== path.parse(currentDir).root) {
        const envPath = path.join(currentDir, '.env');
        if (fs.existsSync(envPath)) {
            return envPath;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

const PROVIDER_LIST = Object.keys(PROVIDERS);

function loadEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        if (key && value) {
            process.env[key] = value;
        }
    }
}

function createEnvTemplate(overrides = {}) {
    const lines = [
        '# Achilles CLI - LLM provider configuration',
        '# Provide API keys and model names for at least one provider below.',
        '# The planner will use the first provider that has an API key configured.',
        ''
    ];

    for (const name of PROVIDER_LIST) {
        const { apiKeyVar, fastModelVar, deepModelVar, defaultFastModel, defaultDeepModel } = PROVIDERS[name];
        const upper = name.toUpperCase();
        const apiValue = overrides[apiKeyVar] || '';
        const fastValue = overrides[fastModelVar] || defaultFastModel;
        const deepValue = overrides[deepModelVar] || defaultDeepModel;
        lines.push(`# ${upper} configuration`);
        lines.push(`${apiKeyVar}=${apiValue}`);
        lines.push(`${fastModelVar}=${fastValue}`);
        lines.push(`${deepModelVar}=${deepValue}`);
        lines.push('');
    }

    return `${lines.join('\n').trim()}\n`;
}

function pickProviderFromEnv(requireModels = false) {
    for (const name of PROVIDER_LIST) {
        const { apiKeyVar, fastModelVar, deepModelVar, defaultFastModel, defaultDeepModel } = PROVIDERS[name];
        const apiKey = process.env[apiKeyVar];
        if (!apiKey) {
            continue;
        }

        const fastModel = process.env[fastModelVar] || (requireModels ? null : defaultFastModel);
        const deepModel = process.env[deepModelVar] || (requireModels ? null : defaultDeepModel);
        if (!requireModels || (fastModel && deepModel)) {
            return {
                name,
                apiKey,
                fastModel,
                deepModel
            };
        }
    }
    return null;
}

function resolveModel(providerName, variant) {
    const providerConfig = PROVIDERS[providerName];
    const key = variant === 'fast' ? providerConfig.fastModelVar : providerConfig.deepModelVar;
    const fallback = variant === 'fast' ? providerConfig.defaultFastModel : providerConfig.defaultDeepModel;
    return process.env[key] || fallback;
}

function applyRuntimeConfig(provider) {
    const providerConfig = PROVIDERS[provider.name];
    process.env.ACHILLES_LLM_PROVIDER = provider.name;
    process.env.ACHILLES_LLM_API_KEY = provider.apiKey;
    process.env.ACHILLES_LLM_FAST_MODEL = provider.fastModel || resolveModel(provider.name, 'fast');
    process.env.ACHILLES_LLM_DEEP_MODEL = provider.deepModel || resolveModel(provider.name, 'deep');
}

function ensureEnvTemplateExists() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        return envPath;
    }

    const template = createEnvTemplate();
    fs.writeFileSync(envPath, template, 'utf-8');
    return envPath;
}

function verifyConfiguration() {
    const provider = pickProviderFromEnv(true);
    if (provider) {
        return provider;
    }

    const envPath = ensureEnvTemplateExists();
    const message = [
        'LLM configuration is missing.',
        'An .env template has been generated with all supported providers.',
        `Please update ${envPath} with your API keys and preferred fast/deep models.`,
        'After updating the file, re-run the planner.'
    ];
    const error = new Error(message.join(' '));
    error.code = 'LLM_CONFIG_MISSING';
    throw error;
}

async function configure() {
    const envPath = findEnvFile();
    if (envPath) {
        console.log(`Found .env file at ${envPath}`);
        loadEnvFile(envPath);
    }

    const provider = verifyConfiguration();
    applyRuntimeConfig(provider);

    console.log('[LLMConfiguration] Using provider:', provider.name);
    console.log('[LLMConfiguration] Fast model:', process.env.ACHILLES_LLM_FAST_MODEL);
    console.log('[LLMConfiguration] Deep model:', process.env.ACHILLES_LLM_DEEP_MODEL);
}

module.exports = { configure };
