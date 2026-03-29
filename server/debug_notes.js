import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("--- Checking Users ---");
    const users = await prisma.user.findMany();
    console.log(users.map(u => ({ id: u.id, username: u.username })));

    console.log("\n--- Checking Notes ---");
    const notes = await prisma.note.findMany();
    console.log(notes.map(n => ({ id: n.id, userId: n.userId, keyword: n.keyword })));

    console.log("\n--- Checking Telegram Bots ---");
    const bots = await prisma.telegramBot.findMany();
    console.log(bots.map(b => ({ id: b.id, name: b.name, userId: b.userId })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
