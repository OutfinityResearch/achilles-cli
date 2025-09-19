/**
 * @file diff.js
 * @description A service to display changes between two strings.
 */

/**
 * Displays a diff between two strings.
 * @param {string} oldString - The original string.
 * @param {string} newString - The new string.
 * @returns {string} - The formatted diff string.
 */
function diff(oldString, newString) {
    // A simple implementation for now
    const oldLines = oldString.split('\n');
    const newLines = newString.split('\n');
    let result = '';

    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
        if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
            result += `  ${oldLines[i]}\n`;
            i++;
            j++;
        } else {
            if (i < oldLines.length) {
                result += `- ${oldLines[i]}\n`;
                i++;
            }
            if (j < newLines.length) {
                result += `+ ${newLines[j]}\n`;
                j++;
            }
        }
    }

    return result;
}

module.exports = { diff };
