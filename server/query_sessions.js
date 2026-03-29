import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const sessions = await prisma.session.findMany();
  console.log("WhatsApp Sessions:", sessions.map(s => ({ id: s.id, status: s.status })));

  const telegramBots = await prisma.telegramBot.findMany();
  console.log("Telegram Bots:", telegramBots.map(b => ({ id: b.id, name: b.name, isActive: b.isActive })));
}
main().finally(() => prisma.$disconnect());
