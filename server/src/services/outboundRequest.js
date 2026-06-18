/**
 * Outbound HTTP service — single entry point for all outgoing webhook / API_CALL
 * requests (rule engine auto-reply, scheduler, and broadcast).
 *
 * Centralizes:
 *   - credential injection (BEARER / HEADER / QUERY)
 *   - JSON payload normalization (auto-fix invalid JSON)
 *   - SSRF protection (public HTTPS only) via urlGuard
 *   - request timeout via urlGuard
 *   - safe response parsing (JSON when possible, text otherwise)
 *
 * Previously this logic was duplicated in ruleEngine, schedulerService, and
 * messageController, each with subtle differences.
 */
import { validateOutboundUrl, fetchWithTimeout } from '../utils/urlGuard.js';
import { fixJsonString } from '../utils/jsonUtils.js';
import { logger } from '../config/logger.js';

/**
 * Inject a stored credential into the request headers / URL.
 * BEARER is handled first (independent of location), then HEADER / QUERY placement.
 * QUERY key & value are URL-encoded so special characters can't break the URL.
 * @returns {string} the (possibly modified) URL
 */
export const applyCredential = (url, headers, credential) => {
    if (!credential) return url;
    if (credential.type === 'BEARER') {
        headers['Authorization'] = `Bearer ${credential.value}`;
    } else if (credential.location === 'HEADER' && credential.key) {
        headers[credential.key] = credential.value;
    } else if (credential.location === 'QUERY' && credential.key) {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}${encodeURIComponent(credential.key)}=${encodeURIComponent(credential.value)}`;
    }
    return url;
};

/** Parse a response body safely: JSON only when the body really is JSON, else as text. */
const parseResponse = async (response, label) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch (e) {
            logger.warn(`[${label}] Failed to parse JSON response: ${e.message}`);
            return null;
        }
    }
    const bodyText = await response.text().catch(() => '');
    return bodyText ? { message: bodyText } : null;
};

/** Derive a human-friendly reply string from a parsed response body. */
export const extractReplyText = (data) => {
    if (data && data.message !== undefined && data.message !== null) {
        return typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    }
    return JSON.stringify(data);
};

/**
 * Perform an outbound API call.
 * @param {object}  opts
 * @param {string}  opts.url        - target URL (may contain pre-substituted variables)
 * @param {string} [opts.method]    - HTTP method (default GET)
 * @param {string} [opts.payload]   - raw JSON payload string; auto-validated/fixed
 * @param {string} [opts.body]      - already-serialized body (takes precedence over payload)
 * @param {object} [opts.credential]- stored credential { type, location, key, value }
 * @param {object} [opts.headers]   - extra headers
 * @param {string} [opts.label]     - log label
 * @param {boolean}[opts.fixJson]   - attempt to repair invalid JSON payloads (default true)
 * @returns {Promise<{ok:boolean,status:number,data:any,replyText:string}>}
 */
export const executeApiCall = async ({
    url,
    method = 'GET',
    payload,
    body,
    credential,
    headers = {},
    label = 'API_CALL',
    fixJson = true,
}) => {
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let finalUrl = applyCredential(url, reqHeaders, credential);

    const options = { method, headers: reqHeaders };
    if (method !== 'GET' && method !== 'HEAD') {
        if (body !== undefined) {
            options.body = body;
        } else if (payload) {
            if (fixJson) {
                try {
                    JSON.parse(payload);
                    options.body = payload;
                } catch (e) {
                    const fixed = fixJsonString(payload);
                    try {
                        options.body = JSON.stringify(JSON.parse(fixed));
                        logger.info(`[${label}] Fixed invalid JSON payload`);
                    } catch (e2) {
                        logger.warn(`[${label}] JSON parse error, sending payload as-is: ${e.message}`);
                        options.body = payload;
                    }
                }
            } else {
                options.body = payload;
            }
        }
    }

    // SSRF guard — throws on private/non-HTTPS targets
    const safeUrl = validateOutboundUrl(finalUrl);
    const response = await fetchWithTimeout(safeUrl, options);

    if (!response.ok) {
        logger.warn(`[${label}] Non-OK status ${response.status} from ${safeUrl}`);
    }

    const data = await parseResponse(response, label);
    logger.info(`[${label}] Outbound request executed. Status: ${response.status}`);

    return { ok: response.ok, status: response.status, data, replyText: extractReplyText(data) };
};
