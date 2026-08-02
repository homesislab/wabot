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
 *   - multipart/form-data support untuk kirim media binary ke n8n
 */
import { validateOutboundUrl, fetchWithTimeout } from '../utils/urlGuard.js';
import { fixJsonString } from '../utils/jsonUtils.js';
import { logger } from '../config/logger.js';

/**
 * Inject a stored credential into the request headers / URL.
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

/** Parse a response body safely */
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
 * Perform an outbound API call (JSON body).
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

    const safeUrl = validateOutboundUrl(finalUrl);
    const response = await fetchWithTimeout(safeUrl, options);

    if (!response.ok) {
        logger.warn(`[${label}] Non-OK status ${response.status} from ${safeUrl}`);
    }

    const data = await parseResponse(response, label);
    logger.info(`[${label}] Outbound request executed. Status: ${response.status}`);

    return { ok: response.ok, status: response.status, data, replyText: extractReplyText(data) };
};

/**
 * Kirim media ke n8n / webhook sebagai multipart/form-data.
 * Berguna saat media perlu dikirim langsung sebagai binary file
 * (tanpa n8n harus fetch URL dari server).
 *
 * @param {object} opts
 * @param {string} opts.url              - target URL
 * @param {object} opts.jsonFields       - field JSON yang disertakan sebagai string
 * @param {object} opts.mediaInfo        - info media dari extractAndSaveMedia
 * @param {Buffer} opts.mediaBuffer      - binary file media
 * @param {object} [opts.credential]     - stored credential
 * @param {string} [opts.label]
 * @returns {Promise<{ok,status,data,replyText}>}
 */
export const executeApiCallMultipart = async ({
    url,
    jsonFields = {},
    mediaInfo = null,
    mediaBuffer = null,
    credential,
    label = 'API_CALL_MULTIPART',
}) => {
    const reqHeaders = {};
    let finalUrl = applyCredential(url, reqHeaders, credential);

    // Build FormData using Node.js built-in FormData (Node 18+)
    const form = new FormData();

    // Append semua JSON fields sebagai string
    for (const [key, value] of Object.entries(jsonFields)) {
        const strVal = typeof value === 'string' ? value : JSON.stringify(value);
        form.append(key, strVal);
    }

    // Append file jika ada
    if (mediaBuffer && mediaInfo) {
        const filename = mediaInfo.filename || `media_${Date.now()}.${getExt(mediaInfo.mimetype)}`;
        const blob = new Blob([mediaBuffer], { type: mediaInfo.mimetype || 'application/octet-stream' });
        form.append('file', blob, filename);
        form.append('mediaType', mediaInfo.type || 'file');
        form.append('mediaMimetype', mediaInfo.mimetype || 'application/octet-stream');
        if (mediaInfo.caption) form.append('mediaCaption', mediaInfo.caption);
        if (mediaInfo.filename) form.append('mediaFilename', mediaInfo.filename);
    }

    const safeUrl = validateOutboundUrl(finalUrl);
    const response = await fetchWithTimeout(safeUrl, {
        method: 'POST',
        headers: reqHeaders, // jangan set Content-Type manual — fetch otomatis set boundary
        body: form,
    });

    if (!response.ok) {
        logger.warn(`[${label}] Non-OK status ${response.status} from ${safeUrl}`);
    }

    const data = await parseResponse(response, label);
    logger.info(`[${label}] Multipart request executed. Status: ${response.status}`);

    return { ok: response.ok, status: response.status, data, replyText: extractReplyText(data) };
};

const getExt = (mimetype = '') => {
    const map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'application/pdf': 'pdf',
    };
    return map[mimetype] || 'bin';
};
