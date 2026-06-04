import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';

// ─── Utility: Fetch with Timeout ──────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 15_000;
const fetchWithTimeout = async (url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

// Keys that must never be used in path/query replacement (prototype pollution guard)
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitizes tool name to meet Gemini API requirements.
 * Must start with letter/underscore, contain only alphanumerics/underscore/dot/colon/dash, max 64 chars.
 */
const sanitizeToolName = (name) => {
    // Replace invalid characters with underscores
    let sanitized = name.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    // Ensure starts with letter or underscore
    if (!/^[a-zA-Z_]/.test(sanitized)) {
        sanitized = '_' + sanitized;
    }
    return sanitized.substring(0, 64);
};

/**
 * Loads all enabled tools for a user and formats them for AI providers.
 * @param {number} userId 
 * @returns {Promise<Array>} Array of tool definitions
 */
export const getToolsForUser = async (userId) => {
    const tools = await prisma.aiTool.findMany({
        where: { userId, isEnabled: true },
        include: { credential: true } // Include linked credential
    });

    return tools.map(tool => ({
        type: 'function',
        function: {
            name: sanitizeToolName(tool.name),
            description: tool.description,
            parameters: tool.parameters ? JSON.parse(tool.parameters) : {}
        },
        _internal: {
            id: tool.id,
            method: tool.method,
            baseUrl: tool.baseUrl,
            endpoint: tool.endpoint,
            headers: tool.headers ? JSON.parse(tool.headers) : {},
            body: tool.body ? JSON.parse(tool.body) : {},
            // Use Credential if available, otherwise fallback to Tool's inline auth
            auth: tool.credential ? {
                id: tool.credential.id,
                source: 'CREDENTIAL', // Marker to know where to update token
                type: tool.credential.type,
                key: tool.credential.key,
                token: tool.credential.value, // Credential uses 'value' for the token
                location: tool.credential.location,
                refreshUrl: tool.credential.refreshUrl,
                refreshPayload: tool.credential.refreshPayload,
                tokenPath: tool.credential.tokenPath
            } : {
                id: tool.id, // Use tool's ID for tool-specific auth
                source: 'TOOL',
                type: tool.authType,
                key: tool.authKey,
                token: tool.authToken,
                location: tool.authLocation,
                refreshUrl: tool.authRefreshUrl,
                refreshPayload: tool.authRefreshPayload,
                tokenPath: tool.authTokenPath
            }
        }
    }));
};

/**
 * Executes a tool by making the HTTP request.
 * @param {Object} toolInternalConfig - The _internal object from the tool list
 * @param {Object} args - The arguments provided by the AI
 * @returns {Promise<Object>} The API response
 */
export const executeTool = async (toolInternalConfig, args) => {
    // 1. First Attempt
    const result = await runRequest(toolInternalConfig, args);

    // 2. Check for 401 and Auto-Refresh availability
    if (result.status === 401 && toolInternalConfig.auth && toolInternalConfig.auth.refreshUrl) {
        logger.warn(`Tool execution failed with 401. Attempting token refresh for tool ${toolInternalConfig.id}...`);

        const success = await refreshToolToken(toolInternalConfig);

        if (success) {
            // Reload credentials (the refresh function updated the DB, but we need the new token here)
            // Ideally validation returns the new token, but for safety we can just query or pass it back.
            // Simplified: we blindly fetch the updated tool from DB to get the new token or pass it from refreshToolToken.
            // Let's refetch or update the config object in place.

            // To be efficient, let's have refreshToolToken return the new token string.
            toolInternalConfig.auth.token = success;

            logger.info("Token refreshed successfully. Retrying request...");
            return await runRequest(toolInternalConfig, args);
        } else {
            logger.error("Token refresh failed.");
            return result; // Return the original 401
        }
    }

    return result;
};

// Helper to actually run the fetch
const runRequest = async (config, args) => {
    const { method, baseUrl, endpoint, headers, auth } = config;
    let urlString = `${baseUrl}${endpoint}`;

    // Replace path variables (e.g., /users/{id})
    // ✅ Filter dangerous keys to prevent prototype pollution
    for (const [key, value] of Object.entries(args)) {
        if (DANGEROUS_KEYS.has(key)) continue;
        if (urlString.includes(`{${key}}`)) {
            urlString = urlString.replace(`{${key}}`, encodeURIComponent(String(value)));
        }
    }

    // Construct URL Object to handle query params safely
    const url = new URL(urlString);

    // Apply Authentication (Query Params)
    if (auth && auth.type === 'API_KEY' && auth.location === 'QUERY' && auth.key && auth.token) {
        url.searchParams.append(auth.key, auth.token);
    }

    const fetchOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        }
    };

    // Apply Authentication (Headers)
    if (auth && auth.type !== 'NONE' && auth.token) {
        if (auth.type === 'BEARER') {
            fetchOptions.headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'API_KEY' && auth.location === 'HEADER' && auth.key) {
            fetchOptions.headers[auth.key] = auth.token;
        }
    }

    if (method !== 'GET' && method !== 'HEAD') {
        const bodyData = { ...args };
        fetchOptions.body = JSON.stringify(bodyData);
    } else {
        // For GET, add remaining args as query params
        // ✅ Filter dangerous keys to prevent prototype pollution
        for (const [key, value] of Object.entries(args)) {
            if (DANGEROUS_KEYS.has(key)) continue;
            // Only add if not used in path replacement
            if (!endpoint.includes(`{${key}}`)) {
                url.searchParams.append(key, String(value));
            }
        }
    }

    try {
        logger.info(`Tool Execution: ${method} ${url.toString()}`);
        // ✅ Fetch with timeout to prevent hanging requests
        const response = await fetchWithTimeout(url.toString(), fetchOptions, FETCH_TIMEOUT_MS);

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return {
            status: response.status,
            data
        };
    } catch (error) {
        logger.error(`Tool Execution Failed: ${error.message}`);
        return {
            error: error.message
        };
    }
};

/**
 * Refreshes the token for a specific tool.
 * @param {Object} toolConfig - The _internal object from the tool list
 * @returns {Promise<string|null>} New token if success, null otherwise
 */
const refreshToolToken = async (toolConfig) => {
    try {
        const { auth } = toolConfig; // auth object is now well-structured
        const { refreshUrl, refreshPayload, tokenPath, source, id } = auth; // id is the ID of the source entity (Tool or Credential)

        if (!refreshUrl) return null;

        const payload = refreshPayload ? JSON.parse(refreshPayload) : {};

        logger.info(`Refreshing token via ${refreshUrl} for ${source} #${id}`);
        // ✅ Fetch with timeout to prevent token refresh from hanging
        const response = await fetchWithTimeout(refreshUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }, FETCH_TIMEOUT_MS);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Refresh failed with status ${response.status}: ${errText}`);
        }

        const data = await response.json();

        // Extract token using dot notation path
        let newToken = null;
        if (tokenPath) {
            newToken = tokenPath.split('.').reduce((obj, key) => obj && obj[key], data);
        } else {
            newToken = data.access_token || data.token || data.accessToken;
        }

        if (!newToken) {
            throw new Error("Could not find new token in refresh response");
        }

        // Update Database based on Source
        if (source === 'CREDENTIAL') {
            await prisma.aiCredential.update({
                where: { id: parseInt(id) },
                data: { value: newToken }
            });
        } else {
            await prisma.aiTool.update({
                where: { id: parseInt(id) },
                data: { authToken: newToken }
            });
        }

        return newToken;

    } catch (error) {
        logger.error(`Token Refresh Error: ${error.message}`);
        return null;
    }
};
