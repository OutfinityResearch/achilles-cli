// src/achilles-planner.js

const readline = require('readline');
const { LLMAgentClient } = require('./services/LLMAgentClient');
const {
  createSpecs,
  updateSpecs,
  deleteSpecs,
  loadSpecs,
  loadVision,
  loadAllRequirements,
  loadAllRequirementDetails,
  loadAllSpecDetails,
  getNextRequirementNumber,
  extractRequirementNumber
} = require('./services/specsManager');
const { diff } = require('./services/diff');
const { configure } = require('./services/LLMConfiguration');
const {
  ensureStructure: ensureContextStructure,
  loadMemory,
  saveMemory,
  loadHistory,
  saveHistory,
  appendHistoryEntry,
  loadIdeas,
  saveIdeas
} = require('./services/contextStorage');

class AchillesPlanner {
  constructor() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      historySize: 0,
      prompt: '> '
    });
    this.llmAgentClient = null;
    this.diff = diff;
    this.context = {
      vision: '',
      requirements: [],
      requirementDetails: [],
      specDetails: [],
      memory: '',
      history: '',
      ideas: '',
      nextRequirementNumber: 1,
      conversationHistory: []
    };
    this.clarificationQuestions = [];
    this.inputHistory = [];
    this.historyIndex = -1;
    this.draftLine = '';
    this.historyInitialized = false;
    this.pasteBuffer = [];
    this.pasteTimer = null;
    this.pasteDelayMs = 50;
    this.useFastModel = ['1', 'true', 'yes'].includes(String(process.env.ACHILLES_USE_FAST || '').toLowerCase());

    if (this.rl.input && this.rl.input.isTTY) {
      this.rl.input.on('keypress', (str, key) => this.handleKeypress(key));
    }

    this.rl.on('close', () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }
    });
  }

  handleKeypress(key) {
    if (!key) {
      return;
    }

    if (key.ctrl && key.name === 'c') {
      this.rl.close();
      return;
    }

    if (key.name === 'up') {
      this.navigateHistory(-1);
    } else if (key.name === 'down') {
      this.navigateHistory(1);
    }
  }

  navigateHistory(direction) {
    if (!Array.isArray(this.inputHistory) || this.inputHistory.length === 0) {
      return;
    }

    if (this.historyIndex === -1) {
      if (direction > 0) {
        return;
      }
      this.historyIndex = this.inputHistory.length;
      this.draftLine = this.rl.line || '';
    }

    const nextIndex = this.historyIndex + direction;

    if (nextIndex < 0) {
      return;
    }

    if (nextIndex >= this.inputHistory.length) {
      this.historyIndex = -1;
      this.replaceCurrentLine(this.draftLine || '');
      this.draftLine = '';
      return;
    }

    this.historyIndex = nextIndex;
    this.replaceCurrentLine(this.inputHistory[this.historyIndex]);
  }

  replaceCurrentLine(text) {
    this.rl.write(null, { ctrl: true, name: 'u' });
    if (text) {
      this.rl.write(text);
    }
  }

  async recordHistoryEntry(role, content) {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed) {
      return;
    }
    const line = `${role}: ${trimmed}`;
    try {
      await appendHistoryEntry(line);
      const existing = this.context.history ? `${this.context.history}\n` : '';
      this.context.history = `${existing}${line}`;
    } catch (error) {
      console.warn('[Planner] Unable to persist history entry:', error);
    }
  }

  async emitAgentMessage(message) {
    console.log(`Agent: ${message}`);
    this.context.conversationHistory.push({ role: 'assistant', content: message });
    await this.recordHistoryEntry('Agent', message);
  }

  static normalizeResponse(raw) {
    if (typeof raw !== 'string') {
      return '';
    }
    return raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  static isAffirmativeResponse(raw) {
    const normalized = AchillesPlanner.normalizeResponse(raw);
    if (!normalized) {
      return false;
    }
    const positives = new Set([
      'yes',
      'y',
      'yeah',
      'yep',
      'sure',
      'ok',
      'okay',
      'da',
      'd',
      'proceed',
      'approve',
      'accept'
    ]);
    return positives.has(normalized);
  }

  static isNegativeResponse(raw) {
    const normalized = AchillesPlanner.normalizeResponse(raw);
    if (!normalized) {
      return false;
    }
    const negatives = new Set([
      'no',
      'n',
      'nu',
      'stop',
      'reject',
      'cancel'
    ]);
    return negatives.has(normalized);
  }

  static createSnippet(content, maxLength = 240) {
    if (!content) {
      return '';
    }
    const flattened = content.replace(/\s+/g, ' ').trim();
    if (flattened.length <= maxLength) {
      return flattened;
    }
    return `${flattened.slice(0, maxLength)}…`;
  }

  static formatLLMError(error) {
    if (!error) {
      return 'An unknown error occurred while contacting the language model.';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error.message) {
      return error.message;
    }
    return JSON.stringify(error);
  }

  static parseJsonSafely(raw) {
    if (raw === null || raw === undefined) {
      return null;
    }

    const text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);

    const tryParse = (candidate) => {
      if (!candidate) {
        return null;
      }
      try {
        return JSON.parse(candidate);
      } catch (error) {
        return null;
      }
    };

    const fenceRegex = /```json\s*([\s\S]*?)```/gi;
    let match;
    const candidates = [];
    while ((match = fenceRegex.exec(text)) !== null) {
      candidates.push(match[1].trim());
    }
    if (candidates.length === 0) {
      candidates.push(text);
    }

    for (const candidate of candidates) {
      const trimmed = candidate.trim();

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const directParse = tryParse(trimmed);
        if (directParse) {
          return directParse;
        }
      }

      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        continue;
      }

      const primary = trimmed.slice(start, end + 1);
      const parsedPrimary = tryParse(primary);
      if (parsedPrimary) {
        return parsedPrimary;
      }

      let stack = [];
      let firstIndex = -1;
      for (let i = 0; i < trimmed.length; i += 1) {
        const char = trimmed[i];
        if (char === '{') {
          if (stack.length === 0) {
            firstIndex = i;
          }
          stack.push('{');
        } else if (char === '}') {
          if (stack.length > 0) {
            stack.pop();
            if (stack.length === 0 && firstIndex !== -1) {
              const snippet = trimmed.slice(firstIndex, i + 1);
              const parsedSnippet = tryParse(snippet);
              if (parsedSnippet) {
                return parsedSnippet;
              }
            }
          }
        }
      }
    }

    return null;
  }

  async initialize() {
    await configure();
    this.llmAgentClient = new LLMAgentClient();
    console.log(`[Planner] Using ${this.useFastModel ? 'fast' : 'deep'} model for interactions.`);
    await this.refreshContextData();
    await this.initializeHistoryFromLog();
  }

  async refreshContextData() {
    await ensureContextStructure();
    this.context.vision = await loadVision();
    this.context.requirements = await loadAllRequirements();
    this.context.requirementDetails = await loadAllRequirementDetails();
    this.context.specDetails = await loadAllSpecDetails();
    this.context.memory = await loadMemory();
    this.context.history = await loadHistory();
    this.context.ideas = await loadIdeas();
    this.context.nextRequirementNumber = await getNextRequirementNumber();
  }

  async initializeHistoryFromLog() {
    if (this.historyInitialized) {
      return;
    }

    const historyText = this.context.history || '';
    if (!historyText) {
      this.historyInitialized = true;
      return;
    }

    const lines = historyText.split(/\r?\n/);
    let currentEntry = null;

    const flushEntry = () => {
      if (!currentEntry || !currentEntry.content) {
        currentEntry = null;
        return;
      }
      const content = currentEntry.content;
      if (currentEntry.role === 'user') {
        this.context.conversationHistory.push({ role: 'user', content });
        const sanitized = this.sanitizeForHistoryNavigation(content);
        if (sanitized) {
          this.inputHistory.push(sanitized);
        }
      } else if (currentEntry.role === 'assistant') {
        this.context.conversationHistory.push({ role: 'assistant', content });
      }
      currentEntry = null;
    };

    for (const rawLine of lines) {
      const line = rawLine;
      if (!line) {
        if (currentEntry) {
          currentEntry.content += '\n';
        }
        continue;
      }

      if (line.startsWith('User: ')) {
        flushEntry();
        currentEntry = {
          role: 'user',
          content: line.slice('User: '.length)
        };
        continue;
      }

      if (line.startsWith('Agent: ')) {
        flushEntry();
        currentEntry = {
          role: 'assistant',
          content: line.slice('Agent: '.length)
        };
        continue;
      }

      if (currentEntry) {
        currentEntry.content += `\n${line}`;
      }
    }

    flushEntry();

    this.historyIndex = -1;
    this.draftLine = '';
    this.historyInitialized = true;
  }

  async main() {
    try {
      await this.initialize();
      console.log('Achilles Planner is ready. Type "stop" to exit or "start over" to reset the context.');
      this.rl.prompt();

      this.rl.on('line', (input) => {
        this.handleLineInput(input);
      });
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  async getUserInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (input) => {
        resolve(input);
      });
    });
  }

  buildContextMessages() {
    const messages = [];
    const contextSections = [];

    if (this.context.vision) {
      contextSections.push(`Project vision:\n${this.context.vision}`);
    }

    if (Array.isArray(this.context.requirementDetails) && this.context.requirementDetails.length > 0) {
      const requirementSummary = this.context.requirementDetails
        .map((req) => {
          const snippet = AchillesPlanner.createSnippet(req.content);
          return `- ${req.path}${snippet ? `: ${snippet}` : ''}`;
        })
        .join('\n');
      contextSections.push(`Known requirements:\n${requirementSummary}`);
    }

    if (Array.isArray(this.context.requirements) && this.context.requirements.length > 0) {
      contextSections.push(`Requirements content:\n${this.context.requirements.join('\n---\n')}`);
    }

    if (Array.isArray(this.context.specDetails) && this.context.specDetails.length > 0) {
      const specSummary = this.context.specDetails
        .map((spec) => {
          const snippet = AchillesPlanner.createSnippet(spec.content);
          return `- ${spec.path}${snippet ? `: ${snippet}` : ''}`;
        })
        .join('\n');
      contextSections.push(`Known specification documents (excluding requirements):\n${specSummary}`);

      const specBodies = this.context.specDetails
        .map((spec) => `### ${spec.path}\n${spec.content}`)
        .join('\n---\n');
      contextSections.push(`Specification content:\n${specBodies}`);
    }

    if (this.context.memory) {
      contextSections.push(`User memory (preferences, context):\n${this.context.memory}`);
    }

    if (this.context.history) {
      contextSections.push(`Prior conversation history log:\n${this.context.history}`);
    }

    if (this.context.ideas) {
      contextSections.push(`Idea bank for future inspiration:\n${this.context.ideas}`);
    }

    if (this.context.nextRequirementNumber) {
      contextSections.push(`Next available requirement number: REQ#${this.context.nextRequirementNumber}`);
    }

    const systemContent = [
      'You are Achilles Planner, a planning-only assistant. Your sole job is to maintain and evolve project specifications (vision and requirements). Never generate source code or implementation details. Only propose or update specification content.',
      'When information is missing, make the most reasonable and lightweight assumption and clearly state it rather than asking unnecessary questions. Ask for clarification only when continuing would likely cause incorrect specs.',
      'Always suggest the simplest, most helpful next specification updates that move the project forward.',
      'Respond in English, even if the user switches languages. Translate or summarise as needed but keep your answers in English.',
      contextSections.length > 0
        ? contextSections.join('\n\n')
        : 'No project vision or requirements are defined yet.',
      'Maintain continuity with the conversation history. Do not repeat previously answered questions unless the user explicitly requests it.'
    ].join('\n\n');

    messages.push({ role: 'system', content: systemContent });

    const history = Array.isArray(this.context.conversationHistory)
      ? this.context.conversationHistory
      : [];

    for (const entry of history) {
      if (!entry) {
        continue;
      }

      if (entry.role && entry.content !== undefined) {
        messages.push({ role: entry.role, content: entry.content });
        continue;
      }

      if (typeof entry === 'string') {
        if (entry.startsWith('User: ')) {
          messages.push({ role: 'user', content: entry.slice('User: '.length) });
        } else if (entry.startsWith('Agent: ')) {
          messages.push({ role: 'assistant', content: entry.slice('Agent: '.length) });
        } else {
          messages.push({ role: 'assistant', content: entry });
        }
      }
    }

    return messages;
  }

  handleLineInput(input) {
    if (this.pasteTimer) {
      clearTimeout(this.pasteTimer);
    }
    this.pasteBuffer.push(input);
    this.pasteTimer = setTimeout(() => {
      const combined = this.pasteBuffer.join('\n');
      this.pasteBuffer = [];
      this.pasteTimer = null;
      this.processUserInput(combined).catch((error) => {
        console.error('[Planner] Failed to process input:', error);
        this.rl.prompt();
      });
    }, this.pasteDelayMs);
  }

  sanitizeForHistoryNavigation(input) {
    if (typeof input !== 'string') {
      return '';
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('\n')) {
      return trimmed.replace(/\r?\n/g, ' ');
    }
    return trimmed;
  }

  async processUserInput(rawInput) {
    const input = typeof rawInput === 'string' ? rawInput : '';
    const trimmed = input.trim();

    if (!trimmed) {
      this.rl.prompt();
      return;
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'stop') {
      this.rl.close();
      return;
    }

    if (lower === 'start over') {
      this.context.conversationHistory = [];
      console.log('Context has been reset. You can start a new discussion.');
      this.historyIndex = -1;
      this.draftLine = '';
      this.rl.prompt();
      return;
    }

    const historyEntry = this.sanitizeForHistoryNavigation(input);
    if (historyEntry) {
      this.inputHistory.push(historyEntry);
    }
    this.historyIndex = -1;
    this.draftLine = '';
    this.context.conversationHistory.push({ role: 'user', content: input });
    await this.recordHistoryEntry('User', input);

    const lowerInput = trimmed.toLowerCase();
    const requirementHints = ['requirement', 'requirements', 'cerinte', 'cerintele'];
    const specHints = ['spec', 'specs', 'specificatii', 'specificatiile'];
    const informationalHints = ['list', 'show', 'enumerate', 'display', 'listeaza', 'listaza', 'enumera', 'arat'];
    const informationalPattern = /(list(eaz[ai])?(-mi)?|show|display|enumerate|enumera|arat[ai]?)/i;

    const wantsRequirements = requirementHints.some((hint) => lowerInput.includes(hint));
    const wantsSpecs = specHints.some((hint) => lowerInput.includes(hint));
    const isInformational = informationalHints.some((hint) => lowerInput.includes(hint))
      || informationalPattern.test(lowerInput)
      || wantsRequirements
      || wantsSpecs;

    const intent = await this.getIntent(input);

    if (isInformational && intent.action === 'plan') {
      const summary = wantsSpecs ? this.describeKnownSpecs() : this.describeKnownRequirements();
      intent.action = 'answer';
      intent.summary = summary;
      intent.response = summary;
    }

    if (intent.action === 'answer') {
      const answer = intent.response || intent.summary || (wantsSpecs ? this.describeKnownSpecs() : this.describeKnownRequirements());
      await this.emitAgentMessage(answer);
    } else if (intent.action === 'clarify') {
      await this.emitAgentMessage(intent.question);
    } else if (intent.action === 'plan') {
      const result = await this.produceValidatedPlan(intent);
      if (result.error) {
        await this.emitAgentMessage(result.error);
        this.rl.prompt();
        return;
      }

      const plan = result.plan;

      if (!plan || plan.length === 0) {
        const summary = result.summary || intent.summary || 'No specification updates are required for this request.';
        await this.emitAgentMessage(summary);
        this.rl.prompt();
        return;
      }

      const confirmed = await this.confirmActionPlan(plan);
      if (confirmed) {
        await this.executeActionPlan(plan);
        await this.emitAgentMessage('Action plan executed successfully.');
        await this.refreshContextData();
      } else {
        await this.emitAgentMessage('Action plan discarded.');
      }
    }

    if (this.clarificationQuestions.length > 0) {
      console.log('Suggested follow-up questions:');
      this.clarificationQuestions.forEach((question, index) => {
        console.log(`${index + 1}. ${question}`);
      });
      this.clarificationQuestions = [];
    }

    this.rl.prompt();
  }

  describeKnownRequirements() {
    if (!Array.isArray(this.context.requirementDetails) || this.context.requirementDetails.length === 0) {
      return 'There are currently no requirements defined.';
    }
    const summaryLines = this.context.requirementDetails
      .map((req) => `• ${req.path}${req.content ? ` — ${AchillesPlanner.createSnippet(req.content, 120)}` : ''}`);
    return ['Current requirements:', ...summaryLines].join('\n');
  }

  describeKnownSpecs() {
    if (!Array.isArray(this.context.specDetails) || this.context.specDetails.length === 0) {
      return 'There are currently no specification documents beyond the requirements.';
    }
    const summaryLines = this.context.specDetails
      .map((spec) => `• ${spec.path}${spec.content ? ` — ${AchillesPlanner.createSnippet(spec.content, 120)}` : ''}`);
    return ['Current specification documents:', ...summaryLines].join('\n');
  }

  async getIntent(userInput) {
    const taskDescription = `Respond with a JSON object only. Schema:
{
  "action": "answer" | "clarify" | "plan",
  "response"?: string,
  "question"?: string,
  "summary"?: string
}
Guidance:
- Default to "plan" with a concrete proposal that updates specs using reasonable assumptions.
- Use "clarify" only if proceeding would risk incorrect specification changes.
- "answer" should restate your suggestion or provide context, never include code snippets.
- When the user only needs information about existing specs, prefer "plan" with an empty changes list and include a helpful "summary" explaining the answer.
- Favor proposing reasonable assumptions and then confirming them instead of asking multiple questions.
- Prefer creating new specification or requirement files (under specs/ or specs/reqs/) when content does not yet exist; avoid proposing updates to missing files.
- Requirement files must live under specs/reqs/ and follow the naming convention REQ#<number>_<three-to-four_words>.md. Vision updates should target only specs/vision.md.
- If the user requests a list or status overview (e.g., "list", "show", "enumerate"), respond with action "answer" and describe the findings using the summary field; do not propose file changes.
User input: ${userInput}`;

    const reason = ['Analyzing input to determine intent...'];
    const contextMessages = this.buildContextMessages();

    let raw;
    try {
      if (this.useFastModel) {
        raw = await this.llmAgentClient.doTaskFast(reason, contextMessages, taskDescription);
      } else {
        raw = await this.llmAgentClient.doTaskDeep(reason, contextMessages, taskDescription);
      }
    } catch (error) {
      const friendly = AchillesPlanner.formatLLMError(error);
      console.error('[Planner] Intent LLM call failed:', error);
      return {
        action: 'answer',
        response: `Failed to contact the planning model: ${friendly}`
      };
    }

    const parsed = AchillesPlanner.parseJsonSafely(raw);
    if (parsed && parsed.action) {
      return parsed;
    }

    console.warn('[Planner] Unable to parse intent JSON. Raw response:', raw);
    return {
      action: 'answer',
      response: typeof raw === 'string' ? raw : JSON.stringify(raw)
    };
  }

  async generateActionPlan(intent) {
    const taskDescription = `Return a JSON array describing the action plan. Each element must follow one of the schemas below:
- { "action": "create" | "update", "path": "specs/...", "content": string }
- { "action": "delete", "path": "specs/..." }
- { "action": "update_memory", "content": string } // provide the full desired memory text
- { "action": "update_history", "content": string } // provide the full desired history log
- { "action": "update_ideas", "content": string } // provide the full desired idea bank text
Content must be specification text only (no executable code). Favor the simplest useful update, make reasonable assumptions, and confirm later if needed. When introducing new behaviour, prefer creating spec files under specs/ (module specs) or specs/reqs/ (requirements) rather than updating non-existent paths. Requirement files must follow the naming convention REQ#<number>_<three-to-four_words>.md, and vision updates must target only specs/vision.md. If the user only needs information, return [] and describe the answer in intent.summary. Intent: ${JSON.stringify(intent)}`;

    const reason = ['Generating action plan...'];
    const contextMessages = this.buildContextMessages();

    let raw;
    try {
      if (this.useFastModel) {
        raw = await this.llmAgentClient.doTaskFast(reason, contextMessages, taskDescription);
      } else {
        raw = await this.llmAgentClient.doTaskDeep(reason, contextMessages, taskDescription);
      }
    } catch (error) {
      const friendly = AchillesPlanner.formatLLMError(error);
      console.error('[Planner] Planning LLM call failed:', error);
      return {
        plan: [],
        error: `Failed to obtain a plan from the model: ${friendly}`
      };
    }

    const parsed = AchillesPlanner.parseJsonSafely(raw);
    if (Array.isArray(parsed)) {
      return {
        plan: parsed,
        error: null
      };
    }

    console.warn('[Planner] Unable to parse action plan JSON. Raw response:', raw);
    return {
      plan: [],
      error: 'The model did not return a valid plan. Please reformulate the request.'
    };
  }

  async validatePlan(plan) {
    if (!Array.isArray(plan) || plan.length === 0) {
      return {
        valid: true,
        issues: []
      };
    }

    const issues = [];

    const allowedActions = new Set(['create', 'update', 'delete']);
    const contextActions = new Set(['update_memory', 'update_history', 'update_ideas']);

    for (const change of plan) {
      if (!change || typeof change !== 'object') {
        issues.push('The proposed plan contains an invalid entry.');
        continue;
      }

      const { action } = change;
      if (!action) {
        issues.push('A plan item is missing the action field.');
        continue;
      }

      if (contextActions.has(action)) {
        if (typeof change.content !== 'string') {
          issues.push(`Action ${action} must include a "content" field containing the full text.`);
        }
        continue;
      }

      const specPath = change.path;
      if (!specPath) {
        issues.push('A plan item is missing the target file path.');
        continue;
      }

      if (!allowedActions.has(action)) {
        issues.push(`Action ${action} is not supported. Use create, update, or delete.`);
        continue;
      }

      if (typeof specPath !== 'string' || specPath.trim().length === 0) {
        issues.push('A plan item uses an empty file path.');
        continue;
      }

      const normalizedPath = specPath.replace(/\\/g, '/');

      if (!normalizedPath.startsWith('specs/')) {
        issues.push(`Path ${specPath} must start with "specs/".`);
        continue;
      }

      if (action === 'update' || action === 'delete') {
        try {
          await loadSpecs(specPath);
        } catch (error) {
          if (error && error.code === 'ENOENT') {
            issues.push(`File ${specPath} does not exist for action ${action}.`);
          } else {
            issues.push(`Cannot read ${specPath}: ${AchillesPlanner.formatLLMError(error)}`);
          }
        }
      }

      const isRequirementFile = normalizedPath.startsWith('specs/reqs/');
      if (isRequirementFile) {
        const fileName = normalizedPath.split('/').pop() || '';
        const requirementNamePattern = /^REQ#\d+_[A-Za-z0-9]+(?:_[A-Za-z0-9]+){1,3}\.md$/;
        const idNumber = extractRequirementNumber(fileName);
        if (!requirementNamePattern.test(fileName)) {
          issues.push(`File ${specPath} must follow the convention REQ#<number>_<three-to-four_words>.md.`);
        }
        if (typeof idNumber === 'number' && Number.isFinite(idNumber)) {
          if (action === 'create' && idNumber !== this.context.nextRequirementNumber) {
            issues.push(`The new requirement must use index REQ#${this.context.nextRequirementNumber}, not REQ#${idNumber}.`);
          }
          if (action !== 'create' && idNumber >= this.context.nextRequirementNumber) {
            issues.push(`Requirement REQ#${idNumber} does not exist; the highest existing index is ${this.context.nextRequirementNumber - 1}.`);
          }
        }
      }

      if (normalizedPath === 'specs/vision' || normalizedPath.startsWith('specs/vision/')) {
        issues.push('Vision documents must remain in the single specs/vision.md file.');
      }

      if (normalizedPath.startsWith('specs/vision') && normalizedPath !== 'specs/vision.md') {
        issues.push(`Vision updates must target specs/vision.md, not ${specPath}.`);
      }

      if (!isRequirementFile && normalizedPath.endsWith('.md') && normalizedPath.startsWith('specs/reqs/') === false) {
        // acceptable general markdown spec (e.g., docs). No extra rule.
      }

      const validSpecExtensions = ['.md', '.specs'];
      if (!validSpecExtensions.some((ext) => normalizedPath.endsWith(ext))) {
        issues.push(`File ${specPath} must use the .md or .specs extension.`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  async produceValidatedPlan(intent) {
    const maxAttempts = 2;
    let attempt = 0;
    let currentIntent = { ...intent };

    while (attempt < maxAttempts) {
      const result = await this.generateActionPlan(currentIntent);
      if (result.error) {
        return result;
      }

      const validation = await this.validatePlan(result.plan);
      if (validation.valid) {
        return {
          plan: result.plan,
          error: null,
          summary: currentIntent.summary || intent.summary || null
        };
      }

      const issueMessage = `Detected an issue with the proposed plan: ${validation.issues.join(' ')}`;
      await this.emitAgentMessage(issueMessage);

      attempt += 1;
      if (attempt >= maxAttempts) {
        const failure = 'Unable to obtain a valid plan without additional clarification. Please restate the request or specify the target files.';
        return {
          plan: [],
          error: failure,
          summary: null
        };
      }

      this.context.conversationHistory.push({
        role: 'user',
        content: 'Please regenerate the plan, noting that some referenced files do not exist or cannot be accessed.'
      });

      currentIntent = {
        ...intent,
        retryReason: validation.issues.join(' ')
      };
    }

    return {
      plan: [],
      error: 'Unable to obtain a valid plan.',
      summary: null
    };
  }

  async confirmActionPlan(plan) {
    if (!Array.isArray(plan) || plan.length === 0) {
      console.log('No actionable changes were proposed.');
      return false;
    }
    console.log('Proposed changes:\n');

    const printDiff = (title, before, after) => {
      console.log(title);
      const diffOutput = this.diff(before || '', after || '');
      if (diffOutput && diffOutput.trim().length > 0) {
        diffOutput.split('\n').forEach((line) => {
          console.log(`  ${line}`);
        });
      } else {
        console.log('  (no textual differences)');
      }
      console.log('');
    };

    for (const change of plan) {
      if (change.action === 'create') {
        printDiff(`- Creating new spec file '${change.path}'`, '', change.content);
      } else if (change.action === 'update') {
        let oldContent = '';
        try {
          oldContent = await loadSpecs(change.path);
        } catch (error) {
          if (!error || error.code !== 'ENOENT') {
            throw error;
          }
          oldContent = '';
        }
        printDiff(`- Updating spec file '${change.path}'`, oldContent, change.content);
      } else if (change.action === 'delete') {
        console.log(`- Deleting spec file '${change.path}'\n`);
      } else if (change.action === 'update_memory') {
        printDiff('- Updating user memory (.achilles/memory)', this.context.memory, change.content);
      } else if (change.action === 'update_history') {
        printDiff('- Updating conversation history (.achilles/.history/history.md)', this.context.history, change.content);
      } else if (change.action === 'update_ideas') {
        printDiff('- Updating idea bank (.achilles/.ideas/ideas.md)', this.context.ideas, change.content);
      } else {
        console.log(`- Action ${change.action} is not recognized.\n`);
      }
    }

    while (true) {
      const confirmation = await this.getUserInput('Do you approve these changes? (yes/no): ');
      if (AchillesPlanner.isAffirmativeResponse(confirmation)) {
        return true;
      }
      if (AchillesPlanner.isNegativeResponse(confirmation)) {
        return false;
      }
      console.log('Please respond with yes/da or no/nu. If you want changes, reject the plan and describe them in the next step.');
    }
  }

  async executeActionPlan(plan) {
    if (!Array.isArray(plan) || plan.length === 0) {
      return;
    }
    for (const change of plan) {
      if (change.action === 'create') {
        await createSpecs(change.path, change.content);
      } else if (change.action === 'update') {
        await updateSpecs(change.path, change.content);
      } else if (change.action === 'delete') {
        await deleteSpecs(change.path);
      } else if (change.action === 'update_memory') {
        await saveMemory(change.content || '');
        this.context.memory = change.content || '';
      } else if (change.action === 'update_history') {
        await saveHistory(change.content || '');
        this.context.history = change.content || '';
      } else if (change.action === 'update_ideas') {
        await saveIdeas(change.content || '');
        this.context.ideas = change.content || '';
      }
    }
  }
}

const planner = new AchillesPlanner();
planner.main();
