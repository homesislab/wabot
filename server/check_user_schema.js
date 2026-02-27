
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserSchema() {
    try {
        const user = await prisma.user.findFirst();
        console.log("User fields:", Object.keys(user || {}));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUserSchema();
