import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const all = await prisma.building.count();
  const zeros = await prisma.building.count({ where: { lat: 0, lng: 0 } });
  console.log(`Zeros: ${zeros} of ${all}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
