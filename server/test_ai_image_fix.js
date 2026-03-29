import { generateImage } from './src/services/aiService.js';
import dotenv from 'dotenv';
import { logger } from './src/config/logger.js';
dotenv.config();

async function testGeneration() {
    // Try to get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    const provider = 'gemini';

    console.log(`Testing with Provider: ${provider}`);
    console.log(`API Key exists: ${!!apiKey}`);

    const prompt = "kucing astronot di planet mars";
    console.log(`Prompt: ${prompt}`);

    try {
        const result = await generateImage(apiKey, provider, prompt);
        console.log("Result:", JSON.stringify({
            hasUrl: !!result.url,
            hasBuffer: !!result.buffer,
            hasRefinedPrompt: !!result.refinedPrompt,
            refinedPrompt: result.refinedPrompt,
            url: result.url
        }, null, 2));

        if (result.buffer) {
            console.log(`Buffer received: ${result.buffer.byteLength} bytes`);
        }
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testGeneration();
