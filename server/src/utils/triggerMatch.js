/**
 * Shared trigger / keyword matching used across the three subsystems that
 * previously each implemented their own matching:
 *
 *   - Games            → exact match    (mode 'exact')   — DB unique lookup
 *   - Mini-app router  → prefix match   (mode 'prefix')
 *   - Rule engine      → contains match (mode 'contains')
 *
 * Centralizing normalization (lowercase + trim) and the match modes keeps the
 * three trigger systems consistent and makes it clear which semantics apply.
 */

/** Normalize text for comparison: lowercase + trim. */
export const normalizeText = (text) => (text || '').toLowerCase().trim();

/**
 * Match a single keyword against text.
 * @param {string} text
 * @param {string} keyword
 * @param {'exact'|'prefix'|'contains'} mode
 * @returns {boolean}
 */
export const matchKeyword = (text, keyword, mode = 'contains') => {
    const t = normalizeText(text);
    const k = normalizeText(keyword);
    if (!t || !k) return false;
    switch (mode) {
        case 'exact':
            return t === k;
        case 'prefix':
            return t.startsWith(k);
        case 'contains':
        default:
            return t.includes(k);
    }
};

/**
 * Match text against a list of keywords (or a single keyword).
 * @param {string} text
 * @param {string|string[]} keywords
 * @param {'exact'|'prefix'|'contains'} mode
 * @returns {boolean}
 */
export const matchAnyKeyword = (text, keywords = [], mode = 'contains') => {
    const list = Array.isArray(keywords) ? keywords : [keywords];
    return list.some((kw) => matchKeyword(text, kw, mode));
};
