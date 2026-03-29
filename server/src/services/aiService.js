
import { logger } from '../config/logger.js';
import { executeTool } from './toolManager.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

/**
 * Generate a response using AI Provider (OpenAI or Gemini) with Tool Support.
 * @param {Object} config - { apiKey, provider, model, tools }
 * @param {string} systemInstruction - The system prompt
 * @param {string} userMessage - The user's input
 * @returns {Promise<string|null>} The generated response
 */
export const generateResponse = async ({ apiKey, provider = 'openai', modelString, tools = [], mediaUrl }, systemInstruction, userMessage) => {
    if (!apiKey) {
        logger.warn('AI Service: No API Key provided');
        return "Error: AI API Key not configured.";
    }

    try {
        if (provider === 'gemini') {
            return await generateGeminiResponse(apiKey, modelString || 'gemini-1.5-flash', tools, systemInstruction, userMessage, mediaUrl);
        } else {
            return await generateOpenAIResponse(apiKey, modelString || 'gpt-3.5-turbo', tools, systemInstruction, userMessage, mediaUrl);
        }
    } catch (error) {
        logger.error(`AI Service Exception (${provider}): ${error.message}`);
        return `Error generating response: ${error.message}`;
    }
};

// --- OpenAI Implementation ---
async function generateOpenAIResponse(apiKey, model, tools, systemInstruction, userMessage, mediaUrl) {
    const openai = new OpenAI({ apiKey });

    // Convert generic tools to OpenAI format
    const openaiTools = tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }
    }));

    const messages = [
        { role: 'system', content: systemInstruction }
    ];

    const userContent = [{ type: 'text', text: userMessage }];
    if (mediaUrl) {
        userContent.push({
            type: 'image_url',
            image_url: { url: mediaUrl }
        });
    }

    messages.push({ role: 'user', content: userContent });

    let keepGoing = true;
    let finalResponse = null;
    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (keepGoing && loopCount < MAX_LOOPS) {
        loopCount++;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Defaulting to a capable model, override if needed
            messages,
            tools: openaiTools.length > 0 ? openaiTools : undefined,
        });

        const choice = completion.choices[0];
        const responseMsg = choice.message;

        // Add assistant's message to history
        messages.push(responseMsg);

        if (responseMsg.tool_calls) {
            // Handle Tool Calls
            for (const toolCall of responseMsg.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);

                // Find internal tool config
                const toolDef = tools.find(t => t.name === functionName);
                if (toolDef) {
                    logger.info(`AI calling tool: ${functionName}`);
                    const toolResult = await executeTool(toolDef._internal, args);

                    messages.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: functionName,
                        content: JSON.stringify(toolResult)
                    });
                } else {
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: functionName,
                        content: JSON.stringify({ error: "Tool not found" })
                    });
                }
            }
            // Loop again to give AI the tool outputs
        } else {
            // No more tool calls, we have the final answer
            finalResponse = responseMsg.content;
            keepGoing = false;
        }
    }

    return finalResponse;
}

// --- Gemini Implementation ---
async function generateGeminiResponse(apiKey, modelName, tools, systemInstruction, userMessage, mediaUrl) {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Map tools to Gemini format
    // Gemini expects: tools: [{ functionDeclarations: [...] }]
    const geminiTools = tools.length > 0 ? [{
        function_declarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }))
    }] : undefined;

    const model = genAI.getGenerativeModel({
        model: modelName,
        tools: geminiTools,
        systemInstruction: systemInstruction
    });

    const chat = model.startChat({
        history: [] // We could pass previous history here
    });

    try {
        let promptParts = [userMessage];
        if (mediaUrl) {
            try {
                const response = await fetch(mediaUrl);
                const buffer = await response.arrayBuffer();
                const base64Data = Buffer.from(buffer).toString('base64');
                const contentType = response.headers.get('content-type') || 'image/jpeg';

                promptParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: contentType
                    }
                });
            } catch (fetchError) {
                logger.error("Failed to fetch media for Gemini: " + fetchError.message);
                // Continue with just text if image fails
            }
        }

        let result = await chat.sendMessage(promptParts);
        let response = result.response;
        let functionCalls = response.functionCalls();

        let loopCount = 0;
        const MAX_LOOPS = 5;

        while (functionCalls && functionCalls.length > 0 && loopCount < MAX_LOOPS) {
            loopCount++;
            logger.info(`Gemini requested function calls: ${functionCalls.length}`);

            const functionResponses = [];
            for (const call of functionCalls) {
                const toolDef = tools.find(t => t.name === call.name);
                if (toolDef) {
                    logger.info(`Executing Gemini tool: ${call.name}`);
                    const apiResult = await executeTool(toolDef._internal, call.args);

                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: apiResult } // Gemini expects 'response' field
                        }
                    });
                }
            }

            // Send tool results back to Gemini
            if (functionResponses.length > 0) {
                result = await chat.sendMessage(functionResponses);
                response = result.response;
                functionCalls = response.functionCalls();
            } else {
                break;
            }
        }

        return response.text();
    } catch (err) {
        logger.error("Gemini Error: " + err.message);
        throw err;
    }
}

