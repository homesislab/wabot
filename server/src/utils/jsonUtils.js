
/**
 * Attempts to fix common JSON syntax errors in string literals,
 * specifically escapes unescaped control characters like newline, tab, return.
 * 
 * @param {string} str - The raw JSON string
 * @returns {string} - The fixed JSON string
 */
export const fixJsonString = (str) => {
    let fixed = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (inString) {
            if (escaped) {
                fixed += char;
                escaped = false;
            } else {
                if (char === '\\') {
                    escaped = true;
                    fixed += char;
                } else if (char === '"') {
                    inString = false;
                    fixed += char;
                } else if (char === '\n') {
                    fixed += '\\n';
                } else if (char === '\r') {
                    fixed += '\\r';
                } else if (char === '\t') {
                    fixed += '\\t';
                } else {
                    fixed += char;
                }
            }
        } else {
            if (char === '"') {
                inString = true;
            }
            fixed += char;
        }
    }
    return fixed;
};
