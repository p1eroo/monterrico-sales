import { PrismaClient } from './src/generated/prisma';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      data: {
        allowedAreas: ['comercial', 'flota'],
      },
    });
    console.log(`Updated ${result.count} users.`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
