const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

async function promptForConfig() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function ask(question) {
        return new Promise(resolve => rl.question(question, resolve));
    }

    let provider;
    while (!PROVIDERS[provider]) {
        console.log('Select the LLM provider to configure:');
        PROVIDER_LIST.forEach((name, index) => {
            console.log(`${index + 1}. ${name}`);
        });
        const selection = await ask('> ');
        const chosen = PROVIDER_LIST[parseInt(selection, 10) - 1];
        if (chosen && PROVIDERS[chosen]) {
            provider = chosen;
        } else {
            console.log('Invalid selection. Please try again.');
        }
    }

    const providerConfig = PROVIDERS[provider];
    const apiKey = await ask(`Enter your ${provider.toUpperCase()} API key: `);
    const fastModel = await ask(`Enter fast model name (leave empty for ${providerConfig.defaultFastModel}): `);
    const deepModel = await ask(`Enter deep model name (leave empty for ${providerConfig.defaultDeepModel}): `);

    rl.close();
    return {
        provider,
        apiKey,
        fastModel: fastModel || providerConfig.defaultFastModel,
        deepModel: deepModel || providerConfig.defaultDeepModel
    };
}

const PROVIDER_LIST = Object.keys(PROVIDERS);

function createEnvFile(provider, apiKey, fastModel, deepModel) {
    const overrides = {};
    const upperProvider = provider.toUpperCase();
    overrides[`${upperProvider}_API_KEY`] = apiKey;
    if (fastModel) {
        overrides[`${upperProvider}_FAST_MODEL`] = fastModel;
    }
    if (deepModel) {
        overrides[`${upperProvider}_DEEP_MODEL`] = deepModel;
    }

    const lines = [
        '# Achilles CLI - LLM provider configuration',
        '# Fill in the API key and model names for the provider you want to use.',
        '# The configuration service will pick the first provider that defines a key.',
        ''
    ];

    for (const name of PROVIDER_LIST) {
        const { apiKeyVar, fastModelVar, deepModelVar, defaultFastModel, defaultDeepModel } = PROVIDERS[name];
        const apiValue = overrides[apiKeyVar] || '';
        const fastValue = overrides[fastModelVar] || defaultFastModel;
        const deepValue = overrides[deepModelVar] || defaultDeepModel;
        lines.push(`# ${name.toUpperCase()} configuration`);
        lines.push(`${apiKeyVar}=${apiValue}`);
        lines.push(`${fastModelVar}=${fastValue}`);
        lines.push(`${deepModelVar}=${deepValue}`);
        lines.push('');
    }

    fs.writeFileSync('.env', `${lines.join('\n').trim()}\n`, 'utf-8');
}

function pickProviderFromEnv() {
    for (const name of PROVIDER_LIST) {
        const { apiKeyVar } = PROVIDERS[name];
        if (process.env[apiKeyVar]) {
            return name;
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

function applyRuntimeConfig(providerName) {
    const providerConfig = PROVIDERS[providerName];
    const apiKey = process.env[providerConfig.apiKeyVar];
    if (!apiKey) {
        throw new Error(`Missing API key for provider ${providerName}.`);
    }

    process.env.ACHILLES_LLM_PROVIDER = providerName;
    process.env.ACHILLES_LLM_API_KEY = apiKey;
    process.env.ACHILLES_LLM_FAST_MODEL = resolveModel(providerName, 'fast');
    process.env.ACHILLES_LLM_DEEP_MODEL = resolveModel(providerName, 'deep');
}

async function configure() {
    const envPath = findEnvFile();
    if (envPath) {
        console.log(`Found .env file at ${envPath}`);
        loadEnvFile(envPath);
    }

    let providerName = pickProviderFromEnv();

    if (!providerName) {
        console.log('No configured LLM provider found. Starting interactive configuration.');
        const config = await promptForConfig();
        createEnvFile(config.provider, config.apiKey, config.fastModel, config.deepModel);
        process.env[`${config.provider.toUpperCase()}_API_KEY`] = config.apiKey;
        process.env[`${config.provider.toUpperCase()}_FAST_MODEL`] = config.fastModel;
        process.env[`${config.provider.toUpperCase()}_DEEP_MODEL`] = config.deepModel;
        providerName = config.provider;
    }

    applyRuntimeConfig(providerName);

    console.log('[LLMConfiguration] Using provider:', providerName);
    console.log('[LLMConfiguration] Fast model:', process.env.ACHILLES_LLM_FAST_MODEL);
    console.log('[LLMConfiguration] Deep model:', process.env.ACHILLES_LLM_DEEP_MODEL);
}

module.exports = { configure };
