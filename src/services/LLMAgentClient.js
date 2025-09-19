const https = require('https');

const PROVIDER_ENDPOINTS = {
    codestral: {
        chat: 'https://codestral.mistral.ai/v1/chat/completions'
    },
    mistral: {
        chat: 'https://api.mistral.ai/v1/chat/completions'
    },
    gemini: {
        chat: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
    },
    openai: {
        chat: 'https://api.openai.com/v1/chat/completions'
    },
    claude: {
        chat: 'https://api.anthropic.com/v1/messages'
    }
};

function stringifyContext(context) {
    if (context == null) {
        return '';
    }

    if (typeof context === 'string') {
        return context;
    }

    if (Array.isArray(context)) {
        return JSON.stringify(context, null, 2);
    }

    return JSON.stringify(context, null, 2);
}

class LLMAgentClient {
    constructor() {
        this.provider = process.env.ACHILLES_LLM_PROVIDER;
        this.apiKey = process.env.ACHILLES_LLM_API_KEY;
        this.fastModel = process.env.ACHILLES_LLM_FAST_MODEL;
        this.deepModel = process.env.ACHILLES_LLM_DEEP_MODEL;
        this.promptPreviewDelayMs = Number.parseInt(process.env.ACHILLES_PROMPT_PREVIEW_DELAY_MS, 10) || 80;

        if (!this.provider) {
            throw new Error('ACHILLES_LLM_PROVIDER is not configured. Did you call configure()?');
        }

        if (!this.apiKey) {
            throw new Error(`ACHILLES_LLM_API_KEY is missing for provider ${this.provider}.`);
        }

        if (!this.fastModel || !this.deepModel) {
            throw new Error('Fast and deep model names must be configured.');
        }

        this.endpoints = PROVIDER_ENDPOINTS[this.provider];
        if (!this.endpoints) {
            throw new Error(`Provider ${this.provider} is not supported.`);
        }

        console.log(`[LLMAgentClient] provider=${this.provider} fast_model=${this.fastModel} deep_model=${this.deepModel}`);
    }

    getFastModel() {
        return this.fastModel;
    }

    getDeepModel() {
        return this.deepModel;
    }

    getProvider() {
        return this.provider;
    }

    _startThinking(reason) {
        const baseMessages = Array.isArray(reason) ? reason.filter(Boolean) : [reason].filter(Boolean);
        const fallbackMessages = [
            'Reviewing specification context...',
            'Consulting project requirements...',
            'Synthesising the response...',
            'Polishing the final answer...'
        ];
        let messages = baseMessages.length > 0 ? baseMessages : fallbackMessages;

        if (messages.length < fallbackMessages.length) {
            messages = messages.concat(fallbackMessages).slice(0, fallbackMessages.length);
        }

        let index = 0;
        let active = true;
        let timer = null;

        const emit = () => {
            if (!active) {
                return;
            }

            const message = messages[index % messages.length];
            console.log(`[LLM] ${message}`);
            index += 1;
            timer = setTimeout(emit, 2500);
        };

        timer = setTimeout(emit, 0);

        return () => {
            active = false;
            if (timer) {
                clearTimeout(timer);
            }
            console.log('[LLM] Done.');
        };
    }

    async _doApiCall(model, context, taskDescription) {
        console.log(`[LLMAgentClient] Using model ${model}`);

        const messages = Array.isArray(context)
            ? context.slice()
            : [{ role: 'system', content: stringifyContext(context) }];

        messages.push({ role: 'user', content: taskDescription });

        const payload = {
            model,
            messages
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            }
        };

        const url = new URL(this.endpoints.chat);
        options.hostname = url.hostname;
        options.path = url.pathname + (url.search || '');

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                                resolve(parsed.choices[0].message.content);
                                return;
                            }
                            resolve(parsed);
                        } catch (error) {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`API request failed with status code ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(JSON.stringify(payload));
            req.end();
        });
    }

    async doTaskFast(reason, context, taskDescription) {
        return this._executeTask('fast', reason, context, taskDescription);
    }

    async doTaskDeep(reason, context, taskDescription) {
        return this._executeTask('deep', reason, context, taskDescription);
    }

    async _executeTask(mode, reason, context, taskDescription) {
        const queue = [].concat(reason || []);
        if (queue.length === 0) {
            queue.push(mode === 'fast' ? 'Thinking fast...' : 'Thinking deep...');
        }

        const model = mode === 'fast' ? this.fastModel : this.deepModel;
        const apiPromise = this._doApiCall(model, context, taskDescription);

        try {
            await this._streamPromptPreview(taskDescription);
        } catch (error) {
            console.warn('[LLM] Failed to stream prompt preview:', error);
        }

        const stopThinking = this._startThinking(queue);

        try {
            return await apiPromise;
        } finally {
            stopThinking();
        }
    }

    async _streamPromptPreview(taskDescription) {
        const text = typeof taskDescription === 'string' ? taskDescription.trim() : '';
        if (!text) {
            return;
        }

        const tokens = text.split(/(\s+)/).filter((token) => token.length > 0);
        if (tokens.length === 0) {
            return;
        }

        process.stdout.write('[LLM Prompt] ');
        for (const token of tokens) {
            process.stdout.write(token);
            if (/\S/.test(token)) {
                await new Promise((resolve) => setTimeout(resolve, this.promptPreviewDelayMs));
            }
        }
        if (!text.endsWith('\n')) {
            process.stdout.write('\n');
        }
    }
}

module.exports = { LLMAgentClient };
