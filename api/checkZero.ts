import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const zeros = await prisma.building.findMany({ where: { lat: 0, lng: 0 }, select: { id: true, title: true } });
  console.log('Zero buildings:', zeros);
}
main().catch(console.error).finally(() => prisma.$disconnect());
