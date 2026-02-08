
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
export const generateResponse = async ({ apiKey, provider = 'openai', modelString, tools = [] }, systemInstruction, userMessage) => {
    if (!apiKey) {
        logger.warn('AI Service: No API Key provided');
        return "Error: AI API Key not configured.";
    }

    try {
        if (provider === 'gemini') {
            return await generateGeminiResponse(apiKey, modelString || 'gemini-1.5-flash', tools, systemInstruction, userMessage);
        } else {
            return await generateOpenAIResponse(apiKey, modelString || 'gpt-3.5-turbo', tools, systemInstruction, userMessage);
        }
    } catch (error) {
        logger.error(`AI Service Exception (${provider}): ${error.message}`);
        return `Error generating response: ${error.message}`;
    }
};

// --- OpenAI Implementation ---
async function generateOpenAIResponse(apiKey, model, tools, systemInstruction, userMessage) {
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
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userMessage }
    ];

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
async function generateGeminiResponse(apiKey, modelName, tools, systemInstruction, userMessage) {
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
        let result = await chat.sendMessage(userMessage);
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
