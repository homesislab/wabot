import { prisma } from './server/src/prisma.js';

async function fix() {
  const updated = await prisma.miniApp.updateMany({
    where: {
      triggerKeywords: {
        contains: '!outfit'
      }
    },
    data: {
      handlerType: 'STYLE_ANALYZER'
    }
  });
  console.log('Updated apps:', updated.count);
}
fix().catch(console.error).finally(() => prisma.$disconnect());
