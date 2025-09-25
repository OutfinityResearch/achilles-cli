const { diff } = require('../services/diff');

const FORMAT_RULES = {
    vision: 'The vision file must contain the chapters "Title", "Purpose", and "Technology".',
    requirements: 'Requirement files use the chapters "Title", "Description", and "Scope". Scope lists impacted files (ALL, wildcards, or concrete .spec/.ds paths).',
    specs: 'Specification files describe a source file. Include chapters "Purpose", "Public Methods" (bullet list), and "Dependencies" (bullet list).',
    designSpecs: 'Design specification files provide detailed instructions for a single function. Use markdown with any necessary subsections or code examples.',
    memory: 'Memory is a free-form markdown list of important reminders for the project. Keep it concise.',
    suggestions: 'Suggestions are stored as bullet points formatted as `- [status] target: details`. Status is accepted | rejected | ignored.'
};

function summariseManagedFiles(context) {
    const requirementList = context.requirementDetails.map((req) => `- requirements/${req.path}`).join('\n') || '- (none)';
    const specsList = context.specDetails.map((spec) => `- specs/${spec.path}`).join('\n') || '- (none)';
    const designList = context.designSpecDetails.map((spec) => `- specs/${spec.path}`).join('\n') || '- (none)';
    return `Requirements files:\n${requirementList}\n\nSpecs files:\n${specsList}\n\nDesign specs:\n${designList}`;
}

function buildDocumentPrompt(task, plannerContext, contextualDocs, existingContent) {
    const managedFiles = summariseManagedFiles(plannerContext);
    const requirementsContext = contextualDocs.requirements
        .map((req) => `### Requirement: ${req.path}\n${req.content}`)
        .join('\n\n') || '(no relevant requirements)';
    const specsContextSection = contextualDocs.specs
        .map((spec) => `### Spec: ${spec.path}\n${spec.content}`)
        .join('\n\n') || '(no relevant specs)';
    const designSpecsContextSection = contextualDocs.designSpecs
        .map((spec) => `### Design Spec: ${spec.path}\n${spec.content}`)
        .join('\n\n') || '(no relevant design specs)';

    const formatRules = FORMAT_RULES[task.agent] || 'Follow the repository conventions.';

    const lines = [
        'You are a senior business analyst.',
        `Your general rules: ${plannerContext.memory.trim() || 'No additional memory recorded.'}`,
        `The vision of the project is "${(plannerContext.vision || 'project vision').trim()}".`,
        '',
        'You are in charge of managing the following files in markdown format:',
        managedFiles,
        '',
        'File naming and formatting rules:',
        '- Requirements: R#XXX-name.req with chapters Title, Description, Scope.',
        '- Specs: mirror source structure, file.ext.spec with Purpose, Public Methods, Dependencies.',
        '- Design specs: <spec>.FunctionName.ds with implementation-level guidance.',
        '- Vision: specs/vision.md with Title, Purpose, Technology.',
        '',
        'Relevant context for this task gathered via specsContext.js:',
        requirementsContext,
        '',
        specsContextSection,
        '',
        designSpecsContextSection,
        '',
        'Current content of the target file:',
        existingContent ? existingContent : '(file does not exist yet)',
        '',
        `Task description: ${task.description || task.raw}`,
        '',
        `Produce the full updated content for ${task.target}. ${formatRules}`
    ];

    return lines.join('\n');
}

function renderDiff(oldContent, newContent) {
    return diff(oldContent, newContent);
}

module.exports = {
    buildDocumentPrompt,
    summariseManagedFiles,
    renderDiff,
    FORMAT_RULES
};