/**
 * Generates an image based on a prompt.
 * Uses OpenAI DALL-E if provider is openai.
 * If provider is gemini, it first uses Gemini to "refine" or "beautify" the prompt for better visuals.
 * Falls back to free services like Hercai or Pollinations if API fails.
 */
export const generateImage = async (apiKey, provider, prompt) => {
    logger.info(`[IMAGE_GEN] Provider: ${provider}, API Key: ${apiKey ? 'PRESENT' : 'MISSING'}`);
    let currentPrompt = prompt;
    let refinedPrompt = null;

    // 1. Optional: Refine prompt with Gemini if available
    if (provider === 'gemini' && apiKey) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            // Use gemini-1.5-flash for best stability
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const refineSystem = "You are a professional prompt engineer for AI image generators (DALL-E, Midjourney). " +
                "Expand the user's simple prompt into a highly detailed, artistic, and descriptive visual prompt in English. " +
                "Keep it under 300 characters. Return ONLY the refined prompt text.";

            // Use simple string for better results in some library versions
            const result = await model.generateContent(`${refineSystem}\n\nUser Prompt: ${prompt}`);
            const text = result.response.text().trim();
            if (text) {
                logger.info(`Gemini refined prompt: ${text}`);
                refinedPrompt = text;
                currentPrompt = text;
            }
        } catch (e) {
            logger.error(`Gemini prompt refinement failed: ${e.message}`);
        }
    }

    // 2. Try OpenAI DALL-E 3
    if (provider === 'openai' && apiKey) {
        try {
            logger.info(`Generating DALL-E image for prompt: ${currentPrompt.substring(0, 50)}...`);
            const openai = new OpenAI({ apiKey });
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: currentPrompt,
                n: 1,
                size: "1024x1024",
                quality: "standard"
            });
            const url = response.data[0].url;
            return { url, refinedPrompt };
        } catch (error) {
            logger.error(`DALL-E Generation Failed: ${error.message}. Falling back.`);
        }
    }

    // 3. Fallback to Hercai (Best free alternative)
    try {
        const hercaiPrompt = currentPrompt.substring(0, 500);
        logger.info(`Trying Hercai for image: ${hercaiPrompt.substring(0, 50)}...`);
        // Try multiple models if one fails - Hercai often has SSL/Timeout issues on specific models
        const hercaiModels = ['v3', 'v3-beta', 'lexica', 'prodia', 'simurg', 'raava', 'shonin'];
        for (const m of hercaiModels) {
            try {
                const hercaiUrl = `https://api.hercai.com/v3/text2image?prompt=${encodeURIComponent(hercaiPrompt)}&model=${m}`;
                const response = await fetch(hercaiUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.url) {
                        logger.info(`Success with Hercai (${m}): ${data.url}`);
                        const imgRes = await fetch(data.url);
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            return { buffer: Buffer.from(buffer), url: data.url, refinedPrompt };
                        }
                        return { url: data.url, refinedPrompt };
                    }
                } else {
                    logger.warn(`Hercai (${m}) status: ${response.status}`);
                }
            } catch (innerE) {
                logger.warn(`Hercai (${m}) internal error: ${innerE.message}`);
            }
        }
    } catch (e) {
        logger.error(`Hercai overall failure: ${e.message}`);
    }

    // 4. Fallback to Pollinations (Multiple strategies)
    const seed = Math.floor(Math.random() * 1000000);
    const sanitizedPrompt = encodeURIComponent(currentPrompt.substring(0, 400));
    const candidates = [
        // Strictly public endpoints that don't require API keys
        `https://image.pollinations.ai/prompt/${sanitizedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`,
        `https://image.pollinations.ai/prompt/${sanitizedPrompt}?width=1024&height=1024&seed=${seed}&model=flux`
    ];

    for (const imageUrl of candidates) {
        try {
            logger.info(`Trying image fetch: ${imageUrl}`);
            const response = await fetch(imageUrl, {
                headers: {
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const contentType = response.headers.get('content-type') || '';
            if (response.ok && contentType.includes('image')) {
                const buffer = await response.arrayBuffer();
                logger.info(`Successfully fetched image buffer (${buffer.byteLength} bytes) from Pollinations`);
                return { buffer: Buffer.from(buffer), url: imageUrl, refinedPrompt };
            } else {
                const text = await response.text();
                logger.warn(`Pollinations fetch failed: ${response.status} ${contentType}. Body: ${text.substring(0, 100)}`);
            }
        } catch (fetchError) {
            logger.error(`Error fetching from Pollinations: ${fetchError.message}`);
        }
    }

    // 5. Ultimate Fallback: Valid PNG Buffer (Black square 1x1 to be safe)
    const placeholderBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    logger.warn(`All image providers failed. Returning fallback buffer.`);
    return { buffer: placeholderBuffer, refinedPrompt };
};
