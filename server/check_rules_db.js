import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.rule.findMany({
        where: { triggerType: { in: ['MENTION', 'KEYWORD'] } }
    });
    console.log(JSON.stringify(rules, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
