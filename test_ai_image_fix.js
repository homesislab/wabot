import { generateImage } from './server/src/services/aiService.js';
import dotenv from 'dotenv';
dotenv.config();

async function testGeneration() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const provider = process.env.GEMINI_API_KEY ? 'gemini' : 'openai';

    console.log(`Testing with Provider: ${provider}`);
    console.log(`API Key exists: ${!!apiKey}`);

    const prompt = "kucing astronot";
    console.log(`Prompt: ${prompt}`);

    try {
        const result = await generateImage(apiKey, provider, prompt);
        console.log("Result Structure:", JSON.stringify({
            hasUrl: !!result.url,
            hasBuffer: !!result.buffer,
            hasRefinedPrompt: !!result.refinedPrompt,
            url: result.url
        }, null, 2));

        if (result.refinedPrompt) {
            console.log("Refined Prompt:", result.refinedPrompt);
        }

        if (result.buffer) {
            console.log(`Buffer received: ${result.buffer.byteLength} bytes`);
        }
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testGeneration();
