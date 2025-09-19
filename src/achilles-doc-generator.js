// src/achilles-doc-generator.js

const fs = require('fs').promises;
const path = require('path');
const { configure } = require('./services/LLMConfiguration');
const { LLMAgentClient } = require('./services/LLMAgentClient');
const specsManager = require('./services/specsManager');

/**
 * Main function to generate HTML documentation from specifications.
 */
async function main() {
    await configure();
    try {
        const specs = await getAllSpecs();
        const htmlContent = await generateHtml(specs);
        await saveHtml(htmlContent);
        console.log('Documentation generated successfully: specs.html');
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        console.error('Error generating documentation:', message);
    }
}

/**
 * Recursively reads all specification files from the specs directory.
 * @returns {Promise<Array<{path: string, content: string}>>} An array of objects containing file paths and their content.
 */
async function getAllSpecs() {
    const specsDir = path.join(process.cwd(), 'specs');
    const specs = [];

    async function readDir(dir) {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory()) {
                await readDir(fullPath);
            } else if (file.isFile() && (file.name.endsWith('.md') || file.name.endsWith('.specs'))) {
                const content = await fs.readFile(fullPath, 'utf8');
                specs.push({ path: fullPath, content });
            }
        }
    }

    await readDir(specsDir);
    return specs;
}

/**
 * Generates HTML content from the specifications using the LLM.
 * @param {Array<{path: string, content: string}>} specs An array of specification objects.
 * @returns {Promise<string>} The generated HTML content.
 */
async function generateHtml(specs) {
    const context = specs.map(spec => ({
        role: 'system',
        content: `Specification: ${spec.path}\n\n${spec.content}`
    }));

    const taskDescription = `
        Generate a single, self-contained HTML file that includes all the specifications.
        The HTML should have a table of contents for easy navigation.
        Add cross-references between related specifications.
        Ensure the HTML is well-formatted and readable.
    `;

    const llmAgentClient = new LLMAgentClient();
    const response = await llmAgentClient.doTaskDeep(
        'Generating HTML documentation',
        context,
        taskDescription
    );

    if (typeof response === 'string') {
        return response;
    }

    if (response && typeof response === 'object' && typeof response.content === 'string') {
        return response.content;
    }

    throw new Error('LLM response did not include HTML content');
}

/**
 * Saves the generated HTML content to a file.
 * @param {string} htmlContent The HTML content to save.
 */
async function saveHtml(htmlContent) {
    const outputPath = path.join(process.cwd(), 'specs.html');
    await fs.writeFile(outputPath, htmlContent, 'utf8');
}

// Execute the main function if this script is run directly.
if (require.main === module) {
    main();
}

module.exports = {
    main,
    getAllSpecs,
    generateHtml,
    saveHtml
};
