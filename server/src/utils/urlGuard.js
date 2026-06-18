// SSRF-safe outbound URL validation + fetch with timeout.
// Shared guard used by ruleEngine, scheduler, and broadcast API_CALL paths
// so every outbound webhook goes through the same protection.

const ALLOWED_OUTBOUND_PROTOCOLS = new Set(['https:']);
const PRIVATE_IP_REGEX = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc00:|fe80:)/i;

export const validateOutboundUrl = (urlString) => {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error(`Invalid URL: ${urlString}`);
    }
    if (!ALLOWED_OUTBOUND_PROTOCOLS.has(parsed.protocol)) {
        throw new Error(`Protocol not allowed: ${parsed.protocol}`);
    }
    if (PRIVATE_IP_REGEX.test(parsed.hostname)) {
        throw new Error(`Access to internal network is blocked: ${parsed.hostname}`);
    }
    return parsed.toString();
};

// fetch with an AbortController timeout (default 15s) so a slow/hostile
// endpoint can't hang the worker indefinitely.
export const fetchWithTimeout = async (url, options = {}, timeoutMs = 15_000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};
