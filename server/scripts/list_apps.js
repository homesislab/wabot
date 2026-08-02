import { prisma } from '../src/prisma.js';

async function main() {
  const apps = await prisma.miniApp.findMany();
  console.log("MiniApps in Database:", JSON.stringify(apps, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
