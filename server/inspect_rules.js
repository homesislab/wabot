import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspectRules() {
    const rules = await prisma.rule.findMany({
        include: {
            credential: true,
            user: {
                select: {
                    id: true,
                    username: true,
                    credits: true,
                    isAiEnabled: true
                }
            }
        }
    });
    console.log("RULES IN DATABASE:");
    console.dir(rules, { depth: null });
}

inspectRules()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
