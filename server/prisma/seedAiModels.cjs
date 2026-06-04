const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const initialModels = [
    { provider: 'gemini', value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Terbaru)' },
    { provider: 'gemini', value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { provider: 'gemini', value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Terbaik)' },
    { provider: 'gemini', value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Cepat)' },
    { provider: 'ollama', value: 'llama3', label: 'Llama 3' },
    { provider: 'ollama', value: 'llama3.1', label: 'Llama 3.1' },
    { provider: 'ollama', value: 'llama3.2', label: 'Llama 3.2' },
    { provider: 'ollama', value: 'mistral', label: 'Mistral' },
    { provider: 'ollama', value: 'gemma', label: 'Gemma' },
    { provider: 'ollama', value: 'gemma2', label: 'Gemma 2' },
    { provider: 'ollama', value: 'qwen', label: 'Qwen' },
    { provider: 'ollama', value: 'qwen2.5:1.5b', label: 'Qwen 2.5 (1.5B)' },
    { provider: 'ollama', value: 'phi3', label: 'Phi-3' },
];

async function main() {
    console.log('Seeding initial AI Models...');
    for (const model of initialModels) {
        await prisma.aiModel.create({
            data: model,
        });
    }
    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
